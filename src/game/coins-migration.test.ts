import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { asGoldSave } from "../test/gold-save";
import { applyCommand } from "./commands";
import {
  createMissionBoard,
  MARKET_PORTS,
  STARTING_COINS,
  createNewGame,
  getGoodPrice,
  getMerchantProfile,
  type GameState,
} from "./model";
import { NewerSaveError, isValidGameState, migrateLegacySave, validateSave } from "./save-format";
import {
  commitGame,
  listSaveBackups,
  loadGame,
  openGameSession,
  readCommandLog,
  readRawSave,
  readSaveBackup,
  restoreSaveBackup,
  saveGame,
  startCommandLog,
} from "./storage";
import saveV19 from "./__fixtures__/save-v19.json";
import saveV20 from "./__fixtures__/save-v20.json";

const T0 = 1_800_100_000_000;
const MIGRATION_BACKUP = "save-backup:migration:v20";

type Loose = Record<string, any>;

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

function scaled(amounts: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(amounts).map(([key, amount]) => [key, amount * 50]));
}

function expectExactCoins(old: Loose, game: GameState): void {
  expect(game.version).toBe(28);
  expect(game.coins).toBe(old.gold * 50);
  expect(game.highestCoins).toBe(old.highestGold * 50);
  expect("gold" in game).toBe(false);
  expect("highestGold" in game).toBe(false);
  expect(JSON.stringify(game)).not.toMatch(/\bgold\b|Gold/);

  expect(game.averagePurchasePrice).toEqual(scaled(old.averagePurchasePrice));
  for (const port of MARKET_PORTS) {
    expect(game.warehouseAveragePurchasePrice[port.id]).toEqual(
      scaled(old.warehouseAveragePurchasePrice[port.id]),
    );
  }
  game.fleet.forEach((ship, index) => {
    const before = old.fleet[index];
    expect(ship.averagePurchasePrice).toEqual(scaled(before.averagePurchasePrice));
    expect(ship.automatedRoute?.capital).toBe(
      before.automatedRoute ? before.automatedRoute.capital * 50 : undefined,
    );
  });
  // The original merchants convert exactly, and can only then rise to their roster capital.
  for (const before of old.npcMerchants) {
    const merchant = game.npcMerchants.find((entry) => entry.id === before.id)!;
    expect(merchant.budget).toBe(Math.max(before.budget * 50, getMerchantProfile(before.id)!.startingCoins));
    expect(merchant.cargoCost).toEqual(scaled(before.cargoCost));
  }
  game.missions.forEach((mission, index) => {
    const before = old.missions[index];
    // A later step sets new delivery and visit rewards. Profit targets kept their converted one.
    if (mission.type === "profitable_trade") expect(mission.rewardCoins).toBe(before.rewardGold * 50);
    else expect(mission.rewardCoins).toBe(createMissionBoard().find((offer) => offer.id === mission.id)!.rewardCoins);
    expect(mission.targetProfit).toBe(before.targetProfit * 50);
    expect(mission.progress).toBe(
      before.type === "profitable_trade" ? before.progress * 50 : before.progress,
    );
  });
}

// What's left of a save once every money field is taken out should be identical.
function withoutMoney(save: Loose): Loose {
  // Stock and the world clock are covered by the market tests.
  const { gold, highestGold, coins, highestCoins, version, averagePurchasePrice, warehouseAveragePurchasePrice, lastMessage, voyage, marketStock, npcSimulationDay, worldDay, worldSeed, npcActivity, debtOwed, rescuesTaken, leaderboards, ...rest } = save;
  const { startedAt, arrivalAt, progressUpdatedAt, ...voyageRest } = voyage ?? {};
  return {
    ...rest,
    voyage: voyageRest,
    fleet: save.fleet.map((ship: Loose) => {
      const { averagePurchasePrice: _cost, automationLog, automatedRoute, ...other } = ship;
      const { capital, runningCostPaid, waiting, ...route } = automatedRoute ?? {};
      return { ...other, route, logDays: automationLog.map((entry: Loose) => entry.sailingDay) };
    }),
    // Merchants have their own migration tests.
    npcMerchants: undefined,
    missions: save.missions.map(
      ({ rewardGold, rewardCoins, targetProfit, progress, reputationEarned, availableAgainDay, ...mission }: Loose) => mission,
    ),
  };
}

