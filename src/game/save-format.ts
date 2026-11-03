// Save validation and migrations. Pure, so the server can use them too.
import { PLAYER_ENTRY_ID, createLeaderboardSnapshot } from "./leaderboard";
import {
  MARKET_MAX_STOCK,
  WAREHOUSE_CAPACITY,
  GOODS,
  MILESTONES,
  MARKET_PORTS,
  PROSPEROUS_MERCHANT_COINS,
  SAVE_VERSION,
  MAX_PLAYER_SHIPS,
  TOWNS,
  UPGRADES,
  createInitialMarketStock,
  createEmptyFarmOutput,
  createEmptyFarmProductionDays,
  createEmptyHousehold,
  createEmptyLocalStanding,
  createMissionBoard,
  createNpcMerchants,
  getMerchantRoute,
  advanceMarketStock,
  createEmptyWarehouseStock,
  createEmptyWarehousePurchasePrices,
  STARTER_SHIP_ID,
  VESSEL_CLASSES,
  getVesselCargoCapacity,
  getVesselMaximumHull,
  FARM_OUTPUT_CAPACITY,
  MAX_AUTOMATED_ROUTE_CAPITAL,
  formatCoins,
  getGoodPrice,
  getShipRouteConditions,
  getShipRouteDays,
  type GameState,
  type AutomatedTradeRoute,
  type AutomatedTradeRule,
  type GoodId,
  type MilestoneId,
  type Mission,
  type NpcActivity,
  type NpcMerchant,
  type PlayerShip,
  type TownId,
  type TravelEventId,
  type VesselClassId,
  type Voyage,
} from "./model";
import {
  RIVER_EDGES,
  buildRiverRoute,
  planRiverRoute,
  type RiverRoute,
  type RouteConditions,
} from "./navigation";
import {
  getRouteTravelTime,
  SAILING_SPEEDS,
  type SailingSpeed,
} from "./travel-time";
import { MAX_NPC_ACTIVITY, hashText } from "./npc";
import { LEGACY_MERCHANT_IDS } from "./npc-roster";

const COINS_PER_GOLD = 50;

/** The save was written by a later version of the game, so this one can't read it. */
export class NewerSaveError extends Error {
  constructor() {
    super("Your save is from a newer version of the game. Reload the page to update, and your progress will be there.");
    this.name = "NewerSaveError";
  }
}

export function isNewerSave(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { version?: unknown }).version === "number" &&
    (value as { version: number }).version > SAVE_VERSION
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonnegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isNonnegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isTownId(value: unknown): value is TownId {
  return typeof value === "string" && TOWNS.some((town) => town.id === value);
}

function isMilestoneId(value: unknown): value is MilestoneId {
  return MILESTONES.some((milestone) => milestone.id === value);
}

function isProfitableTradeMark(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const [townId, goodId, extra] = value.split(":");
  return (
    extra === undefined &&
    isTownId(townId) &&
    GOODS.some((good) => good.id === goodId)
  );
}

function isSailingSpeed(value: unknown): value is SailingSpeed {
  return (
    typeof value === "number" &&
    (SAILING_SPEEDS as readonly number[]).includes(value)
  );
}

function isTravelEventId(value: unknown): value is TravelEventId | null {
  return value === null || value === "river-pilot" || value === "rough-water";
}

function isVesselClassId(value: unknown): value is VesselClassId {
  return typeof value === "string" && Object.hasOwn(VESSEL_CLASSES, value);
}

function isValidVoyage(
  value: unknown,
  sailingSpeed: SailingSpeed,
  travelFactor: number,
): value is Voyage | null {
  if (value === null) return true;
  return (
    isRecord(value) &&
    typeof value.shipId === "string" &&
    value.shipId.length > 0 &&
    isTownId(value.origin) &&
    isTownId(value.destination) &&
    typeof value.startedAt === "number" &&
    Number.isFinite(value.startedAt) &&
    typeof value.arrivalAt === "number" &&
    Number.isFinite(value.arrivalAt) &&
    value.arrivalAt > value.startedAt &&
    typeof value.durationMs === "number" &&
    Number.isFinite(value.durationMs) &&
    value.durationMs > 0 &&
    typeof value.elapsedMs === "number" &&
    Number.isFinite(value.elapsedMs) &&
    value.elapsedMs >= 0 &&
    value.elapsedMs <= value.durationMs &&
    typeof value.progressUpdatedAt === "number" &&
    Number.isFinite(value.progressUpdatedAt) &&
    value.progressUpdatedAt >= value.startedAt &&
    typeof value.durationDays === "number" &&
    Number.isFinite(value.durationDays) &&
    value.durationDays > 0 &&
    typeof value.routeAlert === "boolean" &&
    isTravelEventId(value.travelEvent) &&
    isValidRiverRoute(value.route, value.origin, value.destination) &&
    isVoyageTimingConsistent(value, sailingSpeed, travelFactor)
  );
}

function isValidPlayerShip(value: unknown): value is PlayerShip {
  if (!isRecord(value)) return false;
  const upgrades = value.upgrades;
  const cargo = value.cargo;
  const averagePurchasePrice = value.averagePurchasePrice;
  if (
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    value.id.length > 40 ||
    typeof value.name !== "string" ||
    value.name.length === 0 ||
    value.name.length > 32 ||
    !isTownId(value.currentPort) ||
    !isRecord(upgrades) ||
    !isRecord(cargo) ||
    !isRecord(averagePurchasePrice) ||
    !isSailingSpeed(value.sailingSpeed) ||
    !isVesselClassId(value.vesselClass) ||
    !isNonnegativeInteger(value.shipHull)
  ) {
    return false;
  }

  const validUpgrades = UPGRADES.every(
    (upgrade) =>
      isNonnegativeInteger(upgrades[upgrade.id]) &&
      Number(upgrades[upgrade.id]) <= upgrade.maxLevel,
  );
  if (!validUpgrades) return false;
  const cargoCapacity = getVesselCargoCapacity(
    value.vesselClass,
    upgrades as unknown as PlayerShip["upgrades"],
  );
  const cargoUsed = GOODS.reduce(
    (total, good) => total + Number(cargo[good.id] ?? 0),
    0,
  );
  return (
    (value.automatedRoute === null ||
      isValidAutomatedTradeRoute(value.automatedRoute, value)) &&
    Array.isArray(value.automationLog) &&
    value.automationLog.length <= 8 &&
    value.automationLog.every(
      (entry) =>
        isRecord(entry) &&
        isNonnegativeInteger(entry.sailingDay) &&
        isTownId(entry.port) &&
        typeof entry.message === "string" &&
        entry.message.length > 0 &&
        entry.message.length <= 180,
    ) &&
    isValidShipReturnOrder(value.returnOrder, value) &&
    value.cargoCapacity === cargoCapacity &&
    value.shipHull <=
      getVesselMaximumHull(value.vesselClass, upgrades as unknown as PlayerShip["upgrades"]) &&
    cargoUsed <= cargoCapacity &&
    GOODS.every(
      (good) =>
        isNonnegativeInteger(cargo[good.id]) &&
        isNonnegativeFiniteNumber(averagePurchasePrice[good.id]) &&
        (Number(cargo[good.id]) > 0 ||
          Number(averagePurchasePrice[good.id]) === 0),
    )
  );
}

function isValidShipReturnOrder(
  value: unknown,
  ship: Record<string, unknown>,
): boolean {
  if (value === null) return true;
  return (
    isRecord(value) &&
    ship.automatedRoute === null &&
    isTownId(value.destination) &&
    value.destination !== ship.currentPort &&
    isNonnegativeInteger(value.travelDaysTotal) &&
    value.travelDaysTotal >= 1 &&
    value.travelDaysTotal <= 30 &&
    isNonnegativeInteger(value.travelDaysRemaining) &&
    value.travelDaysRemaining >= 1 &&
    value.travelDaysRemaining <= value.travelDaysTotal
  );
}

