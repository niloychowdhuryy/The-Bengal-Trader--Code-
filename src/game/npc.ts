// The merchants' day. They obey the rules the player does: real routes, real cargo, the
// shared price function and a purse that only changes through trade and expenses.
import {
  GOODS,
  MARKET_BASE_PRICES,
  MARKET_MAX_STOCK,
  SHIPYARD_PORTS,
  TOWNS,
  UPGRADES,
  VESSEL_CLASSES,
  createInitialMarketStock,
  getGoodPrice,
  getShipRouteConditions,
  getShipRouteDays,
  getTown,
  getVesselCargoCapacity,
  isHistoricalRouteAlertActive,
  type GameState,
  type GoodId,
  type NpcActivity,
  type NpcMerchant,
  type TownId,
  type VesselClassId,
} from "./model";
import { planRiverRoute, type RiverRoute, type RouteConditions } from "./navigation";
import {
  MERCHANT_ROSTER,
  type MerchantProfile,
  type MerchantTemperament,
} from "./npc-roster";

interface TemperamentRules {
  /** The first unit must clear this margin, as a share of its price, or the route isn't worth it. */
  minMargin: number;
  /** Once a route is worth it, keep loading while the next unit still earns this much. */
  loadMargin: number;
  /** Share of the purse kept back from any one cargo. */
  reserve: number;
  /** Share of expected profit discounted for each day at sea. */
  riskPerDay: number;
  /** How far a merchant's idea of a distant price can be wrong. */
  priceError: number;
  /** Days spent in port after arriving. */
  dockDays: number;
  maxTripDays: number;
}

export const TEMPERAMENTS: Record<MerchantTemperament, TemperamentRules> = {
  cautious: { minMargin: 0.24, loadMargin: 0.16, reserve: 0.3, riskPerDay: 0.06, priceError: 0.04, dockDays: 2, maxTripDays: 3 },
  steady: { minMargin: 0.2, loadMargin: 0.14, reserve: 0.15, riskPerDay: 0.03, priceError: 0.07, dockDays: 1, maxTripDays: 4 },
  bold: { minMargin: 0.16, loadMargin: 0.11, reserve: 0.05, riskPerDay: 0.01, priceError: 0.12, dockDays: 1, maxTripDays: 6 },
};

// Crew and port dues for each day at sea, paid when leaving.
export const DAILY_RUNNING_COST: Record<VesselClassId, number> = {
  bora: 30,
  "river-boat": 45,
  patello: 90,
};

// A voyage's costs spread over more units in a big hold, so bulk carriers can profitably take
// thinner margins on each one. It's the commercial case for a larger ship.
const LOAD_MARGIN_BY_SHIP: Record<VesselClassId, number> = { bora: 1.1, "river-boat": 1, patello: 0.5 };

// Merchants leave a town at least this share of a stall's usual stock, and won't flood it
// beyond this share. So no rival can empty a stall, however large the ship.
const STALL_FLOOR_SHARE = 0.4;
const STALL_CEILING_SHARE = 1.6;
// Each unit moves a typical price about 1.1% at the stall it leaves and 1% where it lands.
const MARGIN_LOST_PER_UNIT = 0.021;
// Working capital a merchant wants to keep after buying a ship: enough to fill a good part of
// the new hold, and ten days of crew.
const WORKING_CAPITAL_PER_HOLD_UNIT = 350;
const CREW_DAYS_KEPT = 10;
const INVESTMENT_PAYBACK_DAYS = 250;
const CAUTIOUS_PURSE_MULTIPLE = 3;
const EMPTY_TRIP_CHANCE = 0.15;
const ACTIVITY_PER_PORT = 4;
const MAX_REPUTATION = 200;
const STANDING_NAMES = ["Struggling", "Small trader", "Modest merchant", "Established merchant", "Great house"];

// Fifteen ports. Spelled out because this file and the model load each other.
export const MAX_NPC_ACTIVITY = 15 * ACTIVITY_PER_PORT;

export function getMerchantProfile(id: string): MerchantProfile | undefined {
  return MERCHANT_ROSTER.find((profile) => profile.id === id);
}

export function hashText(text: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16_777_619);
  }
  return hash >>> 0;
}

