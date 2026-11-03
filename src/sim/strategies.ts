// Scripted players. They decide from what a player can see and act only through commands.
// They're competent rather than optimal, so results show a lower limit on what's possible.
import {
  FARM_PRICE,
  GOODS,
  MARKET_MAX_STOCK,
  MARKET_TARGET_STOCK,
  SHIPYARD_PORTS,
  TOWNS,
  UPGRADES,
  VESSEL_CLASSES,
  WAREHOUSE_PRICE,
  canSelectedShipReach,
  getCargoCapacity,
  getCargoUsed,
  getGoodPrice,
  getSelectedVesselClass,
  getShipMaximumHull,
  getShipRoutePreview,
  getTradeQuote,
  getWarehouseUsed,
  isHistoricalRouteAlertActive,
  type AutomatedTradeRule,
  type GameState,
  type GoodId,
  type TownId,
} from "../game/model";
import { sail, send, type Sim } from "./driver";

export interface BotContext {
  random: () => number;
  /** Share of error in how a bot judges opportunities. 0 means it judges exactly. */
  noise: number;
  reserved: Partial<Record<GoodId, number>>;
}

export type Strategy = (sim: Sim, context: BotContext) => void;

const MIN_DAYS_FOR_VALUE = 0.5;
const SELL_FLOOR = 0.9;
const CLEAR_HOLD_FLOOR = 0.6;

function alert(state: GameState): boolean {
  return isHistoricalRouteAlertActive(state);
}

export interface CargoPlan {
  units: Partial<Record<GoodId, number>>;
  profit: number;
}

/** Fills the hold one unit at a time with whichever unit earns most at the destination. */
export function planCargo(
  state: GameState,
  origin: TownId,
  destination: TownId,
  room: number,
  funds: number,
  goods: readonly GoodId[] = GOODS.map((good) => good.id),
): CargoPlan {
  const units: Partial<Record<GoodId, number>> = {};
  const routeAlert = alert(state);
  let profit = 0;
  let money = funds;
  for (let slot = 0; slot < room; slot += 1) {
    let bestGood: GoodId | null = null;
    let bestMargin = 0;
    let bestPrice = 0;
    for (const good of goods) {
      const count = units[good] ?? 0;
      const stock = state.marketStock[origin][good] - count;
      const destinationStock = state.marketStock[destination][good] + count;
      if (stock <= 0 || destinationStock >= MARKET_MAX_STOCK) continue;
      const buy = getGoodPrice(origin, good, "buy", routeAlert, stock);
      const sell = getGoodPrice(destination, good, "sell", routeAlert, destinationStock);
      if (buy <= money && sell - buy > bestMargin) {
        bestGood = good;
        bestMargin = sell - buy;
        bestPrice = buy;
      }
    }
    if (!bestGood) break;
    units[bestGood] = (units[bestGood] ?? 0) + 1;
    profit += bestMargin;
    money -= bestPrice;
  }
  return { units, profit };
}

function buyPlan(sim: Sim, plan: CargoPlan): void {
  for (const [good, quantity] of Object.entries(plan.units) as [GoodId, number][]) {
    send(sim, { type: "buyGood", good, quantity });
  }
}

function room(state: GameState): number {
  return getCargoCapacity(state) - getCargoUsed(state);
}

/** Sells what's worth selling, keeping goods promised to a contract. */
function sellCargo(sim: Sim, context: BotContext): void {
  for (const { id: good } of GOODS) {
    const state = sim.state;
    const available = state.cargo[good] - (context.reserved[good] ?? 0);
    if (available <= 0) continue;
    const stock = state.marketStock[state.currentTown][good];
    const cost = state.averagePurchasePrice[good];
    const floor = getCargoUsed(state) > getCargoCapacity(state) / 2 ? CLEAR_HOLD_FLOOR : SELL_FLOOR;
    let quantity = 0;
    while (quantity < available && stock + quantity < MARKET_MAX_STOCK) {
      const price = getGoodPrice(state.currentTown, good, "sell", alert(state), stock + quantity);
      if (price < cost * floor) break;
      quantity += 1;
    }
    if (quantity > 0) send(sim, { type: "sellGood", good, quantity });
  }
}

