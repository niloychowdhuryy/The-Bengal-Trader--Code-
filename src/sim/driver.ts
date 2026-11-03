// Plays the game headlessly through the same commands the interface sends, on a virtual
// clock. Nothing here changes state directly, so every run can be checked by replay.
import { applyCommand, type CommandResult, type GameCommand, type RecordedCommand } from "../game/commands";
import type { GameState, TownId } from "../game/model";
import { replayCommands, type ReplayResult } from "../game/replay";
import { createLedger, noteCommand, type Ledger } from "./ledger";
import type { SailingSpeed } from "../game/travel-time";

export const SIM_START_AT = 1_800_000_000_000;

export interface LegTally {
  voyages: number;
  profit: number;
}

export interface Sim {
  base: GameState;
  state: GameState;
  at: number;
  log: RecordedCommand[];
  speed: SailingSpeed;
  /** Real time a player would spend watching voyages, not deciding. */
  realMs: number;
  voyages: number;
  refused: string[];
  legs: Map<string, LegTally>;
  currentLeg: string | null;
  firstDay: Partial<Record<string, number>>;
  farmUnitsCollected: number;
  ledger: Ledger;
  /** Called after each arrival, so a run can take its measurements. */
  onArrive?: () => void;
}

export function createSim(base: GameState, speed: SailingSpeed = 1): Sim {
  return {
    base,
    state: base,
    at: SIM_START_AT,
    log: [],
    speed,
    realMs: 0,
    voyages: 0,
    refused: [],
    legs: new Map(),
    currentLeg: null,
    firstDay: {},
    farmUnitsCollected: 0,
    ledger: createLedger(),
  };
}

function noteFirst(sim: Sim, event: string): void {
  sim.firstDay[event] ??= Math.round(sim.state.sailingDay * 100) / 100;
}

const FIRST_EVENTS: Partial<Record<GameCommand["type"], string>> = {
  buyUpgrade: "upgrade",
  buyShip: "extraShip",
  configureRoute: "automatedRoute",
  buyWarehouse: "warehouse",
  buyFarm: "farm",
  buyResidence: "residence",
  marry: "marriage",
};

/** Sends one command. Anything refused is noted, because a bot shouldn't ask for it. */
export function send(sim: Sim, command: GameCommand): CommandResult {
  const before = sim.state;
  const result = applyCommand(before, command, sim.at);
  if (result.status === "rejected") {
    sim.refused.push(`${command.type}:${result.error}`);
    return result;
  }
  if (result.status === "noop") return result;

  sim.state = result.state;
  noteCommand(sim.ledger, before, result.state, command);
  sim.log.push({ seq: sim.log.length + 1, at: sim.at, command });

  const event = FIRST_EVENTS[command.type];
  if (event) noteFirst(sim, event);
  if (command.type === "buyShip" && command.vesselClass === "patello") noteFirst(sim, "patello");
  if (command.type === "collectFarm") {
    sim.farmUnitsCollected += result.state.cargo.rice - before.cargo.rice;
  }
  if (command.type === "sellGood" && sim.currentLeg) {
    const leg = sim.legs.get(sim.currentLeg);
    if (leg) {
      leg.profit += result.state.coins - before.coins -
        before.averagePurchasePrice[command.good] * command.quantity;
    }
  }
  for (const milestone of result.state.completedMilestones) {
    if (!before.completedMilestones.includes(milestone)) noteFirst(sim, milestone);
  }
  return result;
}

/** Waits on the virtual clock, in whole milliseconds as the command log requires. */
export function waitUntil(sim: Sim, at: number): void {
  sim.at = Math.max(sim.at, Math.ceil(at));
}

/** Leaves the current port. Returns false if the voyage couldn't start. */
export function depart(sim: Sim, destination: TownId): boolean {
  const origin = sim.state.currentTown;
  send(sim, { type: "selectDestination", town: destination });
  send(sim, { type: "startVoyage" });
  if (!sim.state.voyage) return false;
  if (sim.state.sailingSpeed !== sim.speed) {
    send(sim, { type: "changeVoyageSpeed", speed: sim.speed });
  }
  const key = `${origin}>${destination}`;
  const leg = sim.legs.get(key) ?? { voyages: 0, profit: 0 };
  sim.legs.set(key, { ...leg, voyages: leg.voyages + 1 });
  sim.currentLeg = key;
  sim.voyages += 1;
  return true;
}

/** Waits out the voyage under way and docks, settling any encounter on arrival. */
export function arrive(sim: Sim): void {
  const voyage = sim.state.voyage;
  if (!voyage) return;
  const departedAt = sim.at;
  waitUntil(sim, voyage.arrivalAt);
  sim.realMs += sim.at - departedAt;
  send(sim, { type: "arrive" });
  if (sim.state.encounterPending) send(sim, { type: "resolveEncounter" });
  sim.onArrive?.();
}

export function sail(sim: Sim, destination: TownId): boolean {
  if (!depart(sim, destination)) return false;
  arrive(sim);
  return true;
}

/** Rebuilds the whole run from its recorded commands, as the server would. */
export function replaySim(sim: Sim): ReplayResult {
  return replayCommands(
    { state: sim.base, lastSeq: 0, lastAt: SIM_START_AT },
    sim.log,
    { receivedAt: sim.at },
  );
}
