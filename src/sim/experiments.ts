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
  advanceWorld,
  checkpointVoyageProgress,
  createInitialMarketStock,
  createNewGame,
  getGoodPrice,
  getMerchantProfile,
  getMerchantRoute,
  getMerchantWorth,
  getShipRouteConditions,
  getTradeQuote,
  isLaidUp,
  type GameState,
  type GoodId,
  type MarketPortId,
  type TownId,
  type VesselClassId,
} from "../game/model";
import { planRiverRoute } from "../game/navigation";
import { getRouteTravelTime } from "../game/travel-time";
import { arrive, createSim, depart, sail, send } from "./driver";
import { fromTop, giniOf, measureMarket, median, npcWorth, round, type MarketSnapshot } from "./metrics";
import { SIM_SEEDS, STRATEGIES, runStrategy } from "./runner";
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
  coinsPerDay: number;
  /** Earnings per day late in the run against early on. Below 1 means the route tired. */
  lateVsEarly: number;
}

/** Runs every pair of ports as a real two-port loop, through commands. */
export function measureSustainedRoutes(days = 90, base = createNewGame("Simulated")): SustainedRoute[] {
  const results: SustainedRoute[] = [];
  const early = Math.round(days / 3);
  for (let i = 0; i < TOWNS.length; i += 1) {
    for (let j = i + 1; j < TOWNS.length; j += 1) {
      const first = TOWNS[i].id;
      const second = TOWNS[j].id;
      const { result } = runStrategy(
        { id: `${first}-${second}`, strategy: () => twoPort(first, second), noise: 0, speed: 1 },
        { days: [early, days], base },
      );
      const [start, end] = result.snapshots;
      const earlyRate = (start.coins - base.coins) / start.sailingDay;
      const lateRate = (end.coins - start.coins) / (end.sailingDay - start.sailingDay);
      results.push({
        first,
        second,
        coinsPerDay: round((end.coins - base.coins) / end.sailingDay),
        lateVsEarly: earlyRate > 0 ? round(lateRate / earlyRate) : 0,
      });
    }
  }
  return results.sort((a, b) => b.coinsPerDay - a.coinsPerDay);
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

function recoveryCase(label: string, port: MarketPortId, good: GoodId, startStock: number): RecoveryCase {
  const target = createInitialMarketStock()[port][good];
  return { label, startStock, targetStock: target, ...daysToRecover(port, good, startStock, target) };
}

export function measureRecovery(): RecoveryCase[] {
  return [
    recoveryCase("Dhaka silk, emptied", "dhaka", "silk", 0),
    recoveryCase("Dhaka silk, half emptied", "dhaka", "silk", 30),
    recoveryCase("Dhaka silk, full", "dhaka", "silk", MARKET_MAX_STOCK),
    recoveryCase("Producer: Dhaka cotton, emptied", "dhaka", "muslin", 0),
    recoveryCase("Scarce: Sandwip salt's opposite, Patna salt, emptied", "patna", "salt", 0),
    recoveryCase("Big buyer: Dhaka rice, full", "dhaka", "rice", MARKET_MAX_STOCK),
    recoveryCase("Small buyer: Dhaka saltpetre, full", "dhaka", "saltpetre", MARKET_MAX_STOCK),
  ];
}

export interface MarketImpact {
  hold: number;
  stall: string;
  startPrice: number;
  /** Price of the last unit bought, against the first, as a share. */
  buyRise: number;
  /** Price of the last unit sold into a fresh stall, against the first, as a share. */
  sellFall: number;
  /** Lost to the discount and price movement if the whole hold is bought and sold back. */
  roundTripLossShare: number;
}

/** How far one hold moves a typical stall, for each vessel's base hold. */
export function measureMarketImpact(port: MarketPortId = "hooghly", good: GoodId = "sugar"): MarketImpact[] {
  const start = createInitialMarketStock()[port][good];
  return VESSEL_CLASS_IDS.map((vessel) => {
    const hold = VESSEL_CLASSES[vessel].baseHold;
    let paid = 0;
    let received = 0;
    for (let unit = 0; unit < hold; unit += 1) {
      paid += getGoodPrice(port, good, "buy", false, start - unit);
      received += getGoodPrice(port, good, "sell", false, start - hold + unit);
    }
    const first = getGoodPrice(port, good, "buy", false, start);
    const last = getGoodPrice(port, good, "buy", false, start - hold + 1);
    const firstSale = getGoodPrice(port, good, "sell", false, start);
    const lastSale = getGoodPrice(port, good, "sell", false, start + hold - 1);
    return {
      hold,
      stall: `${port} ${good}`,
      startPrice: first,
      buyRise: round(last / first - 1, 3),
      sellFall: round(1 - lastSale / firstSale, 3),
      roundTripLossShare: round(1 - received / paid, 3),
    };
  });
}

export interface ClosedLoopCheck {
  cycles: number;
  worstProfit: number;
  profitableCycles: number;
}

/**
 * Carries one good from one port to another and straight back, with no recovery between, so
 * nothing but the price function decides the result. Every cycle of the same units must lose.
 */
export function measureClosedLoops(units: readonly number[] = [1, 6, 12, 30, 48]): ClosedLoopCheck {
  const stock = createInitialMarketStock();
  let cycles = 0;
  let worstProfit = Number.NEGATIVE_INFINITY;
  let profitableCycles = 0;
  for (const first of MARKET_PORTS) {
    for (const second of MARKET_PORTS) {
      if (first.id === second.id) continue;
      for (const { id: good } of GOODS) {
        for (const quantity of units) {
          let a = stock[first.id][good];
          let b = stock[second.id][good];
          if (quantity > a || b + quantity > MARKET_MAX_STOCK) continue;
          let money = 0;
          for (let unit = 0; unit < quantity; unit += 1) {
            money -= getGoodPrice(first.id, good, "buy", false, a);
            a -= 1;
            money += getGoodPrice(second.id, good, "sell", false, b);
            b += 1;
          }
          for (let unit = 0; unit < quantity; unit += 1) {
            money -= getGoodPrice(second.id, good, "buy", false, b);
            b -= 1;
            money += getGoodPrice(first.id, good, "sell", false, a);
            a += 1;
          }
          cycles += 1;
          worstProfit = Math.max(worstProfit, money);
          if (money > 0) profitableCycles += 1;
        }
      }
    }
  }
  return { cycles, worstProfit, profitableCycles };
}

/** Whether saving a voyage's progress more or less often changes the world. */
export function measureCheckpointInvariance(): boolean {
  const play = (checkpoints: number) => {
    const sim = createSim(createNewGame("Simulated"));
    for (const port of ["hooghly", "sonargaon", "chittagong", "dhaka"] as const) {
      depart(sim, port);
      const voyage = sim.state.voyage!;
      for (let step = 1; step <= checkpoints; step += 1) {
        sim.state = checkpointVoyageProgress(
          sim.state,
          Math.floor(voyage.startedAt + ((voyage.arrivalAt - voyage.startedAt) * step) / (checkpoints + 1)),
        );
      }
      arrive(sim);
    }
    return JSON.stringify({ ...sim.state, voyage: null });
  };
  return play(0) === play(7);
}

// ---- Investments ----

export interface RouteShipReturn {
  vessel: VesselClassId;
  price: number;
  route: string;
  capitalStart: number;
  capitalEnd: number;
  coinsPerDay: number;
  paybackDays: number | null;
}

/** What one automated ship earns on its own, while the player only keeps the days moving. */
export function measureRouteShip(
  vessel: VesselClassId,
  origin: TownId = "hooghly",
  destination: TownId = "tanda",
  days = 200,
): RouteShipReturn {
  const capitalStart = 15_000;
  const sim = createSim({ ...createNewGame("Simulated"), coins: 250_000, highestCoins: 250_000 });
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
    coinsPerDay: round(perDay),
    paybackDays: perDay > 0 ? round(VESSEL_CLASSES[vessel].price / perDay, 0) : null,
  };
}

