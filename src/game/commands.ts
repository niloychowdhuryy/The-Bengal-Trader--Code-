// Every change a player can make to the game is a named command. The browser and
// the server run the same applyCommand, so a recorded game can be replayed and checked.
import {
  GOODS,
  TOWNS,
  UPGRADES,
  VESSEL_CLASSES,
  acceptMission,
  arriveAtDestination,
  buyFarm,
  buyGood,
  buyPlayerShip,
  buyResidence,
  buyUpgrade,
  buyWarehouse,
  cancelAutomatedTradeRoute,
  changeVoyageSpeed,
  checkpointVoyageProgress,
  collectFarmOutput,
  configureAutomatedTradeRoute,
  marryAtResidence,
  orderShipReturn,
  repairShip,
  resolveRiverEncounter,
  resumeVoyage,
  retrieveGoodFromWarehouse,
  selectPlayerShip,
  sellGood,
  setAutomatedTradeRouteStatus,
  startVoyage,
  storeGoodInWarehouse,
  tradeWithNpcMerchant,
  type AutomatedTradeRule,
  type EncounterResult,
  type GameState,
  type GoodId,
  type TownId,
  type UpgradeId,
  type VesselClassId,
} from "./model";
import { SAILING_SPEEDS, type SailingSpeed } from "./travel-time";

export type GameCommand =
  | { type: "selectDestination"; town: TownId }
  | { type: "startVoyage" }
  | { type: "changeVoyageSpeed"; speed: SailingSpeed }
  | { type: "resumeVoyage"; pausedAt: number }
  | { type: "arrive" }
  | { type: "resolveEncounter" }
  | { type: "buyGood"; good: GoodId; quantity: number }
  | { type: "sellGood"; good: GoodId; quantity: number }
  | { type: "buyUpgrade"; upgrade: UpgradeId }
  | { type: "repairShip" }
  | { type: "buyShip"; vesselClass: VesselClassId }
  | { type: "selectShip"; shipId: string }
  | { type: "orderShipReturn"; shipId: string }
  | {
      type: "configureRoute";
      shipId: string;
      destination: TownId;
      rules: AutomatedTradeRule[];
      initialCapital: number;
    }
  | { type: "setRouteStatus"; shipId: string; status: "running" | "paused" }
  | { type: "cancelRoute"; shipId: string }
  | { type: "tradeWithMerchant"; merchantId: string; good: GoodId }
  | { type: "buyWarehouse" }
  | { type: "storeGood"; good: GoodId }
  | { type: "retrieveGood"; good: GoodId }
  | { type: "buyResidence" }
  | { type: "marry" }
  | { type: "buyFarm" }
  | { type: "collectFarm" }
  | { type: "acceptMission"; missionId: string };

export type CommandType = GameCommand["type"];

/** A command with its place in the player's history. */
export interface RecordedCommand {
  seq: number;
  at: number;
  command: GameCommand;
}

export interface CommandResult {
  state: GameState;
  /** "noop" changed nothing and "rejected" was refused; neither is recorded. */
  status: "applied" | "noop" | "rejected";
  error?: string;
  message?: string;
  encounter?: EncounterResult;
}

const MAX_TRADE_QUANTITY = 10_000;
const MAX_ID_LENGTH = 80;
// Sailing clocks can differ by a rounding error between checkpoints.
const ARRIVAL_TOLERANCE_MS = 5;