/** A repeatable number from 0 to 1. Nothing about a merchant's luck is stored or rolled twice. */
function chance(...parts: (string | number)[]): number {
  return hashText(parts.join("|")) / 4_294_967_296;
}

// Usual stock never changes, and these limits are checked for every unit traded.
let usualStock: GameState["marketStock"] | null = null;

function stallUsual(port: TownId, good: GoodId): number {
  usualStock ??= createInitialMarketStock();
  return usualStock[port][good];
}

function stallFloor(port: TownId, good: GoodId): number {
  return Math.ceil(stallUsual(port, good) * STALL_FLOOR_SHARE);
}

function stallCeiling(port: TownId, good: GoodId): number {
  return Math.floor(stallUsual(port, good) * STALL_CEILING_SHARE);
}

function emptyGoods(): Record<GoodId, number> {
  return Object.fromEntries(GOODS.map((good) => [good.id, 0])) as Record<GoodId, number>;
}

export function createMerchant(profile: MerchantProfile): NpcMerchant {
  return {
    id: profile.id,
    name: profile.name,
    homePort: profile.homePort,
    currentPort: profile.homePort,
    destinationPort: profile.homePort,
    strategy: profile.strategy,
    phase: "docked",
    cargo: emptyGoods(),
    cargoCost: emptyGoods(),
    vesselClass: profile.vesselClass,
    holdUpgrades: 0,
    cargoCapacity: VESSEL_CLASSES[profile.vesselClass].baseHold,
    budget: profile.startingCoins,
    preferences: [...profile.preferences],
    preferredPorts: [...profile.preferredPorts],
    travelDaysRemaining: 0,
    travelDaysTotal: 0,
    dockDaysRemaining: 0,
    purchaseDay: 0,
    reputation: profile.startingReputation,
    visitedPorts: [profile.homePort],
    profitMarks: [],
    tripsCompleted: 0,
    unitsBought: 0,
    unitsSold: 0,
    realizedProfit: 0,
    lastTradeDay: 0,
  };
}

export function createNpcMerchants(): NpcMerchant[] {
  return MERCHANT_ROSTER.map(createMerchant);
}

export function getNpcMerchant(state: GameState, merchantId: string): NpcMerchant | undefined {
  return state.npcMerchants.find((merchant) => merchant.id === merchantId);
}

export function getNpcTradingIntent(merchant: NpcMerchant): string {
  if (merchant.strategy === "arbitrage") {
    return "Compares reachable markets and seeks the best price difference.";
  }
  if (merchant.strategy === "regional") {
    return "Trades preferred goods among nearby ports.";
  }
  const goods = merchant.preferences
    .map((goodId) => GOODS.find((good) => good.id === goodId)?.name)
    .filter((name): name is string => Boolean(name));
  return `Specialises in ${goods.join(", ")}.`;
}

export function goodsAtReference(goods: Record<GoodId, number>): number {
  return GOODS.reduce((total, good) => total + goods[good.id] * MARKET_BASE_PRICES[good.id] * 0.8, 0);
}

/** Purse, cargo and ship, valued the way the harness values the player's. */
export function getMerchantWorth(merchant: NpcMerchant): number {
  const hold = UPGRADES.find((upgrade) => upgrade.id === "hold")!;
  const level = merchant.holdUpgrades;
  return Math.round(
    merchant.budget +
      goodsAtReference(merchant.cargo) +
      VESSEL_CLASSES[merchant.vesselClass].price * 0.6 +
      hold.baseCost * ((level * (level + 1)) / 2) * 0.6,
  );
}

export function getMerchantStanding(merchant: NpcMerchant): string {
  const worth = getMerchantWorth(merchant);
  const tier = worth >= 150_000 ? 4 : worth >= 60_000 ? 3 : worth >= 25_000 ? 2 : worth >= 12_000 ? 1 : 0;
  return isLaidUp(merchant) ? "Laid up" : STANDING_NAMES[tier];
}

function cargoUnits(merchant: NpcMerchant): number {
  return GOODS.reduce((total, good) => total + merchant.cargo[good.id], 0);
}