function isValidAutomatedTradeRoute(
  value: unknown,
  ship: Record<string, unknown>,
): value is AutomatedTradeRoute {
  if (!isRecord(value)) return false;
  const rules = value.rules;
  if (
    !isTownId(value.origin) ||
    !isTownId(value.destination) ||
    value.origin === value.destination ||
    !isTownId(value.destinationPort) ||
    !Array.isArray(rules) ||
    rules.length === 0 ||
    rules.length > GOODS.length ||
    (value.status !== "running" && value.status !== "paused") ||
    (value.phase !== "docked" && value.phase !== "traveling") ||
    (value.direction !== "outbound" && value.direction !== "return") ||
    !isNonnegativeInteger(value.travelDaysRemaining) ||
    !isNonnegativeInteger(value.travelDaysTotal) ||
    !isNonnegativeInteger(value.capital) ||
    value.capital > MAX_AUTOMATED_ROUTE_CAPITAL ||
    !isTownId(ship.currentPort) ||
    (ship.currentPort !== value.origin && ship.currentPort !== value.destination)
  ) {
    return false;
  }
  const validRules = rules.every(
    (rule): rule is AutomatedTradeRule =>
      isRecord(rule) &&
      GOODS.some((good) => good.id === rule.good) &&
      typeof rule.buyAtOrigin === "boolean" &&
      typeof rule.sellAtDestination === "boolean" &&
      (rule.buyAtOrigin || rule.sellAtDestination),
  );
  const nextPort =
    ship.currentPort === value.origin ? value.destination : value.origin;
  const route = planRiverRoute(ship.currentPort, nextPort);
  return (
    validRules &&
    new Set(rules.map((rule) => (isRecord(rule) ? rule.good : ""))).size ===
      rules.length &&
    rules.some((rule) => isRecord(rule) && rule.buyAtOrigin) &&
    rules.some((rule) => isRecord(rule) && rule.sellAtDestination) &&
    (value.phase === "docked"
      ? value.travelDaysRemaining === 0 &&
        value.travelDaysTotal === 0 &&
        value.destinationPort === nextPort
      : value.status === "running" &&
        value.destinationPort === nextPort &&
        route !== null &&
        value.travelDaysTotal >= 1 &&
        value.travelDaysTotal <= 30 &&
        value.travelDaysRemaining > 0 &&
        value.travelDaysRemaining <= value.travelDaysTotal)
  );
}

function isMissionType(value: unknown): value is Mission["type"] {
  return (
    value === "delivery" ||
    value === "purchase_delivery" ||
    value === "visit" ||
    value === "profitable_trade"
  );
}

function isValidMissions(value: unknown, sailingDay: number): value is Mission[] {
  if (!Array.isArray(value)) return false;
  const templates = createMissionBoard();
  if (value.length !== templates.length) return false;
  return (
    value.every((mission) => {
      if (!isRecord(mission)) return false;
      const template = templates.find((entry) => entry.id === mission.id);
      if (
        !template ||
        !isMissionType(mission.type) ||
        mission.type !== template.type ||
        mission.origin !== template.origin ||
        mission.destination !== template.destination ||
        mission.good !== template.good ||
        mission.quantity !== template.quantity ||
        mission.targetProfit !== template.targetProfit ||
        mission.rewardCoins !== template.rewardCoins ||
        mission.deadlineDays !== template.deadlineDays ||
        (mission.status !== "available" &&
          mission.status !== "active" &&
          mission.status !== "completed" &&
          mission.status !== "expired") ||
        !isNonnegativeFiniteNumber(mission.progress) ||
        !isNonnegativeInteger(mission.purchasedQuantity) ||
        mission.purchasedQuantity > template.quantity ||
        (template.type === "delivery" &&
          mission.progress > template.quantity) ||
        (template.type === "purchase_delivery" &&
          mission.progress > template.quantity) ||
        (template.type === "visit" && mission.progress > 1) ||
        (template.type === "profitable_trade" &&
          mission.progress > template.targetProfit)
      ) {
        return false;
      }

      const acceptedAt = mission.acceptedAtSailingDay;
      const deadline = mission.deadlineSailingDay;
      if (mission.status === "available") {
        return (
          acceptedAt === null &&
          deadline === null &&
          mission.progress === 0 &&
          mission.purchasedQuantity === 0
        );
      }
      if (
        !isNonnegativeFiniteNumber(acceptedAt) ||
        !isNonnegativeFiniteNumber(deadline) ||
        acceptedAt > sailingDay ||
        Math.abs(deadline - acceptedAt - template.deadlineDays) > 0.000001
      ) {
        return false;
      }
      if (mission.status === "active") return deadline >= sailingDay;
      if (mission.status === "expired") return deadline < sailingDay;
      const completionTarget =
        template.type === "profitable_trade" ? template.targetProfit : template.quantity;
      return mission.progress >= completionTarget;
    }) &&
    new Set(value.map((mission) => isRecord(mission) ? mission.id : null)).size ===
      value.length
  );
}

function isValidLeaderboard(value: unknown, ids: Set<string>, lowest: number): boolean {
  if (!Array.isArray(value) || value.length !== ids.size) return false;
  const seen = new Set<string>();
  return value.every((entry, index) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== "string" ||
      !ids.has(entry.id) ||
      seen.has(entry.id) ||
      !Number.isSafeInteger(entry.value) ||
      Number(entry.value) < lowest ||
      entry.rank !== index + 1 ||
      !(
        entry.previousRank === null ||
        (isNonnegativeInteger(entry.previousRank) &&
          entry.previousRank >= 1 &&
          entry.previousRank <= ids.size)
      ) ||
      (index > 0 && Number((value[index - 1] as { value: number }).value) < Number(entry.value))
    ) {
      return false;
    }
    seen.add(entry.id);
    return true;
  });
}

function isValidLeaderboards(
  value: unknown,
  merchants: NpcMerchant[],
  worldDay: number,
): boolean {
  if (!isRecord(value) || !isNonnegativeInteger(value.day) || value.day > worldDay) return false;
  const ids = new Set([PLAYER_ENTRY_ID, ...merchants.map((merchant) => merchant.id)]);
  // Debt can take net worth below zero, but nothing can do that to influence.
  return (
    isValidLeaderboard(value.wealth, ids, Number.MIN_SAFE_INTEGER) &&
    isValidLeaderboard(value.influence, ids, 0)
  );
}

function isValidNpcMerchants(value: unknown): value is NpcMerchant[] {
  if (!Array.isArray(value)) return false;
  const templates = createNpcMerchants();
  const hold = UPGRADES.find((upgrade) => upgrade.id === "hold")!;
  return (
    value.length === templates.length &&
    new Set(value.map((merchant) => (isRecord(merchant) ? merchant.id : ""))).size === templates.length &&
    value.every((merchant) => {
      if (!isRecord(merchant)) return false;
      const template = templates.find((entry) => entry.id === merchant.id);
      if (
        !template ||
        merchant.name !== template.name ||
        merchant.homePort !== template.homePort ||
        merchant.strategy !== template.strategy ||
        !isVesselClassId(merchant.vesselClass) ||
        !isNonnegativeInteger(merchant.holdUpgrades) ||
        Number(merchant.holdUpgrades) > hold.maxLevel ||
        merchant.cargoCapacity !==
          getVesselCargoCapacity(merchant.vesselClass, {
            cannon: 0,
            hull: 0,
            hold: Number(merchant.holdUpgrades),
          }) ||
        !isTownId(merchant.currentPort) ||
        !isTownId(merchant.destinationPort) ||
        VESSEL_CLASSES[merchant.vesselClass].barredPorts.includes(merchant.currentPort) ||
        VESSEL_CLASSES[merchant.vesselClass].barredPorts.includes(merchant.destinationPort) ||
        (merchant.phase !== "docked" && merchant.phase !== "traveling") ||
        !isNonnegativeFiniteNumber(merchant.budget) ||
        !Array.isArray(merchant.preferences) ||
        JSON.stringify(merchant.preferences) !== JSON.stringify(template.preferences) ||
        !Array.isArray(merchant.preferredPorts) ||
        JSON.stringify(merchant.preferredPorts) !== JSON.stringify(template.preferredPorts) ||
        !isNonnegativeFiniteNumber(merchant.travelDaysRemaining) ||
        !isNonnegativeFiniteNumber(merchant.travelDaysTotal) ||
        !isNonnegativeInteger(merchant.dockDaysRemaining) ||
        !isNonnegativeFiniteNumber(merchant.purchaseDay) ||
        !isNonnegativeInteger(merchant.reputation) ||
        !Array.isArray(merchant.visitedPorts) ||
        !merchant.visitedPorts.every(isTownId) ||
        !Array.isArray(merchant.profitMarks) ||
        !merchant.profitMarks.every(isNonnegativeInteger) ||
        !isNonnegativeInteger(merchant.tripsCompleted) ||
        !isNonnegativeInteger(merchant.unitsBought) ||
        !isNonnegativeInteger(merchant.unitsSold) ||
        typeof merchant.realizedProfit !== "number" ||
        !Number.isFinite(merchant.realizedProfit) ||
        !isNonnegativeFiniteNumber(merchant.lastTradeDay)
      ) {
        return false;
      }
      const cargo = merchant.cargo;
      const costs = merchant.cargoCost;
      if (!isRecord(cargo) || !isRecord(costs)) return false;
      const cargoUsed = GOODS.reduce((total, good) => total + Number(cargo[good.id] ?? 0), 0);
      const validGoods = GOODS.every(
        (good) =>
          isNonnegativeInteger(cargo[good.id]) &&
          isNonnegativeFiniteNumber(costs[good.id]) &&
          (Number(cargo[good.id]) > 0 || Number(costs[good.id]) === 0),
      );
      return (
        validGoods &&
        cargoUsed <= merchant.cargoCapacity &&
        (merchant.phase === "docked"
          ? merchant.travelDaysRemaining === 0 &&
            merchant.travelDaysTotal === 0 &&
            merchant.currentPort === merchant.destinationPort
          : merchant.currentPort !== merchant.destinationPort &&
            getMerchantRoute(merchant.currentPort, merchant.destinationPort, merchant.vesselClass) !== null &&
            merchant.travelDaysRemaining > 0 &&
            merchant.travelDaysRemaining <= merchant.travelDaysTotal)
      );
    })
  );
}

