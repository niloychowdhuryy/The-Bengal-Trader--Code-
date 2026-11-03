import {
  PORT_LOCATIONS,
  planRiverRoute,
  type RiverRoute,
  type RouteConditions,
} from "./navigation";
import {
  getVoyageProgressMs,
  getVoyageRemainingRealTimeMs,
  getRouteTravelTime,
  type RouteTravelTime,
  type SailingSpeed,
} from "./travel-time";

export type GoodId =
  | "rice"
  | "salt"
  | "muslin"
  | "silk"
  | "sugar"
  | "saltpetre"
  | "opium"
  | "lac";

export type MarketPortId =
  | "dhaka"
  | "sonargaon"
  | "kasimbazar"
  | "chittagong"
  | "sylhet"
  | "hooghly"
  | "satgaon"
  | "rajmahal"
  | "tanda"
  | "malda"
  | "balasore"
  | "jessore"
  | "sandwip"
  | "bakla-chandradwip"
  | "patna";

export type TownId = MarketPortId;

export type MarketTier = 1 | 2 | 3;
export type Screen =
  | "map"
  | "market"
  | "dock"
  | "progress"
  | "fleet"
  | "city"
  | "politics"
  | "family"
  | "missions"
  | "properties"
  | "notifications"
  | "backups"
  | "account";

export interface Town {
  id: TownId;
  name: string;
  description: string;
  x: number;
  y: number;
}

export interface TradeGood {
  id: GoodId;
  name: string;
  description: string;
  icon: string;
}

export interface Upgrades {
  cannon: number;
  hull: number;
  hold: number;
}

export interface Voyage {
  shipId: string;
  origin: TownId;
  destination: TownId;
  startedAt: number;
  arrivalAt: number;
  durationMs: number;
  elapsedMs: number;
  progressUpdatedAt: number;
  durationDays: number;
  routeAlert: boolean;
  route: RiverRoute;
  travelEvent: TravelEventId | null;
}

export interface PlayerShip {
  id: string;
  name: string;
  currentPort: TownId;
  shipHull: number;
  upgrades: Upgrades;
  cargoCapacity: number;
  cargo: Record<GoodId, number>;
  averagePurchasePrice: Record<GoodId, number>;
  sailingSpeed: SailingSpeed;
  vesselClass: VesselClassId;
  automatedRoute: AutomatedTradeRoute | null;
  automationLog: AutomatedTradeActivity[];
  returnOrder: ShipReturnOrder | null;
}

export type VesselClassId = "river-boat" | "bora" | "patello";

export interface VesselClass {
  id: VesselClassId;
  name: string;
  summary: string;
  price: number;
  baseHold: number;
  holdPerUpgrade: number;
  baseHull: number;
  hullPerUpgrade: number;
  repairCostPerHull: number;
  travelFactor: number;
  draft: number;
  routeUnitsPerGood: number;
  /** Never reachable by this vessel, whatever the route. */
  barredPorts: TownId[];
}

export interface ShipReturnOrder {
  destination: TownId;
  travelDaysRemaining: number;
  travelDaysTotal: number;
}

export interface AutomatedTradeRule {
  good: GoodId;
  buyAtOrigin: boolean;
  sellAtDestination: boolean;
}

export interface AutomatedTradeActivity {
  sailingDay: number;
  port: TownId;
  message: string;
}

export interface AutomatedTradeRoute {
  origin: TownId;
  destination: TownId;
  rules: AutomatedTradeRule[];
  status: "running" | "paused";
  phase: "docked" | "traveling";
  direction: "outbound" | "return";
  destinationPort: TownId;
  travelDaysRemaining: number;
  travelDaysTotal: number;
  capital: number;
}

export interface NpcMerchant {
  id: string;
  name: string;
  homePort: TownId;
  currentPort: TownId;
  destinationPort: TownId;
  strategy: "specialist" | "arbitrage" | "regional";
  phase: "docked" | "traveling";
  cargo: Record<GoodId, number>;
  cargoCost: Record<GoodId, number>;
  cargoCapacity: number;
  budget: number;
  preferences: GoodId[];
  preferredPorts: TownId[];
  travelDaysRemaining: number;
  travelDaysTotal: number;
}

export interface NpcActivity {
  id: string;
  merchantId: string;
  town: TownId;
  sailingDay: number;
  message: string;
}

export type TravelEventId = "river-pilot" | "rough-water";

export type MissionType =
  | "delivery"
  | "purchase_delivery"
  | "visit"
  | "profitable_trade";

export type MissionStatus = "available" | "active" | "completed" | "expired";

export interface Mission {
  id: string;
  type: MissionType;
  origin: TownId;
  destination: TownId;
  good: GoodId | null;
  quantity: number;
  targetProfit: number;
  rewardCoins: number;
  deadlineDays: number;
  status: MissionStatus;
  acceptedAtSailingDay: number | null;
  deadlineSailingDay: number | null;
  progress: number;
  purchasedQuantity: number;
}

export interface HouseholdChild {
  id: string;
  joinedAtSailingDay: number;
}

export interface HouseholdState {
  spouse: {
    status: "married";
    marriedAtSailingDay: number;
  } | null;
  children: HouseholdChild[];
  inheritance: {
    designatedHeirId: string | null;
  };
}

export type AutomatedRouteFailure =
  | "unavailable"
  | "not-owned"
  | "active-ship"
  | "not-docked"
  | "port-not-visited"
  | "same-port"
  | "no-route"
  | "too-large"
  | "invalid-rules"
  | "coins";

export function configureAutomatedTradeRoute(
  state: GameState,
  shipId: string,
  destination: TownId,
  rules: AutomatedTradeRule[],
  initialCapital: number,
): { state: GameState; error?: AutomatedRouteFailure } {
  if (state.encounterPending) return { state, error: "unavailable" };
  const ship = state.fleet.find((entry) => entry.id === shipId);
  if (!ship) return { state, error: "not-owned" };
  if (shipId === state.selectedShipId) return { state, error: "active-ship" };
  if (ship.automatedRoute?.phase === "traveling" || ship.returnOrder) {
    return { state, error: "not-docked" };
  }
  if (
    !state.visitedTowns.includes(ship.currentPort) ||
    !state.visitedTowns.includes(destination)
  ) {
    return { state, error: "port-not-visited" };
  }
  if (destination === ship.currentPort) return { state, error: "same-port" };
  if (
    !planRiverRoute(
      ship.currentPort,
      destination,
      getShipRouteConditions(state.navigationConditions, ship.vesselClass),
    )
  ) {
    return {
      state,
      error: planRiverRoute(ship.currentPort, destination, state.navigationConditions)
        ? "too-large"
        : "no-route",
    };
  }
  const validRules =
    rules.length > 0 &&
    rules.length <= GOODS.length &&
    new Set(rules.map((rule) => rule.good)).size === rules.length &&
    rules.every(
      (rule) =>
        GOODS.some((good) => good.id === rule.good) &&
        typeof rule.buyAtOrigin === "boolean" &&
        typeof rule.sellAtDestination === "boolean" &&
        (rule.buyAtOrigin || rule.sellAtDestination),
    ) &&
    rules.some((rule) => rule.buyAtOrigin) &&
    rules.some((rule) => rule.sellAtDestination);
  if (!validRules) return { state, error: "invalid-rules" };

  const previousRoute = ship.automatedRoute;
  if (
    previousRoute &&
    (!Number.isSafeInteger(initialCapital) || initialCapital !== 0)
  ) {
    return { state, error: "invalid-rules" };
  }
  const capitalDeposit = previousRoute ? 0 : initialCapital;
  if (
    !Number.isSafeInteger(capitalDeposit) ||
    capitalDeposit < 0 ||
    capitalDeposit > MAX_AUTOMATED_ROUTE_CAPITAL
  ) {
    return { state, error: "invalid-rules" };
  }
  if (state.coins < capitalDeposit) return { state, error: "coins" };
  const route: AutomatedTradeRoute = {
    origin: ship.currentPort,
    destination,
    rules: rules.map((rule) => ({ ...rule })),
    status: previousRoute?.status ?? "running",
    phase: "docked",
    direction: "outbound",
    destinationPort: destination,
    travelDaysRemaining: 0,
    travelDaysTotal: 0,
    capital: (previousRoute?.capital ?? 0) + capitalDeposit,
  };
  return {
    state: {
      ...state,
      coins: state.coins - capitalDeposit,
      fleet: state.fleet.map((entry) =>
        entry.id === shipId ? { ...entry, automatedRoute: route } : entry,
      ),
      lastMessage: `${ship.name} will trade between ${getTown(route.origin).name} and ${getTown(destination).name}.`,
    },
  };
}

export function setAutomatedTradeRouteStatus(
  state: GameState,
  shipId: string,
  status: "running" | "paused",
): { state: GameState; error?: "unavailable" | "not-owned" | "not-assigned" | "not-docked" } {
  if (state.encounterPending) return { state, error: "unavailable" };
  const ship = state.fleet.find((entry) => entry.id === shipId);
  if (!ship) return { state, error: "not-owned" };
  const route = ship.automatedRoute;
  if (!route) return { state, error: "not-assigned" };
  if (route.phase !== "docked") return { state, error: "not-docked" };
  return {
    state: {
      ...state,
      fleet: state.fleet.map((entry) =>
        entry.id === shipId
          ? { ...entry, automatedRoute: { ...route, status } }
          : entry,
      ),
      lastMessage: `${ship.name}'s trade route ${status === "paused" ? "paused" : "resumed"}.`,
    },
  };
}

export function cancelAutomatedTradeRoute(
  state: GameState,
  shipId: string,
): { state: GameState; error?: "unavailable" | "not-owned" | "not-assigned" | "not-docked" } {
  if (state.encounterPending) return { state, error: "unavailable" };
  const ship = state.fleet.find((entry) => entry.id === shipId);
  if (!ship) return { state, error: "not-owned" };
  const route = ship.automatedRoute;
  if (!route) return { state, error: "not-assigned" };
  if (route.phase !== "docked") return { state, error: "not-docked" };
  return {
    state: updateProgress({
      ...state,
      coins: state.coins + route.capital,
      fleet: state.fleet.map((entry) =>
        entry.id === shipId ? { ...entry, automatedRoute: null } : entry,
      ),
      lastMessage: `${ship.name}'s route ended. ${formatCoins(route.capital)} Coins returned to your purse.`,
    }),
  };
}

export interface GameState {
  version: typeof SAVE_VERSION;
  captainName: string;
  coins: number;
  highestCoins: number;
  reputation: number;
  visitedTowns: TownId[];
  profitableTradeMarks: string[];
  completedMilestones: MilestoneId[];
  ownedWarehouses: TownId[];
  ownedFarms: TownId[];
  residenceTown: TownId | null;
  household: HouseholdState;
  missions: Mission[];
  localStanding: Record<MarketPortId, number>;
  voyagesStarted: number;
  npcMerchants: NpcMerchant[];
  npcActivity: NpcActivity[];
  worldDay: number;
  farmOutput: Record<MarketPortId, number>;
  farmProductionDay: Record<MarketPortId, number>;
  warehouseStock: Record<MarketPortId, Record<GoodId, number>>;
  warehouseAveragePurchasePrice: Record<MarketPortId, Record<GoodId, number>>;
  currentTown: TownId;
  selectedTown: TownId;
  fleet: PlayerShip[];
  selectedShipId: string;
  cargo: Record<GoodId, number>;
  averagePurchasePrice: Record<GoodId, number>;
  marketStock: Record<MarketPortId, Record<GoodId, number>>;
  navigationConditions: RouteConditions;
  shipHull: number;
  upgrades: Upgrades;
  sailingDay: number;
  sailingSpeed: SailingSpeed;
  voyage: Voyage | null;
  encounterPending: boolean;
  chittagongIntroductionSeen: boolean;
  lastMessage: string;
}