/** Days for one farm to repay its price, selling each day's free rice at a typical price. */
export function measureFarmPayback(): { riceSellMedian: number; coinsPerDay: number; paybackDays: number } {
  const start = createInitialMarketStock();
  const riceSellMedian = median(
    MARKET_PORTS.map((port) => getGoodPrice(port.id, "rice", "sell", false, start[port.id].rice)),
  );
  const coinsPerDay = riceSellMedian * FARM_DAILY_OUTPUT;
  return { riceSellMedian, coinsPerDay, paybackDays: round(FARM_PRICE / coinsPerDay, 0) };
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
      averageReward: round(missions.reduce((total, mission) => total + mission.rewardCoins, 0) / missions.length),
      averageGoodsCost: round(costs.reduce((total, cost) => total + cost, 0) / missions.length),
      worthDoing: missions.filter((mission, index) => mission.rewardCoins > costs[index]).length,
    };
  });
}

// ---- NPC world ----

export interface NpcReport {
  id: string;
  name: string;
  temperament: string;
  strategy: string;
  vessel: VesselClassId;
  startWorth: number;
  worthAt: Record<number, number>;
  purseAt: Record<number, number>;
  trips: number;
  unitsBought: number;
  unitsSold: number;
  portsVisited: number;
  averageTripDays: number;
  profitPerUnit: number;
  reputation: number;
  lastTradeDay: number;
  daysDockedWithCargo: number;
  daysLaidUp: number;
}