function isValidNpcActivity(value: unknown, maxDay: number): value is NpcActivity[] {
  if (!Array.isArray(value) || value.length > MAX_NPC_ACTIVITY) return false;
  const merchantIds = new Set(createNpcMerchants().map((merchant) => merchant.id));
  return value.every(
    (activity) =>
      isRecord(activity) &&
      typeof activity.id === "string" &&
      activity.id.length > 0 &&
      typeof activity.merchantId === "string" &&
      merchantIds.has(activity.merchantId) &&
      isTownId(activity.town) &&
      isNonnegativeFiniteNumber(activity.sailingDay) &&
      activity.sailingDay <= maxDay &&
      typeof activity.message === "string" &&
      activity.message.length <= 100,
  );
}

function isVoyageTimingConsistent(
  value: Record<string, unknown>,
  sailingSpeed: SailingSpeed,
  travelFactor: number,
): boolean {
  const timing = getRouteTravelTime(
    value.route as RiverRoute,
    value.routeAlert === true,
    travelFactor,
  );
  const expectedArrivalAt =
    Number(value.progressUpdatedAt) +
    (timing.durationMs - Number(value.elapsedMs)) / sailingSpeed;
  return (
    Math.abs(Number(value.durationMs) - timing.durationMs) < 0.001 &&
    Math.abs(Number(value.arrivalAt) - expectedArrivalAt) < 0.001 &&
    Math.abs(Number(value.durationDays) - timing.durationDays) < 0.000001
  );
}

function isValidRiverRoute(
  value: unknown,
  origin: unknown,
  destination: unknown,
): value is RiverRoute {
  if (
    !isRecord(value) ||
    !isTownId(origin) ||
    !isTownId(destination) ||
    value.origin !== origin ||
    value.destination !== destination ||
    !Array.isArray(value.edgeIds) ||
    !value.edgeIds.every((edgeId) => typeof edgeId === "string") ||
    !Array.isArray(value.points) ||
    value.points.length < 2 ||
    !value.points.every(
      (point) =>
        isRecord(point) &&
        typeof point.x === "number" &&
        Number.isFinite(point.x) &&
        point.x >= 0 &&
        point.x <= 1152 &&
        typeof point.y === "number" &&
        Number.isFinite(point.y) &&
        point.y >= 0 &&
        point.y <= 768,
    ) ||
    typeof value.distance !== "number" ||
    !Number.isFinite(value.distance) ||
    value.distance <= 0
  ) {
    return false;
  }

  const expectedRoute = buildRiverRoute(
    origin,
    destination,
    value.edgeIds as string[],
  );
  return Boolean(
    expectedRoute &&
      JSON.stringify(value.points) === JSON.stringify(expectedRoute.points) &&
      JSON.stringify(value.legs) === JSON.stringify(expectedRoute.legs) &&
      value.distance === expectedRoute.distance,
  );
}

const LEGACY_TOWN_IDS = new Set([
  "dhaka",
  "sonargaon",
  "kasimbazar",
  "chittagong",
  "sylhet",
]);
const LEGACY_PORT_LOCATIONS: Record<string, { x: number; y: number }> = {
  dhaka: { x: 334, y: 275 },
  sonargaon: { x: 410, y: 328 },
  kasimbazar: { x: 270, y: 153 },
  chittagong: { x: 514, y: 443 },
  sylhet: { x: 465, y: 132 },
};
const LEGACY_EDGE_CONNECTIONS: Record<string, readonly [string, string]> = {
  "northwest-channel": ["kasimbazar", "upper-bend"],
  "upper-river": ["upper-bend", "dhaka"],
  "sylhet-branch": ["upper-bend", "sylhet"],
  "eastern-river": ["dhaka", "sonargaon"],
  "southern-channel": ["sonargaon", "lower-bend"],
  "coastal-channel": ["lower-bend", "chittagong"],
};

function isLegacyRiverRoute(
  value: unknown,
  origin: unknown,
  destination: unknown,
): value is RiverRoute {
  if (
    !isRecord(value) ||
    typeof origin !== "string" ||
    typeof destination !== "string" ||
    !LEGACY_TOWN_IDS.has(origin) ||
    !LEGACY_TOWN_IDS.has(destination) ||
    !Array.isArray(value.edgeIds) ||
    value.edgeIds.length === 0 ||
    !value.edgeIds.every(
      (edgeId) =>
        typeof edgeId === "string" &&
        Object.hasOwn(LEGACY_EDGE_CONNECTIONS, edgeId),
    ) ||
    !Array.isArray(value.points) ||
    value.points.length < 2 ||
    !value.points.every(
      (point) =>
        isRecord(point) &&
        typeof point.x === "number" &&
        Number.isFinite(point.x) &&
        point.x >= 0 &&
        point.x <= 640 &&
        typeof point.y === "number" &&
        Number.isFinite(point.y) &&
        point.y >= 0 &&
        point.y <= 720,
    ) ||
    typeof value.distance !== "number" ||
    !Number.isFinite(value.distance) ||
    value.distance <= 0 ||
    value.origin !== origin ||
    value.destination !== destination
  ) {
    return false;
  }

  const first = value.points[0];
  const last = value.points.at(-1);
  const expectedStart = LEGACY_PORT_LOCATIONS[origin];
  const expectedEnd = LEGACY_PORT_LOCATIONS[destination];
  if (
    !expectedStart ||
    !expectedEnd ||
    !isRecord(first) ||
    !isRecord(last) ||
    first.x !== expectedStart.x ||
    first.y !== expectedStart.y ||
    last.x !== expectedEnd.x ||
    last.y !== expectedEnd.y
  ) {
    return false;
  }

  let cursor = origin;
  for (const edgeId of value.edgeIds) {
    if (typeof edgeId !== "string") return false;
    const connection = LEGACY_EDGE_CONNECTIONS[edgeId];
    if (connection[0] === cursor) cursor = connection[1];
    else if (connection[1] === cursor) cursor = connection[0];
    else return false;
  }
  if (cursor !== destination) return false;

  const points = value.points;
  if (!Array.isArray(points)) return false;
  const routeDistance = points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    if (!isRecord(previous) || !isRecord(point)) return Number.NaN;
    return total + Math.hypot(
      Number(point.x) - Number(previous.x),
      Number(point.y) - Number(previous.y),
    );
  }, 0);
  return Math.abs(routeDistance - value.distance) < 0.001;
}