/** Can't pay for a voyage or for anything to carry, and has nothing left to sell. */
export function isLaidUp(merchant: NpcMerchant): boolean {
  return (
    merchant.phase === "docked" &&
    cargoUnits(merchant) === 0 &&
    merchant.budget < DAILY_RUNNING_COST[merchant.vesselClass] + 200
  );
}

// Routes never change during a game's rules, so each is only worked out once.
const routeCache = new Map<string, RiverRoute | null>();

export function getMerchantRoute(
  from: TownId,
  to: TownId,
  vesselClass: VesselClassId,
  conditions: RouteConditions = {},
): RiverRoute | null {
  const key = `${vesselClass}|${from}|${to}|${JSON.stringify(conditions)}`;
  const cached = routeCache.get(key);
  if (cached !== undefined) return cached;
  const route = planRiverRoute(from, to, getShipRouteConditions(conditions, vesselClass));
  routeCache.set(key, route);
  return route;
}

interface MerchantDay {
  stock: GameState["marketStock"];
  merchants: Map<string, NpcMerchant>;
  activity: NpcActivity[];
  /** Goods already on their way to each port, which every merchant can see coming. */
  inbound: Record<TownId, Record<GoodId, number>>;
  day: number;
  seed: number;
  routeAlert: boolean;
  conditions: RouteConditions;
}

function note(
  world: MerchantDay,
  merchant: NpcMerchant,
  town: TownId,
  kind: NonNullable<NpcActivity["kind"]>,
  message: string,
  good?: GoodId,
  units?: number,
): void {
  const record: NpcActivity = {
    id: `${merchant.id}:${world.day}:${kind}:${good ?? town}`,
    merchantId: merchant.id,
    town,
    sailingDay: world.day,
    message,
    kind,
    ...(good ? { good, units } : {}),
  };
  world.activity.push(record);
}

function keepRecentActivity(activity: NpcActivity[]): NpcActivity[] {
  const seen = new Map<TownId, number>();
  const kept: NpcActivity[] = [];
  for (let index = activity.length - 1; index >= 0; index -= 1) {
    const count = seen.get(activity[index].town) ?? 0;
    if (count < ACTIVITY_PER_PORT) {
      seen.set(activity[index].town, count + 1);
      kept.push(activity[index]);
    }
  }
  return kept.reverse();
}

function goodName(good: GoodId): string {
  return GOODS.find((item) => item.id === good)!.name;
}

function earnReputation(merchant: NpcMerchant, points: number): NpcMerchant {
  return { ...merchant, reputation: Math.min(MAX_REPUTATION, merchant.reputation + points) };
}

/** What a merchant expects a good to fetch at a port, allowing for what's already heading there. */
function expectedSale(world: MerchantDay, merchant: NpcMerchant, port: TownId, good: GoodId, extraUnits: number): number {
  const profile = getMerchantProfile(merchant.id);
  const error = TEMPERAMENTS[profile?.temperament ?? "steady"].priceError;
  const wrongBy = (chance(world.seed, world.day, merchant.id, port, good) - 0.5) * 2 * error;
  const stock = world.stock[port][good] + world.inbound[port][good] + extraUnits;
  return getGoodPrice(port, good, "sell", world.routeAlert, Math.min(MARKET_MAX_STOCK - 1, stock)) * (1 + wrongBy);
}

/** A merchant who hasn't made a deal in a while grows less choosy, and takes thinner margins. */
function marginWanted(world: MerchantDay, merchant: NpcMerchant, profile: MerchantProfile): number {
  const idle = world.day - merchant.lastTradeDay;
  const relaxed = idle > 25 ? 0.4 : idle > 12 ? 0.7 : 1;
  return TEMPERAMENTS[profile.temperament].minMargin * relaxed;
}

function isPoor(merchant: NpcMerchant, profile: MerchantProfile): boolean {
  return getMerchantWorth(merchant) < (profile.startingCoins + VESSEL_CLASSES[profile.vesselClass].price * 0.6) * 0.5;
}