export interface GroupBehaviour {
  group: string;
  merchants: number;
  tripsEach: number;
  unitsEach: number;
  averageTripDays: number;
  portsEach: number;
  profitPerUnit: number;
  growth: number;
}

export interface VesselLoad {
  vessel: VesselClassId;
  voyages: number;
  emptyVoyages: number;
  /** Cargo units per voyage that carried anything. */
  unitsPerLoadedVoyage: number;
  /** Cargo units per voyage, counting empty ones. */
  unitsPerVoyage: number;
  /** Share of the hold in use, counting empty voyages. */
  holdUse: number;
  /** Share of the hold in use on voyages that carried anything. */
  loadedHoldUse: number;
}

export interface MerchantTier {
  tier: string;
  merchants: number;
  medianGrowth: number;
  lowestGrowth: number;
  voyagesEach: number;
  unitsEach: number;
  profitEach: number;
  shareOfWealthAtEnd: number;
}

const TIER_LIMITS = [
  { tier: "Great houses", from: 60_000, to: Number.POSITIVE_INFINITY },
  { tier: "Established", from: 26_000, to: 60_000 },
  { tier: "Modest", from: 12_000, to: 26_000 },
  { tier: "Small", from: 0, to: 12_000 },
];

export interface NpcWorldReport {
  seed: number;
  loads: VesselLoad[];
  tiers: MerchantTier[];
  /** Ship purchases that happened, as "name: from to on day". */
  shipPurchases: string[];
  holdUpgrades: number;
  /** Stall-days at or below the merchants' reserve, across the whole run. */
  stallDaysAtReserve: number;
  lowestStock: number;
  days: number;
  merchants: NpcReport[];
  marketAt: Record<number, MarketSnapshot>;
  totalWorthAt: Record<number, number>;
  giniAt: Record<number, number>;
  /** Share of all merchant wealth held by the richest three. */
  topThreeShareAt: Record<number, number>;
  /** Merchants that made no trade in the final 50 days. */
  stalledAtEnd: number;
  laidUpAtEnd: number;
  unitsMovedPerDay: number;
  journeysCompleted: number;
  /** Stops at a port a merchant's own ship is barred from, or moves with no valid route. */
  restrictionBreaks: number;
  /** Goods that appeared or vanished, beyond what stalls recovered and merchants traded. */
  goodsUnaccounted: number;
  /** Times a purse grew on a day its owner sold nothing. */
  purseGrewWithoutSale: number;
}