function migrateActiveVoyageRoute(value: unknown, now: number): unknown {
  if (!isRecord(value) || !isRecord(value.voyage)) return value;
  const voyage = value.voyage;
  if (
    isValidRiverRoute(voyage.route, voyage.origin, voyage.destination) ||
    !isLegacyRiverRoute(voyage.route, voyage.origin, voyage.destination) ||
    !isTownId(voyage.origin) ||
    !isTownId(voyage.destination)
  ) {
    return value;
  }

  const route = planRiverRoute(voyage.origin, voyage.destination);
  if (!route) return value;
  const oldDuration = Number(voyage.durationMs);
  const oldElapsed = Number(voyage.elapsedMs);
  const sailingSpeed = isSailingSpeed(value.sailingSpeed)
    ? value.sailingSpeed
    : 1;
  if (
    !Number.isFinite(oldDuration) ||
    oldDuration <= 0 ||
    !Number.isFinite(oldElapsed) ||
    oldElapsed < 0
  ) {
    return value;
  }

  const timing = getRouteTravelTime(route, voyage.routeAlert === true);
  const progress = Math.max(0, Math.min(1, oldElapsed / oldDuration));
  const elapsedMs = timing.durationMs * progress;
  const arrivalAt = now + (timing.durationMs - elapsedMs) / sailingSpeed;
  return {
    ...value,
    voyage: {
      ...voyage,
      route,
      startedAt: Math.min(now - elapsedMs / sailingSpeed, arrivalAt - 1),
      arrivalAt,
      durationMs: timing.durationMs,
      elapsedMs,
      progressUpdatedAt: now,
      durationDays: timing.durationDays,
    },
  };
}

function reanchorPausedVoyage(value: unknown, now: number): unknown {
  if (!isRecord(value) || !isRecord(value.voyage)) return value;
  const voyage = value.voyage;
  const sailingSpeed = isSailingSpeed(value.sailingSpeed)
    ? value.sailingSpeed
    : 1;
  const durationMs = Number(voyage.durationMs);
  const elapsedMs = Number(voyage.elapsedMs);
  if (
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs < 0 ||
    elapsedMs > durationMs
  ) {
    return value;
  }

  return {
    ...value,
    voyage: {
      ...voyage,
      startedAt: Math.min(Number(voyage.startedAt), now),
      arrivalAt: now + (durationMs - elapsedMs) / sailingSpeed,
      progressUpdatedAt: now,
    },
  };
}

function isValidRouteConditions(value: unknown): value is RouteConditions {
  if (!isRecord(value)) return false;
  const edgeIds = new Set(RIVER_EDGES.map((edge) => edge.id));
  const blockageFields = [
    "eventBlockages",
    "militaryBlockages",
    "weatherBlockages",
  ] as const;
  return (
    blockageFields.every(
      (field) =>
        value[field] === undefined ||
        (Array.isArray(value[field]) &&
          value[field].every(
            (edgeId) => typeof edgeId === "string" && edgeIds.has(edgeId),
          )),
    ) &&
    (value.vesselDraft === undefined ||
      (typeof value.vesselDraft === "number" &&
        Number.isFinite(value.vesselDraft) &&
        value.vesselDraft >= 0))
  );
}

