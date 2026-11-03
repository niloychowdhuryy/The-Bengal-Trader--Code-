// Focused measurements of one behaviour each: route income, stock recovery, the NPC world
// and known exploits. Each returns plain data, so it can be recorded and compared later.
import { applyCommand } from "../game/commands";
import {
  FARM_DAILY_OUTPUT,
  FARM_PRICE,
  GOODS,
  MARKET_MAX_STOCK,
  MARKET_PORTS,
  TOWNS,
  VESSEL_CLASSES,
  VESSEL_CLASS_IDS,
  advanceMarketStock,
  advanceNpcWorld,
  createInitialMarketStock,
  createNewGame,
  getGoodPrice,
  getShipRouteConditions,
  getTradeQuote,
  type GameState,
  type GoodId,
  type MarketPortId,
  type TownId,
  type VesselClassId,
} from "../game/model";
import { planRiverRoute } from "../game/navigation";
import { getRouteTravelTime } from "../game/travel-time";
import { arrive, createSim, depart, sail, send } from "./driver";
import { fromTop, measureMarket, median, npcWorth, round } from "./metrics";
import { runStrategy } from "./runner";
import { manual, routeRules, twoPort } from "./strategies";

// ---- Routes ----

function vesselRouteDays(from: TownId, to: TownId, vessel: VesselClassId): number | null {
  const route = planRiverRoute(from, to, getShipRouteConditions({}, vessel));
  return route
    ? getRouteTravelTime(route, false, VESSEL_CLASSES[vessel].travelFactor).durationDays
    : null;
}

export interface FirstTrip {
  from: TownId;
  to: TownId;
  good: GoodId;
  units: number;
  profit: number;
  days: number;
  profitPerDay: number;
}

/** The best single cargo for each route from fresh markets, for one vessel with an empty hold. */
export function measureFirstTrips(vesselClass: VesselClassId): FirstTrip[] {
  const stock = createInitialMarketStock();
  const hold = VESSEL_CLASSES[vesselClass].baseHold;
  const trips: FirstTrip[] = [];
  for (const from of TOWNS) {
    for (const to of TOWNS) {
      if (from.id === to.id) continue;
      const days = vesselRouteDays(from.id, to.id, vesselClass);
      if (days === null) continue;
      let best: FirstTrip | null = null;
      for (const { id: good } of GOODS) {
        let cost = 0;
        let revenue = 0;
        for (let units = 1; units <= hold && units <= stock[from.id][good]; units += 1) {
          const destinationStock = stock[to.id][good] + units - 1;
          if (destinationStock >= MARKET_MAX_STOCK) break;
          cost += getGoodPrice(from.id, good, "buy", false, stock[from.id][good] - units + 1);
          revenue += getGoodPrice(to.id, good, "sell", false, destinationStock);
          if (!best || revenue - cost > best.profit) {
            best = {
              from: from.id,
              to: to.id,
              good,
              units,
              profit: revenue - cost,
              days: round(days),
              profitPerDay: round((revenue - cost) / days, 1),
            };
          }
        }
      }
      if (best && best.profit > 0) trips.push(best);
    }
  }
  return trips.sort((a, b) => b.profitPerDay - a.profitPerDay);
}

export interface VesselRouteSummary {
  vessel: VesselClassId;
  routes: number;
  profitableRoutes: number;
  best: FirstTrip | null;
  topTenthPerDay: number;
  medianPerDay: number;
  /** How far the best route is ahead of the top tenth. */
  dominance: number;
}

export function summariseFirstTrips(): VesselRouteSummary[] {
  return VESSEL_CLASS_IDS.map((vessel) => {
    const trips = measureFirstTrips(vessel);
    const reachable = TOWNS.flatMap((from) =>
      TOWNS.filter(
        (to) => from.id !== to.id && vesselRouteDays(from.id, to.id, vessel) !== null,
      ),
    ).length;
    const perDay = trips.map((trip) => trip.profitPerDay);
    const padded = [...perDay, ...Array<number>(reachable - perDay.length).fill(0)];
    const topTenth = fromTop(padded, 0.1);
    return {
      vessel,
      routes: reachable,
      profitableRoutes: trips.length,
      best: trips[0] ?? null,
      topTenthPerDay: topTenth,
      medianPerDay: median(padded),
      dominance: topTenth > 0 ? round((trips[0]?.profitPerDay ?? 0) / topTenth, 1) : 0,
    };
  });
}