describe("a new game", () => {
  it("starts with 5,000 Coins", () => {
    const game = createNewGame("Maya");
    expect(STARTING_COINS).toBe(5_000);
    expect(game.coins).toBe(5_000);
    expect(game.highestCoins).toBe(5_000);
    expect(isValidGameState(game)).toBe(true);
  });
});

describe("migrating to Coins", () => {
  it("converts every amount in the v20 test save, and nothing else", () => {
    const game = validateSave(saveV20, T0);
    expectExactCoins(saveV20, game);
    expect(withoutMoney(game)).toEqual(withoutMoney(saveV20));
    expect(game.voyage!.elapsedMs).toBe(saveV20.voyage.elapsedMs);
  });

  it("converts a v19 save the same way, through the navigation step", () => {
    const game = validateSave(saveV19, T0);
    expectExactCoins(saveV19, game);
    const old = saveV19 as Loose;
    expect(game.cargo).toEqual(old.cargo);
    expect(game.marketStock.dhaka.rice).toBe(old.marketStock.dhaka.rice * 3);
    expect(game.fleet.map((ship) => ship.cargo)).toEqual(old.fleet.map((ship: Loose) => ship.cargo));
    expect(game.fleet.map((ship) => ship.shipHull)).toEqual(old.fleet.map((ship: Loose) => ship.shipHull));
    expect(game.sailingDay).toBe(old.sailingDay);
    expect(game.reputation).toBe(old.reputation);
    expect(game.visitedTowns).toEqual(old.visitedTowns);
    expect(game.voyage!.destination).toBe(old.voyage.destination);
    expect(game.voyage!.elapsedMs / game.voyage!.durationMs).toBeCloseTo(
      old.voyage.elapsedMs / old.voyage.durationMs,
    );
  });

  it("restates amounts in old messages, and leaves other words alone", () => {
    const game = createNewGame("Maya");
    const old = {
      ...asGoldSave(game, 20),
      lastMessage: "Contract complete: 24 gold, +2 reputation.",
    };
    expect(validateSave(old, T0).lastMessage).toBe("Contract complete: 1,200 Coins, +2 reputation.");
    expect(validateSave({ ...old, lastMessage: "You made it to Dhaka." }, T0).lastMessage).toBe(
      "You made it to Dhaka.",
    );
  });

  it("doesn't convert twice when an older step adds today's templates", () => {
    const { missions, npcMerchants, npcActivity, worldDay, ...v13 } = asGoldSave(createNewGame("Maya"), 13);
    const game = validateSave(v13, T0);
    expect(game.missions).toEqual(createNewGame("Maya").missions);
    expect(game.npcMerchants).toEqual(createNewGame("Maya").npcMerchants);
  });

  it("gives an old save's estimated cost basis in Coins once", () => {
    const fresh = createNewGame("Maya");
    const { averagePurchasePrice: _cost, ...v5 } = asGoldSave(fresh, 5);
    const game = migrateLegacySave(v5, T0) as GameState;
    expect(game.averagePurchasePrice.rice).toBeCloseTo(
      getGoodPrice("dhaka", "rice", "buy", false, fresh.marketStock.dhaka.rice),
    );
  });

  describe("the gold-peak repair", () => {
    function goldSave(gold: number, highestGold: number, completedMilestones: string[] = []): Loose {
      return { ...asGoldSave(createNewGame("Maya"), 20), gold, highestGold, completedMilestones };
    }

    it("runs on gold, then converts", () => {
      const game = validateSave(goldSave(280, 200), T0);
      expect(game.coins).toBe(14_000);
      expect(game.highestCoins).toBe(14_000);
      expect(game.completedMilestones).toContain("prosperous_merchant");
    });

    it("uses the gold target, so 249 gold doesn't earn the milestone", () => {
      const game = validateSave(goldSave(249, 100), T0);
      expect(game.highestCoins).toBe(12_450);
      expect(game.completedMilestones).toEqual([]);
    });

    it("leaves a correct peak alone", () => {
      const game = validateSave(goldSave(100, 900), T0);
      expect(game.coins).toBe(5_000);
      expect(game.highestCoins).toBe(45_000);
      expect(game.completedMilestones).toEqual([]);
    });

    it("still repairs a save already in Coins", () => {
      const game = validateSave({ ...createNewGame("Maya"), coins: 14_000, highestCoins: 10_000 }, T0);
      expect(game.highestCoins).toBe(14_000);
      expect(game.completedMilestones).toContain("prosperous_merchant");
    });
  });

  it("is safe to load again without converting again", () => {
    const once = validateSave(saveV20, T0);
    const twice = validateSave(JSON.parse(JSON.stringify(once)), T0 + 1_000);
    expect(twice.coins).toBe(once.coins);
    expect(twice.missions).toEqual(once.missions);
    expect(twice.npcMerchants).toEqual(once.npcMerchants);
  });

  it("plays on after converting", () => {
    const game = validateSave(saveV20, T0);
    const arrived = applyCommand(game, { type: "arrive" }, Math.ceil(game.voyage!.arrivalAt));
    expect(arrived.status).toBe("applied");
    expect(isValidGameState(arrived.state)).toBe(true);
  });
});

