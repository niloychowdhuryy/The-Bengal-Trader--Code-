// A closer look at a market design, beside the benchmarks and without changing them. It asks
// three things the fixed benchmarks can't: how much skill is really worth, which route and
// warehouse pairs the current data favours, and how long stalls take to recover.
import {
  MARKET_PORTS,
  SHIPYARD_PORTS,
  VESSEL_CLASSES,
  VESSEL_CLASS_IDS,
  buyPlayerShip,
  configureAutomatedTradeRoute,
  createNewGame,
  getCargoCapacity,
  getShipRoutePreview,
  planRouteJourney,
  type TownId,
  type VesselClassId,
} from "../game/model";
import { DAILY_RUNNING_COST, goodsAtReference } from "../game/npc";
import { createSim, sail, send } from "./driver";
import { measureRecovery, measureNpcWorlds, measureSustainedRoutes } from "./experiments";
import { tradeProfit } from "./ledger";
import { median, round } from "./metrics";
import { SIM_SEEDS, STRATEGIES, runStrategy, type StrategyDefinition } from "./runner";
import {
  expertTrader,
  farmCircuit,
  manual,
  planCargo,
  routeRules,
  skilledManual,
  skilledWithFarms,
  twoPort,
  uninformedTrader,
  warehouseRoute,
  type Strategy,
} from "./strategies";

const SKILL_DAYS = [30, 90, 200, 400, 800] as const;
const WAREHOUSE_DAYS = [200, 400] as const;
const WAREHOUSE_PAIRS_TESTED = 3;
const TWO_WAREHOUSES = 15_000;
const ROUTE_TRIAL_DAYS = 60;

function bot(id: string, strategy: () => Strategy, noise = 0): StrategyDefinition {
  return { id, label: id, strategy, noise, speed: 1 };
}

const mixed = STRATEGIES.find((entry) => entry.id === "mixed-active")!;

export const SKILL_CHECK: StrategyDefinition[] = [
  bot("uninformed", () => uninformedTrader, 0.15),
  bot("basic", () => manual, 0.15),
  mixed,
  bot("skilled", () => skilledManual()),
  bot("expert", () => expertTrader()),
  bot("skilled-farms", () => skilledWithFarms(6)),
  bot("expert-farms", () => expertTrader(6)),
  bot("farm-circuit", () => farmCircuit, 0.15),
];

function measureSkill() {
  return SKILL_CHECK.map((definition) => {
    const runs = SIM_SEEDS.map((seed) => runStrategy(definition, { seed, days: SKILL_DAYS }).result);
    return {
      id: definition.id,
      days: SKILL_DAYS.map((day, index) => {
        const snapshots = runs.map((run) => run.snapshots[index]);
        const middle = (pick: (snapshot: (typeof snapshots)[number]) => number) =>
          round(median(snapshots.map(pick)), 0);
        return {
          day,
          netWorth: middle((snapshot) => snapshot.netWorth),
          lowest: Math.min(...snapshots.map((snapshot) => snapshot.netWorth)),
          highest: Math.max(...snapshots.map((snapshot) => snapshot.netWorth)),
          rank: middle((snapshot) => snapshot.playerRank),
          trade: middle((snapshot) => tradeProfit(snapshot.ledger)),
          voyages: middle((snapshot) => snapshot.voyages),
          commands: middle((snapshot) => snapshot.commands),
          farms: middle((snapshot) => snapshot.farms),
          farmNet: middle((snapshot) => snapshot.ledger.farmRevenue - snapshot.ledger.cropCost),
        };
      }),
      refused: runs.reduce((total, run) => total + run.refused.length, 0),
    };
  });
}

/**
 * How much the choice of next port matters: from each port, the best round trip's profit per day
 * against a typical one, at a new game's prices. Near 1 means every choice is about as good.
 */
function measureChoice() {
  const state = createNewGame("Simulated");
  return MARKET_PORTS.map(({ id: from }) => {
    const here = { ...state, currentTown: from, selectedTown: from };
    const values = MARKET_PORTS.filter((port) => port.id !== from).map(({ id: to }) => {
      const time = getShipRoutePreview(here, to).travelTime;
      if (!time) return 0;
      const room = getCargoCapacity(here);
      const out = planCargo(here, from, to, room, state.coins).profit;
      const back = planCargo(here, to, from, room, state.coins).profit;
      return (out + back) / (2 * Math.max(0.5, time.durationDays));
    });
    const best = Math.max(...values);
    const typical = median(values);
    return { from, best: round(best, 0), typical: round(typical, 0), ratio: typical > 0 ? round(best / typical) : null };
  });
}

