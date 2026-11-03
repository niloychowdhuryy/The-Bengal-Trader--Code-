import { beforeEach, describe, expect, it } from "vitest";
import { applyCommand, type GameCommand, type RecordedCommand } from "./commands";
import { createNewGame, type GameState } from "./model";
import { replayCommands } from "./replay";
import { isValidGameState } from "./save-format";
import {
  commitGame,
  loadGame,
  openGameSession,
  readCommandLog,
  saveGame,
  startCommandLog,
} from "./storage";
import { asGoldSave } from "../test/gold-save";
import fixture from "./__fixtures__/save-v19.json";

const T0 = 1_800_000_000_000;

function resetDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("bengal-trader");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function writeRaw(key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("bengal-trader", 2);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains("save")) open.result.createObjectStore("save");
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const transaction = open.result.transaction("save", "readwrite");
      transaction.objectStore("save").put(value, key);
      transaction.oncomplete = () => {
        open.result.close();
        resolve();
      };
    };
  });
}

function play(
  state: GameState,
  commands: GameCommand[],
  firstSeq = 1,
  startAt = T0,
): { state: GameState; entries: RecordedCommand[] } {
  let current = state;
  const entries = commands.map((command, index) => {
    const at = startAt + index * 1_000;
    const result = applyCommand(current, command, at);
    expect(result.status, command.type).toBe("applied");
    current = result.state;
    return { seq: firstSeq + index, at, command };
  });
  return { state: current, entries };
}

async function replaySavedLog(receivedAt: number) {
  const log = await readCommandLog();
  if (!log) throw new Error("no log");
  return {
    log,
    replay: replayCommands(
      { state: log.base, lastSeq: log.meta.baseSeq, lastAt: 0 },
      log.commands,
      { receivedAt },
    ),
  };
}

beforeEach(resetDatabase);

describe("command log", () => {
  it("rebuilds a saved game from its recorded commands", async () => {
    const start = { ...createNewGame("Maya"), coins: 40_000, highestCoins: 40_000 };
    await startCommandLog(start);
    const { state, entries } = play(start, [
      { type: "buyGood", good: "salt", quantity: 2 },
      { type: "buyUpgrade", upgrade: "hold" },
      { type: "sellGood", good: "salt", quantity: 1 },
    ]);
    await commitGame(state, entries);

    const { log, replay } = await replaySavedLog(T0 + 60_000);
    expect(log.meta).toMatchObject({ provenance: "recorded", nextSeq: 4, lastAt: T0 + 2_000 });
    expect(log.commands).toEqual(entries);
    expect(replay).toMatchObject({ status: "accepted", lastSeq: 3 });
    if (replay.status === "accepted") expect(replay.state).toEqual(await loadGame());
  });

  it("appends across saves in order, including when saves overlap", async () => {
    const start = createNewGame("Maya");
    await startCommandLog(start);
    const first = play(start, [{ type: "selectDestination", town: "patna" }]);
    const second = play(first.state, [{ type: "selectDestination", town: "sylhet" }], 2, T0 + 5_000);
    await Promise.all([commitGame(first.state, first.entries), commitGame(second.state, second.entries)]);
    const log = await readCommandLog();
    expect(log?.commands.map((entry) => entry.seq)).toEqual([1, 2]);
    expect((await loadGame())?.selectedTown).toBe("sylhet");
  });

  it("saves the game and its commands together or not at all", async () => {
    const start = createNewGame("Maya");
    await startCommandLog(start);
    const { state, entries } = play(start, [{ type: "buyGood", good: "rice", quantity: 1 }]);
    const broken = { ...state, unsavable: () => undefined } as unknown as GameState;
    await expect(commitGame(broken, entries)).rejects.toBeDefined();
    expect(await readCommandLog()).toMatchObject({ commands: [], meta: { nextSeq: 1 } });
    expect((await loadGame())?.coins).toBe(start.coins);
    await commitGame(state, entries);
    expect((await readCommandLog())?.commands).toHaveLength(1);
  });

  it("starts over for a new game", async () => {
    const start = createNewGame("Maya");
    await startCommandLog(start);
    const { state, entries } = play(start, [{ type: "buyGood", good: "rice", quantity: 1 }]);
    await commitGame(state, entries);
    const fresh = createNewGame("Asha");
    await startCommandLog(fresh);
    expect(await readCommandLog()).toMatchObject({
      base: { captainName: "Asha" },
      commands: [],
      meta: { provenance: "recorded", nextSeq: 1 },
    });
  });

  it("restarts from the current game if the log grows too long, and stops claiming full history", async () => {
    const start = createNewGame("Maya");
    await startCommandLog(start);
    const first = play(start, [{ type: "selectDestination", town: "patna" }, { type: "selectDestination", town: "sylhet" }]);
    await commitGame(first.state, first.entries, 5);
    const more = play(first.state, [{ type: "selectDestination", town: "malda" }, { type: "selectDestination", town: "tanda" }, { type: "selectDestination", town: "jessore" }, { type: "selectDestination", town: "patna" }], 3, T0 + 9_000);
    await commitGame(more.state, more.entries, 5);
    const log = await readCommandLog();
    expect(log?.commands).toEqual([]);
    expect(log?.meta).toMatchObject({ provenance: "imported", baseSeq: 6, nextSeq: 7 });
    expect(log?.base.selectedTown).toBe("patna");
  });
});