export const VESSEL_CLASSES: Record<VesselClassId, VesselClass> = {
  "river-boat": {
    id: "river-boat",
    name: "River boat",
    summary: "A steady all-rounder that can reach every port.",
    price: 25_000,
    baseHold: 12,
    holdPerUpgrade: 6,
    baseHull: 8,
    hullPerUpgrade: 3,
    repairCostPerHull: 100,
    travelFactor: 1,
    draft: 1.4,
    routeUnitsPerGood: 1,
    barredPorts: [],
  },
  bora: {
    id: "bora",
    name: "Bora",
    summary: "A light, quick boat with a small hold. Cheap to buy and repair.",
    price: 17_500,
    baseHold: 8,
    holdPerUpgrade: 3,
    baseHull: 6,
    hullPerUpgrade: 3,
    repairCostPerHull: 100,
    travelFactor: 0.8,
    draft: 1.2,
    routeUnitsPerGood: 1,
    barredPorts: [],
  },
  patello: {
    id: "patello",
    name: "Patello",
    summary: "A strong, slow bulk carrier. Too large for the narrowest channels.",
    price: 45_000,
    baseHold: 30,
    holdPerUpgrade: 6,
    baseHull: 14,
    hullPerUpgrade: 3,
    repairCostPerHull: 150,
    travelFactor: 1.25,
    draft: 1.5,
    routeUnitsPerGood: 4,
    barredPorts: ["sylhet", "balasore"],
  },
};
export const VESSEL_CLASS_IDS: VesselClassId[] = ["river-boat", "bora", "patello"];
export const ADDITIONAL_SHIP_PRICE = VESSEL_CLASSES["river-boat"].price;
export const MAX_PLAYER_SHIPS = 3;
export const SHIPYARD_PORTS: TownId[] = ["dhaka", "chittagong", "hooghly"];
export const STARTER_SHIP_ID = "player-ship-1";
export const MAX_AUTOMATED_ROUTE_CAPITAL = 250_000;

export function getVesselCargoCapacity(
  vesselClass: VesselClassId,
  upgrades: Upgrades,
): number {
  const definition = VESSEL_CLASSES[vesselClass];
  return definition.baseHold + upgrades.hold * definition.holdPerUpgrade;
}

export function getVesselMaximumHull(
  vesselClass: VesselClassId,
  upgrades: Upgrades,
): number {
  const definition = VESSEL_CLASSES[vesselClass];
  return definition.baseHull + upgrades.hull * definition.hullPerUpgrade;
}

export function getShipRouteConditions(
  conditions: RouteConditions,
  vesselClass: VesselClassId,
): RouteConditions {
  return {
    ...conditions,
    vesselDraft: Math.max(
      conditions.vesselDraft ?? 0,
      VESSEL_CLASSES[vesselClass].draft,
    ),
    travelFactor: VESSEL_CLASSES[vesselClass].travelFactor,
    barredPorts: VESSEL_CLASSES[vesselClass].barredPorts,
  };
}

export function getSelectedVesselClass(state: GameState): VesselClass {
  const ship = state.fleet.find((entry) => entry.id === state.selectedShipId);
  return VESSEL_CLASSES[ship?.vesselClass ?? "river-boat"];
}

export interface ShipRoutePreview {
  route: RiverRoute | null;
  travelTime: RouteTravelTime | null;
  tooLarge: boolean;
  standardTravelTime: RouteTravelTime | null;
}

// Plans for the selected ship. `standardTravelTime` is set only when the ship's
// size forces a longer path than the open route other vessels would take.
export function getShipRoutePreview(
  state: GameState,
  destination: TownId,
): ShipRoutePreview {
  const vessel = getSelectedVesselClass(state);
  const route = planRiverRoute(
    state.currentTown,
    destination,
    getShipRouteConditions(state.navigationConditions, vessel.id),
  );
  const openRoute = planRiverRoute(
    state.currentTown,
    destination,
    state.navigationConditions,
  );
  const routeAlert =
    destination === "chittagong" && isHistoricalRouteAlertActive(state);
  return {
    route,
    travelTime: route
      ? getRouteTravelTime(route, routeAlert, vessel.travelFactor)
      : null,
    tooLarge: !route && openRoute !== null,
    standardTravelTime:
      route && openRoute && route.distance > openRoute.distance + 0.001
        ? getRouteTravelTime(openRoute, routeAlert, vessel.travelFactor)
        : null,
  };
}

export function canSelectedShipReach(state: GameState, port: TownId): boolean {
  return (
    port === state.currentTown ||
    planRiverRoute(
      state.currentTown,
      port,
      getShipRouteConditions(
        state.navigationConditions,
        getSelectedVesselClass(state).id,
      ),
    ) !== null
  );
}

export function getShipRouteDays(
  route: RiverRoute,
  vesselClass: VesselClassId,
): number {
  return Math.max(
    1,
    Math.ceil(
      getRouteTravelTime(route, false, VESSEL_CLASSES[vesselClass].travelFactor)
        .durationDays,
    ),
  );
}

export function isShipOutOfReach(state: GameState, shipId: string): boolean {
  const ship = state.fleet.find((entry) => entry.id === shipId);
  return Boolean(
    ship &&
      ship.id !== state.selectedShipId &&
      !ship.automatedRoute &&
      !ship.returnOrder &&
      !canSelectedShipReach(state, ship.currentPort),
  );
}

export function getShipReturnPlan(
  state: GameState,
  shipId: string,
): { destination: TownId; days: number } | null {
  const ship = state.fleet.find((entry) => entry.id === shipId);
  if (!ship || !isShipOutOfReach(state, shipId)) return null;
  const destination = state.voyage?.destination ?? state.currentTown;
  const route = planRiverRoute(
    ship.currentPort,
    destination,
    getShipRouteConditions(state.navigationConditions, ship.vesselClass),
  );
  return route
    ? { destination, days: getShipRouteDays(route, ship.vesselClass) }
    : null;
}

export function orderShipReturn(
  state: GameState,
  shipId: string,
): {
  state: GameState;
  error?: "unavailable" | "not-owned" | "not-needed" | "no-route";
} {
  if (state.encounterPending) return { state, error: "unavailable" };
  const ship = state.fleet.find((entry) => entry.id === shipId);
  if (!ship) return { state, error: "not-owned" };
  if (!isShipOutOfReach(state, shipId)) return { state, error: "not-needed" };
  const plan = getShipReturnPlan(state, shipId);
  if (!plan) return { state, error: "no-route" };
  const message = `${ship.name} is returning to ${getTown(plan.destination).name} (${plan.days} in-game day${plan.days === 1 ? "" : "s"}).`;
  return {
    state: {
      ...state,
      fleet: state.fleet.map((entry) =>
        entry.id === shipId
          ? addAutomatedTradeActivity(
              {
                ...entry,
                returnOrder: {
                  destination: plan.destination,
                  travelDaysRemaining: plan.days,
                  travelDaysTotal: plan.days,
                },
              },
              Math.floor(state.sailingDay),
              message,
            )
          : entry,
      ),
      lastMessage: message,
    },
  };
}

export function syncSelectedShip(state: GameState): GameState {
  const updatedFleet = state.fleet.map((ship) =>
    ship.id === state.selectedShipId
      ? {
          ...ship,
          currentPort: state.voyage ? ship.currentPort : state.currentTown,
          shipHull: state.shipHull,
          upgrades: state.upgrades,
          cargoCapacity: getVesselCargoCapacity(ship.vesselClass, state.upgrades),
          cargo: state.cargo,
          averagePurchasePrice: state.averagePurchasePrice,
          sailingSpeed: state.sailingSpeed,
        }
      : ship,
  );
  if (!updatedFleet.some((ship) => ship.id === state.selectedShipId)) {
    throw new Error("The selected player ship is missing from the fleet.");
  }
  return { ...state, fleet: updatedFleet };
}

export function selectPlayerShip(
  state: GameState,
  shipId: string,
): {
  state: GameState;
  error?: "unavailable" | "not-owned" | "not-here" | "automated" | "returning";
} {
  if (state.voyage || state.encounterPending) {
    return { state, error: "unavailable" };
  }
  const ship = state.fleet.find((entry) => entry.id === shipId);
  if (!ship) return { state, error: "not-owned" };
  if (ship.automatedRoute) return { state, error: "automated" };
  if (ship.returnOrder) return { state, error: "returning" };
  if (ship.currentPort !== state.currentTown) return { state, error: "not-here" };
  if (shipId === state.selectedShipId) return { state };

  const current = syncSelectedShip(state);
  return {
    state: {
      ...current,
      selectedShipId: ship.id,
      shipHull: ship.shipHull,
      upgrades: ship.upgrades,
      cargo: ship.cargo,
      averagePurchasePrice: ship.averagePurchasePrice,
      sailingSpeed: ship.sailingSpeed,
      lastMessage: `${ship.name} is now your active ship.`,
    },
  };
}

export function buyPlayerShip(
  state: GameState,
  vesselClass: VesselClassId = "river-boat",
): {
  state: GameState;
  error?: "unavailable" | "not-shipyard" | "fleet-full" | "coins";
} {
  if (state.voyage || state.encounterPending) {
    return { state, error: "unavailable" };
  }
  if (!SHIPYARD_PORTS.includes(state.currentTown)) {
    return { state, error: "not-shipyard" };
  }
  if (state.fleet.length >= MAX_PLAYER_SHIPS) {
    return { state, error: "fleet-full" };
  }
  const vessel = VESSEL_CLASSES[vesselClass];
  if (state.coins < vessel.price) {
    return { state, error: "coins" };
  }

  const current = syncSelectedShip(state);
  const ordinal = current.fleet.length + 1;
  const romanNumerals = ["I", "II", "III"];
  const ship: PlayerShip = {
    id: `player-ship-${ordinal}`,
    name: `${vesselClass === "river-boat" ? "River Trader" : vessel.name} ${romanNumerals[ordinal - 1]}`,
    currentPort: state.currentTown,
    shipHull: vessel.baseHull,
    upgrades: { cannon: 0, hull: 0, hold: 0 },
    cargoCapacity: vessel.baseHold,
    cargo: {
      rice: 0,
      salt: 0,
      muslin: 0,
      silk: 0,
      sugar: 0,
      saltpetre: 0,
      opium: 0,
      lac: 0,
    },
    averagePurchasePrice: {
      rice: 0,
      salt: 0,
      muslin: 0,
      silk: 0,
      sugar: 0,
      saltpetre: 0,
      opium: 0,
      lac: 0,
    },
    sailingSpeed: 1,
    vesselClass,
    automatedRoute: null,
    automationLog: [],
    returnOrder: null,
  };
  return {
    state: {
      ...current,
      coins: current.coins - vessel.price,
      fleet: [...current.fleet, ship],
      lastMessage: `${ship.name} has been purchased at ${getTown(state.currentTown).name}.`,
    },
  };
}

export const TOWNS: Town[] = [
  {
    id: "dhaka",
    name: "Dhaka",
    description: "Busy river port",
    ...PORT_LOCATIONS.dhaka,
  },
  {
    id: "sonargaon",
    name: "Sonargaon",
    description: "A regional cloth market",
    ...PORT_LOCATIONS.sonargaon,
  },
  {
    id: "kasimbazar",
    name: "Kasimbazar",
    description: "A silk-trading centre",
    ...PORT_LOCATIONS.kasimbazar,
  },
  {
    id: "chittagong",
    name: "Chittagong",
    description: "Gateway to the sea",
    ...PORT_LOCATIONS.chittagong,
  },
  {
    id: "sylhet",
    name: "Sylhet",
    description: "A northeastern river market",
    ...PORT_LOCATIONS.sylhet,
  },
  {
    id: "hooghly",
    name: "Hooghly",
    description: "A busy river trading hub",
    ...PORT_LOCATIONS.hooghly,
  },
  {
    id: "satgaon",
    name: "Satgaon",
    description: "A legacy inland market",
    ...PORT_LOCATIONS.satgaon,
  },
  {
    id: "rajmahal",
    name: "Rajmahal",
    description: "A Ganges crossing and market",
    ...PORT_LOCATIONS.rajmahal,
  },
  {
    id: "tanda",
    name: "Tanda",
    description: "An inland regional market",
    ...PORT_LOCATIONS.tanda,
  },
  {
    id: "malda",
    name: "Malda",
    description: "A hinterland exchange market",
    ...PORT_LOCATIONS.malda,
  },
  {
    id: "balasore",
    name: "Balasore",
    description: "A coastal exchange market",
    ...PORT_LOCATIONS.balasore,
  },
  {
    id: "jessore",
    name: "Jessore",
    description: "A southwest river market",
    ...PORT_LOCATIONS.jessore,
  },
  {
    id: "sandwip",
    name: "Sandwip",
    description: "An island market",
    ...PORT_LOCATIONS.sandwip,
  },
  {
    id: "bakla-chandradwip",
    name: "Bakla–Chandradwip",
    description: "A lower-delta market region",
    ...PORT_LOCATIONS["bakla-chandradwip"],
  },
  {
    id: "patna",
    name: "Patna",
    description: "A Bihar river-trade gateway",
    ...PORT_LOCATIONS.patna,
  },
];