function repairIfNeeded(sim: Sim): void {
  const state = sim.state;
  const maximum = getShipMaximumHull(state);
  const cost = (maximum - state.shipHull) * getSelectedVesselClass(state).repairCostPerHull;
  if (state.shipHull <= maximum / 2 && state.coins >= cost) {
    send(sim, { type: "repairShip" });
  }
}

function buyHoldUpgrade(sim: Sim, reserve: number): void {
  const state = sim.state;
  const hold = UPGRADES.find((upgrade) => upgrade.id === "hold")!;
  const cost = hold.baseCost * (state.upgrades.hold + 1);
  if (state.upgrades.hold < hold.maxLevel && state.coins >= cost + reserve) {
    send(sim, { type: "buyUpgrade", upgrade: "hold" });
  }
}

interface Destination {
  port: TownId;
  plan: CargoPlan;
  value: number;
}

/** The best next port by estimated profit per day, with a little judgement error. */
function bestDestination(
  sim: Sim,
  context: BotContext,
  bonus: (port: TownId) => number = () => 0,
): Destination {
  const state = sim.state;
  let best: Destination | null = null;
  for (const town of TOWNS) {
    if (town.id === state.currentTown) continue;
    const time = getShipRoutePreview(state, town.id).travelTime;
    if (!time) continue;
    const plan = planCargo(state, state.currentTown, town.id, room(state), state.coins);
    const judged = 1 + context.noise * (context.random() - 0.5) * 2;
    const value = ((plan.profit + bonus(town.id)) * judged) /
      Math.max(MIN_DAYS_FOR_VALUE, time.durationDays);
    if (!best || value > best.value) best = { port: town.id, plan, value };
  }
  if (!best) throw new Error("The ship has nowhere to sail.");
  return best;
}

function goTo(sim: Sim, destination: TownId): void {
  if (!sail(sim, destination)) {
    throw new Error(`The bot couldn't sail to ${destination}.`);
  }
}

function tradeAndSail(sim: Sim, context: BotContext, bonus?: (port: TownId) => number): void {
  const next = bestDestination(sim, context, bonus);
  buyPlan(sim, next.plan);
  goTo(sim, next.port);
}

/** Does no trading beyond clearing the starting hold, and only keeps the days moving. */
export const passive: Strategy = (sim, context) => {
  sellCargo(sim, context);
  repairIfNeeded(sim);
  goTo(sim, sim.state.currentTown === "dhaka" ? "sonargaon" : "dhaka");
};

/** Repeats one route forever, carrying whatever pays best each way. */
export function twoPort(first: TownId, second: TownId): Strategy {
  return (sim, context) => {
    const state = sim.state;
    sellCargo(sim, context);
    repairIfNeeded(sim);
    if (state.currentTown !== first && state.currentTown !== second) {
      goTo(sim, first);
      return;
    }
    const destination = state.currentTown === first ? second : first;
    buyPlan(
      sim,
      planCargo(sim.state, sim.state.currentTown, destination, room(sim.state), sim.state.coins),
    );
    goTo(sim, destination);
  };
}

/** Roams to the best opportunity and spends on a bigger hold. */
export const manual: Strategy = (sim, context) => {
  sellCargo(sim, context);
  repairIfNeeded(sim);
  buyHoldUpgrade(sim, 3_000);
  tradeAndSail(sim, context);
};

const ROUTE_CAPITAL = 15_000;
const ROUTE_SHIP_RESERVE = 5_000;

export function routeRules(state: GameState, origin: TownId, destination: TownId): AutomatedTradeRule[] {
  return GOODS.flatMap((good) => {
    const buy = getGoodPrice(origin, good.id, "buy", false, state.marketStock[origin][good.id]);
    const sell = getGoodPrice(destination, good.id, "sell", false, state.marketStock[destination][good.id]);
    return sell > buy
      ? [{ good: good.id, buyAtOrigin: true, sellAtDestination: true }]
      : [];
  });
}