/**
 * Advances only the world, one day at a time, with no player in it. It calls the same
 * world clock an arrival does, but steps it daily so every trade can be counted and checked.
 */
export function measureNpcWorld(
  seed = 1,
  days = 200,
  marks: readonly number[] = [30, 90, 200],
): NpcWorldReport {
  let state: GameState = { ...createNewGame("Simulated"), worldSeed: seed };
  const reports = new Map<string, NpcReport>(
    state.npcMerchants.map((merchant) => {
      const profile = getMerchantProfile(merchant.id)!;
      return [
        merchant.id,
        {
          id: merchant.id,
          name: merchant.name,
          temperament: profile.temperament,
          strategy: profile.strategy,
          vessel: merchant.vesselClass,
          startWorth: getMerchantWorth(merchant),
          worthAt: {},
          purseAt: {},
          trips: 0,
          unitsBought: 0,
          unitsSold: 0,
          portsVisited: 1,
          averageTripDays: 0,
          profitPerUnit: 0,
          reputation: merchant.reputation,
          lastTradeDay: 0,
          daysDockedWithCargo: 0,
          daysLaidUp: 0,
        },
      ];
    }),
  );
  const marketAt: NpcWorldReport["marketAt"] = {};
  const totalWorthAt: NpcWorldReport["totalWorthAt"] = {};
  const giniAt: NpcWorldReport["giniAt"] = {};
  const topThreeShareAt: NpcWorldReport["topThreeShareAt"] = {};
  const tripDays = new Map<string, number>();
  const loadTally = new Map<VesselClassId, { voyages: number; empty: number; units: number; capacity: number; loadedCapacity: number }>();
  const shipPurchases: string[] = [];
  let holdUpgrades = 0;
  let stallDaysAtReserve = 0;
  let lowestStock = Number.POSITIVE_INFINITY;
  let restrictionBreaks = 0;
  let goodsUnaccounted = 0;
  let purseGrewWithoutSale = 0;

  for (let day = 1; day <= days; day += 1) {
    const before = state;
    const recovered = advanceMarketStock(before.marketStock, 1);
    state = advanceWorld({ ...before, sailingDay: day }, day);

    for (const { id: good } of GOODS) {
      const held = (world: GameState) =>
        world.npcMerchants.reduce((total, merchant) => total + merchant.cargo[good], 0);
      const stocked = (market: GameState["marketStock"]) =>
        MARKET_PORTS.reduce((total, port) => total + market[port.id][good], 0);
      goodsUnaccounted += Math.abs(held(state) + stocked(state.marketStock) - held(before) - stocked(recovered));
    }

    for (const merchant of state.npcMerchants) {
      const previous = before.npcMerchants.find((entry) => entry.id === merchant.id)!;
      const report = reports.get(merchant.id)!;
      const barred = VESSEL_CLASSES[merchant.vesselClass].barredPorts;
      if (barred.includes(merchant.currentPort) || barred.includes(merchant.destinationPort)) restrictionBreaks += 1;
      if (previous.phase === "docked" && merchant.phase === "traveling") {
        tripDays.set(merchant.id, (tripDays.get(merchant.id) ?? 0) + merchant.travelDaysTotal);
        const carried = GOODS.reduce((total, good) => total + merchant.cargo[good.id], 0);
        const tally = loadTally.get(merchant.vesselClass) ?? { voyages: 0, empty: 0, units: 0, capacity: 0, loadedCapacity: 0 };
        tally.voyages += 1;
        tally.units += carried;
        tally.capacity += merchant.cargoCapacity;
        if (carried === 0) tally.empty += 1;
        else tally.loadedCapacity += merchant.cargoCapacity;
        loadTally.set(merchant.vesselClass, tally);
        if (!getMerchantRoute(merchant.currentPort, merchant.destinationPort, merchant.vesselClass)) restrictionBreaks += 1;
      }
      // A ship can only change port by finishing the journey it was on.
      if (
        merchant.currentPort !== previous.currentPort &&
        !(previous.phase === "traveling" && previous.travelDaysRemaining === 1 && merchant.currentPort === previous.destinationPort)
      ) {
        restrictionBreaks += 1;
      }
      if (merchant.budget > previous.budget && merchant.unitsSold === previous.unitsSold) purseGrewWithoutSale += 1;
      if (merchant.vesselClass !== previous.vesselClass) {
        shipPurchases.push(`${merchant.name}: ${previous.vesselClass} to ${merchant.vesselClass}, day ${day}`);
      }
      if (merchant.holdUpgrades > previous.holdUpgrades) holdUpgrades += 1;
      if (merchant.phase === "docked" && GOODS.some((good) => merchant.cargo[good.id] > 0)) report.daysDockedWithCargo += 1;
      if (isLaidUp(merchant)) report.daysLaidUp += 1;
      report.lastTradeDay = merchant.lastTradeDay;
    }

    for (const port of MARKET_PORTS) {
      for (const { id: good } of GOODS) {
        const stock = state.marketStock[port.id][good];
        lowestStock = Math.min(lowestStock, stock);
        if (stock <= 8) stallDaysAtReserve += 1;
      }
    }

    if (marks.includes(day)) {
      marketAt[day] = measureMarket(state);
      const worths = state.npcMerchants.map(npcWorth);
      const total = worths.reduce((sum, value) => sum + value, 0);
      totalWorthAt[day] = total;
      giniAt[day] = giniOf(worths);
      topThreeShareAt[day] = round(
        [...worths].sort((a, b) => b - a).slice(0, 3).reduce((sum, value) => sum + value, 0) / total,
        3,
      );
      for (const merchant of state.npcMerchants) {
        const report = reports.get(merchant.id)!;
        report.worthAt[day] = npcWorth(merchant);
        report.purseAt[day] = Math.round(merchant.budget);
      }
    }
  }

  for (const merchant of state.npcMerchants) {
    const report = reports.get(merchant.id)!;
    report.vessel = merchant.vesselClass;
    report.trips = merchant.tripsCompleted;
    report.unitsBought = merchant.unitsBought;
    report.unitsSold = merchant.unitsSold;
    report.portsVisited = merchant.visitedPorts.length;
    report.reputation = merchant.reputation;
    report.averageTripDays = round((tripDays.get(merchant.id) ?? 0) / Math.max(1, merchant.tripsCompleted));
    report.profitPerUnit = merchant.unitsSold > 0 ? Math.round(merchant.realizedProfit / merchant.unitsSold) : 0;
  }

  const merchants = [...reports.values()];
  const finalWorth = merchants.reduce((total, merchant) => total + (merchant.worthAt[days] ?? merchant.startWorth), 0);
  const tiers = TIER_LIMITS.map(({ tier, from, to }) => {
    const members = merchants.filter((merchant) => {
      const coins = getMerchantProfile(merchant.id)!.startingCoins;
      return coins >= from && coins < to;
    });
    const growths = members.map((merchant) => (merchant.worthAt[days] ?? merchant.startWorth) / merchant.startWorth);
    const each = (pick: (merchant: NpcReport) => number) =>
      round(members.reduce((total, merchant) => total + pick(merchant), 0) / members.length);
    return {
      tier,
      merchants: members.length,
      medianGrowth: round(median(growths)),
      lowestGrowth: round(Math.min(...growths)),
      voyagesEach: each((merchant) => merchant.trips),
      unitsEach: each((merchant) => merchant.unitsSold),
      profitEach: Math.round(each((merchant) => (merchant.worthAt[days] ?? merchant.startWorth) - merchant.startWorth)),
      shareOfWealthAtEnd: round(
        members.reduce((total, merchant) => total + (merchant.worthAt[days] ?? merchant.startWorth), 0) / finalWorth,
        3,
      ),
    };
  });
  return {
    seed,
    loads: VESSEL_CLASS_IDS.map((vessel) => {
      const tally = loadTally.get(vessel) ?? { voyages: 0, empty: 0, units: 0, capacity: 0, loadedCapacity: 0 };
      const loaded = tally.voyages - tally.empty;
      return {
        vessel,
        voyages: tally.voyages,
        emptyVoyages: tally.empty,
        unitsPerLoadedVoyage: loaded > 0 ? round(tally.units / loaded) : 0,
        unitsPerVoyage: tally.voyages > 0 ? round(tally.units / tally.voyages) : 0,
        holdUse: tally.capacity > 0 ? round(tally.units / tally.capacity, 3) : 0,
        loadedHoldUse: tally.loadedCapacity > 0 ? round(tally.units / tally.loadedCapacity, 3) : 0,
      };
    }),
    tiers,
    shipPurchases,
    holdUpgrades,
    stallDaysAtReserve,
    lowestStock,
    days,
    merchants,
    marketAt,
    totalWorthAt,
    giniAt,
    topThreeShareAt,
    stalledAtEnd: merchants.filter((merchant) => merchant.lastTradeDay <= days - 50).length,
    laidUpAtEnd: state.npcMerchants.filter(isLaidUp).length,
    unitsMovedPerDay: round(
      merchants.reduce((total, merchant) => total + merchant.unitsBought + merchant.unitsSold, 0) / days,
    ),
    journeysCompleted: merchants.reduce((total, merchant) => total + merchant.trips, 0),
    restrictionBreaks,
    goodsUnaccounted,
    purseGrewWithoutSale,
  };
}