// The interface already hides these while sailing or during an encounter.
// The rules are enforced here too, because replayed input can't be trusted.
const DOCKED_ONLY = new Set<CommandType>([
  "selectDestination",
  "startVoyage",
  "buyGood",
  "sellGood",
  "buyUpgrade",
  "repairShip",
  "buyShip",
  "selectShip",
  "tradeWithMerchant",
  "buyWarehouse",
  "storeGood",
  "retrieveGood",
  "buyResidence",
  "marry",
  "buyFarm",
  "collectFarm",
  "acceptMission",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactly(value: Record<string, unknown>, keys: string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
}

function isGood(value: unknown): value is GoodId {
  return GOODS.some((good) => good.id === value);
}

function isTown(value: unknown): value is TownId {
  return TOWNS.some((town) => town.id === value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

function isQuantity(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= MAX_TRADE_QUANTITY;
}

function parseRule(value: unknown): AutomatedTradeRule | null {
  if (
    !isRecord(value) ||
    !hasExactly(value, ["good", "buyAtOrigin", "sellAtDestination"]) ||
    !isGood(value.good) ||
    typeof value.buyAtOrigin !== "boolean" ||
    typeof value.sellAtDestination !== "boolean"
  ) {
    return null;
  }
  return {
    good: value.good,
    buyAtOrigin: value.buyAtOrigin,
    sellAtDestination: value.sellAtDestination,
  };
}

/** Rebuilds untrusted input into a known command, or returns null. */
export function parseCommand(value: unknown): GameCommand | null {
  if (!isRecord(value)) return null;
  const has = (...keys: string[]) => hasExactly(value, ["type", ...keys]);
  switch (value.type) {
    case "startVoyage":
    case "arrive":
    case "resolveEncounter":
    case "repairShip":
    case "buyWarehouse":
    case "buyResidence":
    case "marry":
    case "buyFarm":
    case "collectFarm":
      return has() ? { type: value.type } : null;
    case "selectDestination":
      return has("town") && isTown(value.town)
        ? { type: value.type, town: value.town }
        : null;
    case "changeVoyageSpeed":
      return has("speed") && (SAILING_SPEEDS as readonly unknown[]).includes(value.speed)
        ? { type: value.type, speed: value.speed as SailingSpeed }
        : null;
    case "resumeVoyage":
      return has("pausedAt") && Number.isFinite(value.pausedAt) && Number(value.pausedAt) >= 0
        ? { type: value.type, pausedAt: Number(value.pausedAt) }
        : null;
    case "buyGood":
    case "sellGood":
      return has("good", "quantity") && isGood(value.good) && isQuantity(value.quantity)
        ? { type: value.type, good: value.good, quantity: value.quantity }
        : null;
    case "storeGood":
    case "retrieveGood":
      return has("good") && isGood(value.good)
        ? { type: value.type, good: value.good }
        : null;
    case "buyUpgrade":
      return has("upgrade") && UPGRADES.some((upgrade) => upgrade.id === value.upgrade)
        ? { type: value.type, upgrade: value.upgrade as UpgradeId }
        : null;
    case "buyShip":
      return has("vesselClass") &&
        typeof value.vesselClass === "string" &&
        Object.hasOwn(VESSEL_CLASSES, value.vesselClass)
        ? { type: value.type, vesselClass: value.vesselClass as VesselClassId }
        : null;
    case "selectShip":
    case "orderShipReturn":
    case "cancelRoute":
      return has("shipId") && isId(value.shipId)
        ? { type: value.type, shipId: value.shipId }
        : null;
    case "configureRoute": {
      if (
        !has("shipId", "destination", "rules", "initialCapital") ||
        !isId(value.shipId) ||
        !isTown(value.destination) ||
        !Array.isArray(value.rules) ||
        value.rules.length > GOODS.length ||
        !Number.isSafeInteger(value.initialCapital) ||
        Number(value.initialCapital) < 0
      ) {
        return null;
      }
      const rules = value.rules.map(parseRule);
      if (rules.some((rule) => rule === null)) return null;
      return {
        type: value.type,
        shipId: value.shipId,
        destination: value.destination,
        rules: rules as AutomatedTradeRule[],
        initialCapital: Number(value.initialCapital),
      };
    }
    case "setRouteStatus":
      return has("shipId", "status") &&
        isId(value.shipId) &&
        (value.status === "running" || value.status === "paused")
        ? { type: value.type, shipId: value.shipId, status: value.status }
        : null;
    case "tradeWithMerchant":
      return has("merchantId", "good") && isId(value.merchantId) && isGood(value.good)
        ? { type: value.type, merchantId: value.merchantId, good: value.good }
        : null;
    case "acceptMission":
      return has("missionId") && isId(value.missionId)
        ? { type: value.type, missionId: value.missionId }
        : null;
    default:
      return null;
  }
}

export function parseRecordedCommand(value: unknown): RecordedCommand | null {
  if (
    !isRecord(value) ||
    !hasExactly(value, ["seq", "at", "command"]) ||
    !Number.isSafeInteger(value.seq) ||
    Number(value.seq) < 1 ||
    !Number.isSafeInteger(value.at) ||
    Number(value.at) < 0
  ) {
    return null;
  }
  const command = parseCommand(value.command);
  return command
    ? { seq: Number(value.seq), at: Number(value.at), command }
    : null;
}

function reject(state: GameState, error: string, message?: string): CommandResult {
  return { state, status: "rejected", error, message };
}

function fromModel(
  previous: GameState,
  result: { state: GameState; error?: string },
): CommandResult {
  if (result.error) return reject(previous, result.error);
  return {
    state: result.state,
    status: result.state === previous ? "noop" : "applied",
  };
}

function runCommand(state: GameState, command: GameCommand, at: number): CommandResult {
  switch (command.type) {
    case "selectDestination":
      if (state.selectedTown === command.town && state.lastMessage === "") {
        return { state, status: "noop" };
      }
      return {
        state: { ...state, selectedTown: command.town, lastMessage: "" },
        status: "applied",
      };
    case "startVoyage": {
      const next = startVoyage(state, at);
      return next.voyage
        ? { state: next, status: "applied" }
        : reject(state, "route-unavailable", next.lastMessage);
    }
    case "changeVoyageSpeed":
      return fromModel(state, { state: changeVoyageSpeed(state, command.speed, at) });
    case "resumeVoyage":
      // Handled before the clock runs, in applyCommand.
      return reject(state, "invalid-command");
    case "arrive": {
      const voyage = state.voyage;
      if (!voyage) return reject(state, "not-sailing");
      if (voyage.durationMs - voyage.elapsedMs > ARRIVAL_TOLERANCE_MS * state.sailingSpeed) {
        return reject(state, "voyage-not-finished");
      }
      return { state: arriveAtDestination(state), status: "applied" };
    }
    case "resolveEncounter": {
      if (!state.encounterPending) return reject(state, "no-encounter");
      const resolved = resolveRiverEncounter(state);
      return { state: resolved.state, status: "applied", encounter: resolved.result };
    }
    case "buyGood":
      return fromModel(state, buyGood(state, command.good, command.quantity));
    case "sellGood":
      return fromModel(state, sellGood(state, command.good, command.quantity));
    case "buyUpgrade":
      return fromModel(state, buyUpgrade(state, command.upgrade));
    case "repairShip":
      return fromModel(state, repairShip(state));
    case "buyShip":
      return fromModel(state, buyPlayerShip(state, command.vesselClass));
    case "selectShip":
      return fromModel(state, selectPlayerShip(state, command.shipId));
    case "orderShipReturn":
      return fromModel(state, orderShipReturn(state, command.shipId));
    case "configureRoute":
      return fromModel(
        state,
        configureAutomatedTradeRoute(
          state,
          command.shipId,
          command.destination,
          command.rules,
          command.initialCapital,
        ),
      );
    case "setRouteStatus":
      return fromModel(state, setAutomatedTradeRouteStatus(state, command.shipId, command.status));
    case "cancelRoute":
      return fromModel(state, cancelAutomatedTradeRoute(state, command.shipId));
    case "tradeWithMerchant":
      return fromModel(state, tradeWithNpcMerchant(state, command.merchantId, command.good));
    case "buyWarehouse":
      return fromModel(state, buyWarehouse(state));
    case "storeGood":
      return fromModel(state, storeGoodInWarehouse(state, command.good));
    case "retrieveGood":
      return fromModel(state, retrieveGoodFromWarehouse(state, command.good));
    case "buyResidence":
      return fromModel(state, buyResidence(state));
    case "marry":
      return fromModel(state, marryAtResidence(state));
    case "buyFarm":
      return fromModel(state, buyFarm(state));
    case "collectFarm":
      return fromModel(state, collectFarmOutput(state));
    case "acceptMission":
      return fromModel(state, acceptMission(state, command.missionId));
  }
}

/**
 * Applies one command at a moment in time. It's pure, so the same state, command
 * and time always give the same result. A refused command leaves the state untouched.
 */
export function applyCommand(
  state: GameState,
  command: GameCommand,
  at: number,
): CommandResult {
  const docked = !state.voyage && !state.encounterPending;
  if (DOCKED_ONLY.has(command.type) && !docked) {
    return reject(state, "not-docked");
  }
  const anchor = state.voyage?.progressUpdatedAt;
  try {
    if (command.type === "resumeVoyage") {
      if (anchor === undefined) return { state, status: "noop" };
      if (command.pausedAt < anchor || command.pausedAt > at) {
        return reject(state, "invalid-time");
      }
      return {
        state: resumeVoyage(checkpointVoyageProgress(state, command.pausedAt), at),
        status: "applied",
      };
    }
    if (anchor !== undefined && at < anchor) return reject(state, "invalid-time");
    // Bringing the voyage up to this moment first means commands see the same world
    // however often the browser happened to checkpoint in between.
    const current = state.voyage ? checkpointVoyageProgress(state, at) : state;
    const result = runCommand(current, command, at);
    if (result.status === "rejected") return { ...result, state };
    if (result.status === "noop") return { ...result, state };
    return result;
  } catch (error) {
    return reject(state, "invalid-state", error instanceof Error ? error.message : undefined);
  }
}