/** Which pair the data favours for a ship, chosen on the day it's set up, without hindsight. */
function chooseRoutePair(vessel: VesselClassId) {
  let best: { origin: TownId; destination: TownId; expectedPerDay: number } | null = null;
  for (const origin of SHIPYARD_PORTS) {
    for (const { id: destination } of MARKET_PORTS) {
      if (destination === origin || VESSEL_CLASSES[vessel].barredPorts.includes(destination)) continue;
      const base = createNewGame("Simulated");
      const rich = {
        ...base,
        coins: 250_000,
        highestCoins: 250_000,
        currentTown: origin,
        selectedTown: origin,
        visitedTowns: MARKET_PORTS.map((port) => port.id),
      };
      const bought = buyPlayerShip(rich, vessel).state;
      const shipId = bought.fleet.at(-1)!.id;
      const rules = routeRules(bought, origin, destination);
      if (rules.length === 0) continue;
      const routed = configureAutomatedTradeRoute(bought, shipId, destination, rules, 15_000);
      if (routed.error) continue;
      const outlook = planRouteJourney(routed.state, routed.state.fleet.at(-1)!);
      if (!outlook || outlook.margin === null) continue;
      const profit =
        outlook.outbound.sales + outlook.homebound.sales - outlook.outbound.cost - outlook.homebound.cost - outlook.runningCost;
      const days = outlook.runningCost / DAILY_RUNNING_COST[vessel];
      const expectedPerDay = profit / Math.max(1, days);
      if (!best || expectedPerDay > best.expectedPerDay) best = { origin, destination, expectedPerDay };
    }
  }
  return best;
}

function measureRouteOnPair(vessel: VesselClassId, origin: TownId, destination: TownId, days = 200) {
  const sim = createSim({ ...createNewGame("Simulated"), coins: 250_000, highestCoins: 250_000 });
  sail(sim, destination);
  if (sim.state.currentTown !== origin) sail(sim, origin);
  send(sim, { type: "buyShip", vesselClass: vessel });
  const shipId = sim.state.fleet.at(-1)!.id;
  const rules = routeRules(sim.state, origin, destination);
  if (rules.length === 0) return { coinsPerDay: 0, paybackDays: null, runningCost: 0 };
  send(sim, { type: "configureRoute", shipId, destination, rules, initialCapital: 15_000 });
  const startDay = sim.state.sailingDay;
  while (sim.state.sailingDay - startDay < days) {
    if (sim.state.shipHull <= 2) send(sim, { type: "repairShip" });
    sail(sim, sim.state.currentTown === origin ? destination : origin);
  }
  const ship = sim.state.fleet.find((entry) => entry.id === shipId)!;
  const perDay =
    (ship.automatedRoute!.capital + goodsAtReference(ship.cargo) - 15_000) / (sim.state.sailingDay - startDay);
  return {
    coinsPerDay: round(perDay),
    paybackDays: perDay > 0 ? round(VESSEL_CLASSES[vessel].price / perDay, 0) : null,
    runningCost: ship.automatedRoute!.runningCostPaid,
  };
}

/** The pair that earns most over a trial, as a player who tried several routes would find. */
function proveRoutePair(vessel: VesselClassId) {
  let best: { origin: TownId; destination: TownId; trialPerDay: number } | null = null;
  for (const origin of SHIPYARD_PORTS) {
    for (const { id: destination } of MARKET_PORTS) {
      if (destination === origin || VESSEL_CLASSES[vessel].barredPorts.includes(destination)) continue;
      const trial = measureRouteOnPair(vessel, origin, destination, ROUTE_TRIAL_DAYS).coinsPerDay;
      if (!best || trial > best.trialPerDay) best = { origin, destination, trialPerDay: trial };
    }
  }
  return best;
}

function measureRoutes() {
  return VESSEL_CLASS_IDS.map((vessel) => {
    const dayOne = chooseRoutePair(vessel);
    const proven = proveRoutePair(vessel);
    return {
      vessel,
      pair: dayOne,
      result: dayOne && measureRouteOnPair(vessel, dayOne.origin, dayOne.destination),
      provenPair: proven,
      provenResult: proven && measureRouteOnPair(vessel, proven.origin, proven.destination),
    };
  });
}

function measureWarehouses(pairs: { first: TownId; second: TownId }[]) {
  return pairs.map(({ first, second }) => {
    const compare = (make: () => Strategy) =>
      SIM_SEEDS.map((seed) => runStrategy(bot("pair", make), { seed, days: WAREHOUSE_DAYS }).result.snapshots);
    const plain = compare(() => twoPort(first, second));
    const stored = compare(() => warehouseRoute(first, second));
    return {
      first,
      second,
      days: WAREHOUSE_DAYS.map((day, index) => {
        const worth = (runs: typeof plain) => median(runs.map((run) => run[index].netWorth));
        const trade = (runs: typeof plain) => median(runs.map((run) => tradeProfit(run[index].ledger)));
        const extraPerDay = (trade(stored) - trade(plain)) / day;
        return {
          day,
          plainWorth: worth(plain),
          storedWorth: worth(stored),
          extraTrade: round(trade(stored) - trade(plain), 0),
          paybackDays: extraPerDay > 0 ? round(TWO_WAREHOUSES / extraPerDay, 0) : null,
        };
      }),
    };
  });
}

export function buildMarketCheck() {
  const sustained = measureSustainedRoutes(90);
  const pairs = sustained.slice(0, WAREHOUSE_PAIRS_TESTED).map(({ first, second }) => ({ first, second }));
  const fixed = { first: "hooghly" as TownId, second: "satgaon" as TownId };
  const withFixed = pairs.some((pair) => pair.first === fixed.first && pair.second === fixed.second)
    ? pairs
    : [...pairs, fixed];
  return {
    skill: measureSkill(),
    routes: measureRoutes(),
    warehouses: measureWarehouses(withFixed),
    topPairs: sustained.slice(0, 6),
    recovery: measureRecovery(),
    merchants: measureNpcWorlds(),
    choice: measureChoice(),
  };
}