function behaviourBy(merchants: readonly NpcReport[], key: "temperament" | "strategy"): GroupBehaviour[] {
  return [...new Set(merchants.map((merchant) => merchant[key]))].sort().map((group) => {
    const members = merchants.filter((merchant) => merchant[key] === group);
    const average = (pick: (merchant: NpcReport) => number) =>
      round(members.reduce((total, merchant) => total + pick(merchant), 0) / members.length);
    return {
      group,
      merchants: members.length,
      tripsEach: average((merchant) => merchant.trips),
      unitsEach: average((merchant) => merchant.unitsSold),
      averageTripDays: average((merchant) => merchant.averageTripDays),
      portsEach: average((merchant) => merchant.portsVisited),
      profitPerUnit: average((merchant) => merchant.profitPerUnit),
      growth: average((merchant) => (merchant.worthAt[200] ?? merchant.startWorth) / merchant.startWorth),
    };
  });
}

/** The same world across several seeds, with the first kept in full. */
export function measureNpcWorlds(seeds: readonly number[] = SIM_SEEDS) {
  const worlds = seeds.map((seed) => measureNpcWorld(seed));
  const middleOf = (pick: (world: NpcWorldReport) => number) => round(median(worlds.map(pick)), 3);
  const atDays = (pick: (world: NpcWorldReport, day: number) => number) =>
    [30, 90, 200].map((day) => ({ day, value: middleOf((world) => pick(world, day)) }));
  const growths = worlds.flatMap((world) =>
    world.merchants.map((merchant) => merchant.worthAt[200] / merchant.startWorth),
  );
  const sum = (pick: (load: VesselLoad) => number, vessel: VesselClassId) =>
    worlds.reduce((total, world) => total + pick(world.loads.find((load) => load.vessel === vessel)!), 0);
  return {
    seeds: seeds.length,
    first: worlds[0],
    loads: VESSEL_CLASS_IDS.map((vessel) => {
      const voyages = sum((load) => load.voyages, vessel);
      const empty = sum((load) => load.emptyVoyages, vessel);
      const weighted = (pick: (load: VesselLoad) => number, weight: (load: VesselLoad) => number) => {
        const totalWeight = sum(weight, vessel);
        return totalWeight > 0
          ? round(sum((load) => pick(load) * weight(load), vessel) / totalWeight, 3)
          : 0;
      };
      return {
        vessel,
        voyagesPerWorld: round(voyages / seeds.length),
        emptyShare: voyages > 0 ? round(empty / voyages, 3) : 0,
        unitsPerVoyage: weighted((load) => load.unitsPerVoyage, (load) => load.voyages),
        unitsPerLoadedVoyage: weighted((load) => load.unitsPerLoadedVoyage, (load) => load.voyages - load.emptyVoyages),
        holdUse: weighted((load) => load.holdUse, (load) => load.voyages),
        loadedHoldUse: weighted((load) => load.loadedHoldUse, (load) => load.voyages - load.emptyVoyages),
      };
    }),
    tiers: worlds[0].tiers.map((entry, index) => ({
      tier: entry.tier,
      merchants: entry.merchants,
      medianGrowth: round(median(worlds.map((world) => world.tiers[index].medianGrowth))),
      lowestGrowth: Math.min(...worlds.map((world) => world.tiers[index].lowestGrowth)),
      voyagesEach: round(median(worlds.map((world) => world.tiers[index].voyagesEach))),
      unitsEach: round(median(worlds.map((world) => world.tiers[index].unitsEach))),
      profitEach: round(median(worlds.map((world) => world.tiers[index].profitEach))),
      shareOfWealthAtEnd: round(median(worlds.map((world) => world.tiers[index].shareOfWealthAtEnd)), 3),
    })),
    shipPurchasesPerWorld: round(worlds.reduce((total, world) => total + world.shipPurchases.length, 0) / seeds.length),
    shipPurchasesFirstWorld: worlds[0].shipPurchases,
    holdUpgradesPerWorld: round(worlds.reduce((total, world) => total + world.holdUpgrades, 0) / seeds.length),
    stallDaysAtReserve: middleOf((world) => world.stallDaysAtReserve),
    lowestStock: Math.min(...worlds.map((world) => world.lowestStock)),
    behaviourByTemperament: behaviourBy(worlds[0].merchants, "temperament"),
    behaviourByStrategy: behaviourBy(worlds[0].merchants, "strategy"),
    totalWorth: atDays((world, day) => world.totalWorthAt[day]),
    gini: atDays((world, day) => world.giniAt[day]),
    topThreeShare: atDays((world, day) => world.topThreeShareAt[day]),
    priceMovement: atDays((world, day) => world.marketAt[day].priceMovement),
    priceIndex: atDays((world, day) => world.marketAt[day].priceIndex),
    stallsMoved: atDays((world, day) => world.marketAt[day].stallsMoved),
    largestPriceMove: atDays((world, day) => world.marketAt[day].largestPriceMove),
    stallsNearEmpty: atDays((world, day) => world.marketAt[day].stallsNearEmpty),
    stallsNearFull: atDays((world, day) => world.marketAt[day].stallsNearFull),
    medianGrowth: round(median(growths)),
    richestGrowth: round(Math.max(...growths)),
    shrunkBelowHalf: round(growths.filter((growth) => growth < 0.5).length / seeds.length),
    stalledAtEnd: middleOf((world) => world.stalledAtEnd),
    laidUpAtEnd: middleOf((world) => world.laidUpAtEnd),
    unitsMovedPerDay: middleOf((world) => world.unitsMovedPerDay),
    journeysCompleted: middleOf((world) => world.journeysCompleted),
    restrictionBreaks: worlds.reduce((total, world) => total + world.restrictionBreaks, 0),
    goodsUnaccounted: worlds.reduce((total, world) => total + world.goodsUnaccounted, 0),
    purseGrewWithoutSale: worlds.reduce((total, world) => total + world.purseGrewWithoutSale, 0),
  };
}