/** How far a merchant will go today. The rich reach further, and the struggling pull back. */
function tripLimit(merchant: NpcMerchant, profile: MerchantProfile): number {
  const rules = TEMPERAMENTS[profile.temperament];
  if (isPoor(merchant, profile)) return Math.min(2, rules.maxTripDays);
  const growth = getMerchantWorth(merchant) / (profile.startingCoins + VESSEL_CLASSES[profile.vesselClass].price * 0.6);
  return rules.maxTripDays + (growth >= 2 ? 1 : 0) + (growth >= 4 ? 1 : 0);
}

function allowedPorts(merchant: NpcMerchant, profile: MerchantProfile, wantsShipyard = false): readonly TownId[] {
  const growth = getMerchantWorth(merchant) / (profile.startingCoins + VESSEL_CLASSES[profile.vesselClass].price * 0.6);
  // A regional merchant who has done well starts looking beyond the home waters.
  if (profile.strategy !== "regional" || growth >= 3) return TOWNS.map((town) => town.id);
  return [...new Set([...profile.preferredPorts, profile.homePort, ...(wantsShipyard ? SHIPYARD_PORTS : [])])];
}

function tradedGoods(profile: MerchantProfile): readonly GoodId[] {
  return profile.strategy === "arbitrage" ? GOODS.map((good) => good.id) : profile.preferences;
}

function sellFloor(merchant: NpcMerchant, profile: MerchantProfile, good: GoodId, day: number): number {
  const cost = merchant.cargoCost[good];
  const held = day - merchant.purchaseDay;
  if (isPoor(merchant, profile) || held > 10) return 0;
  if (held > 5) return cost * 0.95;
  return cost * (1 + TEMPERAMENTS[profile.temperament].minMargin / 3);
}

function sellHere(world: MerchantDay, start: NpcMerchant, profile: MerchantProfile, floorOverride?: number): NpcMerchant {
  let merchant = start;
  const port = merchant.currentPort;
  for (const { id: good } of GOODS) {
    let sold = 0;
    let revenue = 0;
    const floor = floorOverride ?? sellFloor(merchant, profile, good, world.day);
    const cost = merchant.cargoCost[good];
    while (sold < merchant.cargo[good] && world.stock[port][good] < stallCeiling(port, good)) {
      const price = getGoodPrice(port, good, "sell", world.routeAlert, world.stock[port][good]);
      if (price < floor) break;
      revenue += price;
      sold += 1;
      world.stock[port][good] += 1;
    }
    if (sold === 0) continue;
    const remaining = merchant.cargo[good] - sold;
    const profit = revenue - cost * sold;
    merchant = {
      ...merchant,
      budget: merchant.budget + revenue,
      cargo: { ...merchant.cargo, [good]: remaining },
      cargoCost: { ...merchant.cargoCost, [good]: remaining > 0 ? cost : 0 },
      unitsSold: merchant.unitsSold + sold,
      realizedProfit: merchant.realizedProfit + profit,
      lastTradeDay: world.day,
    };
    if (profit > 0) {
      const mark = TOWNS.findIndex((town) => town.id === port) * GOODS.length + GOODS.findIndex((item) => item.id === good);
      if (!merchant.profitMarks.includes(mark)) {
        merchant = earnReputation({ ...merchant, profitMarks: [...merchant.profitMarks, mark] }, 1);
      }
    }
    note(world, merchant, port, "sold", `sold ${sold} ${goodName(good)}`, good, sold);
  }
  return merchant;
}

function nextShip(merchant: NpcMerchant): VesselClassId | null {
  return merchant.vesselClass === "bora" ? "river-boat" : merchant.vesselClass === "river-boat" ? "patello" : null;
}

/**
 * Whether a bigger ship would pay for itself. It looks at how this merchant has actually been
 * trading: how much of the hold they use, what a unit earns them, and how often they sail. A
 * bigger ship costs more to run and sails slower, and some can't reach a merchant's home waters.
 */
