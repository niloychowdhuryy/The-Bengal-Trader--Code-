import { describe, expect, it } from "vitest";
import {
  applyCommand,
  parseCommand,
  parseRecordedCommand,
  type GameCommand,
  type RecordedCommand,
} from "./commands";
import {
  TOWNS,
  checkpointVoyageProgress,
  createNewGame,
  sellGood,
  buyGood,
  startVoyage,
  type GameState,
} from "./model";
import { replayCommands } from "./replay";
import { isValidGameState } from "./save-format";

const T0 = 1_800_000_000_000;

function rich(gold = 5_000): GameState {
  return { ...createNewGame("Maya"), gold, highestGold: gold };
}

function sailing(state = rich()): GameState {
  return startVoyage({ ...state, selectedTown: "sonargaon" }, T0);
}

describe("parseCommand", () => {
  it.each([
    [{ type: "buyGood", good: "rice", quantity: 2 }],
    [{ type: "startVoyage" }],
    [{ type: "changeVoyageSpeed", speed: 4 }],
    [{ type: "resumeVoyage", pausedAt: 5 }],
    [{ type: "configureRoute", shipId: "a", destination: "patna", initialCapital: 0, rules: [{ good: "lac", buyAtOrigin: true, sellAtDestination: false }] }],
  ])("accepts %j", (command) => {
    expect(parseCommand(command)).toEqual(command);
  });

  it.each([
    [null],
    ["buyGood"],
    [[]],
    [{}],
    [{ type: "giveMeGold", amount: 1_000_000 }],
    [{ type: "buyGood", good: "rice" }],
    [{ type: "buyGood", good: "diamonds", quantity: 1 }],
    [{ type: "buyGood", good: "__proto__", quantity: 1 }],
    [{ type: "buyGood", good: "rice", quantity: -1 }],
    [{ type: "buyGood", good: "rice", quantity: 0 }],
    [{ type: "buyGood", good: "rice", quantity: 1.5 }],
    [{ type: "buyGood", good: "rice", quantity: "9" }],
    [{ type: "buyGood", good: "rice", quantity: 1e12 }],
    [{ type: "buyGood", good: "rice", quantity: 1, price: 0 }],
    [{ type: "sellGood", good: "rice", quantity: Number.NaN }],
    [{ type: "startVoyage", gold: 999 }],
    [{ type: "selectDestination", town: "atlantis" }],
    [{ type: "changeVoyageSpeed", speed: 1000 }],
    [{ type: "buyShip", vesselClass: "constructor" }],
    [{ type: "buyUpgrade", upgrade: "toString" }],
    [{ type: "configureRoute", shipId: "a", destination: "patna", initialCapital: -5, rules: [] }],
    [{ type: "configureRoute", shipId: "a", destination: "patna", initialCapital: 0, rules: [{ good: "lac" }] }],
    [{ type: "setRouteStatus", shipId: "a", status: "free-money" }],
    [{ type: "selectShip", shipId: "x".repeat(81) }],
  ])("refuses %j", (command) => {
    expect(parseCommand(command)).toBeNull();
  });

  it("rejects recorded commands with bad numbering or time", () => {
    const command = { type: "startVoyage" };
    expect(parseRecordedCommand({ seq: 1, at: 5, command })).not.toBeNull();
    expect(parseRecordedCommand({ seq: 0, at: 5, command })).toBeNull();
    expect(parseRecordedCommand({ seq: 1.5, at: 5, command })).toBeNull();
    expect(parseRecordedCommand({ seq: 1, at: -1, command })).toBeNull();
    expect(parseRecordedCommand({ seq: 1, at: 5, command, extra: true })).toBeNull();
  });
});