export const GOODS: TradeGood[] = [
  {
    id: "rice",
    name: "Rice",
    description: "Food for busy river towns",
    icon: "rice",
  },
  {
    id: "muslin",
    name: "Bengal cotton textiles",
    description: "Cotton cloth, including fine Bengal muslin",
    icon: "cloth",
  },
  {
    id: "salt",
    name: "Salt",
    description: "A handy trade good from the coast",
    icon: "salt",
  },
  { id: "silk", name: "Raw silk", description: "Silk from Bengal's weaving districts", icon: "silk" },
  { id: "sugar", name: "Sugar and molasses", description: "Sweet cargo from agricultural markets", icon: "sugar" },
  { id: "saltpetre", name: "Saltpetre", description: "A specialist mineral trade good", icon: "saltpetre" },
  { id: "opium", name: "Opium", description: "A high-value commodity", icon: "opium" },
  { id: "lac", name: "Lac resin", description: "A compact resin from wooded hinterlands", icon: "lac" },
];

export const CURRENT_MARKET_GOODS = GOODS;

export type UpgradeId = keyof Upgrades;

export interface UpgradeDefinition {
  id: UpgradeId;
  name: string;
  detail: string;
  effect: string;
  baseCost: number;
  maxLevel: number;
}

export const UPGRADES: UpgradeDefinition[] = [
  {
    id: "cannon",
    name: "Stronger bow cannon",
    detail: "Fire first and protect your cargo.",
    effect: "+1 attack",
    baseCost: 1_750,
    maxLevel: 3,
  },
  {
    id: "hull",
    name: "Reinforced hull",
    detail: "Take less damage in a close fight.",
    effect: "+1 defence",
    baseCost: 1_750,
    maxLevel: 2,
  },
  {
    id: "hold",
    name: "Roomier cargo hold",
    detail: "Bring more goods home.",
    effect: "+6 cargo space",
    baseCost: 1_250,
    maxLevel: 3,
  },
];

export const SAVE_VERSION = 22;
export const STARTING_COINS = 5_000;
export const PROSPEROUS_MERCHANT_COINS = 12_500;
const CHITTAGONG_ALERT_SALT_SURCHARGE = 300;