export function isValidGameState(value: unknown): value is GameState {
  if (!isRecord(value)) return false;

  const cargo = value.cargo;
  const averagePurchasePrice = value.averagePurchasePrice;
  const upgrades = value.upgrades;
  const marketStock = value.marketStock;
  const warehouseStock = value.warehouseStock;
  const warehouseAveragePurchasePrice = value.warehouseAveragePurchasePrice;
  const ownedWarehouses = value.ownedWarehouses;
  const ownedFarms = value.ownedFarms;
  const household = value.household;
  const missions = value.missions;
  const localStanding = value.localStanding;
  const npcMerchants = value.npcMerchants;
  const npcActivity = value.npcActivity;
  const fleet = value.fleet;
  const selectedShipId = value.selectedShipId;
  const farmOutput = value.farmOutput;
  const farmProductionDay = value.farmProductionDay;
  const visitedTowns = value.visitedTowns;
  const profitableTradeMarks = value.profitableTradeMarks;
  const completedMilestones = value.completedMilestones;
  if (
    !isRecord(cargo) ||
    !isRecord(averagePurchasePrice) ||
    !isRecord(upgrades) ||
    !isRecord(marketStock) ||
    !isRecord(warehouseStock) ||
    !isRecord(warehouseAveragePurchasePrice) ||
    !Array.isArray(ownedWarehouses) ||
    !Array.isArray(ownedFarms) ||
    !isRecord(household) ||
    !isRecord(localStanding) ||
    !Array.isArray(npcMerchants) ||
    !Array.isArray(npcActivity) ||
    !Array.isArray(fleet) ||
    typeof selectedShipId !== "string" ||
    !isRecord(farmOutput) ||
    !isRecord(farmProductionDay) ||
    !Array.isArray(visitedTowns) ||
    !Array.isArray(profitableTradeMarks) ||
    !Array.isArray(completedMilestones)
  ) return false;

  const validGoods = GOODS.every(
    (good) =>
      isNonnegativeInteger(cargo[good.id]) &&
      isNonnegativeFiniteNumber(averagePurchasePrice[good.id]) &&
      (Number(cargo[good.id]) > 0 ||
        Number(averagePurchasePrice[good.id]) === 0),
  );
  const validUpgrades = UPGRADES.every(
    (upgrade) =>
      isNonnegativeInteger(upgrades[upgrade.id]) &&
      Number(upgrades[upgrade.id]) <= upgrade.maxLevel,
  );
  const validMarkets = MARKET_PORTS.every((port) => {
    const stock = marketStock[port.id];
    return (
      isRecord(stock) &&
      GOODS.every(
        (good) =>
          isNonnegativeInteger(stock[good.id]) &&
          Number(stock[good.id]) <= MARKET_MAX_STOCK,
      )
    );
  });
  const validProgress = (
    visitedTowns.length > 0 &&
    visitedTowns.every(isTownId) &&
    new Set(visitedTowns).size === visitedTowns.length &&
    isTownId(value.currentTown) &&
    visitedTowns.includes(value.currentTown) &&
    profitableTradeMarks.length <= MARKET_PORTS.length * GOODS.length &&
    profitableTradeMarks.every(isProfitableTradeMark) &&
    new Set(profitableTradeMarks).size === profitableTradeMarks.length &&
    completedMilestones.every(isMilestoneId) &&
    new Set(completedMilestones).size === completedMilestones.length
  );
  const validFleet = (
    fleet.length > 0 &&
    fleet.length <= MAX_PLAYER_SHIPS &&
    fleet.every(isValidPlayerShip) &&
    new Set(fleet.map((ship) => (isRecord(ship) ? ship.id : ""))).size ===
      fleet.length &&
    new Set(fleet.map((ship) => (isRecord(ship) ? ship.name : ""))).size ===
      fleet.length
  );
  const selectedShip = fleet.find(
    (ship): ship is PlayerShip =>
      isValidPlayerShip(ship) && ship.id === selectedShipId,
  );
  const validAutomatedAssignments = fleet.every(
    (ship) =>
      isRecord(ship) &&
      (ship.id !== selectedShipId || ship.returnOrder === null) &&
      (ship.automatedRoute === null ||
        (ship.id !== selectedShipId &&
          isRecord(ship.automatedRoute) &&
          visitedTowns.includes(ship.automatedRoute.origin) &&
          visitedTowns.includes(ship.automatedRoute.destination))) &&
      Array.isArray(ship.automationLog) &&
      ship.automationLog.every(
        (entry) =>
          isRecord(entry) &&
          Number(entry.sailingDay) <= Number(value.sailingDay) +
            (isRecord(value.voyage) ? Number(value.voyage.durationDays) : 0),
      ),
  );
  const validLocalStanding = MARKET_PORTS.every(
    (port) =>
      isNonnegativeInteger(localStanding[port.id]) &&
      Number(localStanding[port.id]) <= 100,
  );
  const maximumNpcDay = Number(value.sailingDay) +
    (isRecord(value.voyage) ? Number(value.voyage.durationDays) : 0);
  const validWarehouses = (
    ownedWarehouses.every(isTownId) &&
    new Set(ownedWarehouses).size === ownedWarehouses.length &&
    MARKET_PORTS.every((port) => {
      const stock = warehouseStock[port.id];
      const average = warehouseAveragePurchasePrice[port.id];
      if (!isRecord(stock) || !isRecord(average)) return false;
      const used = GOODS.reduce((total, good) => total + Number(stock[good.id]), 0);
      return GOODS.every(
        (good) =>
          isNonnegativeInteger(stock[good.id]) &&
          isNonnegativeFiniteNumber(average[good.id]) &&
          (Number(stock[good.id]) > 0 || Number(average[good.id]) === 0),
      ) &&
        (ownedWarehouses.includes(port.id)
          ? used <= WAREHOUSE_CAPACITY
          : used === 0);
    })
  );
  const validFarms = (
    ownedFarms.every(isTownId) &&
    new Set(ownedFarms).size === ownedFarms.length &&
    MARKET_PORTS.every((port) => {
      const output = farmOutput[port.id];
      const productionDay = farmProductionDay[port.id];
      return (
        isNonnegativeInteger(output) &&
        Number(output) <= FARM_OUTPUT_CAPACITY &&
        isNonnegativeFiniteNumber(productionDay) &&
        Number(productionDay) <= Number(value.sailingDay) &&
        (ownedFarms.includes(port.id) ||
          (Number(output) === 0 && Number(productionDay) === 0))
      );
    })
  );
  const householdSpouse = household.spouse;
  const householdChildren = household.children;
  const inheritance = household.inheritance;
  const validHousehold = (
    (householdSpouse === null ||
      (isRecord(householdSpouse) &&
        householdSpouse.status === "married" &&
        isNonnegativeFiniteNumber(householdSpouse.marriedAtSailingDay) &&
        Number(householdSpouse.marriedAtSailingDay) <= Number(value.sailingDay))) &&
    Array.isArray(householdChildren) &&
    householdChildren.every(
      (child) =>
        isRecord(child) &&
        typeof child.id === "string" &&
        child.id.length > 0 &&
        isNonnegativeFiniteNumber(child.joinedAtSailingDay) &&
        Number(child.joinedAtSailingDay) <= Number(value.sailingDay),
    ) &&
    new Set(
      householdChildren
        .filter(isRecord)
        .map((child) => child.id),
    ).size === householdChildren.length &&
    isRecord(inheritance) &&
    (inheritance.designatedHeirId === null ||
      (typeof inheritance.designatedHeirId === "string" &&
        householdChildren.some(
          (child) =>
            isRecord(child) && child.id === inheritance.designatedHeirId,
        ))) &&
    (householdSpouse === null || isTownId(value.residenceTown))
  );

  if (
    value.version !== SAVE_VERSION ||
    (value.residenceTown !== null && !isTownId(value.residenceTown)) ||
    !isSailingSpeed(value.sailingSpeed) ||
    typeof value.captainName !== "string" ||
    value.captainName.length > 18 ||
    typeof value.coins !== "number" ||
    !Number.isSafeInteger(value.coins) ||
    value.coins < 0 ||
    !isNonnegativeInteger(value.highestCoins) ||
    value.highestCoins < value.coins ||
    !isNonnegativeInteger(value.debtOwed) ||
    !isNonnegativeInteger(value.rescuesTaken) ||
    (value.debtOwed > 0 && value.rescuesTaken === 0) ||
    !isNonnegativeInteger(value.reputation) ||
    value.reputation >
      MARKET_PORTS.length * (GOODS.length + 1) +
        createMissionBoard().length * 2 ||
    !isTownId(value.currentTown) ||
    !isTownId(value.selectedTown) ||
    !validGoods ||
    !validUpgrades ||
    !validMarkets ||
    !validProgress ||
    !validFleet ||
    !validAutomatedAssignments ||
    !selectedShip ||
    !validWarehouses ||
    !validFarms ||
    !validHousehold ||
    !isValidMissions(missions, Number(value.sailingDay)) ||
    !validLocalStanding ||
    !isNonnegativeInteger(value.voyagesStarted) ||
    !isValidNpcMerchants(npcMerchants) ||
    !isValidNpcActivity(npcActivity, maximumNpcDay) ||
    !isNonnegativeInteger(value.worldSeed) ||
    !isNonnegativeInteger(value.worldDay) ||
    Number(value.worldDay) > Math.floor(maximumNpcDay) ||
    !isValidLeaderboards(value.leaderboards, npcMerchants, value.worldDay) ||
    !isValidRouteConditions(value.navigationConditions) ||
    !isNonnegativeInteger(value.shipHull) ||
    typeof value.sailingDay !== "number" ||
    !Number.isFinite(value.sailingDay) ||
    value.sailingDay < 0 ||
    !isValidVoyage(
      value.voyage,
      value.sailingSpeed,
      VESSEL_CLASSES[selectedShip.vesselClass].travelFactor,
    ) ||
    typeof value.encounterPending !== "boolean" ||
    typeof value.chittagongIntroductionSeen !== "boolean" ||
    typeof value.lastMessage !== "string"
  ) {
    return false;
  }

  if (
    selectedShip.currentPort !== value.currentTown ||
    selectedShip.shipHull !== value.shipHull ||
    selectedShip.cargoCapacity !==
      getVesselCargoCapacity(
        selectedShip.vesselClass,
        upgrades as unknown as PlayerShip["upgrades"],
      ) ||
    selectedShip.sailingSpeed !== value.sailingSpeed ||
    selectedShip.upgrades.cannon !== upgrades.cannon ||
    selectedShip.upgrades.hull !== upgrades.hull ||
    selectedShip.upgrades.hold !== upgrades.hold ||
    GOODS.some(
      (good) =>
        selectedShip.cargo[good.id] !== Number(cargo[good.id]) ||
        selectedShip.averagePurchasePrice[good.id] !==
          Number(averagePurchasePrice[good.id]),
    )
  ) {
    return false;
  }

  if (
    value.voyage &&
    (value.voyage.origin !== value.currentTown ||
      value.voyage.origin === value.voyage.destination ||
      value.voyage.destination !== value.selectedTown ||
      value.voyage.shipId !== selectedShipId ||
      value.encounterPending)
  ) {
    return false;
  }

  if (value.encounterPending && value.currentTown !== "chittagong") {
    return false;
  }
  if (value.encounterPending && !value.chittagongIntroductionSeen) {
    return false;
  }

  const cargoCount = GOODS.reduce(
    (total, good) => total + Number(cargo[good.id]),
    0,
  );
  if (cargoCount > selectedShip.cargoCapacity) {
    return false;
  }

  return true;
}

// Saves older than version 21 count in gold, and the Coins step converts them at the end
// of the chain. Steps before it that add today's templates must add them in gold too, or
// those amounts would be converted twice.
function createGoldMissionBoard(): Record<string, unknown>[] {
  return createMissionBoard().map(({ rewardCoins, targetProfit, ...mission }) => ({
    ...mission,
    rewardGold: rewardCoins / COINS_PER_GOLD,
    targetProfit: targetProfit / COINS_PER_GOLD,
  }));
}

// The merchants a save of that age knew, with what they held before the roster grew.
function createGoldNpcMerchants(): Record<string, unknown>[] {
  return createNpcMerchants()
    .filter((merchant) => LEGACY_MERCHANT_IDS.includes(merchant.id))
    .map((merchant) => ({ ...merchant, budget: 100 }));
}

// Stalls held a third of today's stock before version 22.
const STOCK_PER_OLD_UNIT = 3;

function createOldMarketStock(): ReturnType<typeof createInitialMarketStock> {
  return Object.fromEntries(
    Object.entries(createInitialMarketStock()).map(([port, stalls]) => [
      port,
      Object.fromEntries(
        Object.entries(stalls).map(([good, stock]) => [good, stock / STOCK_PER_OLD_UNIT]),
      ),
    ]),
  ) as ReturnType<typeof createInitialMarketStock>;
}

function isCompleteMarket(value: unknown): value is ReturnType<typeof createInitialMarketStock> {
  return (
    isRecord(value) &&
    MARKET_PORTS.every((port) => {
      const stalls = value[port.id];
      return isRecord(stalls) && GOODS.every((good) => typeof stalls[good.id] === "number");
    })
  );
}