export interface SustainedRoute {
  first: TownId;
  second: TownId;
  goldPerDay: number;
  /** Earnings per day late in the run against early on. Below 1 means the route tired. */
  lateVsEarly: number;
}

/** Runs every pair of ports as a real two-port loop, through commands. */
export function measureSustainedRoutes(days = 90): SustainedRoute[] {
  const results: SustainedRoute[] = [];
  const early = Math.round(days / 3);
  for (let i = 0; i < TOWNS.length; i += 1) {
    for (let j = i + 1; j < TOWNS.length; j += 1) {
      const first = TOWNS[i].id;
      const second = TOWNS[j].id;
      const { result } = runStrategy(
        { id: `${first}-${second}`, strategy: () => twoPort(first, second), noise: 0, speed: 1 },
        { days: [early, days] },
      );
      const [start, end] = result.snapshots;
      const earlyRate = (start.gold - 90) / start.sailingDay;
      const lateRate = (end.gold - start.gold) / (end.sailingDay - start.sailingDay);
      results.push({
        first,
        second,
        goldPerDay: round((end.gold - 90) / end.sailingDay),
        lateVsEarly: earlyRate > 0 ? round(lateRate / earlyRate) : 0,
      });
    }
  }
  return results.sort((a, b) => b.goldPerDay - a.goldPerDay);
}

// ---- Stock recovery ----

export interface RecoveryCase {
  label: string;
  startStock: number;
  targetStock: number;
  daysToHalfway: number;
  daysToFull: number;
}

function daysToRecover(port: MarketPortId, good: GoodId, startStock: number, target: number) {
  let market: GameState["marketStock"] = {
    ...createInitialMarketStock(),
    [port]: { ...createInitialMarketStock()[port], [good]: startStock },
  };
  const gap = Math.abs(target - startStock);
  let daysToHalfway = 0;
  let day = 0;
  while (market[port][good] !== target && day < 400) {
    market = advanceMarketStock(market, 1);
    day += 1;
    if (!daysToHalfway && Math.abs(target - market[port][good]) <= gap / 2) daysToHalfway = day;
  }
  return { daysToHalfway, daysToFull: day };
}

export function measureRecovery(): RecoveryCase[] {
  const start = createInitialMarketStock();
  const port: MarketPortId = "dhaka";
  const good: GoodId = "silk";
  const target = start[port][good];
  return [
    { label: "Stall emptied", startStock: 0 },
    { label: "Stall half emptied", startStock: Math.floor(target / 2) },
    { label: "Stall full", startStock: MARKET_MAX_STOCK },
  ].map(({ label, startStock }) => ({
    label,
    startStock,
    targetStock: target,
    ...daysToRecover(port, good, startStock, target),
  }));
}

// ---- Investments ----

export interface RouteShipReturn {
  vessel: VesselClassId;
  price: number;
  route: string;
  capitalStart: number;
  capitalEnd: number;
  goldPerDay: number;
  paybackDays: number | null;
}

/** What one automated ship earns on its own, while the player only keeps the days moving. */
export function measureRouteShip(
  vessel: VesselClassId,
  origin: TownId = "hooghly",
  destination: TownId = "tanda",
  days = 200,
): RouteShipReturn {
  const capitalStart = 300;
  const sim = createSim({ ...createNewGame("Simulated"), gold: 5_000, highestGold: 5_000 });
  sail(sim, destination);
  sail(sim, origin);
  send(sim, { type: "buyShip", vesselClass: vessel });
  const shipId = sim.state.fleet.at(-1)!.id;
  send(sim, {
    type: "configureRoute",
    shipId,
    destination,
    rules: routeRules(sim.state, origin, destination),
    initialCapital: capitalStart,
  });
  const startDay = sim.state.sailingDay;
  while (sim.state.sailingDay - startDay < days) {
    if (sim.state.shipHull <= 2) send(sim, { type: "repairShip" });
    sail(sim, sim.state.currentTown === "hooghly" ? "satgaon" : "hooghly");
  }
  const capitalEnd = sim.state.fleet.find((ship) => ship.id === shipId)!.automatedRoute!.capital;
  const perDay = (capitalEnd - capitalStart) / (sim.state.sailingDay - startDay);
  return {
    vessel,
    price: VESSEL_CLASSES[vessel].price,
    route: `${origin}>${destination}`,
    capitalStart,
    capitalEnd,
    goldPerDay: round(perDay),
    paybackDays: perDay > 0 ? round(VESSEL_CLASSES[vessel].price / perDay, 0) : null,
  };
}