function shipWorthBuying(merchant: NpcMerchant, profile: MerchantProfile, day: number): VesselClassId | null {
  const next = nextShip(merchant);
  if (!next || merchant.tripsCompleted < 10 || merchant.unitsSold < 20 || merchant.realizedProfit <= 0) return null;
  const barred = VESSEL_CLASSES[next].barredPorts;
  if (barred.includes(profile.homePort) || profile.preferredPorts.some((port) => barred.includes(port))) return null;

  const current = VESSEL_CLASSES[merchant.vesselClass];
  const bigger = VESSEL_CLASSES[next];
  const net = bigger.price - current.price * 0.6;
  const hold = getVesselCargoCapacity(next, { cannon: 0, hull: 0, hold: merchant.holdUpgrades });
  const reserve = hold * WORKING_CAPITAL_PER_HOLD_UNIT + DAILY_RUNNING_COST[next] * CREW_DAYS_KEPT;
  if (merchant.budget - net < reserve * (profile.ambitious ? 1 : CAUTIOUS_PURSE_MULTIPLE)) return null;

  const loadsPerDay = (merchant.tripsCompleted / Math.max(1, day)) * (current.travelFactor / bigger.travelFactor);
  const unitsPerLoad = merchant.unitsSold / merchant.tripsCompleted;
  // A bigger ship also takes thinner margins, so it fills better than this one has.
  const holdUse = Math.max(0.4, Math.min(1, unitsPerLoad / merchant.cargoCapacity));
  const extraUnits = (hold - merchant.cargoCapacity) * holdUse;
  const profitPerUnit = merchant.realizedProfit / merchant.unitsSold;
  // Extra units sell for less, since each one moves the price further.
  const extraIncome = extraUnits * profitPerUnit * 0.6 * loadsPerDay;
  const extraCrew = (DAILY_RUNNING_COST[next] - DAILY_RUNNING_COST[merchant.vesselClass]) * 0.6;
  const extraPerDay = extraIncome - extraCrew;
  return extraPerDay > 0 && net / extraPerDay <= INVESTMENT_PAYBACK_DAYS * (profile.ambitious ? 1 : 0.5)
    ? next
    : null;
}

function invest(world: MerchantDay, start: NpcMerchant, profile: MerchantProfile): NpcMerchant {
  let merchant = start;
  const hold = UPGRADES.find((upgrade) => upgrade.id === "hold")!;
  const holdCost = hold.baseCost * (merchant.holdUpgrades + 1);
  if (profile.ambitious && merchant.holdUpgrades < hold.maxLevel && merchant.budget >= holdCost * 8) {
    const holdUpgrades = merchant.holdUpgrades + 1;
    merchant = {
      ...merchant,
      holdUpgrades,
      budget: merchant.budget - holdCost,
      cargoCapacity: getVesselCargoCapacity(merchant.vesselClass, { cannon: 0, hull: 0, hold: holdUpgrades }),
    };
    note(world, merchant, merchant.currentPort, "invested", "fitted a bigger hold");
  }
  const next = SHIPYARD_PORTS.includes(merchant.currentPort) ? shipWorthBuying(merchant, profile, world.day) : null;
  if (next) {
    const net = VESSEL_CLASSES[next].price - VESSEL_CLASSES[merchant.vesselClass].price * 0.6;
    merchant = {
      ...merchant,
      vesselClass: next,
      budget: Math.round(merchant.budget - net),
      cargoCapacity: getVesselCargoCapacity(next, { cannon: 0, hull: 0, hold: merchant.holdUpgrades }),
    };
    note(world, merchant, merchant.currentPort, "invested", `bought a ${VESSEL_CLASSES[next].name}`);
  }
  return merchant;
}

interface TripChoice {
  port: TownId;
  days: number;
  score: number;
}