describe("version 19 saves", () => {
  it("loads a real version 19 save with everything intact", async () => {
    await writeRaw("captain", fixture);
    const session = await openGameSession(T0);
    const game = session.game!;
    expect(game.version).toBe(24);
    expect(isValidGameState(game)).toBe(true);
    const saved = fixture as unknown as GameState;
    expect(game.coins).toBe(fixture.gold * 50);
    expect(game.fleet.map((ship) => ship.cargo)).toEqual(saved.fleet.map((ship) => ship.cargo));
    expect(game.cargo).toEqual(saved.cargo);
    expect(game.marketStock.dhaka.rice).toBe(saved.marketStock.dhaka.rice * 3);
    expect(game.missions.map((mission) => mission.status)).toEqual(
      saved.missions.map((mission) => mission.status),
    );
    expect(game.household).toEqual(saved.household);
    expect(game.ownedWarehouses).toEqual(saved.ownedWarehouses);
    // The journey moved onto the rebuilt network, keeping how far along it was.
    expect(game.version).toBe(24);
    expect(game.voyage?.destination).toBe(saved.voyage?.destination);
    expect(game.voyage!.elapsedMs / game.voyage!.durationMs).toBeCloseTo(
      saved.voyage!.elapsedMs / saved.voyage!.durationMs,
    );
  });

  it("marks it as imported, because its history before commands can't be proved", async () => {
    await writeRaw("captain", fixture);
    const session = await openGameSession(T0);
    expect(session.log).toMatchObject({ provenance: "imported", nextSeq: 1 });
    expect(session.resumedVoyage).toBeNull();
    const log = await readCommandLog();
    expect(log?.base.coins).toBe(session.game?.coins);
  });

  it("starts a new history after migrating, since old commands used the old rules", async () => {
    const start = createNewGame("Maya");
    await startCommandLog(start);
    const { state, entries } = play(start, [{ type: "buyGood", good: "rice", quantity: 1 }]);
    await commitGame(state, entries);
    await writeRaw("captain", asGoldSave(state, 19));
    const session = await openGameSession(T0 + 60_000);
    expect(session.game?.version).toBe(24);
    expect(session.log).toMatchObject({ provenance: "imported", baseSeq: 1, nextSeq: 2 });
    const log = await readCommandLog();
    expect(log?.commands).toEqual([]);
    expect(log?.base.coins).toBe(Math.round(state.coins / 50) * 50);
    expect((await loadGame())?.version).toBe(24);
  });

  it("can be played on and verified after loading", async () => {
    await writeRaw("captain", fixture);
    const { game } = await openGameSession(T0);
    const at = Math.ceil(game!.voyage!.arrivalAt);
    const { state, entries } = play(game!, [{ type: "arrive" }, { type: "buyGood", good: "rice", quantity: 1 }], 1, at);
    await commitGame(state, entries);
    const { replay } = await replaySavedLog(at + 60_000);
    expect(replay.status).toBe("accepted");
    if (replay.status === "accepted") {
      expect(replay.state.currentTown).toBe("sonargaon");
      expect(replay.state).toEqual(await loadGame());
    }
  });

  it("still loads through the plain loader, so older code paths keep working", async () => {
    await saveGame(createNewGame("Maya"));
    expect((await loadGame())?.captainName).toBe("Maya");
  });
});

describe("offline behaviour", () => {
  it("records and replays a voyage interrupted by closing the app", async () => {
    const start = { ...createNewGame("Maya"), selectedTown: "patna" as const };
    await startCommandLog(start);
    const sailing = play(start, [{ type: "startVoyage" }]);
    await commitGame(sailing.state, sailing.entries);

    // Closed for a day, with no connection and no running code.
    const reopenedAt = T0 + 86_400_000;
    const session = await openGameSession(reopenedAt);
    expect(session.game?.voyage?.elapsedMs).toBe(0);
    expect(session.resumedVoyage).toEqual({ pausedAt: T0, at: reopenedAt });
    const resumeEntry: RecordedCommand = {
      seq: session.log!.nextSeq,
      at: reopenedAt,
      command: { type: "resumeVoyage", pausedAt: session.resumedVoyage!.pausedAt },
    };
    const arriveAt = Math.ceil(session.game!.voyage!.arrivalAt);
    const arrived = applyCommand(session.game!, { type: "arrive" }, arriveAt).state;
    expect(arrived.currentTown).toBe("patna");
    await commitGame(arrived, [
      resumeEntry,
      { seq: resumeEntry.seq + 1, at: arriveAt, command: { type: "arrive" } },
    ]);

    const { replay } = await replaySavedLog(arriveAt + 1_000);
    expect(replay.status).toBe("accepted");
    if (replay.status === "accepted") {
      expect(replay.state).toEqual(await loadGame());
    }
  });
});
