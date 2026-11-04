// Version 29 changed towns' market profiles and the price weight. Nothing in a save changes.
import { beforeEach, describe, expect, it } from "vitest";
import saveV20 from "./__fixtures__/save-v20.json";
import saveV28 from "./__fixtures__/save-v28.json";
import { GOODS, MARKET_PORTS, SAVE_VERSION, advanceMarketStock, createInitialMarketStock, createNewGame, type GameState } from "./model";
import { migrateLegacySave, validateSave } from "./save-format";
import { dismissMarketNotice, listSaveBackups, openGameSession, readCommandLog, readSaveBackup, startCommandLog } from "./storage";

const T0 = saveV28.voyage ? (saveV28.voyage as { startedAt: number }).startedAt + 1_000 : 1_000;

describe("a version 28 save", () => {
  it("loads with money, cargo, property, fleet, contracts and stock exactly as they were", () => {
    const upgraded = validateSave(migrateLegacySave(saveV28, T0), T0);
    expect(saveV28.version).toBe(28);
    expect(upgraded.version).toBe(SAVE_VERSION);
    for (const field of [
      "coins", "highestCoins", "captainName", "currentTown", "cargo", "averagePurchasePrice", "marketStock",
      "warehouseStock", "ownedWarehouses", "ownedFarms", "farmOutput", "residenceTown", "reputation", "localStanding",
      "visitedTowns", "missions", "npcMerchants", "worldDay", "sailingDay", "debtOwed", "upgrades",
    ] as const) {
      expect(upgraded[field], field).toEqual((saveV28 as unknown as GameState)[field]);
    }
    expect(upgraded.fleet.map((ship) => ship.id)).toEqual(saveV28.fleet.map((ship) => ship.id));
    expect(upgraded.fleet[0].automatedRoute).toEqual(saveV28.fleet[0].automatedRoute);
    expect(upgraded.voyage?.destination).toBe(saveV28.voyage?.destination);
  });

  it("drifts to the new usual stock by the normal rule, without any jump", () => {
    const upgraded = validateSave(migrateLegacySave(saveV28, T0), T0);
    const usual = createInitialMarketStock();
    const later = advanceMarketStock(upgraded.marketStock, 200);
    for (const { id: port } of MARKET_PORTS) {
      for (const { id: good } of GOODS) {
        expect(later[port][good], `${port} ${good}`).toBe(usual[port][good]);
      }
    }
  });
});

describe("older saves", () => {
  it("reach version 29 through every step, keeping progress", () => {
    const upgraded = validateSave(migrateLegacySave(saveV20, T0), T0);
    expect(upgraded.version).toBe(SAVE_VERSION);
    expect(upgraded.coins).toBe(saveV20.gold * 50);
    expect(upgraded.ownedFarms).toEqual(saveV20.ownedFarms);
    expect(upgraded.ownedWarehouses).toEqual(saveV20.ownedWarehouses);
    expect(upgraded.fleet).toHaveLength(saveV20.fleet.length);
  });
});

describe("upgrading on disk", () => {
  beforeEach(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("bengal-trader");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
  );

  it("backs up the version 28 save first, and restarts its command history", async () => {
    const log = { formatVersion: 1, provenance: "recorded", baseSeq: 0, nextSeq: 1, lastAt: T0 };
    await writeRaw("captain", saveV28);
    await writeRaw("command-log:meta", log);
    await writeRaw("command-log:base", { from: "the old base" });

    const session = await openGameSession(T0);

    expect(session.game?.version).toBe(SAVE_VERSION);
    expect(session.game?.coins).toBe(saveV28.coins);
    expect(session.log?.provenance).toBe("imported");
    expect((await readCommandLog())?.commands).toEqual([]);
    const backup = await readSaveBackup("save-backup:migration:v28");
    expect(backup?.save).toEqual(saveV28);
    expect(backup?.log?.meta).toEqual(log);
    expect((await listSaveBackups()).map((entry) => entry.saveVersion)).toEqual([28]);
  });
});

describe("the notice about the new markets", () => {
  beforeEach(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("bengal-trader");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
  );

  it("is pending after an upgrade, stays pending until read, and never returns", async () => {
    await writeRaw("captain", saveV28);
    expect((await openGameSession(T0)).marketNoticePending).toBe(true);
    expect((await openGameSession(T0)).marketNoticePending).toBe(true);
    await dismissMarketNotice();
    expect((await openGameSession(T0)).marketNoticePending).toBe(false);
  });

  it("is pending after an upgrade from an older version too", async () => {
    await writeRaw("captain", saveV20);
    expect((await openGameSession(T0)).marketNoticePending).toBe(true);
  });

  it("isn't shown for a save already on version 29, or after starting a new game", async () => {
    await writeRaw("captain", createNewGame("Maya", 8));
    expect((await openGameSession(T0)).marketNoticePending).toBe(false);

    await writeRaw("captain", saveV28);
    expect((await openGameSession(T0)).marketNoticePending).toBe(true);
    await startCommandLog(createNewGame("Maya", 8));
    expect((await openGameSession(T0)).marketNoticePending).toBe(false);
  });
});

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