/** Days for one farm to repay its price, selling each day's free rice at a typical price. */
export function measureFarmPayback(): { riceSellMedian: number; goldPerDay: number; paybackDays: number } {
  const start = createInitialMarketStock();
  const riceSellMedian = median(
    MARKET_PORTS.map((port) => getGoodPrice(port.id, "rice", "sell", false, start[port.id].rice)),
  );
  const goldPerDay = riceSellMedian * FARM_DAILY_OUTPUT;
  return { riceSellMedian, goldPerDay, paybackDays: round(FARM_PRICE / goldPerDay, 0) };
}

export interface ContractValue {
  type: string;
  count: number;
  averageReward: number;
  averageGoodsCost: number;
  worthDoing: number;
}

/** Whether contracts pay for the goods handed over, priced at the starting market. */
export function measureContracts(): ContractValue[] {
  const state = createNewGame("Simulated");
  const types = [...new Set(state.missions.map((mission) => mission.type))];
  return types.map((type) => {
    const missions = state.missions.filter((mission) => mission.type === type);
    const costs = missions.map((mission) =>
      mission.good !== null && mission.quantity > 0
        ? getTradeQuote(state, mission.origin, mission.good, "buy", mission.quantity)?.total ?? 0
        : 0,
    );
    return {
      type,
      count: missions.length,
      averageReward: round(missions.reduce((total, mission) => total + mission.rewardGold, 0) / missions.length),
      averageGoodsCost: round(costs.reduce((total, cost) => total + cost, 0) / missions.length),
      worthDoing: missions.filter((mission, index) => mission.rewardGold > costs[index]).length,
    };
  });
}

// ---- NPC world ----

export interface NpcReport {
  id: string;
  name: string;
  purseAt: Record<number, number>;
  worthAt: Record<number, number>;
  trips: number;
  unitsBought: number;
  unitsSold: number;
  lastTradeDay: number;
  daysDockedWithCargo: number;
  /** Sales income lost to the purse limit. An estimate from prices at the start of the day. */
  estimatedIncomeLostToCap: number;
}

export interface NpcWorldReport {
  days: number;
  merchants: NpcReport[];
  marketAt: Record<number, ReturnType<typeof measureMarket>>;
  /** Merchants that made no trade in the final 50 days. */
  stalledAtEnd: number;
  unitsMovedPerDay: number;
}

/**
 * Advances only the world, one day at a time, with no player in it. It calls the same
 * world functions an arrival does, but steps them daily so every trade can be counted.
 */