describe("applyCommand", () => {
  it("matches the game rules for normal play", () => {
    const state = rich();
    const viaCommand = applyCommand(state, { type: "buyGood", good: "salt", quantity: 2 }, T0);
    expect(viaCommand.status).toBe("applied");
    expect(viaCommand.state).toEqual(buyGood(state, "salt", 2).state);
    const sold = applyCommand(viaCommand.state, { type: "sellGood", good: "salt", quantity: 1 }, T0);
    expect(sold.state).toEqual(sellGood(viaCommand.state, "salt", 1).state);
  });

  it("refuses trades the player can't afford and leaves the state untouched", () => {
    const state = rich(1);
    const result = applyCommand(state, { type: "buyGood", good: "silk", quantity: 1 }, T0);
    expect(result.status).toBe("rejected");
    expect(result.error).toBe("gold");
    expect(result.state).toBe(state);
  });

  it("refuses selling goods the player doesn't own", () => {
    const result = applyCommand(rich(), { type: "sellGood", good: "opium", quantity: 1 }, T0);
    expect(result.error).toBe("empty");
  });

  it.each<[GameCommand]>([
    [{ type: "buyGood", good: "rice", quantity: 1 }],
    [{ type: "sellGood", good: "rice", quantity: 1 }],
    [{ type: "buyUpgrade", upgrade: "hold" }],
    [{ type: "repairShip" }],
    [{ type: "buyShip", vesselClass: "bora" }],
    [{ type: "buyWarehouse" }],
    [{ type: "storeGood", good: "rice" }],
    [{ type: "buyResidence" }],
    [{ type: "buyFarm" }],
    [{ type: "collectFarm" }],
    [{ type: "acceptMission", missionId: "dhaka:visit" }],
    [{ type: "selectDestination", town: "patna" }],
    [{ type: "tradeWithMerchant", merchantId: "abdul-rahman", good: "rice" }],
  ])("refuses %j while at sea", (command) => {
    const state = sailing();
    const result = applyCommand(state, command, T0 + 1_000);
    expect(result.error).toBe("not-docked");
    expect(result.state).toBe(state);
  });

  it("refuses docked actions during an encounter, and only then allows resolving it", () => {
    const state: GameState = {
      ...rich(),
      currentTown: "chittagong",
      selectedTown: "chittagong",
      encounterPending: true,
      chittagongIntroductionSeen: true,
    };
    expect(applyCommand(state, { type: "buyFarm" }, T0).error).toBe("not-docked");
    const resolved = applyCommand(state, { type: "resolveEncounter" }, T0);
    expect(resolved.status).toBe("applied");
    expect(resolved.encounter).toBeDefined();
    expect(applyCommand(resolved.state, { type: "resolveEncounter" }, T0).error).toBe("no-encounter");
  });

  it("refuses arriving before the voyage has finished", () => {
    const state = sailing();
    const early = applyCommand(state, { type: "arrive" }, T0 + 1_000);
    expect(early.error).toBe("voyage-not-finished");
    expect(early.state.voyage).not.toBeNull();
    const voyage = state.voyage!;
    const onTime = applyCommand(state, { type: "arrive" }, Math.ceil(voyage.arrivalAt));
    expect(onTime.status).toBe("applied");
    expect(onTime.state.currentTown).toBe("sonargaon");
    expect(onTime.state.voyage).toBeNull();
    expect(applyCommand(onTime.state, { type: "arrive" }, Math.ceil(voyage.arrivalAt)).error).toBe("not-sailing");
  });

  it("doesn't count closed-app time when a voyage resumes", () => {
    const state = sailing();
    const left = T0 + 2_000;
    const hourLater = left + 3_600_000;
    const resumed = applyCommand(state, { type: "resumeVoyage", pausedAt: left }, hourLater);
    expect(resumed.state.voyage?.elapsedMs).toBe(2_000);
    expect(applyCommand(resumed.state, { type: "arrive" }, hourLater + 1_000).error).toBe("voyage-not-finished");
  });

  it("refuses a resume that claims impossible times", () => {
    const state = sailing();
    expect(applyCommand(state, { type: "resumeVoyage", pausedAt: T0 - 1 }, T0 + 5).error).toBe("invalid-time");
    expect(applyCommand(state, { type: "resumeVoyage", pausedAt: T0 + 9 }, T0 + 5).error).toBe("invalid-time");
  });

  it("treats actions that change nothing as no-ops so they aren't recorded", () => {
    const state = rich();
    expect(applyCommand(state, { type: "selectShip", shipId: state.selectedShipId }, T0).status).toBe("noop");
    expect(applyCommand(sailing(), { type: "changeVoyageSpeed", speed: 1 }, T0).status).toBe("noop");
  });
});

// A small seeded generator so a failure can be reproduced from its seed.
function random(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function closeTo(a: unknown, b: unknown, path = ""): string | null {
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) < 1e-6 * Math.max(1, Math.abs(a)) ? null : `${path}: ${a} vs ${b}`;
  }
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return a === b ? null : `${path}: ${String(a)} vs ${String(b)}`;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const difference = closeTo(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      `${path}.${key}`,
    );
    if (difference) return difference;
  }
  return null;
}