describe("save backups", () => {
  beforeEach(resetDatabase);
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the original save and its log when migrating", async () => {
    const log = { formatVersion: 1, provenance: "recorded", baseSeq: 0, nextSeq: 3, lastAt: T0 };
    const entry = { seq: 1, at: T0, command: { type: "startVoyage" } };
    await writeRaw("captain", saveV20);
    await writeRaw("command-log:meta", log);
    await writeRaw("command-log:base", { from: "the old base" });
    await writeRaw("command-log:entry:000000000001", entry);

    const session = await openGameSession(T0);

    expect(session.game?.version).toBe(28);
    expect(session.log?.provenance).toBe("imported");
    expect((await readCommandLog())?.commands).toEqual([]);
    const backup = await readSaveBackup(MIGRATION_BACKUP);
    expect(backup).toMatchObject({ formatVersion: 1, reason: "migration", createdAt: T0 });
    expect(backup?.save).toEqual(saveV20);
    expect(backup?.log).toEqual({ meta: log, base: { from: "the old base" }, entries: [entry] });
    expect(await listSaveBackups()).toEqual([
      { key: MIGRATION_BACKUP, reason: "migration", createdAt: T0, saveVersion: 20, captainName: "Recorded" },
    ]);
  });

  it("backs up each older version under its own name", async () => {
    await writeRaw("captain", saveV19);
    await openGameSession(T0);
    expect((await readSaveBackup("save-backup:migration:v19"))?.save).toEqual(saveV19);
    expect(await readSaveBackup(MIGRATION_BACKUP)).toBeUndefined();
  });

  it("writes no backup when nothing needs migrating", async () => {
    await saveGame(createNewGame("Maya"));
    await openGameSession(T0);
    expect(await listSaveBackups()).toEqual([]);
  });

  it("leaves the original untouched if the save can't be migrated", async () => {
    const broken = { ...saveV20, fleet: "not a fleet" };
    await writeRaw("captain", broken);
    await expect(openGameSession(T0)).rejects.toThrow("could not be loaded");
    expect(await readRawSave()).toEqual(broken);
    expect(await listSaveBackups()).toEqual([]);
  });

  it("leaves the original untouched if writing the migration is interrupted", async () => {
    await writeRaw("captain", saveV20);
    await writeRaw("command-log:meta", { formatVersion: 1, provenance: "recorded", baseSeq: 0, nextSeq: 1, lastAt: T0 });
    const realPut = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      // The backup has been written by now, so this tests that the two stand or fall together.
      if (key === "command-log:meta") throw new Error("The browser stopped the write.");
      return realPut.call(this, value, key);
    });

    await expect(openGameSession(T0)).rejects.toThrow("The browser stopped the write.");
    spy.mockRestore();

    expect(await readRawSave()).toEqual(saveV20);
    expect(await listSaveBackups()).toEqual([]);
    expect((await openGameSession(T0)).game?.coins).toBe(saveV20.gold * 50);
  });

  it("restores a backup, which then upgrades again, keeping what it replaced", async () => {
    await writeRaw("captain", saveV20);
    const { game } = await openGameSession(T0);
    const laterGame = { ...game!, coins: game!.coins + 50, highestCoins: game!.highestCoins + 50 };
    await saveGame(laterGame);

    await restoreSaveBackup(MIGRATION_BACKUP, T0 + 5_000);

    expect(await readRawSave()).toEqual(saveV20);
    const replaced = await readSaveBackup("save-backup:before-restore");
    expect((replaced?.save as GameState).coins).toBe(laterGame.coins);
    const again = await openGameSession(T0 + 6_000);
    expect(again.game?.coins).toBe(saveV20.gold * 50);
  });

  it("restores the old command log with the save", async () => {
    const log = { formatVersion: 1, provenance: "recorded", baseSeq: 0, nextSeq: 2, lastAt: T0 };
    const entry = { seq: 1, at: T0, command: { type: "startVoyage" } };
    await writeRaw("captain", saveV20);
    await writeRaw("command-log:meta", log);
    await writeRaw("command-log:base", { from: "the old base" });
    await writeRaw("command-log:entry:000000000001", entry);
    await openGameSession(T0);

    await restoreSaveBackup(MIGRATION_BACKUP, T0 + 1_000);

    expect(await readCommandLog()).toEqual({
      meta: log,
      base: { from: "the old base" },
      commands: [entry],
    });
  });

  it("refuses to restore a backup that doesn't exist, changing nothing", async () => {
    const game = createNewGame("Maya");
    await saveGame(game);
    await expect(restoreSaveBackup("save-backup:migration:v5")).rejects.toThrow();
    expect((await loadGame())?.captainName).toBe("Maya");
  });

  it("keeps the old save when starting a new game, even one that wouldn't load", async () => {
    const broken = { ...saveV20, fleet: "not a fleet" };
    await writeRaw("captain", broken);
    await startCommandLog(createNewGame("Maya"));
    expect((await loadGame())?.captainName).toBe("Maya");
    expect((await readSaveBackup("save-backup:new-game"))?.save).toEqual(broken);
  });
});