/** Rough but quick: the value of what's aboard, plus the best goods to load here, per day. */
function chooseTrip(world: MerchantDay, merchant: NpcMerchant, profile: MerchantProfile): TripChoice | null {
  const rules = TEMPERAMENTS[profile.temperament];
  const here = merchant.currentPort;
  const limit = tripLimit(merchant, profile);
  const ports = allowedPorts(merchant, profile, shipWorthBuying(merchant, profile, world.day) !== null);
  const goods = tradedGoods(profile);
  const poor = isPoor(merchant, profile);
  const room = merchant.cargoCapacity - cargoUnits(merchant);
  const funds = merchant.budget * (1 - (poor ? 0 : rules.reserve));
  const preferred = new Set(profile.preferredPorts);
  const wanted = marginWanted(world, merchant, profile);
  const loadFloor = Math.min(wanted, rules.loadMargin * LOAD_MARGIN_BY_SHIP[merchant.vesselClass]);
  const shipWanted = shipWorthBuying(merchant, profile, world.day) !== null;
  let best: TripChoice | null = null;

  for (const port of ports) {
    if (port === here) continue;
    const route = getMerchantRoute(here, port, merchant.vesselClass, world.conditions);
    if (!route) continue;
    const days = getShipRouteDays(route, merchant.vesselClass);
    if (days > limit) continue;
    const running = DAILY_RUNNING_COST[merchant.vesselClass] * days;
    if (running > merchant.budget) continue;

    let value = 0;
    for (const { id: good } of GOODS) {
      const held = merchant.cargo[good];
      if (held > 0) value += held * (expectedSale(world, merchant, port, good, held / 2) - merchant.cargoCost[good]);
    }

    // The likely load: goods that pay, best first. The best must justify the voyage, and the
    // rest only have to earn a real profit. Each one stops where its margin runs out.
    const money = funds - running * 2;
    const options: { margin: number; price: number; units: number }[] = [];
    for (const good of goods) {
      const stock = world.stock[here][good];
      const available = stock - stallFloor(here, good);
      if (available <= 0) continue;
      const buy = getGoodPrice(here, good, "buy", world.routeAlert, stock);
      if (buy > money) continue;
      const margin = (expectedSale(world, merchant, port, good, 0) - buy) / buy;
      if (margin < loadFloor) continue;
      options.push({
        margin,
        price: buy,
        units: Math.min(available, Math.ceil((margin - loadFloor) / MARGIN_LOST_PER_UNIT) + 1),
      });
    }
    if (options.length > 0 && Math.max(...options.map((option) => option.margin)) < wanted) options.length = 0;
    options.sort((a, b) => b.margin * b.price - a.margin * a.price);
    let roomLeft = room;
    let cash = money;
    for (const option of options) {
      const units = Math.min(roomLeft, option.units, Math.floor(cash / option.price));
      if (units <= 0) continue;
      const averageMargin = Math.max(0, option.margin - (MARGIN_LOST_PER_UNIT * (units - 1)) / 2);
      value += units * option.price * averageMargin;
      roomLeft -= units;
      cash -= units * option.price;
    }

    const score =
      ((value * (1 - rules.riskPerDay * days) - running) / (days + rules.dockDays)) *
      (preferred.has(port) ? 1.2 : 1) *
      // Saved up for a bigger ship: worth a detour to a yard, but not an empty one.
      (shipWanted && SHIPYARD_PORTS.includes(port) ? 1.5 : 1) *
      (0.9 + chance(world.seed, world.day, merchant.id, port) * 0.2);
    if (score > 0 && (!best || score > best.score)) best = { port, days, score };
  }
  return best;
}