export interface CompetitionCheck {
  strategy: string;
  withMerchants: number;
  withoutMerchants: number;
  change: number;
}

/** What rivals cost a player: the same play, on the same day, with and without them. */
export function measureCompetition(ids: readonly string[] = ["manual", "mixed-active", "two-port-start"]): CompetitionCheck[] {
  const fresh = createNewGame("Simulated");
  return ids.map((id) => {
    const definition = STRATEGIES.find((entry) => entry.id === id)!;
    const worth = (base: GameState) =>
      runStrategy(definition, { base, days: [200] }).result.snapshots[0].netWorth;
    const withMerchants = worth(fresh);
    const withoutMerchants = worth({ ...fresh, npcMerchants: [], npcActivity: [] });
    return { strategy: id, withMerchants, withoutMerchants, change: round(withMerchants / withoutMerchants - 1, 3) };
  });
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
  coinsBeforeDraining: number;
  unitsBought: number;
  loops: number;
  coinsGained: number;
  gainPerLoop: number;
  inGameDaysUsed: number;
  commandsRejected: number;
}

/**
 * Proves the loop in real play: a new game trades up to the money it needs, sails there,
 * drains the stall, then buys and sells back through normal commands. No state is edited.
 */
export function demonstrateSamePortLoop(loops = 200, base = createNewGame("Simulated")): SamePortDemo | null {
  const reachable = findSamePortLoops().filter((stall) => stall.unitsToDrain <= VESSEL_CLASSES["river-boat"].baseHold);
  const target = reachable[0];
  if (!target) return null;

  const { sim } = runStrategy(
    { id: "exploit-setup", strategy: () => manual, noise: 0, speed: 1 },
    { days: [1], base },
  );
  const context = { random: () => 0.5, noise: 0, reserved: {} };
  const coinsNeeded = target.costToDrain + 3_000;
  let guard = 0;
  while (sim.state.coins < coinsNeeded && guard < 2_000) {
    manual(sim, context);
    guard += 1;
  }
  if (sim.state.coins < coinsNeeded) return null;

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
  const coinsBeforeDraining = sim.state.coins;
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

  const coinsAtLoopStart = sim.state.coins;
  const dayAtLoopStart = sim.state.sailingDay;
  const refusedBefore = sim.refused.length;
  for (let loop = 0; loop < loops; loop += 1) {
    send(sim, { type: "buyGood", good: target.good, quantity: 1 });
    send(sim, { type: "sellGood", good: target.good, quantity: 1 });
  }
  const coinsGained = sim.state.coins - coinsAtLoopStart;
  return {
    port: target.port,
    good: target.good,
    dayStarted,
    coinsBeforeDraining,
    unitsBought,
    loops,
    coinsGained,
    gainPerLoop: round(coinsGained / loops),
    inGameDaysUsed: round(sim.state.sailingDay - dayAtLoopStart),
    commandsRejected: sim.refused.length - refusedBefore,
  };
}

/** The stall most exposed once a stall is near empty, on the game's own quotes. */
export function measureLoopAtLowStock(
  port: MarketPortId,
  good: GoodId,
  stocks: readonly number[] = [60, 30, 15, 6, 1],
): { stock: number; coinsPer100Loops: number }[] {
  return stocks.map((stock) => {
    const fresh = createNewGame("Simulated");
    let state: GameState = {
      ...fresh,
      coins: 5_000_000,
      highestCoins: 5_000_000,
      currentTown: port,
      selectedTown: port,
      visitedTowns: [...new Set([...fresh.visitedTowns, port])],
      fleet: fresh.fleet.map((ship) => ({ ...ship, currentPort: port })),
      marketStock: { ...fresh.marketStock, [port]: { ...fresh.marketStock[port], [good]: stock } },
    };
    const startCoins = state.coins;
    for (let loop = 0; loop < 100; loop += 1) {
      state = applyCommand(state, { type: "buyGood", good, quantity: 1 }, 0).state;
      state = applyCommand(state, { type: "sellGood", good, quantity: 1 }, 0).state;
    }
    return { stock, coinsPer100Loops: state.coins - startCoins };
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