describe("a save from a newer version of the game", () => {
  const newer = { ...createNewGame("Maya"), version: 29, somethingNew: true };

  beforeEach(resetDatabase);

  it("is reported as newer, not as broken", async () => {
    expect(() => validateSave(newer, T0)).toThrow(NewerSaveError);
    await writeRaw("captain", newer);
    await expect(openGameSession(T0)).rejects.toBeInstanceOf(NewerSaveError);
    await expect(openGameSession(T0)).rejects.toThrow(/newer version.*Reload/);
    await expect(loadGame()).rejects.toBeInstanceOf(NewerSaveError);
  });

  it("is never changed by loading", async () => {
    await writeRaw("captain", newer);
    await openGameSession(T0).catch(() => undefined);
    expect(await readRawSave()).toEqual(newer);
    expect(await listSaveBackups()).toEqual([]);
  });

  it("can't be overwritten by a tab left open on the older version", async () => {
    await writeRaw("captain", newer);
    const old = createNewGame("Other");
    await expect(saveGame(old)).rejects.toBeInstanceOf(NewerSaveError);
    await expect(commitGame(old, [])).rejects.toBeInstanceOf(NewerSaveError);
    await expect(startCommandLog(old)).rejects.toBeInstanceOf(NewerSaveError);
    expect(await readRawSave()).toEqual(newer);
  });
});