function loadCargo(
  world: MerchantDay,
  start: NpcMerchant,
  profile: MerchantProfile,
  trip: TripChoice,
  sailingAnyway = false,
): NpcMerchant {
  const rules = TEMPERAMENTS[profile.temperament];
  const here = start.currentPort;
  const poor = isPoor(start, profile);
  const running = DAILY_RUNNING_COST[start.vesselClass] * trip.days;
  // Keep back the reserve, this voyage's crew, and the crew for the next one.
  let money = start.budget * (1 - (poor ? 0 : rules.reserve)) - running * 2;
  const goods = tradedGoods(profile);
  const wanted = marginWanted(world, start, profile);
  const bought = emptyGoods();
  const paid = emptyGoods();
  let room = start.cargoCapacity - cargoUnits(start);

  const loadFloor = Math.min(wanted, rules.loadMargin * LOAD_MARGIN_BY_SHIP[start.vesselClass]);
  const fullRoom = room;
  while (room > 0) {
    let pick: GoodId | null = null;
    let pickProfit = 0;
    let pickPrice = 0;
    for (const good of goods) {
      const stock = world.stock[here][good];
      if (stock <= stallFloor(here, good)) continue;
      const price = getGoodPrice(here, good, "buy", world.routeAlert, stock);
      if (price > money) continue;
      const profit = expectedSale(world, start, trip.port, good, start.cargo[good] + bought[good]) - price;
      // The best good has to justify the voyage. After that, any good is worth carrying as long
      // as the next unit still earns a real profit, which is how a big hold earns its keep:
      // several cargoes at fair margins, rather than one pushed until its price collapses.
      // On a trip it's making anyway, any profitable cargo beats sailing empty.
      if (profit < price * (room === fullRoom && !sailingAnyway ? wanted : loadFloor)) continue;
      if (profit > pickProfit) {
        pick = good;
        pickProfit = profit;
        pickPrice = price;
      }
    }
    if (!pick) break;
    world.stock[here][pick] -= 1;
    bought[pick] += 1;
    paid[pick] += pickPrice;
    money -= pickPrice;
    room -= 1;
  }

  let merchant = start;
  for (const { id: good } of GOODS) {
    if (bought[good] === 0) continue;
    const held = merchant.cargo[good];
    merchant = {
      ...merchant,
      budget: merchant.budget - paid[good],
      cargo: { ...merchant.cargo, [good]: held + bought[good] },
      cargoCost: {
        ...merchant.cargoCost,
        [good]: (merchant.cargoCost[good] * held + paid[good]) / (held + bought[good]),
      },
      unitsBought: merchant.unitsBought + bought[good],
      purchaseDay: world.day,
      lastTradeDay: world.day,
    };
    note(world, merchant, here, "bought", `bought ${bought[good]} ${goodName(good)}`, good, bought[good]);
  }
  return merchant;
}

/**
 * With nothing worth carrying from here, an empty ship looks for a port that has a cargo worth
 * buying right now. If nowhere does, it stays put: sailing empty costs money.
 */
function chooseEmptyTrip(world: MerchantDay, merchant: NpcMerchant, profile: MerchantProfile): TripChoice | null {
  if (cargoUnits(merchant) > 0) return null;
  const limit = tripLimit(merchant, profile);
  const goods = tradedGoods(profile);
  const wanted = marginWanted(world, merchant, profile);
  const shipWanted = shipWorthBuying(merchant, profile, world.day) !== null;
  const ports = allowedPorts(merchant, profile, shipWanted);
  let best: TripChoice | null = null;
  for (const port of ports) {
    if (port === merchant.currentPort) continue;
    const route = getMerchantRoute(merchant.currentPort, port, merchant.vesselClass, world.conditions);
    if (!route) continue;
    const days = getShipRouteDays(route, merchant.vesselClass);
    if (days > limit) continue;
    const running = DAILY_RUNNING_COST[merchant.vesselClass] * days;
    if (merchant.budget < running * 2 + 300) continue;
    let opportunity = 0;
    for (const good of goods) {
      const stock = world.stock[port][good];
      if (stock <= stallFloor(port, good)) continue;
      const buy = getGoodPrice(port, good, "buy", world.routeAlert, stock);
      if (buy > merchant.budget) continue;
      for (const market of ports) {
        if (market === port || !getMerchantRoute(port, market, merchant.vesselClass, world.conditions)) continue;
        const margin = (expectedSale(world, merchant, market, good, 0) - buy) / buy;
        if (margin >= wanted) opportunity = Math.max(opportunity, margin * buy);
      }
    }
    if (opportunity <= 0 && !(shipWanted && SHIPYARD_PORTS.includes(port))) continue;
    const score = (opportunity + 1) / (days + 1);
    if (!best || score > best.score) best = { port, days, score };
  }
  return best;
}

function departFor(world: MerchantDay, start: NpcMerchant, trip: TripChoice): NpcMerchant {
  const running = DAILY_RUNNING_COST[start.vesselClass] * trip.days;
  const merchant: NpcMerchant = {
    ...start,
    budget: Math.max(0, start.budget - running),
    destinationPort: trip.port,
    phase: "traveling",
    travelDaysRemaining: trip.days,
    travelDaysTotal: trip.days,
    dockDaysRemaining: 0,
  };
  for (const { id: good } of GOODS) world.inbound[trip.port][good] += merchant.cargo[good];
  note(world, merchant, merchant.currentPort, "sailed", `sailed toward ${getTown(trip.port).name}`);
  return merchant;
}