describe("randomised play", () => {
  const goods = ["rice", "salt", "muslin", "silk", "sugar", "saltpetre", "opium", "lac"] as const;

  function nextCommand(pick: () => number, state: GameState): GameCommand {
    const good = goods[Math.floor(pick() * goods.length)];
    const town = TOWNS[Math.floor(pick() * TOWNS.length)].id;
    const ship = state.fleet[Math.floor(pick() * state.fleet.length)].id;
    const options: GameCommand[] = [
      { type: "selectDestination", town },
      { type: "startVoyage" },
      { type: "buyGood", good, quantity: 1 + Math.floor(pick() * 6) },
      { type: "buyGood", good, quantity: 1 + Math.floor(pick() * 6) },
      { type: "sellGood", good, quantity: 1 + Math.floor(pick() * 6) },
      { type: "sellGood", good, quantity: 1 + Math.floor(pick() * 6) },
      { type: "buyUpgrade", upgrade: (["cannon", "hull", "hold"] as const)[Math.floor(pick() * 3)] },
      { type: "repairShip" },
      { type: "buyShip", vesselClass: (["river-boat", "bora", "patello"] as const)[Math.floor(pick() * 3)] },
      { type: "selectShip", shipId: ship },
      { type: "orderShipReturn", shipId: ship },
      { type: "configureRoute", shipId: ship, destination: town, initialCapital: 50 * Math.floor(pick() * 4), rules: [{ good, buyAtOrigin: true, sellAtDestination: true }] },
      { type: "setRouteStatus", shipId: ship, status: pick() < 0.5 ? "paused" : "running" },
      { type: "cancelRoute", shipId: ship },
      { type: "tradeWithMerchant", merchantId: state.npcMerchants[0].id, good },
      { type: "buyWarehouse" },
      { type: "storeGood", good },
      { type: "retrieveGood", good },
      { type: "buyResidence" },
      { type: "marry" },
      { type: "buyFarm" },
      { type: "collectFarm" },
      { type: "acceptMission", missionId: `${state.currentTown}:visit` },
      { type: "acceptMission", missionId: `${state.currentTown}:delivery` },
      { type: "acceptMission", missionId: `${state.currentTown}:purchase-delivery` },
      { type: "acceptMission", missionId: `${state.currentTown}:profitable-trade` },
      { type: "resolveEncounter" },
      { type: "changeVoyageSpeed", speed: ([1, 2, 4] as const)[Math.floor(pick() * 3)] },
    ];
    return options[Math.floor(pick() * options.length)];
  }

  it.each([1, 2, 3, 4, 5, 6, 7, 8])("stays valid and replays exactly (seed %i)", (seed) => {
    const pick = random(seed);
    const base = rich(4_000);
    let live = base;
    let at = T0;
    let seq = 0;
    const log: RecordedCommand[] = [];
    const record = (command: GameCommand) => {
      const result = applyCommand(live, command, at);
      expect(result.status === "rejected" ? result.state : live).toBe(live);
      if (result.status !== "applied") return;
      live = result.state;
      log.push({ seq: (seq += 1), at, command });
      expect(live.gold).toBeGreaterThanOrEqual(0);
      expect(isValidGameState(live), `after ${command.type}`).toBe(true);
    };

    for (let step = 0; step < 1_500; step += 1) {
      at += Math.floor(pick() * 20_000);
      if (live.voyage) {
        const roll = pick();
        if (roll < 0.3) {
          // The browser's unrecorded background checkpoint.
          live = checkpointVoyageProgress(live, at);
        } else if (roll < 0.4) {
          // Closing the app: checkpoint, time passes, then resume.
          live = checkpointVoyageProgress(live, at);
          const pausedAt = at;
          at += Math.floor(pick() * 10_000_000);
          record({ type: "resumeVoyage", pausedAt });
        }
        if (at >= live.voyage!.arrivalAt) {
          record({ type: "arrive" });
          continue;
        }
      }
      record(nextCommand(pick, live));
    }

    expect(log.length).toBeGreaterThan(100);
    const replay = replayCommands(
      { state: base, lastSeq: 0, lastAt: 0 },
      log,
      { receivedAt: at },
    );
    expect(replay).toMatchObject({ status: "accepted", lastSeq: seq });
    if (replay.status !== "accepted") return;
    // Background checkpoints only ever bring a voyage up to date.
    const settle = (state: GameState) => checkpointVoyageProgress(state, at);
    expect(closeTo(settle(replay.state), settle(live))).toBeNull();
  });
});