export function measureNpcWorld(days = 200, marks: readonly number[] = [30, 90, 200]): NpcWorldReport {
  let state = createNewGame("Simulated");
  const reports = new Map<string, NpcReport>(
    state.npcMerchants.map((merchant) => [
      merchant.id,
      {
        id: merchant.id,
        name: merchant.name,
        purseAt: {},
        worthAt: {},
        trips: 0,
        unitsBought: 0,
        unitsSold: 0,
        lastTradeDay: 0,
        daysDockedWithCargo: 0,
        estimatedIncomeLostToCap: 0,
      },
    ]),
  );
  const marketAt: NpcWorldReport["marketAt"] = {};

  const units = (cargo: Record<GoodId, number>) =>
    GOODS.reduce((total, good) => total + cargo[good.id], 0);

  for (let day = 1; day <= days; day += 1) {
    const before = state;
    const recovered = advanceMarketStock(before.marketStock, 1);
    state = advanceNpcWorld({ ...before, sailingDay: day, marketStock: recovered }, day);

    for (const merchant of state.npcMerchants) {
      const previous = before.npcMerchants.find((entry) => entry.id === merchant.id)!;
      const report = reports.get(merchant.id)!;
      const change = units(merchant.cargo) - units(previous.cargo);
      if (change > 0) report.unitsBought += change;
      if (change < 0) report.unitsSold -= change;
      if (change !== 0) report.lastTradeDay = day;
      if (previous.phase === "docked" && merchant.phase === "traveling") report.trips += 1;
      if (merchant.phase === "docked" && units(merchant.cargo) > 0) report.daysDockedWithCargo += 1;
      if (change < 0) {
        let revenue = 0;
        for (const { id: good } of GOODS) {
          const sold = previous.cargo[good] - merchant.cargo[good];
          for (let unit = 0; unit < sold; unit += 1) {
            revenue += getGoodPrice(
              merchant.currentPort,
              good,
              "sell",
              false,
              recovered[merchant.currentPort][good] + unit,
            );
          }
        }
        report.estimatedIncomeLostToCap += Math.max(0, revenue - (merchant.budget - previous.budget));
      }
    }

    if (marks.includes(day)) {
      marketAt[day] = measureMarket(state);
      for (const merchant of state.npcMerchants) {
        const report = reports.get(merchant.id)!;
        report.purseAt[day] = merchant.budget;
        report.worthAt[day] = npcWorth(merchant);
      }
    }
  }

  const merchants = [...reports.values()];
  return {
    days,
    merchants,
    marketAt,
    stalledAtEnd: merchants.filter((merchant) => merchant.lastTradeDay <= days - 50).length,
    unitsMovedPerDay: round(
      merchants.reduce((total, merchant) => total + merchant.unitsBought + merchant.unitsSold, 0) / days,
    ),
  };
}

// ---- Exploits ----

export interface SamePortStall {
  port: MarketPortId;
  good: GoodId;
  startStock: number;
  /** Stock at which buying one unit and selling it back first earns money. */
  profitableBelowStock: number;
  unitsToDrain: number;
  costToDrain: number;
  profitPerLoop: number;
}

/**
 * A pure check of every stall at its starting stock, using only the game's price function.
 * A sale is priced from stock after the purchase, so a loop can profit where stock is low.
 */
export function findSamePortLoops(): SamePortStall[] {
  const start = createInitialMarketStock();
  const stalls: SamePortStall[] = [];
  for (const port of MARKET_PORTS) {
    for (const { id: good } of GOODS) {
      const startStock = start[port.id][good];
      let cost = 0;
      for (let stock = startStock; stock >= 1; stock -= 1) {
        const buy = getGoodPrice(port.id, good, "buy", false, stock);
        cost += buy;
        const profit = getGoodPrice(port.id, good, "sell", false, stock - 1) - buy;
        if (profit > 0) {
          stalls.push({
            port: port.id,
            good,
            startStock,
            profitableBelowStock: stock,
            unitsToDrain: startStock - stock + 1,
            costToDrain: cost,
            profitPerLoop: profit,
          });
          break;
        }
      }
    }
  }
  return stalls.sort((a, b) => a.costToDrain - b.costToDrain);
}

export interface SamePortDemo {
  port: MarketPortId;
  good: GoodId;
  dayStarted: number;
  goldBeforeDraining: number;
  unitsBought: number;
  loops: number;
  goldGained: number;
  gainPerLoop: number;
  inGameDaysUsed: number;
  commandsRejected: number;
}

/**
 * Proves the loop in real play: a new game trades up to the money it needs, sails there,
 * drains the stall, then buys and sells back through normal commands. No state is edited.
 */