/** Buys a bulk ship at a shipyard and sets it on the best route among ports already seen. */
function buyRouteShip(sim: Sim): boolean {
  const state = sim.state;
  if (!SHIPYARD_PORTS.includes(state.currentTown)) return false;
  const vessel = VESSEL_CLASSES.patello;
  if (state.coins < vessel.price + ROUTE_CAPITAL + ROUTE_SHIP_RESERVE) return false;

  let bestPort: TownId | null = null;
  let bestRules: AutomatedTradeRule[] = [];
  let bestMargin = 0;
  for (const port of state.visitedTowns) {
    if (port === state.currentTown || vessel.barredPorts.includes(port)) continue;
    const rules = routeRules(state, state.currentTown, port);
    const margin = rules.reduce(
      (total, rule) =>
        total +
        getGoodPrice(port, rule.good, "sell", false, state.marketStock[port][rule.good]) -
        getGoodPrice(state.currentTown, rule.good, "buy", false, state.marketStock[state.currentTown][rule.good]),
      0,
    );
    if (margin > bestMargin) {
      bestPort = port;
      bestRules = rules;
      bestMargin = margin;
    }
  }
  if (!bestPort) return false;

  send(sim, { type: "buyShip", vesselClass: "patello" });
  const ship = sim.state.fleet.at(-1)!;
  send(sim, {
    type: "configureRoute",
    shipId: ship.id,
    destination: bestPort,
    rules: bestRules,
    initialCapital: ROUTE_CAPITAL,
  });
  return true;
}

function wantsRouteShip(state: GameState, limit: number): boolean {
  return (
    state.fleet.length - 1 < limit &&
    state.coins >= VESSEL_CLASSES.patello.price + ROUTE_CAPITAL + ROUTE_SHIP_RESERVE
  );
}

/** Trades by hand until it can afford bulk ships, then leaves them running on routes. */
export function automated(shipLimit = 2): Strategy {
  return (sim, context) => {
    sellCargo(sim, context);
    repairIfNeeded(sim);
    buyHoldUpgrade(sim, 3_000);
    if (wantsRouteShip(sim.state, shipLimit)) {
      if (!buyRouteShip(sim) && !SHIPYARD_PORTS.includes(sim.state.currentTown)) {
        goTo(sim, "hooghly");
        return;
      }
    }
    tradeAndSail(sim, context);
  };
}

const WAREHOUSE_RESERVE = 5_000;
const WAREHOUSE_BUY_PER_VISIT = 4;

/**
 * Runs one route with a warehouse at each end, buying a few units whenever a stall has
 * recovered and loading them later, so a full hold needn't be bought at one high price.
 */
export function warehouseRoute(first: TownId, second: TownId): Strategy {
  return (sim, context) => {
    sellCargo(sim, context);
    repairIfNeeded(sim);
    const here = sim.state.currentTown;
    if (here !== first && here !== second) {
      goTo(sim, first);
      return;
    }
    const destination = here === first ? second : first;

    if (
      !sim.state.ownedWarehouses.includes(here) &&
      sim.state.coins >= WAREHOUSE_PRICE + WAREHOUSE_RESERVE
    ) {
      send(sim, { type: "buyWarehouse" });
    }

    if (sim.state.ownedWarehouses.includes(here)) {
      for (const { id: good } of GOODS) {
        while (sim.state.warehouseStock[here][good] > 0 && room(sim.state) > 0) {
          send(sim, { type: "retrieveGood", good });
        }
      }
    }
    buyPlan(sim, planCargo(sim.state, here, destination, room(sim.state), sim.state.coins));

    if (sim.state.ownedWarehouses.includes(here)) {
      for (let unit = 0; unit < WAREHOUSE_BUY_PER_VISIT; unit += 1) {
        const state = sim.state;
        if (getWarehouseUsed(state, here) >= 20) break;
        const stored = planCargo(state, here, destination, 1, state.coins);
        const good = (Object.keys(stored.units) as GoodId[])[0];
        if (!good || state.marketStock[here][good] < MARKET_TARGET_STOCK) break;
        // A full hold leaves nowhere to put a purchase on its way to the warehouse.
        if (room(state) <= 0) {
          const carried = GOODS.find((item) => state.cargo[item.id] > 0)?.id;
          if (!carried) break;
          send(sim, { type: "storeGood", good: carried });
          continue;
        }
        send(sim, { type: "buyGood", good, quantity: 1 });
        send(sim, { type: "storeGood", good });
      }
    }
    goTo(sim, destination);
  };
}

