import { beforeEach, describe, expect, it } from "vitest";
import { applyCommand } from "./commands";
import { GOODS, type GameState } from "./model";
import { isValidGameState, validateSave } from "./save-format";
import { loadGame, openGameSession } from "./storage";
import fixture from "./__fixtures__/save-v20.json";

const T0 = 1_800_100_000_000;

// A later migration can only be trusted if this save holds what it has to carry across.
const save = fixture as unknown as GameState;

function resetDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("bengal-trader");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function writeRawSave(value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("bengal-trader", 2);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains("save")) open.result.createObjectStore("save");
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const transaction = open.result.transaction("save", "readwrite");
      transaction.objectStore("save").put(value, "captain");
      transaction.oncomplete = () => {
        open.result.close();
        resolve();
      };
    };
  });
}

function withoutVoyageClock(state: GameState) {
  const { voyage, ...rest } = state;
  if (!voyage) return rest;
  const { startedAt: _s, arrivalAt: _a, progressUpdatedAt: _p, ...timeless } = voyage;
  return { ...rest, voyage: timeless };
}

describe("v20 test save", () => {
  beforeEach(resetDatabase);

  it("is a valid version 20 save", () => {
    expect(save.version).toBe(20);
    expect(isValidGameState(fixture)).toBe(true);
  });

  it("holds money in every form a migration has to convert", () => {
    expect(save.gold).toBeGreaterThan(0);
    expect(save.highestGold).toBeGreaterThan(save.gold);
    const carrying = save.fleet.filter((ship) =>
      GOODS.some((good) => ship.cargo[good.id] > 0 && ship.averagePurchasePrice[good.id] > 0),
    );
    expect(carrying.length).toBeGreaterThan(1);
    expect(
      Object.values(save.warehouseAveragePurchasePrice).some((port) =>
        Object.values(port).some((price) => price > 0),
      ),
    ).toBe(true);
    expect(save.fleet.some((ship) => (ship.automatedRoute?.capital ?? 0) > 0)).toBe(true);
    expect(save.npcMerchants.some((merchant) => merchant.budget > 0)).toBe(true);
    expect(
      save.npcMerchants.some((merchant) =>
        GOODS.some((good) => merchant.cargo[good.id] > 0 && merchant.cargoCost[good.id] > 0),
      ),
    ).toBe(true);
    expect(save.missions.some((mission) => mission.type === "profitable_trade" && mission.progress > 0)).toBe(true);
    expect(save.missions.some((mission) => mission.status === "active" && mission.purchasedQuantity > 0)).toBe(true);
  });

  it("holds the other things a migration must leave alone", () => {
    expect(save.voyage).not.toBeNull();
    expect(save.fleet).toHaveLength(3);
    expect(new Set(save.fleet.map((ship) => ship.vesselClass)).size).toBe(3);
    expect(save.fleet.some((ship) => ship.automatedRoute?.phase === "traveling")).toBe(true);
    expect(save.npcMerchants.some((merchant) => merchant.phase === "traveling")).toBe(true);
    expect(save.ownedWarehouses.length).toBeGreaterThan(0);
    expect(save.ownedFarms.length).toBeGreaterThan(0);
    expect(save.farmOutput[save.ownedFarms[0]]).toBeGreaterThan(0);
    expect(save.residenceTown).not.toBeNull();
    expect(save.household.spouse).not.toBeNull();
    expect(save.completedMilestones.length).toBeGreaterThan(0);
    expect(save.missions.some((mission) => mission.status === "completed")).toBe(true);
    expect(save.reputation).toBeGreaterThan(0);
  });

  it("loads with only the voyage clock moved on", () => {
    const loaded = validateSave(fixture, T0);
    expect(withoutVoyageClock(loaded)).toEqual(withoutVoyageClock(save));
    expect(loaded.voyage!.elapsedMs).toBe(save.voyage!.elapsedMs);
  });

  it("opens from the database with nothing lost, and carries on playing", async () => {
    await writeRawSave(fixture);

    const session = await openGameSession(T0);
    expect(withoutVoyageClock(session.game!)).toEqual(withoutVoyageClock(save));
    const reloaded = await loadGame();
    expect(withoutVoyageClock(reloaded!)).toEqual(withoutVoyageClock(save));

    const voyage = session.game!.voyage!;
    const arrived = applyCommand(session.game!, { type: "arrive" }, Math.ceil(voyage.arrivalAt));
    expect(arrived.status).toBe("applied");
    expect(arrived.state.currentTown).toBe(voyage.destination);
    expect(isValidGameState(arrived.state)).toBe(true);
  });
});