// Stalls get three times the depth, so old stock levels keep the same share of it. The
// world clock replaces the NPC clock, and now recovers stock as it goes. A voyage under way
// had its recovery still to come on arrival, so those days are applied here, once.
function migrateToWorldClock(save: Record<string, unknown>): Record<string, unknown> {
  const { npcSimulationDay, ...rest } = save;
  let marketStock = save.marketStock;
  if (isRecord(marketStock)) {
    marketStock = Object.fromEntries(
      Object.entries(marketStock).map(([port, stalls]) => [
        port,
        isRecord(stalls)
          ? Object.fromEntries(
              Object.entries(stalls).map(([good, stock]) => [
                good,
                typeof stock === "number" ? stock * STOCK_PER_OLD_UNIT : stock,
              ]),
            )
          : stalls,
      ]),
    );
    const pendingDays = isRecord(save.voyage)
      ? Number(npcSimulationDay) - Math.floor(Number(save.sailingDay))
      : 0;
    if (pendingDays > 0 && isCompleteMarket(marketStock)) {
      marketStock = advanceMarketStock(marketStock, pendingDays);
    }
  }
  return { ...rest, version: 22, worldDay: npcSimulationDay, marketStock };
}

// The first count comes from the save's real state, so it shows no movement. A save too
// damaged to value is left without rankings, and validation then refuses it unchanged.
function migrateToLeaderboards(save: Record<string, unknown>): Record<string, unknown> {
  try {
    return {
      ...save,
      version: 25,
      leaderboards: createLeaderboardSnapshot(save as unknown as GameState),
    };
  } catch {
    return { ...save, version: 25 };
  }
}

// Twenty-two merchants join. The original four keep their cargo and whereabouts, and get a
// real ship. Their old purses were limited by a cap that destroyed income, so each starts
// from at least its roster capital. This happens once, and only to merchants, never the player.
function migrateToLivingMerchants(save: Record<string, unknown>): Record<string, unknown> {
  const old = Array.isArray(save.npcMerchants) ? save.npcMerchants : [];
  const npcMerchants = createNpcMerchants().map((fresh) => {
    const before = old.find((merchant) => isRecord(merchant) && merchant.id === fresh.id);
    if (!isRecord(before)) return fresh;
    const vesselClass = isVesselClassId(before.vesselClass) ? before.vesselClass : fresh.vesselClass;
    const holdUpgrades = isNonnegativeInteger(before.holdUpgrades) ? before.holdUpgrades : 0;
    const merged = {
      ...fresh,
      vesselClass,
      holdUpgrades,
      cargoCapacity: getVesselCargoCapacity(vesselClass, { cannon: 0, hull: 0, hold: holdUpgrades }),
      currentPort: before.currentPort,
      destinationPort: before.destinationPort,
      phase: before.phase,
      cargo: before.cargo,
      cargoCost: before.cargoCost,
      budget: Math.max(Number(before.budget) || 0, fresh.budget),
      travelDaysRemaining: before.travelDaysRemaining,
      travelDaysTotal: before.travelDaysTotal,
    };
    if (
      merged.phase !== "traveling" ||
      !isTownId(merged.currentPort) ||
      !isTownId(merged.destinationPort)
    ) {
      return merged;
    }
    // The ship's speed may differ from the old abstract one, so keep the share of the trip.
    const route = getMerchantRoute(merged.currentPort, merged.destinationPort, vesselClass);
    if (!route) return merged;
    const total = getShipRouteDays(route, vesselClass);
    const share = Number(before.travelDaysRemaining) / Math.max(1, Number(before.travelDaysTotal));
    return {
      ...merged,
      travelDaysTotal: total,
      travelDaysRemaining: Math.max(1, Math.min(total, Math.ceil(share * total - 1e-9))),
    };
  });
  return {
    ...save,
    version: 23,
    npcMerchants,
    worldSeed: isNonnegativeInteger(save.worldSeed)
      ? save.worldSeed
      : hashText(typeof save.captainName === "string" ? save.captainName : ""),
    npcActivity: Array.isArray(save.npcActivity) ? save.npcActivity.slice(-MAX_NPC_ACTIVITY) : save.npcActivity,
  };
}

function goldToCoins(value: unknown): unknown {
  return typeof value === "number" ? value * COINS_PER_GOLD : value;
}

function recordGoldToCoins(value: unknown): unknown {
  return isRecord(value)
    ? Object.fromEntries(Object.entries(value).map(([key, amount]) => [key, goldToCoins(amount)]))
    : value;
}

// Old messages keep their wording, with the amount restated as it would be today.
function messageGoldToCoins(value: unknown): unknown {
  return typeof value === "string"
    ? value.replace(/(\d+) gold\b/g, (_match, amount: string) =>
        `${formatCoins(Number(amount) * COINS_PER_GOLD)} Coins`,
      )
    : value;
}

// Every amount of money becomes ×50. Nothing else in the save changes.
function migrateToCoins(save: Record<string, unknown>): Record<string, unknown> {
  const { gold, highestGold, ...rest } = save;

  const fleet = Array.isArray(save.fleet)
    ? save.fleet.map((ship) => {
        if (!isRecord(ship)) return ship;
        return {
          ...ship,
          averagePurchasePrice: recordGoldToCoins(ship.averagePurchasePrice),
          automatedRoute: isRecord(ship.automatedRoute)
            ? { ...ship.automatedRoute, capital: goldToCoins(ship.automatedRoute.capital) }
            : ship.automatedRoute,
          automationLog: Array.isArray(ship.automationLog)
            ? ship.automationLog.map((entry) =>
                isRecord(entry) ? { ...entry, message: messageGoldToCoins(entry.message) } : entry,
              )
            : ship.automationLog,
        };
      })
    : save.fleet;

  const missions = Array.isArray(save.missions)
    ? save.missions.map((mission) => {
        if (!isRecord(mission)) return mission;
        const { rewardGold, ...other } = mission;
        return {
          ...other,
          rewardCoins: goldToCoins(rewardGold),
          targetProfit: goldToCoins(mission.targetProfit),
          // Progress means goods for other contracts, and only money for this one.
          progress:
            mission.type === "profitable_trade" ? goldToCoins(mission.progress) : mission.progress,
        };
      })
    : save.missions;

  const npcMerchants = Array.isArray(save.npcMerchants)
    ? save.npcMerchants.map((merchant) =>
        isRecord(merchant)
          ? {
              ...merchant,
              budget: goldToCoins(merchant.budget),
              cargoCost: recordGoldToCoins(merchant.cargoCost),
            }
          : merchant,
      )
    : save.npcMerchants;

  const warehouses = save.warehouseAveragePurchasePrice;

  return {
    ...rest,
    version: 21,
    coins: goldToCoins(gold),
    highestCoins: goldToCoins(highestGold),
    averagePurchasePrice: recordGoldToCoins(save.averagePurchasePrice),
    warehouseAveragePurchasePrice: isRecord(warehouses)
      ? Object.fromEntries(
          Object.entries(warehouses).map(([port, prices]) => [port, recordGoldToCoins(prices)]),
        )
      : warehouses,
    fleet,
    missions,
    npcMerchants,
    lastMessage: messageGoldToCoins(save.lastMessage),
  };
}