/** Whole Coins with thousands separators, the same on every device. */
export function formatCoins(amount: number): string {
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export const EVENT_LAST_DAY = 36;
export const MARKET_TARGET_STOCK = 60;
export const MARKET_SUPPLY_TIER_STOCK = 12;
export const MARKET_MAX_STOCK = 120;
// Softens the stock curve, so a stall's price at its usual stock doesn't swing on one sale.
const MARKET_STOCK_CUSHION = 30;
// Prices stay between these shares of a good's base price, before any event.
export const MARKET_MIN_PRICE_SHARE = 0.4;
export const MARKET_MAX_PRICE_SHARE = 2.5;
// Quotes move in whole steps of this many Coins.
export const MARKET_PRICE_STEP = 5;
export const MARKET_SELL_SPREAD = 0.12;
// The share of the gap to its usual stock that a stall closes each day, at least one unit.
// Producers restock faster and big buyers use up a surplus faster, which is what makes one
// town's shortage last longer than another's.
const MARKET_RECOVERY_BY_TIER: Record<MarketTier, number> = { 1: 0.06, 2: 0.08, 3: 0.12 };
export const WAREHOUSE_PRICE = 7_500;
export const WAREHOUSE_CAPACITY = 20;
export const RESIDENCE_PRICE = 12_500;
export const FARM_PRICE = 10_000;
export const FARM_OUTPUT_CAPACITY = 20;
export const FARM_DAILY_OUTPUT = 1;
export const FARM_GOOD_ID: GoodId = "rice";
export const MARRIAGE_HOUSEHOLD_COST = 5_000;
export const NPC_MAX_BUDGET = 9_000;
export const NPC_STARTING_BUDGET = 5_000;
export const NPC_MERCHANTS = [
  {
    id: "abdul-rahman",
    name: "Abdul Rahman",
    homePort: "dhaka",
    strategy: "specialist",
    preferences: ["rice", "salt", "muslin"],
    preferredPorts: ["patna", "sonargaon", "hooghly"],
  },
  {
    id: "mariam-banu",
    name: "Mariam Banu",
    homePort: "sonargaon",
    strategy: "arbitrage",
    preferences: ["muslin", "silk", "sugar", "lac", "salt"],
    preferredPorts: [],
  },
  {
    id: "govinda-das",
    name: "Govinda Das",
    homePort: "kasimbazar",
    strategy: "specialist",
    preferences: ["silk", "saltpetre", "lac"],
    preferredPorts: ["patna", "hooghly", "rajmahal"],
  },
  {
    id: "fatima-khatun",
    name: "Fatima Khatun",
    homePort: "patna",
    strategy: "regional",
    preferences: ["saltpetre", "opium", "silk"],
    preferredPorts: ["rajmahal", "tanda", "malda", "kasimbazar"],
  },
] as const;

export const MILESTONES = [
  {
    id: "river_explorer",
    title: "River explorer",
    description: "Visit five different ports.",
    target: 5,
  },
  {
    id: "trusted_trader",
    title: "Trusted trader",
    description: "Make a profitable sale in five different port-and-good markets.",
    target: 5,
  },
  {
    id: "prosperous_merchant",
    title: "Prosperous merchant",
    description: "Reach 12,500 Coins. Spending them later will not undo this milestone.",
    target: 12_500,
  },
] as const;

export type MilestoneId = (typeof MILESTONES)[number]["id"];

export interface MilestoneProgress {
  id: MilestoneId;
  title: string;
  description: string;
  current: number;
  target: number;
  completed: boolean;
}

export interface MarketPort {
  id: MarketPortId;
  name: string;
}

export interface PortEconomyProfile {
  supply: Partial<Record<GoodId, MarketTier>>;
  demand: Partial<Record<GoodId, MarketTier>>;
}

export const MARKET_PORTS: MarketPort[] = [
  { id: "dhaka", name: "Dhaka" },
  { id: "sonargaon", name: "Sonargaon" },
  { id: "kasimbazar", name: "Kasimbazar" },
  { id: "chittagong", name: "Chittagong" },
  { id: "sylhet", name: "Sylhet" },
  { id: "hooghly", name: "Hooghly" },
  { id: "satgaon", name: "Satgaon" },
  { id: "rajmahal", name: "Rajmahal" },
  { id: "tanda", name: "Tanda" },
  { id: "malda", name: "Malda" },
  { id: "balasore", name: "Balasore" },
  { id: "jessore", name: "Jessore" },
  { id: "sandwip", name: "Sandwip" },
  { id: "bakla-chandradwip", name: "Bakla–Chandradwip" },
  { id: "patna", name: "Patna" },
];

export const PORT_ECONOMIES: Record<MarketPortId, PortEconomyProfile> = {
  dhaka: {
    supply: { muslin: 3, rice: 2 },
    demand: { rice: 3, salt: 3, silk: 2, sugar: 2, saltpetre: 1, opium: 2 },
  },
  sonargaon: {
    supply: { muslin: 2, rice: 2 },
    demand: { salt: 3, rice: 2, sugar: 2, silk: 2 },
  },
  kasimbazar: {
    supply: { silk: 3, rice: 2 },
    demand: { rice: 3, salt: 3, muslin: 2, saltpetre: 2 },
  },
  chittagong: {
    supply: { salt: 2, rice: 2 },
    demand: { rice: 3, salt: 3, muslin: 2, sugar: 2, saltpetre: 2 },
  },
  sylhet: {
    supply: { rice: 2, lac: 2 },
    demand: { salt: 3, muslin: 3, sugar: 2 },
  },
  hooghly: {
    supply: { rice: 3, salt: 2, muslin: 3, silk: 3, sugar: 3, saltpetre: 3, opium: 3 },
    demand: { rice: 3, salt: 3, muslin: 3, silk: 3, sugar: 2, saltpetre: 3, opium: 2, lac: 2 },
  },
  satgaon: {
    supply: { rice: 1, sugar: 1, lac: 1 },
    demand: { salt: 3, muslin: 2, rice: 2, sugar: 2 },
  },
  rajmahal: {
    supply: { rice: 2, silk: 1, saltpetre: 1 },
    demand: { rice: 3, salt: 3, muslin: 2, sugar: 2 },
  },
  tanda: {
    supply: { rice: 1, sugar: 1, muslin: 1, silk: 1 },
    demand: { salt: 3, rice: 2, muslin: 2, silk: 2 },
  },
  malda: {
    supply: { rice: 2, sugar: 2, silk: 1, lac: 1 },
    demand: { salt: 3, muslin: 2, silk: 2, saltpetre: 2 },
  },
  balasore: {
    supply: { rice: 2, salt: 1 },
    demand: { rice: 2, muslin: 2, silk: 2, sugar: 2, saltpetre: 2 },
  },
  jessore: {
    supply: { rice: 3, sugar: 2 },
    demand: { salt: 3, muslin: 2, silk: 2 },
  },
  sandwip: {
    supply: { salt: 1, rice: 1 },
    demand: { rice: 3, salt: 3, muslin: 3, sugar: 2, silk: 2 },
  },
  "bakla-chandradwip": {
    supply: { rice: 3, salt: 1, lac: 1 },
    demand: { salt: 3, muslin: 3, sugar: 2, silk: 1, saltpetre: 1 },
  },
  patna: {
    supply: { rice: 2, saltpetre: 3, opium: 3 },
    demand: { saltpetre: 3, opium: 2, muslin: 3, silk: 3, salt: 3, sugar: 2 },
  },
};

export const MARKET_BASE_PRICES: Record<GoodId, number> = {
  rice: 400,
  salt: 600,
  muslin: 1_200,
  silk: 1_600,
  sugar: 700,
  saltpetre: 900,
  opium: 2_000,
  lac: 1_100,
};

export function getMarketSupply(port: MarketPortId, good: GoodId): MarketTier {
  return PORT_ECONOMIES[port].supply[good] ?? 2;
}

export function getMarketDemand(port: MarketPortId, good: GoodId): MarketTier {
  return PORT_ECONOMIES[port].demand[good] ?? 2;
}

export function createInitialMarketStock(): GameState["marketStock"] {
  return Object.fromEntries(
    MARKET_PORTS.map((port) => [
      port.id,
      Object.fromEntries(
        GOODS.map((good) => [
          good.id,
          MARKET_TARGET_STOCK + (getMarketSupply(port.id, good.id) - 2) * MARKET_SUPPLY_TIER_STOCK,
        ]),
      ),
    ]),
  ) as GameState["marketStock"];
}

export function createEmptyWarehouseStock(): GameState["warehouseStock"] {
  return Object.fromEntries(
    MARKET_PORTS.map((port) => [
      port.id,
      Object.fromEntries(GOODS.map((good) => [good.id, 0])),
    ]),
  ) as GameState["warehouseStock"];
}

export function createEmptyFarmOutput(): GameState["farmOutput"] {
  return Object.fromEntries(MARKET_PORTS.map((port) => [port.id, 0])) as
    GameState["farmOutput"];
}

export function createEmptyFarmProductionDays(): GameState["farmProductionDay"] {
  return Object.fromEntries(MARKET_PORTS.map((port) => [port.id, 0])) as
    GameState["farmProductionDay"];
}

export function createEmptyHousehold(): HouseholdState {
  return {
    spouse: null,
    children: [],
    inheritance: { designatedHeirId: null },
  };
}

export function createMissionBoard(): Mission[] {
  return MARKET_PORTS.flatMap((port, index) => {
    const destination = (offset: number) =>
      MARKET_PORTS[(index + offset) % MARKET_PORTS.length].id;
    const good = (offset: number) =>
      GOODS[(index + offset) % GOODS.length].id;
    return [
      {
        id: `${port.id}:delivery`,
        type: "delivery" as const,
        origin: port.id,
        destination: destination(2),
        good: good(1),
        quantity: 2,
        targetProfit: 0,
        rewardCoins: 1_200,
        deadlineDays: 24,
        status: "available" as const,
        acceptedAtSailingDay: null,
        deadlineSailingDay: null,
        progress: 0,
        purchasedQuantity: 0,
      },
      {
        id: `${port.id}:purchase-delivery`,
        type: "purchase_delivery" as const,
        origin: port.id,
        destination: destination(4),
        good: good(3),
        quantity: 2,
        targetProfit: 0,
        rewardCoins: 1_500,
        deadlineDays: 24,
        status: "available" as const,
        acceptedAtSailingDay: null,
        deadlineSailingDay: null,
        progress: 0,
        purchasedQuantity: 0,
      },
      {
        id: `${port.id}:visit`,
        type: "visit" as const,
        origin: port.id,
        destination: destination(6),
        good: null,
        quantity: 1,
        targetProfit: 0,
        rewardCoins: 900,
        deadlineDays: 30,
        status: "available" as const,
        acceptedAtSailingDay: null,
        deadlineSailingDay: null,
        progress: 0,
        purchasedQuantity: 0,
      },
      {
        id: `${port.id}:profitable-trade`,
        type: "profitable_trade" as const,
        origin: port.id,
        destination: port.id,
        good: good(5),
        quantity: 0,
        targetProfit: 1_250,
        rewardCoins: 1_100,
        deadlineDays: 20,
        status: "available" as const,
        acceptedAtSailingDay: null,
        deadlineSailingDay: null,
        progress: 0,
        purchasedQuantity: 0,
      },
    ];
  });
}

export function createEmptyLocalStanding(): GameState["localStanding"] {
  return Object.fromEntries(MARKET_PORTS.map((port) => [port.id, 0])) as
    GameState["localStanding"];
}

export function createEmptyWarehousePurchasePrices(): GameState["warehouseAveragePurchasePrice"] {
  return Object.fromEntries(
    MARKET_PORTS.map((port) => [
      port.id,
      Object.fromEntries(GOODS.map((good) => [good.id, 0])),
    ]),
  ) as GameState["warehouseAveragePurchasePrice"];
}

function emptyCargo(): Record<GoodId, number> {
  return Object.fromEntries(GOODS.map((good) => [good.id, 0])) as
    Record<GoodId, number>;
}

export function createNpcMerchants(): NpcMerchant[] {
  return NPC_MERCHANTS.map((merchant): NpcMerchant => ({
    ...merchant,
    preferences: [...merchant.preferences],
    preferredPorts: [...merchant.preferredPorts],
    currentPort: merchant.homePort,
    destinationPort: merchant.homePort,
    strategy: merchant.strategy,
    phase: "docked",
    cargo: emptyCargo(),
    cargoCost: Object.fromEntries(GOODS.map((good) => [good.id, 0])) as
      Record<GoodId, number>,
    cargoCapacity: 3,
    budget: NPC_STARTING_BUDGET,
    travelDaysRemaining: 0,
    travelDaysTotal: 0,
  }));
}

export function getNpcMerchant(
  state: GameState,
  merchantId: string,
): NpcMerchant | undefined {
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

function getNpcCargoUsed(merchant: NpcMerchant): number {
  return GOODS.reduce((total, good) => total + merchant.cargo[good.id], 0);
}

function recordNpcActivity(
  state: GameState,
  merchant: NpcMerchant,
  town: TownId,
  message: string,
  sailingDay: number,
): GameState {
  const record: NpcActivity = {
    id: `${merchant.id}:${sailingDay}:${message}`,
    merchantId: merchant.id,
    town,
    sailingDay,
    message,
  };
  return { ...state, npcActivity: [...state.npcActivity, record].slice(-24) };
}

function chooseNpcDestination(
  state: GameState,
  merchant: NpcMerchant,
  good: GoodId | null,
): TownId {
  const candidates = (merchant.strategy === "arbitrage"
    ? TOWNS.map((town) => town.id)
    : merchant.preferredPorts
  ).filter(
    (port) =>
      port !== merchant.currentPort &&
      planRiverRoute(merchant.currentPort, port) !== null,
  );
  if (merchant.strategy === "regional") {
    return candidates
      .map((port) => ({
        port,
        distance: planRiverRoute(merchant.currentPort, port)?.distance ??
          Number.POSITIVE_INFINITY,
      }))
      .sort((a, b) => a.distance - b.distance || a.port.localeCompare(b.port))[0]
      ?.port ?? merchant.homePort;
  }
  if (good !== null) {
    const profitable = candidates
      .map((port) => ({
        port,
        quote: getGoodPrice(
          port,
          good,
          "sell",
          isHistoricalRouteAlertActive(state),
          state.marketStock[port][good],
        ),
      }))
      .filter(({ quote }) => quote > merchant.cargoCost[good])
      .sort((a, b) => b.quote - a.quote);
    if (profitable[0]) return profitable[0].port;
  }
  return candidates[0] ?? merchant.homePort;
}

function startNpcJourney(
  state: GameState,
  merchant: NpcMerchant,
  sailingDay: number,
): GameState {
  const cargoGood = GOODS.find((good) => merchant.cargo[good.id] > 0)?.id ?? null;
  const destinationPort = chooseNpcDestination(state, merchant, cargoGood);
  if (destinationPort === merchant.currentPort) return state;
  const route = planRiverRoute(merchant.currentPort, destinationPort);
  if (!route) return state;
  const durationDays = getRouteTravelTime(route).durationDays;
  const traveling = {
    ...merchant,
    destinationPort,
    phase: "traveling" as const,
    travelDaysRemaining: Math.max(1, Math.ceil(durationDays)),
    travelDaysTotal: Math.max(1, Math.ceil(durationDays)),
  };
  const updated = {
    ...state,
    npcMerchants: state.npcMerchants.map((entry) =>
      entry.id === merchant.id ? traveling : entry,
    ),
  };
  return recordNpcActivity(
    updated,
    traveling,
    merchant.currentPort,
    `sailed toward ${getTown(destinationPort).name}`,
    sailingDay,
  );
}

function settleNpcCargo(
  state: GameState,
  merchant: NpcMerchant,
  sailingDay: number,
): GameState {
  let marketStock = state.marketStock;
  let nextMerchant = merchant;
  let soldUnits = 0;
  for (const good of GOODS) {
    const quantity = nextMerchant.cargo[good.id];
    if (quantity <= 0) continue;
    const availableSpace = MARKET_MAX_STOCK - marketStock[merchant.currentPort][good.id];
    const sold = Math.min(quantity, availableSpace);
    if (sold <= 0) continue;
    let remainingCoins = nextMerchant.budget;
    let revenue = 0;
    let stock = marketStock[merchant.currentPort][good.id];
    for (let unit = 0; unit < sold; unit += 1) {
      const quote = getGoodPrice(
        merchant.currentPort,
        good.id,
        "sell",
        isHistoricalRouteAlertActive(state),
        stock + unit,
      );
      revenue += quote;
    }
    stock += sold;
    marketStock = {
      ...marketStock,
      [merchant.currentPort]: {
        ...marketStock[merchant.currentPort],
        [good.id]: stock,
      },
    };
    remainingCoins = Math.min(NPC_MAX_BUDGET, remainingCoins + revenue);
    nextMerchant = {
      ...nextMerchant,
      budget: remainingCoins,
      cargo: {
        ...nextMerchant.cargo,
        [good.id]: quantity - sold,
      },
      cargoCost: {
        ...nextMerchant.cargoCost,
        [good.id]: quantity - sold > 0 ? nextMerchant.cargoCost[good.id] : 0,
      },
    };
    soldUnits += sold;
  }
  const settled = {
    ...state,
    marketStock,
    npcMerchants: state.npcMerchants.map((entry) =>
      entry.id === merchant.id ? nextMerchant : entry,
    ),
  };
  return soldUnits
    ? recordNpcActivity(
        settled,
        nextMerchant,
        merchant.currentPort,
        `sold ${soldUnits} cargo unit${soldUnits === 1 ? "" : "s"}`,
        sailingDay,
      )
    : settled;
}

function buyNpcCargo(
  state: GameState,
  merchant: NpcMerchant,
  sailingDay: number,
): GameState {
  let nextMerchant = merchant;
  let marketStock = state.marketStock;
  let bought = 0;
  const preferredGoods = merchant.strategy === "arbitrage"
    ? [...merchant.preferences].sort((a, b) => {
        const margin = (goodId: GoodId) => {
          const currentBuy = getGoodPrice(
            merchant.currentPort,
            goodId,
            "buy",
            isHistoricalRouteAlertActive(state),
            marketStock[merchant.currentPort][goodId],
          );
          const destination = chooseNpcDestination(state, merchant, goodId);
          const destinationSell = getGoodPrice(
            destination,
            goodId,
            "sell",
            isHistoricalRouteAlertActive(state),
            marketStock[destination][goodId],
          );
          return destinationSell - currentBuy;
        };
        return margin(b) - margin(a) || merchant.preferences.indexOf(a) -
          merchant.preferences.indexOf(b);
      })
        .filter((goodId) => {
          const currentBuy = getGoodPrice(
            merchant.currentPort,
            goodId,
            "buy",
            isHistoricalRouteAlertActive(state),
            marketStock[merchant.currentPort][goodId],
          );
          const destination = chooseNpcDestination(state, merchant, goodId);
          const destinationSell = getGoodPrice(
            destination,
            goodId,
            "sell",
            isHistoricalRouteAlertActive(state),
            marketStock[destination][goodId],
          );
          return destinationSell > currentBuy;
        })
    : merchant.preferences;
  for (const goodId of preferredGoods) {
    const room = merchant.cargoCapacity - getNpcCargoUsed(nextMerchant);
    if (room <= 0) break;
    const stock = marketStock[merchant.currentPort][goodId];
    if (stock <= 0) continue;
    const desired = Math.min(2, room, stock);
    let quantity = 0;
    let cost = 0;
    for (let unit = 0; unit < desired; unit += 1) {
      const quote = getGoodPrice(
        merchant.currentPort,
        goodId,
        "buy",
        isHistoricalRouteAlertActive(state),
        stock - unit,
      );
      if (nextMerchant.budget < cost + quote) break;
      cost += quote;
      quantity += 1;
    }
    if (!quantity) continue;
    const oldQuantity = nextMerchant.cargo[goodId];
    const nextQuantity = oldQuantity + quantity;
    nextMerchant = {
      ...nextMerchant,
      budget: nextMerchant.budget - cost,
      cargo: { ...nextMerchant.cargo, [goodId]: nextQuantity },
      cargoCost: {
        ...nextMerchant.cargoCost,
        [goodId]:
          (nextMerchant.cargoCost[goodId] * oldQuantity + cost) /
          nextQuantity,
      },
    };
    marketStock = {
      ...marketStock,
      [merchant.currentPort]: {
        ...marketStock[merchant.currentPort],
        [goodId]: stock - quantity,
      },
    };
    bought = quantity;
    break;
  }

  const updated = {
    ...state,
    marketStock,
    npcMerchants: state.npcMerchants.map((entry) =>
      entry.id === merchant.id ? nextMerchant : entry,
    ),
  };
  const noticed = bought
    ? recordNpcActivity(
        updated,
        nextMerchant,
        merchant.currentPort,
        `bought ${bought} preferred cargo unit${bought === 1 ? "" : "s"}`,
        sailingDay,
      )
    : updated;
  return bought || getNpcCargoUsed(nextMerchant) > 0
      ? startNpcJourney(noticed, nextMerchant, sailingDay)
      : noticed;
}

function addAutomatedTradeActivity(
  ship: PlayerShip,
  sailingDay: number,
  message: string,
): PlayerShip {
  const record: AutomatedTradeActivity = {
    sailingDay,
    port: ship.currentPort,
    message,
  };
  return {
    ...ship,
    automationLog: [...ship.automationLog, record].slice(-8),
  };
}

function advanceAutomatedShipDay(
  state: GameState,
  shipId: string,
  sailingDay: number,
): GameState {
  const ship = state.fleet.find((entry) => entry.id === shipId);
  if (ship?.returnOrder && ship.id !== state.selectedShipId) {
    const order = ship.returnOrder;
    const remaining = order.travelDaysRemaining - 1;
    const moved =
      remaining > 0
        ? { ...ship, returnOrder: { ...order, travelDaysRemaining: remaining } }
        : addAutomatedTradeActivity(
            { ...ship, currentPort: order.destination, returnOrder: null },
            sailingDay,
            `Returned to ${getTown(order.destination).name}.`,
          );
    return {
      ...state,
      fleet: state.fleet.map((entry) => (entry.id === shipId ? moved : entry)),
    };
  }
  const route = ship?.automatedRoute;
  if (!ship || !route || ship.id === state.selectedShipId) return state;

  if (route.phase === "traveling") {
    const remaining = route.travelDaysRemaining - 1;
    if (remaining > 0) {
      return {
        ...state,
        fleet: state.fleet.map((entry) =>
          entry.id === shipId
            ? {
                ...entry,
                automatedRoute: { ...route, travelDaysRemaining: remaining },
              }
            : entry,
        ),
      };
    }

    const arrived = addAutomatedTradeActivity(
      {
        ...ship,
        currentPort: route.destinationPort,
        automatedRoute: {
          ...route,
          phase: "docked",
          destinationPort:
            route.destinationPort === route.origin
              ? route.destination
              : route.origin,
          travelDaysRemaining: 0,
          travelDaysTotal: 0,
        },
      },
      sailingDay,
      `Arrived at ${getTown(route.destinationPort).name}.`,
    );
    return {
      ...state,
      fleet: state.fleet.map((entry) => (entry.id === shipId ? arrived : entry)),
    };
  }

  if (route.status !== "running") return state;
  const atOrigin = ship.currentPort === route.origin;
  const rules = route.rules;
  const destinationPort = atOrigin ? route.destination : route.origin;
  const riverRoute = planRiverRoute(
    ship.currentPort,
    destinationPort,
    getShipRouteConditions(state.navigationConditions, ship.vesselClass),
  );
  if (!riverRoute) {
    const message = planRiverRoute(
      ship.currentPort,
      destinationPort,
      state.navigationConditions,
    )
      ? `Too large for the channels to ${getTown(destinationPort).name}; waiting at port.`
      : `No open river route to ${getTown(destinationPort).name}; waiting at port.`;
    if (ship.automationLog.at(-1)?.message === message) return state;
    const waiting = addAutomatedTradeActivity(ship, sailingDay, message);
    return {
      ...state,
      fleet: state.fleet.map((entry) => (entry.id === shipId ? waiting : entry)),
    };
  }

  let nextShip = ship;
  let nextMarket = state.marketStock;
  const quoteState = { ...state, sailingDay };
  const unitLimit = VESSEL_CLASSES[ship.vesselClass].routeUnitsPerGood;

  for (const rule of rules) {
    const goodName = GOODS.find((good) => good.id === rule.good)!.name;
    let units = 0;
    let total = 0;
    if (atOrigin && rule.buyAtOrigin) {
      while (units < unitLimit) {
        const used = GOODS.reduce(
          (sum, good) => sum + nextShip.cargo[good.id],
          0,
        );
        const stock = nextMarket[nextShip.currentPort][rule.good];
        if (used >= nextShip.cargoCapacity || stock <= 0) break;
        const price = getGoodPrice(
          nextShip.currentPort,
          rule.good,
          "buy",
          isHistoricalRouteAlertActive(quoteState),
          stock,
        );
        if (nextShip.automatedRoute!.capital < price) break;
        const quantity = nextShip.cargo[rule.good];
        nextShip = {
          ...nextShip,
          cargo: { ...nextShip.cargo, [rule.good]: quantity + 1 },
          averagePurchasePrice: {
            ...nextShip.averagePurchasePrice,
            [rule.good]:
              (nextShip.averagePurchasePrice[rule.good] * quantity + price) /
              (quantity + 1),
          },
          automatedRoute: {
            ...nextShip.automatedRoute!,
            capital: nextShip.automatedRoute!.capital - price,
          },
        };
        nextMarket = {
          ...nextMarket,
          [nextShip.currentPort]: {
            ...nextMarket[nextShip.currentPort],
            [rule.good]: stock - 1,
          },
        };
        units += 1;
        total += price;
      }
      if (units > 0) {
        nextShip = addAutomatedTradeActivity(
          nextShip,
          sailingDay,
          `Bought ${units} ${goodName} for ${formatCoins(total)} Coins.`,
        );
      }
    } else if (!atOrigin && rule.sellAtDestination) {
      while (units < unitLimit) {
        const quantity = nextShip.cargo[rule.good];
        const stock = nextMarket[nextShip.currentPort][rule.good];
        if (quantity <= 0 || stock >= MARKET_MAX_STOCK) break;
        const price = getGoodPrice(
          nextShip.currentPort,
          rule.good,
          "sell",
          isHistoricalRouteAlertActive(quoteState),
          stock,
        );
        if (
          nextShip.automatedRoute!.capital + price >
          MAX_AUTOMATED_ROUTE_CAPITAL
        ) {
          break;
        }
        nextShip = {
          ...nextShip,
          cargo: { ...nextShip.cargo, [rule.good]: quantity - 1 },
          averagePurchasePrice: {
            ...nextShip.averagePurchasePrice,
            [rule.good]: quantity > 1 ? nextShip.averagePurchasePrice[rule.good] : 0,
          },
          automatedRoute: {
            ...nextShip.automatedRoute!,
            capital: nextShip.automatedRoute!.capital + price,
          },
        };
        nextMarket = {
          ...nextMarket,
          [nextShip.currentPort]: {
            ...nextMarket[nextShip.currentPort],
            [rule.good]: stock + 1,
          },
        };
        units += 1;
        total += price;
      }
      if (units > 0) {
        nextShip = addAutomatedTradeActivity(
          nextShip,
          sailingDay,
          `Sold ${units} ${goodName} for ${formatCoins(total)} Coins.`,
        );
      }
    }
  }

  const durationDays = getShipRouteDays(riverRoute, ship.vesselClass);
  nextShip = {
    ...nextShip,
    automatedRoute: {
      ...nextShip.automatedRoute!,
      phase: "traveling",
      direction: atOrigin ? "outbound" : "return",
      destinationPort,
      travelDaysRemaining: durationDays,
      travelDaysTotal: durationDays,
    },
  };
  nextShip = addAutomatedTradeActivity(
    nextShip,
    sailingDay,
    `Sailed toward ${getTown(destinationPort).name} (${durationDays} in-game day${durationDays === 1 ? "" : "s"}).`,
  );
  return {
    ...state,
    marketStock: nextMarket,
    fleet: state.fleet.map((entry) => (entry.id === shipId ? nextShip : entry)),
  };
}

/**
 * The world clock. Every whole day runs once, in one order: stalls recover, then merchants
 * act, then automated ships. It only moves with sailing, so opening screens or reloading
 * can't move it, and checkpointing a voyage more or less often gives the same world.
 */
export function advanceWorld(
  state: GameState,
  sailingDay: number,
): GameState {
  if (!Number.isFinite(sailingDay) || sailingDay < state.worldDay) {
    throw new Error("World time must be finite and cannot move backward.");
  }

  const targetDay = Math.floor(sailingDay);
  let next = state;
  while (next.worldDay < targetDay) {
    const day = next.worldDay + 1;
    next = {
      ...next,
      worldDay: day,
      marketStock: advanceMarketStock(next.marketStock, 1),
    };
    for (const merchant of [...next.npcMerchants]) {
      const current = next.npcMerchants.find((entry) => entry.id === merchant.id);
      if (!current) continue;
      if (current.phase === "traveling") {
        const remaining = current.travelDaysRemaining - 1;
        if (remaining > 0) {
          next = {
            ...next,
            npcMerchants: next.npcMerchants.map((entry) =>
              entry.id === current.id
                ? { ...entry, travelDaysRemaining: remaining }
                : entry,
            ),
          };
          continue;
        }
        const arrived = {
          ...current,
          phase: "docked" as const,
          currentPort: current.destinationPort,
          travelDaysRemaining: 0,
          travelDaysTotal: 0,
        };
        next = {
          ...next,
          npcMerchants: next.npcMerchants.map((entry) =>
            entry.id === current.id ? arrived : entry,
          ),
        };
        next = recordNpcActivity(
          next,
          arrived,
          arrived.currentPort,
          "arrived",
          day,
        );
        next = settleNpcCargo(next, arrived, day);
        continue;
      }
      next = buyNpcCargo(next, current, day);
    }
    for (const ship of [...next.fleet]) {
      next = advanceAutomatedShipDay(next, ship.id, day);
    }
  }
  return next;
}

export function tradeWithNpcMerchant(
  state: GameState,
  merchantId: string,
  goodId: GoodId,
): { state: GameState; error?: "not-at-port" | "not-present" | "no-cargo" | "coins" | "space" } {
  if (state.voyage || state.encounterPending) {
    return { state, error: "not-at-port" };
  }
  const merchant = getNpcMerchant(state, merchantId);
  if (
    !merchant ||
    merchant.phase !== "docked" ||
    merchant.currentPort !== state.currentTown
  ) {
    return { state, error: "not-present" };
  }
  if (merchant.cargo[goodId] <= 0) return { state, error: "no-cargo" };
  if (getCargoUsed(state) >= getCargoCapacity(state)) {
    return { state, error: "space" };
  }

  const stock = state.marketStock[state.currentTown][goodId];
  const price = getGoodPrice(
    state.currentTown,
    goodId,
    "buy",
    isHistoricalRouteAlertActive(state),
    stock,
  );
  if (state.coins < price) return { state, error: "coins" };

  const previousQuantity = state.cargo[goodId];
  const nextQuantity = previousQuantity + 1;
  const updatedMerchant: NpcMerchant = {
    ...merchant,
    budget: Math.min(NPC_MAX_BUDGET, merchant.budget + price),
    cargo: { ...merchant.cargo, [goodId]: merchant.cargo[goodId] - 1 },
    cargoCost: {
      ...merchant.cargoCost,
      [goodId]: merchant.cargo[goodId] > 1 ? merchant.cargoCost[goodId] : 0,
    },
  };
  const traded = {
    ...state,
    coins: state.coins - price,
    cargo: { ...state.cargo, [goodId]: nextQuantity },
    averagePurchasePrice: {
      ...state.averagePurchasePrice,
      [goodId]:
        (state.averagePurchasePrice[goodId] * previousQuantity + price) /
        nextQuantity,
    },
    npcMerchants: state.npcMerchants.map((entry) =>
      entry.id === merchant.id ? updatedMerchant : entry,
    ),
    lastMessage: `Bought 1 ${GOODS.find((good) => good.id === goodId)!.name} from ${merchant.name} for ${formatCoins(price)} Coins.`,
  };
  return { state: syncSelectedShip(traded) };
}

function recoverStall(
  port: MarketPortId,
  good: GoodId,
  stock: number,
  target: number,
): number {
  const gap = target - stock;
  if (gap === 0) return stock;
  const rate = MARKET_RECOVERY_BY_TIER[
    gap > 0 ? getMarketSupply(port, good) : getMarketDemand(port, good)
  ];
  const step = Math.min(Math.abs(gap), Math.max(1, Math.round(Math.abs(gap) * rate)));
  return stock + Math.sign(gap) * step;
}

export function advanceMarketStock(
  marketStock: GameState["marketStock"],
  days: number,
): GameState["marketStock"] {
  if (!Number.isFinite(days)) {
    throw new Error("Market time must be a finite number of days.");
  }
  const wholeDays = Math.max(0, Math.floor(days));
  if (wholeDays === 0) return marketStock;

  const targets = createInitialMarketStock();
  const next = { ...marketStock };
  for (const port of MARKET_PORTS) {
    const portStock = { ...marketStock[port.id] };
    for (const good of GOODS) {
      let stock = Math.max(0, Math.min(MARKET_MAX_STOCK, portStock[good.id]));
      for (let day = 0; day < wholeDays; day += 1) {
        stock = recoverStall(port.id, good.id, stock, targets[port.id][good.id]);
      }
      portStock[good.id] = stock;
    }
    next[port.id] = portStock;
  }
  return next;
}

export function createNewGame(captainName: string): GameState {
  const cleanName = captainName.trim().slice(0, 18);
  const marketStock = createInitialMarketStock();
  const cargo: GameState["cargo"] = {
    rice: 2,
    salt: 0,
    muslin: 1,
    silk: 0,
    sugar: 0,
    saltpetre: 0,
    opium: 0,
    lac: 0,
  };
  const averagePurchasePrice = Object.fromEntries(
    GOODS.map((good) => [
      good.id,
      cargo[good.id] > 0
        ? getGoodPrice("dhaka", good.id, "buy", false, marketStock.dhaka[good.id])
        : 0,
    ]),
  ) as GameState["averagePurchasePrice"];
  const upgrades: Upgrades = { cannon: 0, hull: 0, hold: 0 };
  const starterShip: PlayerShip = {
    id: STARTER_SHIP_ID,
    name: `${cleanName || "Captain"}'s Boat`,
    currentPort: "dhaka",
    shipHull: 8,
    upgrades,
    cargoCapacity: 12,
    cargo,
    averagePurchasePrice,
    sailingSpeed: 1,
    vesselClass: "river-boat",
    automatedRoute: null,
    automationLog: [],
    returnOrder: null,
  };

  return {
    version: SAVE_VERSION,
    captainName: cleanName || "Captain",
    coins: STARTING_COINS,
    highestCoins: STARTING_COINS,
    reputation: 0,
    visitedTowns: ["dhaka"],
    profitableTradeMarks: [],
    completedMilestones: [],
    ownedWarehouses: [],
    ownedFarms: [],
    residenceTown: null,
    household: createEmptyHousehold(),
    missions: createMissionBoard(),
    localStanding: createEmptyLocalStanding(),
    voyagesStarted: 0,
    npcMerchants: createNpcMerchants(),
    npcActivity: [],
    worldDay: 0,
    farmOutput: createEmptyFarmOutput(),
    farmProductionDay: createEmptyFarmProductionDays(),
    warehouseStock: createEmptyWarehouseStock(),
    warehouseAveragePurchasePrice: createEmptyWarehousePurchasePrices(),
    currentTown: "dhaka",
    selectedTown: "sonargaon",
    fleet: [starterShip],
    selectedShipId: STARTER_SHIP_ID,
    cargo,
    averagePurchasePrice,
    marketStock,
    navigationConditions: {},
    shipHull: 8,
    upgrades,
    sailingDay: 0,
    sailingSpeed: 1,
    voyage: null,
    encounterPending: false,
    chittagongIntroductionSeen: false,
    lastMessage: "",
  };
}

export function getMilestoneProgress(
  state: GameState,
): MilestoneProgress[] {
  return MILESTONES.map((milestone) => {
    const current =
      milestone.id === "river_explorer"
        ? state.visitedTowns.length
        : milestone.id === "trusted_trader"
          ? state.profitableTradeMarks.length
          : state.highestCoins;
    return {
      ...milestone,
      current: Math.min(current, milestone.target),
      completed:
        state.completedMilestones.includes(milestone.id) ||
        current >= milestone.target,
    };
  });
}

function updateProgress(state: GameState): GameState {
  const highestCoins = Math.max(state.highestCoins, state.coins);
  const completed = new Set(state.completedMilestones);
  if (state.visitedTowns.length >= 5) completed.add("river_explorer");
  if (state.profitableTradeMarks.length >= 5) completed.add("trusted_trader");
  if (highestCoins >= PROSPEROUS_MERCHANT_COINS) completed.add("prosperous_merchant");
  return {
    ...state,
    highestCoins,
    completedMilestones: MILESTONES
      .filter((milestone) => completed.has(milestone.id))
      .map((milestone) => milestone.id),
  };
}

function recordTownVisit(state: GameState, town: TownId): GameState {
  if (state.visitedTowns.includes(town)) return updateProgress(state);
  return updateProgress({
    ...state,
    reputation: state.reputation + 1,
    visitedTowns: [...state.visitedTowns, town],
  });
}

function recordProfitableTrade(
  state: GameState,
  port: MarketPortId,
  good: GoodId,
  profit: number,
): GameState {
  const mark = `${port}:${good}`;
  if (profit <= 0 || state.profitableTradeMarks.includes(mark)) {
    return updateProgress(state);
  }
  return updateProgress({
    ...state,
    reputation: state.reputation + 1,
    profitableTradeMarks: [...state.profitableTradeMarks, mark],
  });
}

function addLocalStanding(
  standing: GameState["localStanding"],
  town: TownId,
  points: number,
): GameState["localStanding"] {
  return {
    ...standing,
    [town]: Math.min(100, Math.max(0, standing[town] + points)),
  };
}

function completeMission(
  state: GameState,
  mission: Mission,
  progress: number,
): GameState {
  const completed = {
    ...state,
    coins: state.coins + mission.rewardCoins,
    reputation: state.reputation + 2,
    localStanding: addLocalStanding(state.localStanding, mission.origin, 5),
    missions: state.missions.map((entry) =>
      entry.id === mission.id
        ? { ...entry, status: "completed" as const, progress }
        : entry,
    ),
    lastMessage: `Contract complete: ${formatCoins(mission.rewardCoins)} Coins, +2 reputation, and +5 local standing in ${getTown(mission.origin).name}.`,
  };
  return updateProgress(completed);
}

export function acceptMission(
  state: GameState,
  missionId: string,
): { state: GameState; error?: "not-at-board" | "not-available" | "active-limit" } {
  if (state.voyage || state.encounterPending) {
    return { state, error: "not-at-board" };
  }
  const mission = state.missions.find((entry) => entry.id === missionId);
  if (
    !mission ||
    mission.status !== "available" ||
    mission.origin !== state.currentTown
  ) {
    return { state, error: "not-available" };
  }
  if (state.missions.filter((entry) => entry.status === "active").length >= 2) {
    return { state, error: "active-limit" };
  }

  const accepted: Mission = {
    ...mission,
    status: "active",
    acceptedAtSailingDay: state.sailingDay,
    deadlineSailingDay: state.sailingDay + mission.deadlineDays,
  };
  return {
    state: {
      ...state,
      missions: state.missions.map((entry) =>
        entry.id === missionId ? accepted : entry,
      ),
      lastMessage: `Contract accepted. Complete it within ${mission.deadlineDays} in-game days.`,
    },
  };
}

function recordMissionPurchase(
  state: GameState,
  port: MarketPortId,
  good: GoodId,
  quantity: number,
): GameState {
  let missions = state.missions;
  for (const mission of state.missions) {
    if (
      mission.status !== "active" ||
      mission.type !== "purchase_delivery" ||
      mission.origin !== port ||
      mission.good !== good ||
      mission.purchasedQuantity >= mission.quantity
    ) {
      continue;
    }
    missions = missions.map((entry) =>
      entry.id === mission.id
        ? {
            ...entry,
            purchasedQuantity: Math.min(
              mission.quantity,
              mission.purchasedQuantity + quantity,
            ),
          }
        : entry,
    );
  }
  return missions === state.missions ? state : { ...state, missions };
}

function recordMissionProfit(
  state: GameState,
  port: MarketPortId,
  good: GoodId,
  profit: number,
): GameState {
  if (profit <= 0) return state;
  let next = state;
  for (const mission of state.missions) {
    if (
      mission.status !== "active" ||
      mission.type !== "profitable_trade" ||
      mission.destination !== port ||
      mission.good !== good ||
      mission.deadlineSailingDay === null ||
      state.sailingDay > mission.deadlineSailingDay
    ) {
      continue;
    }
    const progress = Math.min(mission.targetProfit, mission.progress + profit);
    next = {
      ...next,
      missions: next.missions.map((entry) =>
        entry.id === mission.id ? { ...entry, progress } : entry,
      ),
    };
    if (progress >= mission.targetProfit) {
      const updatedMission = next.missions.find((entry) => entry.id === mission.id);
      if (updatedMission) next = completeMission(next, updatedMission, progress);
    }
  }
  return next;
}

function resolveArrivalMissions(
  state: GameState,
  destination: TownId,
): GameState {
  let next = state;
  for (const mission of state.missions) {
    const current = next.missions.find((entry) => entry.id === mission.id);
    if (
      !current ||
      current.status !== "active" ||
      current.deadlineSailingDay === null
    ) {
      continue;
    }
    if (next.sailingDay > current.deadlineSailingDay) {
      next = {
        ...next,
        missions: next.missions.map((entry) =>
          entry.id === current.id
            ? { ...entry, status: "expired" as const }
            : entry,
        ),
      };
      continue;
    }
    if (current.destination !== destination) continue;
    if (current.type === "visit") {
      next = completeMission(next, current, 1);
      continue;
    }
    if (
      (current.type !== "delivery" &&
        current.type !== "purchase_delivery") ||
      current.good === null ||
      (current.type === "purchase_delivery" &&
        current.purchasedQuantity < current.quantity)
    ) {
      continue;
    }
    const remaining = current.quantity - current.progress;
    const delivered = Math.min(remaining, next.cargo[current.good]);
    if (delivered <= 0) continue;
    const cargoQuantity = next.cargo[current.good] - delivered;
    next = {
      ...next,
      cargo: { ...next.cargo, [current.good]: cargoQuantity },
      averagePurchasePrice: {
        ...next.averagePurchasePrice,
        [current.good]:
          cargoQuantity > 0 ? next.averagePurchasePrice[current.good] : 0,
      },
      missions: next.missions.map((entry) =>
        entry.id === current.id
          ? { ...entry, progress: current.progress + delivered }
          : entry,
      ),
    };
    const updatedMission = next.missions.find((entry) => entry.id === current.id);
    if (updatedMission && updatedMission.progress >= updatedMission.quantity) {
      next = completeMission(next, updatedMission, updatedMission.progress);
    }
  }
  return next;
}

export function getCargoUsed(state: GameState): number {
  return GOODS.reduce((total, good) => total + state.cargo[good.id], 0);
}

export function getCargoCapacity(state: GameState): number {
  return getVesselCargoCapacity(getSelectedVesselClass(state).id, state.upgrades);
}

export function getWarehouseCapacity(state: GameState, port: TownId): number {
  return state.ownedWarehouses.includes(port) ? WAREHOUSE_CAPACITY : 0;
}

export function getWarehouseUsed(
  state: GameState,
  port: TownId,
): number {
  return GOODS.reduce(
    (total, good) => total + state.warehouseStock[port][good.id],
    0,
  );
}

export function buyWarehouse(
  state: GameState,
): { state: GameState; error?: "coins" | "already-owned" } {
  const port = state.currentTown;
  if (state.ownedWarehouses.includes(port)) {
    return { state, error: "already-owned" };
  }
  if (state.coins < WAREHOUSE_PRICE) return { state, error: "coins" };
  return {
    state: {
      ...state,
      coins: state.coins - WAREHOUSE_PRICE,
      ownedWarehouses: [...state.ownedWarehouses, port],
      lastMessage: `Warehouse purchased in ${getTown(port).name}.`,
    },
  };
}

export function buyResidence(
  state: GameState,
): { state: GameState; error?: "coins" | "already-owned" } {
  if (state.residenceTown !== null) {
    return { state, error: "already-owned" };
  }
  if (state.coins < RESIDENCE_PRICE) return { state, error: "coins" };
  return {
    state: {
      ...state,
      coins: state.coins - RESIDENCE_PRICE,
      residenceTown: state.currentTown,
      lastMessage: `Residence established in ${getTown(state.currentTown).name}.`,
    },
  };
}

export function marryAtResidence(
  state: GameState,
): { state: GameState; error?: "no-residence" | "away-from-residence" | "already-married" | "coins" } {
  if (!state.residenceTown) return { state, error: "no-residence" };
  if (
    state.currentTown !== state.residenceTown ||
    state.voyage !== null ||
    state.encounterPending
  ) {
    return { state, error: "away-from-residence" };
  }
  if (state.household.spouse) return { state, error: "already-married" };
  if (state.coins < MARRIAGE_HOUSEHOLD_COST) {
    return { state, error: "coins" };
  }

  return {
    state: {
      ...state,
      coins: state.coins - MARRIAGE_HOUSEHOLD_COST,
      household: {
        ...state.household,
        spouse: {
          status: "married",
          marriedAtSailingDay: state.sailingDay,
        },
      },
      lastMessage: "Your household is established at your residence.",
    },
  };
}

export function buyFarm(
  state: GameState,
): { state: GameState; error?: "coins" | "already-owned" } {
  const port = state.currentTown;
  if (state.ownedFarms.includes(port)) {
    return { state, error: "already-owned" };
  }
  if (state.coins < FARM_PRICE) return { state, error: "coins" };
  return {
    state: {
      ...state,
      coins: state.coins - FARM_PRICE,
      ownedFarms: [...state.ownedFarms, port],
      farmOutput: { ...state.farmOutput, [port]: 0 },
      farmProductionDay: {
        ...state.farmProductionDay,
        [port]: state.sailingDay,
      },
      lastMessage: `Farm purchased in ${getTown(port).name}.`,
    },
  };
}

export function advanceFarmProduction(
  state: GameState,
  sailingDay: number,
): GameState {
  if (!Number.isFinite(sailingDay) || sailingDay < state.sailingDay) {
    throw new Error("Farm production time must be finite and cannot move backwards.");
  }

  let farmOutput = state.farmOutput;
  let farmProductionDay = state.farmProductionDay;
  for (const port of state.ownedFarms) {
    const elapsedDays = Math.floor(sailingDay - state.farmProductionDay[port]);
    if (elapsedDays <= 0) continue;

    if (farmOutput === state.farmOutput) farmOutput = { ...farmOutput };
    if (farmProductionDay === state.farmProductionDay) {
      farmProductionDay = { ...farmProductionDay };
    }
    farmOutput[port] = Math.min(
      FARM_OUTPUT_CAPACITY,
      state.farmOutput[port] + elapsedDays * FARM_DAILY_OUTPUT,
    );
    farmProductionDay[port] =
      state.farmProductionDay[port] + elapsedDays;
  }
  return { ...state, farmOutput, farmProductionDay };
}

export function collectFarmOutput(
  state: GameState,
): { state: GameState; collected: number; error?: "not-owned" | "empty" | "cargo-full" } {
  const port = state.currentTown;
  if (!state.ownedFarms.includes(port)) {
    return { state, collected: 0, error: "not-owned" };
  }
  const stored = state.farmOutput[port];
  if (stored <= 0) return { state, collected: 0, error: "empty" };
  const space = getCargoCapacity(state) - getCargoUsed(state);
  if (space <= 0) return { state, collected: 0, error: "cargo-full" };

  const collected = Math.min(stored, space);
  const currentQuantity = state.cargo[FARM_GOOD_ID];
  const nextQuantity = currentQuantity + collected;
  const averagePurchasePrice =
    currentQuantity === 0
      ? 0
      : (state.averagePurchasePrice[FARM_GOOD_ID] * currentQuantity) /
        nextQuantity;
  return {
    state: syncSelectedShip({
      ...state,
      cargo: {
        ...state.cargo,
        [FARM_GOOD_ID]: nextQuantity,
      },
      averagePurchasePrice: {
        ...state.averagePurchasePrice,
        [FARM_GOOD_ID]: averagePurchasePrice,
      },
      farmOutput: {
        ...state.farmOutput,
        [port]: stored - collected,
      },
      lastMessage: `Collected ${collected} ${GOODS.find((good) => good.id === FARM_GOOD_ID)?.name} from the farm.`,
    }),
    collected,
  };
}

export type WarehouseTransferError =
  | "not-owned"
  | "empty"
  | "full"
  | "cargo-full";

export function storeGoodInWarehouse(
  state: GameState,
  good: GoodId,
): { state: GameState; error?: WarehouseTransferError } {
  const port = state.currentTown;
  if (!state.ownedWarehouses.includes(port)) {
    return { state, error: "not-owned" };
  }
  if (state.cargo[good] <= 0) return { state, error: "empty" };
  if (getWarehouseUsed(state, port) >= WAREHOUSE_CAPACITY) {
    return { state, error: "full" };
  }
  const warehouseQuantity = state.warehouseStock[port][good];
  const nextWarehouseQuantity = warehouseQuantity + 1;
  const sourceAverage = state.averagePurchasePrice[good];
  return {
    state: syncSelectedShip({
      ...state,
      cargo: { ...state.cargo, [good]: state.cargo[good] - 1 },
      averagePurchasePrice: {
        ...state.averagePurchasePrice,
        [good]: state.cargo[good] > 1 ? state.averagePurchasePrice[good] : 0,
      },
      warehouseStock: {
        ...state.warehouseStock,
        [port]: {
          ...state.warehouseStock[port],
          [good]: state.warehouseStock[port][good] + 1,
        },
      },
      warehouseAveragePurchasePrice: {
        ...state.warehouseAveragePurchasePrice,
        [port]: {
          ...state.warehouseAveragePurchasePrice[port],
          [good]:
            (state.warehouseAveragePurchasePrice[port][good] *
              warehouseQuantity +
              sourceAverage) /
            nextWarehouseQuantity,
        },
      },
      lastMessage: `Stored 1 ${GOODS.find((item) => item.id === good)?.name}.`,
    }),
  };
}

export function retrieveGoodFromWarehouse(
  state: GameState,
  good: GoodId,
): { state: GameState; error?: WarehouseTransferError } {
  const port = state.currentTown;
  if (!state.ownedWarehouses.includes(port)) {
    return { state, error: "not-owned" };
  }
  if (state.warehouseStock[port][good] <= 0) {
    return { state, error: "empty" };
  }
  if (getCargoUsed(state) >= getCargoCapacity(state)) {
    return { state, error: "cargo-full" };
  }
  const previousQuantity = state.cargo[good];
  const nextQuantity = previousQuantity + 1;
  const warehouseQuantity = state.warehouseStock[port][good];
  const sourceAverage = state.warehouseAveragePurchasePrice[port][good];
  return {
    state: syncSelectedShip({
      ...state,
      cargo: { ...state.cargo, [good]: nextQuantity },
      averagePurchasePrice: {
        ...state.averagePurchasePrice,
        [good]:
          (state.averagePurchasePrice[good] * previousQuantity +
            sourceAverage) /
          nextQuantity,
      },
      warehouseStock: {
        ...state.warehouseStock,
        [port]: {
          ...state.warehouseStock[port],
          [good]: state.warehouseStock[port][good] - 1,
        },
      },
      warehouseAveragePurchasePrice: {
        ...state.warehouseAveragePurchasePrice,
        [port]: {
          ...state.warehouseAveragePurchasePrice[port],
          [good]: warehouseQuantity > 1 ? sourceAverage : 0,
        },
      },
      lastMessage: `Retrieved 1 ${GOODS.find((item) => item.id === good)?.name}.`,
    }),
  };
}

export function getShipAttack(state: GameState): number {
  return 2 + state.upgrades.cannon;
}

export function getShipDefence(state: GameState): number {
  return 1 + state.upgrades.hull;
}

export function getShipMaximumHull(state: GameState): number {
  return getVesselMaximumHull(getSelectedVesselClass(state).id, state.upgrades);
}

export function getTown(id: TownId): Town {
  const town = TOWNS.find((candidate) => candidate.id === id);
  if (!town) throw new Error(`Unknown town: ${id}`);
  return town;
}

export function getJourneyDistance(originId: TownId, destinationId: TownId) {
  return planRiverRoute(originId, destinationId)?.distance ?? 0;
}

export function getTownRoute(
  originId: TownId,
  destinationId: TownId,
  conditions?: RouteConditions,
) {
  return planRiverRoute(originId, destinationId, conditions);
}

export function isHistoricalRouteAlertActive(state: GameState) {
  return state.sailingDay < EVENT_LAST_DAY;
}

export function startVoyage(
  state: GameState,
  now: number,
  conditions?: RouteConditions,
): GameState {
  if (state.voyage) return state;
  if (state.encounterPending) return state;
  if (state.shipHull <= 0) {
    return { ...state, lastMessage: "Visit a dock to repair your ship." };
  }
  if (state.currentTown === state.selectedTown) {
    return { ...state, lastMessage: "Choose a town on the map first." };
  }

  const vessel = getSelectedVesselClass(state);
  const openConditions = conditions ?? state.navigationConditions;
  const route = planRiverRoute(
    state.currentTown,
    state.selectedTown,
    getShipRouteConditions(openConditions, vessel.id),
  );
  if (!route) {
    return {
      ...syncSelectedShip(state),
      lastMessage: planRiverRoute(state.currentTown, state.selectedTown, openConditions)
        ? `Your ${vessel.name} is too large for the narrow channels to ${getTown(state.selectedTown).name}. Use a smaller ship.`
        : "That river path is closed. Choose another reachable port.",
    };
  }

  const routeAlert =
    state.selectedTown === "chittagong" &&
    isHistoricalRouteAlertActive(state);
  const travelTime = getRouteTravelTime(route, routeAlert, vessel.travelFactor);
  const arrivalAt = now + travelTime.durationMs / state.sailingSpeed;
  const voyagesStarted = state.voyagesStarted + 1;
  const travelEvent =
    voyagesStarted % 5 === 0
      ? Math.floor(voyagesStarted / 5) % 2 === 1
        ? "river-pilot"
        : "rough-water"
      : null;
  return {
    ...syncSelectedShip(state),
    voyagesStarted,
    lastMessage: "",
    voyage: {
      shipId: state.selectedShipId,
      origin: state.currentTown,
      destination: state.selectedTown,
      startedAt: now,
      arrivalAt,
      durationMs: travelTime.durationMs,
      elapsedMs: 0,
      progressUpdatedAt: now,
      durationDays: travelTime.durationDays,
      routeAlert,
      route,
      travelEvent,
    },
  };
}

export function changeVoyageSpeed(
  state: GameState,
  speed: SailingSpeed,
  now: number,
): GameState {
  if (
    !state.voyage ||
    state.encounterPending ||

    speed === state.sailingSpeed
  ) {
    return state;
  }

  const elapsedMs = getVoyageProgressMs(state.voyage, state.sailingSpeed, now);
  const voyage = {
    ...state.voyage,
    elapsedMs,
    progressUpdatedAt: now,
    arrivalAt:
      now +
      getVoyageRemainingRealTimeMs(
        { ...state.voyage, elapsedMs, progressUpdatedAt: now },
        speed,
        now,
      ),
  };
  return syncSelectedShip({ ...state, sailingSpeed: speed, voyage });
}

export function checkpointVoyageProgress(
  state: GameState,
  now: number,
): GameState {
  if (!state.voyage) return state;

  const elapsedMs = getVoyageProgressMs(
    state.voyage,
    state.sailingSpeed,
    now,
  );
  const checkpointed = {
    ...state,
    voyage: {
      ...state.voyage,
      elapsedMs,
      progressUpdatedAt: now,
      arrivalAt:
        now + (state.voyage.durationMs - elapsedMs) / state.sailingSpeed,
    },
  };
  const sailingDay =
    state.sailingDay +
    (elapsedMs / state.voyage.durationMs) * state.voyage.durationDays;
  return advanceWorld(checkpointed, sailingDay);
}

export function resumeVoyage(
  state: GameState,
  now: number,
): GameState {
  if (!state.voyage) return state;

  return {
    ...state,
    voyage: {
      ...state.voyage,
      progressUpdatedAt: now,
      arrivalAt:
        now +
        (state.voyage.durationMs - state.voyage.elapsedMs) /
          state.sailingSpeed,
    },
  };
}

export function arriveAtDestination(state: GameState): GameState {
  if (!state.voyage) return state;

  const voyage = state.voyage;
  const sailingDay = state.sailingDay + voyage.durationDays;
  const triggerIntroduction =
    voyage.destination === "chittagong" &&
    !state.chittagongIntroductionSeen;
  const travelEventMessage =
    voyage.travelEvent === "river-pilot"
      ? " A local river pilot guided your crew: +2 standing here."
      : voyage.travelEvent === "rough-water"
        ? " Rough water damaged the ship by 1 hull."
        : "";
  const eventStanding =
    voyage.travelEvent === "river-pilot"
      ? addLocalStanding(state.localStanding, voyage.destination, 2)
      : state.localStanding;
  const arrived = advanceFarmProduction({
    ...state,
    currentTown: voyage.destination,
    selectedTown: voyage.destination,
    localStanding: eventStanding,
    shipHull:
      voyage.travelEvent === "rough-water"
        ? Math.max(0, state.shipHull - 1)
        : state.shipHull,
    sailingDay,
    sailingSpeed:
      triggerIntroduction || state.encounterPending
        ? 1
        : state.sailingSpeed,
    voyage: null,
    encounterPending: state.encounterPending || triggerIntroduction,
    chittagongIntroductionSeen:
      state.chittagongIntroductionSeen || triggerIntroduction,
    lastMessage: `You made it to ${getTown(voyage.destination).name}.${travelEventMessage}`,
  }, sailingDay);
  const firstVisit = !state.visitedTowns.includes(voyage.destination);
  const recordedVisit = firstVisit
    ? {
        ...recordTownVisit(arrived, voyage.destination),
        lastMessage: `${arrived.lastMessage} +1 reputation for discovering a new port.`,
      }
    : updateProgress(arrived);
  return syncSelectedShip(
    resolveArrivalMissions(
      advanceWorld(recordedVisit, sailingDay),
      voyage.destination,
    ),
  );
}

export interface EncounterResult {
  hullDamage: number;
  enemyDefeated: boolean;
  message: string;
}

export function resolveRiverEncounter(
  state: GameState,
): { state: GameState; result: EncounterResult } {
  if (!state.encounterPending) {
    throw new Error("There is no ship encounter to resolve.");
  }

  const enemyHull = 3;
  const enemyAttack = 3;
  const enemyDefeated = getShipAttack(state) >= enemyHull;
  const hullDamage = enemyDefeated
    ? 0
    : Math.min(
        state.shipHull,
        Math.max(0, enemyAttack - getShipDefence(state)),
      );
  const message = enemyDefeated
    ? "Your upgraded cannon sent the raider away. Your ship and cargo are safe!"
    : `The raider broke off after a hard fight. You lost ${hullDamage} hull.`;
  const result = { hullDamage, enemyDefeated, message };

  return {
    result,
    state: syncSelectedShip({
      ...state,
      shipHull: Math.max(0, state.shipHull - hullDamage),
      encounterPending: false,
      lastMessage: message,
    }),
  };
}

/** What a stall's good is worth at a stock level, before the seller's discount. */
function getMarketPrice(
  town: MarketPortId,
  good: GoodId,
  routeAlertActive: boolean,
  stock: number,
): number {
  const supply = getMarketSupply(town, good);
  const demand = getMarketDemand(town, good);
  const supplyDemandFactor = 1 + (demand - supply) * 0.15;
  const stockFactor =
    (MARKET_TARGET_STOCK + MARKET_STOCK_CUSHION) /
    (Math.max(0, Math.min(MARKET_MAX_STOCK, stock)) + MARKET_STOCK_CUSHION);
  const base = MARKET_BASE_PRICES[good];
  const price = Math.min(
    base * MARKET_MAX_PRICE_SHARE,
    Math.max(base * MARKET_MIN_PRICE_SHARE, base * supplyDemandFactor * stockFactor),
  );
  return (
    MARKET_PRICE_STEP * Math.round(price / MARKET_PRICE_STEP) +
    (routeAlertActive && town === "chittagong" && good === "salt"
      ? CHITTAGONG_ALERT_SALT_SURCHARGE
      : 0)
  );
}

/**
 * The one price function for everybody. A unit is priced at the stock level the stall holds
 * with that unit in it: buying from `stock` uses `stock`, and selling into `stock` uses
 * `stock + 1`. So a unit bought and sold back meets the same price both ways, less the
 * discount, and no sequence of trades at a stall can earn money without time passing.
 */
export function getGoodPrice(
  town: MarketPortId,
  good: GoodId,
  type: "buy" | "sell",
  routeAlertActive = false,
  stock = MARKET_TARGET_STOCK,
): number {
  if (type === "buy") return getMarketPrice(town, good, routeAlertActive, stock);
  const price = getMarketPrice(town, good, routeAlertActive, stock + 1);
  return MARKET_PRICE_STEP * Math.floor((price * (1 - MARKET_SELL_SPREAD)) / MARKET_PRICE_STEP);
}

export type TradeFailure =
  | "coins"
  | "space"
  | "empty"
  | "out-of-stock"
  | "market-full"
  | "quantity";

export interface TradeQuote {
  total: number;
  averageUnitPrice: number;
}

export function getTradeQuote(
  state: GameState,
  port: MarketPortId,
  good: GoodId,
  type: "buy" | "sell",
  quantity: number,
): TradeQuote | null {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return null;
  const startingStock = state.marketStock[port][good];
  if (
    (type === "buy" && quantity > startingStock) ||
    (type === "sell" && startingStock + quantity > MARKET_MAX_STOCK)
  ) {
    return null;
  }

  let total = 0;
  for (let unit = 0; unit < quantity; unit += 1) {
    const stock = type === "buy"
      ? startingStock - unit
      : startingStock + unit;
    total += getGoodPrice(
      port,
      good,
      type,
      isHistoricalRouteAlertActive(state),
      stock,
    );
  }
  return { total, averageUnitPrice: total / quantity };
}

export function buyGood(
  state: GameState,
  good: GoodId,
  quantity = 1,
): { state: GameState; error?: TradeFailure } {
  return buyGoodAtPort(state, state.currentTown, good, quantity);
}

export function buyGoodAtPort(
  state: GameState,
  port: MarketPortId,
  good: GoodId,
  quantity = 1,
): { state: GameState; error?: TradeFailure } {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    return { state, error: "quantity" };
  }
  const stock = state.marketStock[port][good];
  if (stock < quantity) return { state, error: "out-of-stock" };
  if (getCargoUsed(state) + quantity > getCargoCapacity(state)) {
    return { state, error: "space" };
  }

  const quote = getTradeQuote(state, port, good, "buy", quantity);
  if (!quote) return { state, error: "out-of-stock" };
  if (state.coins < quote.total) return { state, error: "coins" };

  const previousQuantity = state.cargo[good];
  const nextQuantity = previousQuantity + quantity;
  const averagePurchasePrice =
    (state.averagePurchasePrice[good] * previousQuantity + quote.total) /
    nextQuantity;

  const purchased = {
    ...state,
    coins: state.coins - quote.total,
    cargo: { ...state.cargo, [good]: nextQuantity },
    averagePurchasePrice: {
      ...state.averagePurchasePrice,
      [good]: averagePurchasePrice,
    },
    marketStock: {
      ...state.marketStock,
      [port]: {
        ...state.marketStock[port],
        [good]: stock - quantity,
      },
    },
    lastMessage: `Bought ${quantity} ${GOODS.find((item) => item.id === good)?.name}.`,
  };
  return {
    state: syncSelectedShip(recordMissionPurchase(
      updateProgress(purchased),
      port,
      good,
      quantity,
    )),
  };
}

export function sellGood(
  state: GameState,
  good: GoodId,
  quantity = 1,
): { state: GameState; error?: TradeFailure } {
  return sellGoodAtPort(state, state.currentTown, good, quantity);
}

export function sellGoodAtPort(
  state: GameState,
  port: MarketPortId,
  good: GoodId,
  quantity = 1,
): { state: GameState; error?: TradeFailure } {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    return { state, error: "quantity" };
  }
  if (state.cargo[good] < quantity) return { state, error: "empty" };
  const stock = state.marketStock[port][good];
  if (stock + quantity > MARKET_MAX_STOCK) {
    return { state, error: "market-full" };
  }
  const quote = getTradeQuote(state, port, good, "sell", quantity);
  if (!quote) return { state, error: "market-full" };
  const remainingQuantity = state.cargo[good] - quantity;

  const profit = quote.total - state.averagePurchasePrice[good] * quantity;
  const sold = {
    ...state,
    coins: state.coins + quote.total,
    cargo: { ...state.cargo, [good]: remainingQuantity },
    averagePurchasePrice: {
      ...state.averagePurchasePrice,
      [good]: remainingQuantity > 0 ? state.averagePurchasePrice[good] : 0,
    },
    marketStock: {
      ...state.marketStock,
      [port]: {
        ...state.marketStock[port],
        [good]: stock + quantity,
      },
    },
    lastMessage: `Sold ${quantity} ${GOODS.find((item) => item.id === good)?.name}.`,
  };
  const marked = recordProfitableTrade(sold, port, good, profit);
  const withTradeNotice =
    marked.reputation > state.reputation
      ? {
          ...marked,
          lastMessage: `${sold.lastMessage} +1 reputation for a profitable trade.`,
        }
      : marked;
  return {
    state: syncSelectedShip(
      recordMissionProfit(withTradeNotice, port, good, profit),
    ),
  };
}