function runOneMerchant(world: MerchantDay, start: NpcMerchant): NpcMerchant {
  const profile = getMerchantProfile(start.id);
  if (!profile) return start;
  let merchant = start;

  if (merchant.phase === "traveling") {
    const remaining = merchant.travelDaysRemaining - 1;
    if (remaining > 0) return { ...merchant, travelDaysRemaining: remaining };
    const port = merchant.destinationPort;
    for (const { id: good } of GOODS) {
      world.inbound[port][good] = Math.max(0, world.inbound[port][good] - merchant.cargo[good]);
    }
    const firstVisit = !merchant.visitedPorts.includes(port);
    merchant = {
      ...merchant,
      phase: "docked",
      currentPort: port,
      travelDaysRemaining: 0,
      travelDaysTotal: 0,
      dockDaysRemaining: TEMPERAMENTS[profile.temperament].dockDays,
      visitedPorts: firstVisit ? [...merchant.visitedPorts, port] : merchant.visitedPorts,
      tripsCompleted: merchant.tripsCompleted + 1,
    };
    if (firstVisit) merchant = earnReputation(merchant, 1);
    note(world, merchant, port, "arrived", "arrived");
    return sellHere(world, merchant, profile);
  }

  if (merchant.dockDaysRemaining > 1) {
    return { ...sellHere(world, merchant, profile), dockDaysRemaining: merchant.dockDaysRemaining - 1 };
  }

  merchant = sellHere(world, { ...merchant, dockDaysRemaining: 0 }, profile);
  merchant = invest(world, merchant, profile);
  const trip = chooseTrip(world, merchant, profile);
  if (trip) {
    merchant = loadCargo(world, merchant, profile, trip);
    if (cargoUnits(merchant) > 0) return departFor(world, merchant, trip);
  }
  // Goods nobody will pay for, and a purse too thin to carry them away: cut the loss.
  if (cargoUnits(merchant) > 0 && merchant.budget < DAILY_RUNNING_COST[merchant.vesselClass]) {
    return sellHere(world, merchant, profile, 0);
  }
  // Sailing empty costs money, so most days a merchant waits to see if prices improve.
  if (chance(world.seed, world.day, merchant.id, "reposition") > EMPTY_TRIP_CHANCE) return merchant;
  const emptyTrip = chooseEmptyTrip(world, merchant, profile);
  return emptyTrip
    ? departFor(world, loadCargo(world, merchant, profile, emptyTrip, true), emptyTrip)
    : merchant;
}

/** One world day for every merchant, in an order that changes daily so nobody always goes first. */
export function runMerchantDay(state: GameState, day: number): GameState {
  if (state.npcMerchants.length === 0) return state;
  const inbound = Object.fromEntries(
    TOWNS.map((town) => [town.id, emptyGoods()]),
  ) as MerchantDay["inbound"];
  for (const merchant of state.npcMerchants) {
    if (merchant.phase !== "traveling") continue;
    for (const { id: good } of GOODS) inbound[merchant.destinationPort][good] += merchant.cargo[good];
  }
  const world: MerchantDay = {
    stock: Object.fromEntries(
      Object.entries(state.marketStock).map(([port, stalls]) => [port, { ...stalls }]),
    ) as GameState["marketStock"],
    merchants: new Map(state.npcMerchants.map((merchant) => [merchant.id, merchant])),
    activity: [...state.npcActivity],
    inbound,
    day,
    seed: state.worldSeed,
    routeAlert: isHistoricalRouteAlertActive(state),
    conditions: state.navigationConditions,
  };
  const order = [...state.npcMerchants].sort(
    (a, b) => chance(state.worldSeed, day, a.id) - chance(state.worldSeed, day, b.id) || a.id.localeCompare(b.id),
  );
  for (const { id } of order) world.merchants.set(id, runOneMerchant(world, world.merchants.get(id)!));
  return {
    ...state,
    marketStock: world.stock,
    npcMerchants: state.npcMerchants.map((merchant) => world.merchants.get(merchant.id)!),
    npcActivity: keepRecentActivity(world.activity),
  };
}