// Journeys under way move onto the rebuilt network, keeping how far along they were.
function migrateToTransportNetwork(
  save: Record<string, unknown>,
  now: number,
): Record<string, unknown> {
  const selected = Array.isArray(save.fleet)
    ? save.fleet.find((ship) => isRecord(ship) && ship.id === save.selectedShipId)
    : undefined;
  const vesselClass: VesselClassId =
    isRecord(selected) && isVesselClassId(selected.vesselClass)
      ? selected.vesselClass
      : "river-boat";
  const sailingSpeed = isSailingSpeed(save.sailingSpeed) ? save.sailingSpeed : 1;

  let voyage = save.voyage;
  if (isRecord(voyage) && isTownId(voyage.origin) && isTownId(voyage.destination)) {
    const route = planRiverRoute(
      voyage.origin,
      voyage.destination,
      getShipRouteConditions({}, vesselClass),
    );
    if (route) {
      const routeAlert = voyage.routeAlert === true;
      const timing = getRouteTravelTime(
        route,
        routeAlert,
        VESSEL_CLASSES[vesselClass].travelFactor,
      );
      const oldDuration = Number(voyage.durationMs);
      const oldElapsed = Number(voyage.elapsedMs);
      const progress =
        Number.isFinite(oldDuration) && oldDuration > 0 && Number.isFinite(oldElapsed)
          ? Math.max(0, Math.min(1, oldElapsed / oldDuration))
          : 0;
      const elapsedMs = timing.durationMs * progress;
      const arrivalAt = now + (timing.durationMs - elapsedMs) / sailingSpeed;
      voyage = {
        ...voyage,
        route,
        startedAt: Math.min(now - elapsedMs / sailingSpeed, arrivalAt - 1),
        arrivalAt,
        durationMs: timing.durationMs,
        elapsedMs,
        progressUpdatedAt: now,
        durationDays: timing.durationDays,
      };
    }
  }

  const rescale = (remaining: unknown, total: unknown, newTotal: number) =>
    Math.max(
      1,
      Math.min(newTotal, Math.ceil((Number(remaining) / Math.max(1, Number(total))) * newTotal - 1e-9)),
    );

  const npcMerchants = Array.isArray(save.npcMerchants)
    ? save.npcMerchants.map((merchant) => {
        if (
          !isRecord(merchant) ||
          merchant.phase !== "traveling" ||
          !isTownId(merchant.currentPort) ||
          !isTownId(merchant.destinationPort)
        ) {
          return merchant;
        }
        const route = planRiverRoute(merchant.currentPort, merchant.destinationPort);
        if (!route) return merchant;
        const total = Math.max(1, Math.ceil(getRouteTravelTime(route).durationDays));
        return {
          ...merchant,
          travelDaysTotal: total,
          travelDaysRemaining: rescale(merchant.travelDaysRemaining, merchant.travelDaysTotal, total),
        };
      })
    : save.npcMerchants;

  const fleet = Array.isArray(save.fleet)
    ? save.fleet.map((ship) => {
        if (!isRecord(ship) || !isTownId(ship.currentPort) || !isVesselClassId(ship.vesselClass)) {
          return ship;
        }
        const conditions = getShipRouteConditions({}, ship.vesselClass);
        const daysTo = (destination: unknown) => {
          if (!isTownId(destination)) return null;
          const route = planRiverRoute(ship.currentPort as TownId, destination, conditions);
          return route ? getShipRouteDays(route, ship.vesselClass as VesselClassId) : null;
        };
        const automated = ship.automatedRoute;
        if (isRecord(automated) && automated.phase === "traveling") {
          const total = daysTo(automated.destinationPort);
          if (total !== null) {
            return {
              ...ship,
              automatedRoute: {
                ...automated,
                travelDaysTotal: total,
                travelDaysRemaining: rescale(automated.travelDaysRemaining, automated.travelDaysTotal, total),
              },
            };
          }
        }
        const order = ship.returnOrder;
        if (isRecord(order)) {
          const total = daysTo(order.destination);
          if (total !== null) {
            return {
              ...ship,
              returnOrder: {
                ...order,
                travelDaysTotal: total,
                travelDaysRemaining: rescale(order.travelDaysRemaining, order.travelDaysTotal, total),
              },
            };
          }
        }
        return ship;
      })
    : save.fleet;

  // Any closures in old saves named channels that no longer exist.
  const known = new Set(RIVER_EDGES.map((edge) => edge.id));
  const conditions = isRecord(save.navigationConditions) ? save.navigationConditions : {};
  const navigationConditions = Object.fromEntries(
    Object.entries(conditions).map(([name, value]) => [
      name,
      Array.isArray(value) ? value.filter((id) => known.has(id)) : value,
    ]),
  );

  return { ...save, version: 20, voyage, npcMerchants, fleet, navigationConditions };
}