const MAX_FARMS = 6;
const FARM_RESERVE = 5_000;

function workFarm(sim: Sim, reserve: number, limit: number): void {
  const state = sim.state;
  if (
    state.ownedFarms.length < limit &&
    !state.ownedFarms.includes(state.currentTown) &&
    state.coins >= FARM_PRICE + reserve
  ) {
    send(sim, { type: "buyFarm" });
  }
  if (
    sim.state.ownedFarms.includes(sim.state.currentTown) &&
    sim.state.farmOutput[sim.state.currentTown] > 0 &&
    room(sim.state) > 0
  ) {
    send(sim, { type: "collectFarm" });
  }
}

/** Trades to fund farms, then collects them whenever it passes through. */
export const farming: Strategy = (sim, context) => {
  sellCargo(sim, context);
  repairIfNeeded(sim);
  workFarm(sim, FARM_RESERVE, MAX_FARMS);
  sellCargo(sim, context);
  tradeAndSail(sim, context);
};

function contractBonus(state: GameState, port: TownId): number {
  return state.missions
    .filter((mission) => mission.status === "active" && mission.destination === port)
    .filter((mission) =>
      mission.good === null || state.cargo[mission.good] >= mission.quantity - mission.progress,
    )
    .reduce((total, mission) => total + mission.rewardCoins, 0);
}

function takeContracts(sim: Sim, context: BotContext): void {
  for (const mission of sim.state.missions) {
    if (
      mission.status !== "available" ||
      mission.origin !== sim.state.currentTown ||
      mission.type === "profitable_trade" ||
      sim.state.missions.filter((entry) => entry.status === "active").length >= 2 ||
      !canSelectedShipReach(sim.state, mission.destination)
    ) {
      continue;
    }
    if (mission.good !== null) {
      const quote = getTradeQuote(sim.state, mission.origin, mission.good, "buy", mission.quantity);
      if (!quote || quote.total >= sim.state.coins || room(sim.state) < mission.quantity) continue;
      // The goods are handed over, so the reward has to cover them.
      if (mission.rewardCoins <= quote.total) continue;
    }
    send(sim, { type: "acceptMission", missionId: mission.id });
    if (mission.good !== null) {
      send(sim, { type: "buyGood", good: mission.good, quantity: mission.quantity });
    }
  }
  // Goods promised to a contract are only sold if it's over.
  context.reserved = {};
  for (const mission of sim.state.missions) {
    if (mission.status === "active" && mission.good !== null) {
      context.reserved[mission.good] =
        (context.reserved[mission.good] ?? 0) + mission.quantity - mission.progress;
    }
  }
}

/** Uses a bit of everything: contracts, a bigger hold, a route ship and a couple of farms. */
export const mixed: Strategy = (sim, context) => {
  takeContracts(sim, context);
  sellCargo(sim, context);
  repairIfNeeded(sim);
  buyHoldUpgrade(sim, 3_000);
  if (wantsRouteShip(sim.state, 1)) {
    if (!buyRouteShip(sim) && !SHIPYARD_PORTS.includes(sim.state.currentTown)) {
      goTo(sim, "hooghly");
      return;
    }
  }
  if (sim.state.fleet.length > 1) workFarm(sim, 15_000, 2);
  takeContracts(sim, context);
  tradeAndSail(sim, context, (port) => contractBonus(sim.state, port));
};