export function demonstrateSamePortLoop(loops = 200): SamePortDemo | null {
  const reachable = findSamePortLoops().filter((stall) => stall.unitsToDrain <= VESSEL_CLASSES["river-boat"].baseHold);
  const target = reachable[0];
  if (!target) return null;

  const { sim } = runStrategy(
    { id: "exploit-setup", strategy: () => manual, noise: 0, speed: 1 },
    { days: [1] },
  );
  const context = { random: () => 0.5, noise: 0, reserved: {} };
  const goldNeeded = target.costToDrain + 60;
  let guard = 0;
  while (sim.state.gold < goldNeeded && guard < 2_000) {
    manual(sim, context);
    guard += 1;
  }
  if (sim.state.gold < goldNeeded) return null;

  // Empty the hold so the whole drain fits, and never sell into the target stall first.
  for (const { id: good } of GOODS) {
    if (sim.state.cargo[good] > 0) {
      send(sim, { type: "sellGood", good, quantity: sim.state.cargo[good] });
    }
  }
  if (sim.state.currentTown !== target.port) {
    depart(sim, target.port);
    arrive(sim);
    for (const { id: good } of GOODS) {
      if (sim.state.cargo[good] > 0) {
        send(sim, { type: "sellGood", good, quantity: sim.state.cargo[good] });
      }
    }
  }

  const dayStarted = round(sim.state.sailingDay);
  const goldBeforeDraining = sim.state.gold;
  // Buy down to the stock where the loop first pays, however far time has moved it.
  let unitsBought = 0;
  while (true) {
    const stock = sim.state.marketStock[target.port][target.good];
    if (stock < 1) break;
    const profit =
      getGoodPrice(target.port, target.good, "sell", false, stock - 1) -
      getGoodPrice(target.port, target.good, "buy", false, stock);
    if (profit > 0) break;
    const result = send(sim, { type: "buyGood", good: target.good, quantity: 1 });
    if (result.status !== "applied") return null;
    unitsBought += 1;
  }

  const goldAtLoopStart = sim.state.gold;
  const dayAtLoopStart = sim.state.sailingDay;
  const refusedBefore = sim.refused.length;
  for (let loop = 0; loop < loops; loop += 1) {
    send(sim, { type: "buyGood", good: target.good, quantity: 1 });
    send(sim, { type: "sellGood", good: target.good, quantity: 1 });
  }
  const goldGained = sim.state.gold - goldAtLoopStart;
  return {
    port: target.port,
    good: target.good,
    dayStarted,
    goldBeforeDraining,
    unitsBought,
    loops,
    goldGained,
    gainPerLoop: round(goldGained / loops),
    inGameDaysUsed: round(sim.state.sailingDay - dayAtLoopStart),
    commandsRejected: sim.refused.length - refusedBefore,
  };
}

/** The stall most exposed once a stall is near empty, on the game's own quotes. */
export function measureLoopAtLowStock(
  port: MarketPortId,
  good: GoodId,
  stocks: readonly number[] = [20, 12, 8, 5, 2],
): { stock: number; goldPer100Loops: number }[] {
  return stocks.map((stock) => {
    const fresh = createNewGame("Simulated");
    let state: GameState = {
      ...fresh,
      gold: 100_000,
      highestGold: 100_000,
      currentTown: port,
      selectedTown: port,
      visitedTowns: [...new Set([...fresh.visitedTowns, port])],
      fleet: fresh.fleet.map((ship) => ({ ...ship, currentPort: port })),
      marketStock: { ...fresh.marketStock, [port]: { ...fresh.marketStock[port], [good]: stock } },
    };
    const startGold = state.gold;
    for (let loop = 0; loop < 100; loop += 1) {
      state = applyCommand(state, { type: "buyGood", good, quantity: 1 }, 0).state;
      state = applyCommand(state, { type: "sellGood", good, quantity: 1 }, 0).state;
    }
    return { stock, goldPer100Loops: state.gold - startGold };
  });
}

/** Whether pausing for hours mid-voyage changes anything. Closed time should count for nothing. */
export function measureBreakInvariance(): boolean {
  const play = (pauseMs: number) => {
    const sim = createSim(createNewGame("Simulated"));
    for (const port of ["sonargaon", "dhaka", "sonargaon", "hooghly", "dhaka"] as const) {
      depart(sim, port);
      if (pauseMs > 0) {
        const pausedAt = sim.at;
        sim.at += pauseMs;
        send(sim, { type: "resumeVoyage", pausedAt });
      }
      arrive(sim);
    }
    const { voyage: _voyage, ...rest } = sim.state;
    return JSON.stringify(rest);
  };
  return play(0) === play(8 * 60 * 60 * 1000);
}