export function migrateLegacySave(value: unknown, now = Date.now()): unknown {
  if (!isRecord(value)) return value;
  let save = value;

  if (save.version === 1) {
    const oldVoyage = save.voyage;
    let voyage = oldVoyage;
    if (
      oldVoyage !== null &&
      isRecord(oldVoyage) &&
      isTownId(oldVoyage.origin) &&
      isTownId(oldVoyage.destination)
    ) {
      const route = planRiverRoute(oldVoyage.origin, oldVoyage.destination);
      if (!route) return value;
      voyage = { ...oldVoyage, route };
    }
    save = {
      ...save,
      version: 2,
      marketStock: createOldMarketStock(),
      navigationConditions: {},
      voyage,
    };
  }

  if (save.version === 2) {
    let voyage = save.voyage;
    if (
      voyage !== null &&
      isRecord(voyage) &&
      isTownId(voyage.origin) &&
      isTownId(voyage.destination)
    ) {
      const edgeIds = isRecord(voyage.route) && Array.isArray(voyage.route.edgeIds)
        ? voyage.route.edgeIds.filter((edgeId): edgeId is string => typeof edgeId === "string")
        : [];
      const route = buildRiverRoute(voyage.origin, voyage.destination, edgeIds) ??
        planRiverRoute(voyage.origin, voyage.destination);
      if (!route) return value;

      const routeAlert = voyage.routeAlert === true;
      const timing = getRouteTravelTime(route, routeAlert);
      const sailingSpeed = isSailingSpeed(save.sailingSpeed)
        ? save.sailingSpeed
        : 1;
      voyage = {
        origin: voyage.origin,
        destination: voyage.destination,
        startedAt: now,
        arrivalAt: now + timing.durationMs / sailingSpeed,
        durationMs: timing.durationMs,
        elapsedMs: 0,
        progressUpdatedAt: now,
        durationDays: timing.durationDays,
        routeAlert,
        route,
      };
    }

    save = {
      ...save,
      version: 3,
      navigationConditions: save.navigationConditions ?? {},
      voyage,
    };
  }

  if (save.version === 3) {
    const sailingSpeed = isSailingSpeed(save.sailingSpeed)
      ? save.sailingSpeed
      : 1;
    let voyage = save.voyage;
    const route = isRecord(voyage)
      ? isValidRiverRoute(voyage.route, voyage.origin, voyage.destination)
        ? voyage.route
        : isLegacyRiverRoute(voyage.route, voyage.origin, voyage.destination) &&
            isTownId(voyage.origin) &&
            isTownId(voyage.destination)
          ? planRiverRoute(voyage.origin, voyage.destination)
          : null
      : null;
    if (
      voyage !== null &&
      isRecord(voyage) &&
      isTownId(voyage.origin) &&
      isTownId(voyage.destination) &&
      typeof voyage.startedAt === "number" &&
      Number.isFinite(voyage.startedAt) &&
      route
    ) {
      const routeAlert = voyage.routeAlert === true;
      const timing = getRouteTravelTime(route, routeAlert);
      const elapsedMs = 0;
      voyage = {
        origin: voyage.origin,
        destination: voyage.destination,
        startedAt: now,
        arrivalAt: now + (timing.durationMs - elapsedMs) / sailingSpeed,
        durationMs: timing.durationMs,
        elapsedMs,
        progressUpdatedAt: now,
        durationDays: timing.durationDays,
        routeAlert,
        route,
      };
    }

    save = { ...save, version: 4, sailingSpeed, voyage };
  }

  if (save.version === 4) {
    if (!isRecord(save.cargo) || !isRecord(save.marketStock)) return save;

    const initialStock = createOldMarketStock();
    const cargo: Record<string, unknown> = { ...save.cargo };
    const oldGoods: GoodId[] = ["rice", "salt", "muslin"];
    for (const good of GOODS) {
      if (!oldGoods.includes(good.id) && cargo[good.id] === undefined) {
        cargo[good.id] = 0;
      }
    }

    const marketStock: Record<string, unknown> = {};
    for (const port of MARKET_PORTS) {
      const savedPort = save.marketStock[port.id];
      if (savedPort === undefined) {
        marketStock[port.id] = TOWNS.some((town) => town.id === port.id)
          ? undefined
          : initialStock[port.id];
        continue;
      }
      if (!isRecord(savedPort)) {
        marketStock[port.id] = savedPort;
        continue;
      }

      const savedGoods: Record<string, unknown> = { ...savedPort };
      for (const good of GOODS) {
        if (
          !oldGoods.includes(good.id) &&
          savedGoods[good.id] === undefined
        ) {
          savedGoods[good.id] = initialStock[port.id][good.id];
        }
      }
      marketStock[port.id] = savedGoods;
    }

    save = { ...save, version: 5, cargo, marketStock };
  }

  if (save.version === 5) {
    const cargo = save.cargo;
    const marketStock = save.marketStock;
    if (!isRecord(cargo) || !isRecord(marketStock)) return save;
    const port = isTownId(save.currentTown) ? save.currentTown : "dhaka";
    const portStock = isRecord(marketStock[port])
      ? marketStock[port]
      : createOldMarketStock()[port];
    const averagePurchasePrice = Object.fromEntries(
      GOODS.map((good) => [
        good.id,
        isNonnegativeInteger(cargo[good.id]) && Number(cargo[good.id]) > 0
          ? getGoodPrice(
              port,
              good.id,
              "buy",
              false,
              isNonnegativeInteger(portStock[good.id])
                ? Number(portStock[good.id]) * STOCK_PER_OLD_UNIT
                : createInitialMarketStock()[port][good.id],
            ) / COINS_PER_GOLD
          : 0,
      ]),
    );
    save = { ...save, version: 6, averagePurchasePrice };
  }

  if (save.version === 6) {
    const migratedRoute = migrateActiveVoyageRoute(save, now);
    if (!isRecord(migratedRoute)) return migratedRoute;
    save = {
      ...migratedRoute,
      version: 7,
      chittagongIntroductionSeen:
        migratedRoute.chittagongIntroductionSeen === true ||
        migratedRoute.encounterPending === true ||
        migratedRoute.currentTown === "chittagong",
    };
  }

  if (save.version === 7) {
    const gold = isNonnegativeInteger(save.gold) ? save.gold : 0;
    save = {
      ...save,
      version: 8,
      highestGold: gold,
      reputation: 0,
      visitedTowns: isTownId(save.currentTown) ? [save.currentTown] : [],
      profitableTradeMarks: [],
      completedMilestones:
        gold >= 250 ? ["prosperous_merchant"] : [],
    };
  }

  if (save.version === 8) {
    save = {
      ...save,
      version: 9,
      ownedWarehouses: [],
      warehouseStock: createEmptyWarehouseStock(),
      warehouseAveragePurchasePrice: createEmptyWarehousePurchasePrices(),
    };
  }

  if (save.version === 9) {
    save = {
      ...save,
      version: 10,
      residenceTown: null,
    };
  }

  if (save.version === 10) {
    save = {
      ...save,
      version: 11,
      ownedFarms: [],
      farmOutput: createEmptyFarmOutput(),
      farmProductionDay: createEmptyFarmProductionDays(),
    };
  }

  if (save.version === 11) {
    save = {
      ...save,
      version: 12,
      household: createEmptyHousehold(),
    };
  }

  if (save.version === 12) {
    save = {
      ...save,
      version: 13,
      household: isRecord(save.household)
        ? save.household
        : createEmptyHousehold(),
    };
  }

  if (save.version === 13) {
    const voyage = isRecord(save.voyage)
      ? { ...save.voyage, travelEvent: null }
      : save.voyage;
    save = {
      ...save,
      version: 14,
      missions: createGoldMissionBoard(),
      localStanding: createEmptyLocalStanding(),
      voyagesStarted: 0,
      voyage,
    };
  }

  if (save.version === 14) {
    save = {
      ...save,
      version: 15,
      npcMerchants: createGoldNpcMerchants(),
      npcActivity: [],
      npcSimulationDay: isNonnegativeInteger(save.sailingDay)
        ? Number(save.sailingDay)
        : typeof save.sailingDay === "number" &&
            Number.isFinite(save.sailingDay) &&
            save.sailingDay >= 0
          ? Math.floor(save.sailingDay)
        : 0,
    };
  }

  if (save.version === 15) {
    const { npcEncounter: _npcEncounter, ...withoutVoyageEncounter } = save;
    const merchantTemplates = createNpcMerchants();
    save = {
      ...withoutVoyageEncounter,
      version: 16,
      npcMerchants: Array.isArray(save.npcMerchants)
        ? save.npcMerchants.map((merchant) => {
            if (!isRecord(merchant)) return merchant;
            const template = merchantTemplates.find(
              (entry) => entry.id === merchant.id,
            );
            return template
              ? { ...merchant, strategy: template.strategy }
              : merchant;
          })
        : save.npcMerchants,
    };
  }

  if (save.version === 16) {
    const shipId = STARTER_SHIP_ID;
    const cargo = isRecord(save.cargo) ? { ...save.cargo } : save.cargo;
    const averagePurchasePrice = isRecord(save.averagePurchasePrice)
      ? { ...save.averagePurchasePrice }
      : save.averagePurchasePrice;
    const upgrades = isRecord(save.upgrades) ? { ...save.upgrades } : save.upgrades;
    const ship = {
      id: shipId,
      name: `${typeof save.captainName === "string" ? save.captainName : "Captain"}'s Boat`,
      currentPort: save.currentTown,
      shipHull: save.shipHull,
      upgrades,
      cargoCapacity:
        12 + (isRecord(upgrades) ? Number(upgrades.hold) * 6 : 0),
      cargo,
      averagePurchasePrice,
      sailingSpeed: save.sailingSpeed,
    };
    const voyage = isRecord(save.voyage)
      ? { ...save.voyage, shipId }
      : save.voyage;
    save = {
      ...save,
      version: 17,
      fleet: [ship],
      selectedShipId: shipId,
      voyage,
    };
  }

  if (save.version === 17) {
    save = {
      ...save,
      version: 18,
      fleet: Array.isArray(save.fleet)
        ? save.fleet.map((ship) =>
            isRecord(ship)
              ? {
                  ...ship,
                  automatedRoute: null,
                  automationLog: [],
                }
              : ship,
          )
        : save.fleet,
      voyage: isRecord(save.voyage)
        ? { ...save.voyage, shipId: save.selectedShipId }
        : save.voyage,
    };
  }

  if (save.version === 18) {
    save = {
      ...save,
      version: 19,
      fleet: Array.isArray(save.fleet)
        ? save.fleet.map((ship) =>
            isRecord(ship)
              ? { ...ship, vesselClass: "river-boat", returnOrder: null }
              : ship,
          )
        : save.fleet,
    };
  }

  if (save.version === 19) {
    save = migrateToTransportNetwork(save, now);
  }

  // The peak repair for gold saves checks a gold amount, so it has to run before Coins.
  if (save.version === 20) {
    save = migrateToCoins(repairPeak(save, "gold", "highestGold", 250));
  }

  if (save.version === 21) {
    save = migrateToWorldClock(save);
  }

  if (save.version === 22) {
    save = migrateToLivingMerchants(save);
  }

  if (save.version === 23) {
    save = { ...save, version: 24, debtOwed: 0, rescuesTaken: 0 };
  }

  if (save.version === 24) {
    save = migrateToLeaderboards(save);
  }

  // No data changes, but farms now cost more to buy and run. A new version restarts the
  // command log, since a game's old commands were made under the old prices.
  if (save.version === 25) {
    save = { ...save, version: 26 };
  }

  return save.version === SAVE_VERSION
    ? reanchorPausedVoyage(
        repairPeak(save, "coins", "highestCoins", PROSPEROUS_MERCHANT_COINS),
        now,
      )
    : save;
}

// Cancelling a profitable route once added capital without raising the peak.
function repairPeak(
  save: Record<string, unknown>,
  moneyField: "gold" | "coins",
  peakField: "highestGold" | "highestCoins",
  milestoneAmount: number,
): Record<string, unknown> {
  const money = save[moneyField];
  const peak = save[peakField];
  if (!isNonnegativeInteger(money) || !isNonnegativeInteger(peak) || money <= peak) {
    return save;
  }
  const completed = save.completedMilestones;
  return {
    ...save,
    [peakField]: money,
    completedMilestones:
      Array.isArray(completed) &&
      money >= milestoneAmount &&
      !completed.includes("prosperous_merchant")
        ? [...completed, "prosperous_merchant"]
        : completed,
  };
}

export function validateSave(value: unknown, now = Date.now()): GameState {
  if (isNewerSave(value)) throw new NewerSaveError();
  const migrated = migrateLegacySave(value, now);
  if (!isValidGameState(migrated)) {
    throw new Error("Your saved voyage could not be loaded. It has not been changed.");
  }

  return migrated;
}