export function buyUpgrade(
  state: GameState,
  upgradeId: UpgradeId,
): { state: GameState; error?: "coins" | "max-level" | "unavailable" } {
  const definition = UPGRADES.find((upgrade) => upgrade.id === upgradeId);
  if (!definition) throw new Error(`Unknown ship upgrade: ${upgradeId}`);
  if (state.voyage || state.encounterPending) {
    return { state, error: "unavailable" };
  }

  const currentLevel = state.upgrades[upgradeId];
  if (currentLevel >= definition.maxLevel) return { state, error: "max-level" };

  const cost = definition.baseCost * (currentLevel + 1);
  if (state.coins < cost) return { state, error: "coins" };

  const nextLevel = currentLevel + 1;
  return {
    state: syncSelectedShip({
      ...state,
      coins: state.coins - cost,
      upgrades: { ...state.upgrades, [upgradeId]: nextLevel },
      shipHull:
        upgradeId === "hull"
          ? state.shipHull + (nextLevel === 1 ? 2 : 1)
          : state.shipHull,
      lastMessage: `${definition.name} fitted at the dock.`,
    }),
  };
}

export function repairShip(
  state: GameState,
): { state: GameState; error?: "coins" | "full-hull" | "unavailable" } {
  if (state.voyage || state.encounterPending) {
    return { state, error: "unavailable" };
  }
  const maximumHull = getShipMaximumHull(state);
  if (state.shipHull >= maximumHull) return { state, error: "full-hull" };

  const cost =
    (maximumHull - state.shipHull) * getSelectedVesselClass(state).repairCostPerHull;
  if (state.coins < cost) return { state, error: "coins" };

  return {
    state: syncSelectedShip({
      ...state,
      shipHull: maximumHull,
      coins: state.coins - cost,
      lastMessage: "Your hull has been repaired at the dock.",
    }),
  };
}
