import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TOWNS,
  advanceNpcWorld,
  configureAutomatedTradeRoute,
  RESIDENCE_PRICE,
  ADDITIONAL_SHIP_PRICE,
  acceptMission,
  arriveAtDestination,
  FARM_PRICE,
  MARRIAGE_HOUSEHOLD_COST,
  marryAtResidence,
  buyGood,
  buyFarm,
  buyPlayerShip,
  buyResidence,
  buyWarehouse,
  checkpointVoyageProgress,
  createNewGame,
  getGoodPrice,
  getNpcMerchant,
  getTownRoute,
  buyUpgrade,
  repairShip,
  resolveRiverEncounter,
  sellGood,
  selectPlayerShip,
  storeGoodInWarehouse,
  startVoyage,
  syncSelectedShip,
  type GameState,
} from "./model";
import { loadGame, saveGame } from "./storage";
import {
  getRouteTravelTime,
  getVoyageProgressMs,
  SAILING_SPEEDS,
} from "./travel-time";
import { planRiverRoute, pointAlongRiverRoute } from "./navigation";

function writeLegacySave(value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("bengal-trader", 2);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("save")) {
        request.result.createObjectStore("save");
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("save", "readwrite");
      transaction.objectStore("save").put(value, "captain");
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
  });

}

describe("IndexedDB offline saves", () => {
  beforeEach(() => {
    indexedDB.deleteDatabase("bengal-trader");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns no save before a new game has been started", async () => {
    await expect(loadGame()).resolves.toBeNull();
  });

  it("migrates version 9 saves with existing property and progress intact", async () => {
    const game = buyWarehouse({
      ...createNewGame("Asha"),
      gold: 400,
      highestGold: 400,
      reputation: 5,
      visitedTowns: ["dhaka", "patna"],
    }).state;
    const { residenceTown: _residenceTown, ...versionNineState } = game;
    await writeLegacySave({ ...versionNineState, version: 9 });

    const migrated = await loadGame();
    expect(migrated?.version).toBe(18);
    expect(migrated?.gold).toBe(250);
    expect(migrated?.reputation).toBe(5);
    expect(migrated?.visitedTowns).toEqual(["dhaka", "patna"]);
    expect(migrated?.ownedWarehouses).toEqual(["dhaka"]);
    expect(migrated?.residenceTown).toBeNull();
  });

  it("restores the latest game after a page reload", async () => {
    const game: GameState = {
      ...createNewGame("Isha"),
      gold: 123,
      highestGold: 123,
      currentTown: "kasimbazar" as const,
      visitedTowns: ["dhaka", "kasimbazar"],
    };

    await saveGame(game);
    await expect(loadGame()).resolves.toEqual(syncSelectedShip(game));
  });

  it("persists accepted missions and local standing across reloads", async () => {
    const accepted = acceptMission(createNewGame("Isha"), "dhaka:delivery").state;
    const game = {
      ...accepted,
      localStanding: { ...accepted.localStanding, dhaka: 25 },
      voyagesStarted: 5,
    };

    await saveGame(game);
    await expect(loadGame()).resolves.toEqual(game);
  });

  it("persists NPC positions, budget, cargo, and activity across reloads", async () => {
    const simulated = {
      ...advanceNpcWorld(createNewGame("Isha"), 1),
      sailingDay: 1,
      selectedTown: "patna" as const,
    };
    const stateWithNpcCargo = {
      ...simulated,
      npcMerchants: simulated.npcMerchants.map((merchant, index) =>
        index === 0
          ? {
              ...merchant,
              cargo: { ...merchant.cargo, rice: 1 },
              cargoCost: { ...merchant.cargoCost, rice: 4 },
            }
          : merchant,
      ),
    };
    await saveGame(stateWithNpcCargo);
    await expect(loadGame()).resolves.toEqual(stateWithNpcCargo);
    expect(getNpcMerchant(stateWithNpcCargo, "abdul-rahman")?.budget).toBe(
      stateWithNpcCargo.npcMerchants[0].budget,
    );
  });

  it("persists each player ship and the selected ship across reloads", async () => {
    const purchased = buyPlayerShip({
      ...createNewGame("Isha"),
      gold: ADDITIONAL_SHIP_PRICE + 40,
      highestGold: ADDITIONAL_SHIP_PRICE + 40,
    }).state;
    const selected = selectPlayerShip(purchased, "player-ship-2").state;
    const carryingCargo = buyGood(selected, "salt").state;

    await saveGame(carryingCargo);
    const restored = await loadGame();
    expect(restored).toEqual(carryingCargo);
    expect(restored?.selectedShipId).toBe("player-ship-2");
    expect(restored?.fleet[0].cargo.rice).toBe(2);
    expect(restored?.fleet[1].cargo.salt).toBe(1);
    expect(restored?.fleet[1].currentPort).toBe("dhaka");
  });

  it("migrates a version 16 voyage without losing the starter ship or progress", async () => {
    const upgraded = buyUpgrade(
      {
        ...createNewGame("Isha"),
        gold: 300,
        highestGold: 300,
      },
      "hold",
    ).state;
    const sailing = startVoyage(
      { ...upgraded, selectedTown: "patna" },
      1_000,
    );
    const voyage = sailing.voyage;
    expect(voyage).not.toBeNull();
    if (!voyage) return;
    const { shipId: _shipId, ...legacyVoyage } = voyage;
    const { fleet: _fleet, selectedShipId: _selectedShipId, ...version16State } =
      sailing;
    await writeLegacySave({
      ...version16State,
      version: 16,
      voyage: legacyVoyage,
    });

    const migrated = await loadGame();
    expect(migrated?.version).toBe(18);
    expect(migrated?.gold).toBe(275);
    expect(migrated?.cargo).toEqual(upgraded.cargo);
    expect(migrated?.upgrades.hold).toBe(1);
    expect(migrated?.fleet).toHaveLength(1);
    expect(migrated?.fleet[0]).toMatchObject({
      id: "player-ship-1",
      currentPort: "dhaka",
      cargo: upgraded.cargo,
      upgrades: upgraded.upgrades,
    });
    expect(migrated?.voyage?.shipId).toBe("player-ship-1");
    expect(migrated?.voyage?.elapsedMs).toBe(sailing.voyage?.elapsedMs);
  });

  it("migrates version 14 saves and initializes bounded NPC traders", async () => {
    const current = createNewGame("Isha");
    const started = startVoyage(
      { ...current, selectedTown: "patna" },
      1000,
    );
    const activeVoyage = checkpointVoyageProgress(started, 31_000);
    const {
      npcMerchants: _npcMerchants,
      npcActivity: _npcActivity,
      npcSimulationDay: _npcSimulationDay,
      ...versionFourteen
    } = activeVoyage;
    await writeLegacySave({ ...versionFourteen, version: 14 });
    vi.spyOn(Date, "now").mockReturnValue(31_000);

    const migrated = await loadGame();
    expect(migrated?.version).toBe(18);
    expect(migrated?.missions).toEqual(current.missions);
    expect(migrated?.npcMerchants).toHaveLength(4);
    expect(migrated?.npcMerchants.every((merchant) => merchant.budget === 100))
      .toBe(true);
    expect(migrated?.npcActivity).toEqual([]);
    expect(migrated?.npcSimulationDay).toBe(0);
    expect(migrated?.voyage?.destination).toBe("patna");
    expect(migrated?.voyage?.elapsedMs).toBe(30_000);
    expect(migrated?.voyage?.progressUpdatedAt).toBe(31_000);
  });

  it("migrates version 15 voyage encounters into optional port encounters without losing cargo or voyage time", async () => {
    const current = createNewGame("Isha");
    const merchant = current.npcMerchants[0];
    const started = startVoyage(
      {
        ...current,
        selectedTown: "patna",
        npcMerchants: [
          {
            ...merchant,
            cargo: { ...merchant.cargo, rice: 1 },
            cargoCost: { ...merchant.cargoCost, rice: 3 },
          },
          ...current.npcMerchants.slice(1),
        ],
      },
      1000,
    );
    const paused = checkpointVoyageProgress(started, 25_000);
    const legacyMerchants = paused.npcMerchants.map(
      ({ strategy: _strategy, ...merchantState }) => merchantState,
    );
    await writeLegacySave({
      ...paused,
      version: 15,
      npcMerchants: legacyMerchants,
      npcEncounter: { merchantId: merchant.id },
    });
    vi.spyOn(Date, "now").mockReturnValue(25_000);

    const migrated = await loadGame();
    expect(migrated?.version).toBe(18);
    expect("npcEncounter" in (migrated ?? {})).toBe(false);
    expect(migrated?.npcMerchants[0].cargo.rice).toBe(1);
    expect(migrated?.npcMerchants[0].strategy).toBe("specialist");
    expect(migrated?.voyage?.elapsedMs).toBe(24_000);
    expect(migrated?.voyage?.progressUpdatedAt).toBe(25_000);
  });

  it("migrates version 13 saves without losing progress or voyage time", async () => {
    const sailing = startVoyage(
      { ...createNewGame("Isha"), gold: 70, highestGold: 90, selectedTown: "patna" },
      1000,
    );
    const voyage = sailing.voyage;
    expect(voyage).not.toBeNull();
    if (!voyage) return;
    const {
      travelEvent: _travelEvent,
      ...legacyVoyage
    } = voyage;
    const {
      missions: _missions,
      localStanding: _localStanding,
      voyagesStarted: _voyagesStarted,
      ...legacyState
    } = sailing;
    await writeLegacySave({
      ...legacyState,
      version: 13,
      voyage: legacyVoyage,
    });

    const migrated = await loadGame();
    expect(migrated?.version).toBe(18);
    expect(migrated?.gold).toBe(70);
    expect(migrated?.voyage?.elapsedMs).toBe(0);
    expect(migrated?.voyage?.travelEvent).toBeNull();
    expect(migrated?.missions).toHaveLength(60);
    expect(migrated?.missions.every((mission) => mission.status === "available"))
      .toBe(true);
    expect(migrated?.localStanding.dhaka).toBe(0);
    expect(migrated?.voyagesStarted).toBe(0);
  });

  it("persists reputation, milestone history, and completion after reload", async () => {
    const game: GameState = {
      ...createNewGame("Isha"),
      gold: 280,
      highestGold: 280,
      reputation: 3,
      visitedTowns: ["dhaka", "sonargaon", "patna"],
      profitableTradeMarks: ["dhaka:rice", "patna:silk"],
      completedMilestones: ["prosperous_merchant"],
    };

    await saveGame(game);
    await expect(loadGame()).resolves.toEqual(game);
  });

  it("persists warehouse ownership, stock, and purchase basis after reload", async () => {
    const purchased = buyWarehouse({
      ...createNewGame("Isha"),
      gold: 250,
      highestGold: 250,
    }).state;
    const carryingGoods = {
      ...purchased,
      cargo: { ...purchased.cargo, rice: 4 },
      averagePurchasePrice: { ...purchased.averagePurchasePrice, rice: 13 },
    };
    const stored = storeGoodInWarehouse(carryingGoods, "rice").state;

    await saveGame(stored);
    await expect(loadGame()).resolves.toEqual(stored);
  });

  it("persists residence ownership at the chosen port after reload", async () => {
    const purchased = buyResidence({
      ...createNewGame("Isha"),
      gold: RESIDENCE_PRICE + 40,
      highestGold: RESIDENCE_PRICE + 40,
    }).state;

    await saveGame(purchased);
    await expect(loadGame()).resolves.toEqual(purchased);
    expect((await loadGame())?.residenceTown).toBe("dhaka");
  });

  it("persists spouse status and future household placeholders after reload", async () => {
    const married = marryAtResidence({
      ...createNewGame("Isha"),
      residenceTown: "dhaka",
      gold: MARRIAGE_HOUSEHOLD_COST + 30,
      highestGold: MARRIAGE_HOUSEHOLD_COST + 30,
      sailingDay: 3,
    }).state;

    await saveGame(married);
    await expect(loadGame()).resolves.toEqual(married);
    const restored = await loadGame();
    expect(restored?.household.spouse?.status).toBe("married");
    expect(restored?.household.children).toEqual([]);
    expect(restored?.household.inheritance.designatedHeirId).toBeNull();
  });

  it("persists farm ownership, output, and production checkpoint after reload", async () => {
    const purchased = buyFarm({
      ...createNewGame("Isha"),
      gold: FARM_PRICE + 40,
      highestGold: FARM_PRICE + 40,
      sailingDay: 1.25,
    }).state;
    const producing = {
      ...purchased,
      farmOutput: { ...purchased.farmOutput, dhaka: 3 },
      farmProductionDay: { ...purchased.farmProductionDay, dhaka: 1 },
    };

    await saveGame(producing);
    await expect(loadGame()).resolves.toEqual(producing);
  });

  it("migrates version 10 saves and initializes farms and household without losing existing ownership", async () => {
    const game = {
      ...createNewGame("Asha"),
      gold: 320,
      highestGold: 350,
      ownedWarehouses: ["dhaka" as const],
      residenceTown: "patna" as const,
      reputation: 4,
    };
    const {
      ownedFarms: _ownedFarms,
      farmOutput: _farmOutput,
      farmProductionDay: _farmProductionDay,
      ...versionTenState
    } = game;
    await writeLegacySave({ ...versionTenState, version: 10 });

    const migrated = await loadGame();
    expect(migrated?.version).toBe(18);
    expect(migrated?.gold).toBe(320);
    expect(migrated?.ownedWarehouses).toEqual(["dhaka"]);
    expect(migrated?.residenceTown).toBe("patna");
    expect(migrated?.ownedFarms).toEqual([]);
    expect(migrated?.farmOutput.dhaka).toBe(0);
    expect(migrated?.farmProductionDay.dhaka).toBe(0);
    expect(migrated?.household.spouse).toBeNull();
    expect(migrated?.household.children).toEqual([]);
    expect(migrated?.household.inheritance.designatedHeirId).toBeNull();
  });

  it("migrates a Stage 9 version 11 save to an empty household", async () => {
    const game = {
      ...createNewGame("Asha"),
      gold: 215,
      highestGold: 300,
      ownedFarms: ["dhaka" as const],
      farmOutput: { ...createNewGame("Asha").farmOutput, dhaka: 4 },
      residenceTown: "dhaka" as const,
    };
    const { household: _household, ...versionElevenState } = game;
    await writeLegacySave({ ...versionElevenState, version: 11 });

    const migrated = await loadGame();
    expect(migrated?.version).toBe(18);
    expect(migrated?.gold).toBe(215);
    expect(migrated?.ownedFarms).toEqual(["dhaka"]);
    expect(migrated?.farmOutput.dhaka).toBe(4);
    expect(migrated?.residenceTown).toBe("dhaka");
    expect(migrated?.household).toEqual({
      spouse: null,
      children: [],
      inheritance: { designatedHeirId: null },
    });
  });

  it("persists shipyard upgrades, repaired hull, and paid costs after reload", async () => {
    const upgraded = buyUpgrade(
      { ...createNewGame("Isha"), gold: 200, highestGold: 200 },
      "hold",
    ).state;
    const repaired = repairShip({ ...upgraded, shipHull: 6 }).state;

    await saveGame(repaired);
    const restored = await loadGame();
    expect(restored).toEqual(repaired);
    expect(restored?.upgrades.hold).toBe(1);
    expect(restored?.shipHull).toBe(8);
    expect(restored?.gold).toBe(171);
  });

  it("persists market stock and its derived price after a trade and reload", async () => {
    const firstPurchase = buyGood(createNewGame("Isha"), "silk").state;
    const secondPurchase = buyGood(firstPurchase, "silk").state;
    const traded = sellGood(secondPurchase, "silk").state;
    const stock = traded.marketStock.dhaka.silk;
    const quote = getGoodPrice("dhaka", "silk", "buy", false, stock);

    await saveGame(traded);
    const restored = await loadGame();
    expect(restored).toEqual(traded);
    expect(restored?.cargo.silk).toBe(1);
    expect(restored?.averagePurchasePrice.silk).toBe(
      traded.averagePurchasePrice.silk,
    );
    expect(restored?.marketStock.dhaka.silk).toBe(stock);
    expect(
      getGoodPrice(
        "dhaka",
        "silk",
        "buy",
        false,
        restored?.marketStock.dhaka.silk,
      ),
    ).toBe(quote);
    if (!restored) return;
    expect(buyGood(restored, "silk").state.marketStock.dhaka.silk).toBe(
      stock - 1,
    );
  });

  it("persists market recovery applied on voyage arrival", async () => {
    const game = {
      ...createNewGame("Asha"),
      selectedTown: "sylhet" as const,
      sailingDay: 0.75,
      marketStock: {
        ...createNewGame("Asha").marketStock,
        dhaka: {
          ...createNewGame("Asha").marketStock.dhaka,
          rice: 10,
        },
      },
    };
    const durationDays = getRouteTravelTime(
      getTownRoute("dhaka", "sylhet")!,
    ).durationDays;
    const isolatedFromNpcTrades = {
      ...game,
      npcSimulationDay: Math.floor(game.sailingDay + durationDays),
    };
    const arrived = arriveAtDestination(startVoyage(isolatedFromNpcTrades, 1_000));
    expect(arrived.marketStock.dhaka.rice).toBeGreaterThan(10);

    await saveGame(arrived);
    vi.spyOn(Date, "now").mockReturnValue(86_400_000_000);
    await expect(loadGame()).resolves.toEqual(arrived);
  });

  it("migrates version 5 holdings with an estimated local cost basis", async () => {
    const game = createNewGame("Isha");
    const { averagePurchasePrice: _averagePurchasePrice, ...versionFiveState } =
      game;
    const marketStock = game.marketStock.patna;
    await writeLegacySave({
      ...versionFiveState,
      version: 5,
      currentTown: "patna",
      cargo: { ...game.cargo, rice: 4, salt: 0 },
      marketStock: game.marketStock,
    });

    const migrated = await loadGame();
    expect(migrated?.version).toBe(18);
    expect(migrated?.cargo.rice).toBe(4);
    expect(migrated?.averagePurchasePrice.rice).toBe(
      getGoodPrice("patna", "rice", "buy", false, marketStock.rice),
    );
    expect(migrated?.averagePurchasePrice.salt).toBe(0);
    expect(migrated?.marketStock).toEqual(game.marketStock);
  });

  it("migrates a version 6 save while preserving its checkpointed voyage and player state", async () => {
    const game = {
      ...createNewGame("Asha"),
      selectedTown: "sylhet" as const,
      sailingSpeed: 4 as const,
      gold: 147,
    };
    const startedAt = 1_000;
    const elapsedMs = 32_000;
    const checkpointed = checkpointVoyageProgress(
      startVoyage(game, startedAt),
      startedAt + elapsedMs / game.sailingSpeed,
    );
    const {
      chittagongIntroductionSeen: _chittagongIntroductionSeen,
      ...versionSixState
    } = checkpointed;
    await writeLegacySave({ ...versionSixState, version: 6 });

    const reopenedAt = 86_400_000_000;
    vi.spyOn(Date, "now").mockReturnValue(reopenedAt);
    const migrated = await loadGame();
    expect(migrated?.version).toBe(18);
    expect(migrated?.gold).toBe(147);
    expect(migrated?.cargo).toEqual(game.cargo);
    expect(migrated?.marketStock).toEqual(game.marketStock);
    expect(migrated?.chittagongIntroductionSeen).toBe(false);
    expect(migrated?.voyage?.elapsedMs).toBe(elapsedMs);
    expect(migrated?.voyage?.progressUpdatedAt).toBe(reopenedAt);
    expect(migrated?.voyage?.arrivalAt).toBe(
      reopenedAt +
        (migrated!.voyage!.durationMs - elapsedMs) / game.sailingSpeed,
    );
  });

  it("migrates a version 7 save without resetting progress and initializes progression history", async () => {
    const game = {
      ...createNewGame("Asha"),
      selectedTown: "sylhet" as const,
      gold: 275,
      shipHull: 6,
      upgrades: { cannon: 1, hull: 0, hold: 1 },
    };
    const checkpointed = checkpointVoyageProgress(
      startVoyage(game, 1_000),
      11_000,
    );
    const {
      highestGold: _highestGold,
      reputation: _reputation,
      visitedTowns: _visitedTowns,
      profitableTradeMarks: _profitableTradeMarks,
      completedMilestones: _completedMilestones,
      ...versionSevenState
    } = checkpointed;
    await writeLegacySave({ ...versionSevenState, version: 7 });

    const reopenedAt = 10_000_000;
    vi.spyOn(Date, "now").mockReturnValue(reopenedAt);
    const migrated = await loadGame();
    expect(migrated?.version).toBe(18);
    expect(migrated?.gold).toBe(275);
    expect(migrated?.shipHull).toBe(6);
    expect(migrated?.upgrades).toEqual({ cannon: 1, hull: 0, hold: 1 });
    expect(migrated?.voyage?.elapsedMs).toBe(checkpointed.voyage?.elapsedMs);
    expect(migrated?.voyage?.arrivalAt).toBe(
      reopenedAt +
        (checkpointed.voyage!.durationMs -
          checkpointed.voyage!.elapsedMs) /
          checkpointed.sailingSpeed,
    );
    expect(migrated?.reputation).toBe(0);
    expect(migrated?.visitedTowns).toEqual(["dhaka"]);
    expect(migrated?.profitableTradeMarks).toEqual([]);
    expect(migrated?.highestGold).toBe(275);
    expect(migrated?.completedMilestones).toContain("prosperous_merchant");
    expect(migrated?.ownedWarehouses).toEqual([]);
    expect(migrated?.warehouseStock.dhaka.rice).toBe(0);
  });

  it("migrates a version 8 progression save with empty warehouse inventory", async () => {
    const game = {
      ...createNewGame("Asha"),
      gold: 180,
      highestGold: 220,
      reputation: 4,
      visitedTowns: ["dhaka", "patna"],
      profitableTradeMarks: ["patna:silk"],
    };
    const {
      ownedWarehouses: _ownedWarehouses,
      warehouseStock: _warehouseStock,
      warehouseAveragePurchasePrice: _warehouseAveragePurchasePrice,
      ...versionEightState
    } = game;
    await writeLegacySave({ ...versionEightState, version: 8 });

    const migrated = await loadGame();
    expect(migrated?.version).toBe(18);
    expect(migrated?.gold).toBe(180);
    expect(migrated?.reputation).toBe(4);
    expect(migrated?.visitedTowns).toEqual(["dhaka", "patna"]);
    expect(migrated?.profitableTradeMarks).toEqual(["patna:silk"]);
    expect(migrated?.ownedWarehouses).toEqual([]);
    expect(migrated?.warehouseStock.patna.silk).toBe(0);
    expect(migrated?.warehouseAveragePurchasePrice.patna.silk).toBe(0);
  });

  it("persists the one-time Chittagong introduction flag across save reloads", async () => {
    const firstArrival = arriveAtDestination(
      startVoyage(
        { ...createNewGame("Asha"), selectedTown: "chittagong" },
        1_000,
      ),
    );
    await saveGame(firstArrival);
    const reopened = await loadGame();
    expect(reopened?.encounterPending).toBe(true);
    expect(reopened?.chittagongIntroductionSeen).toBe(true);
    if (!reopened) return;

    const resolved = resolveRiverEncounter(reopened).state;
    await saveGame(resolved);
    const afterEncounter = await loadGame();
    expect(afterEncounter?.encounterPending).toBe(false);
    expect(afterEncounter?.chittagongIntroductionSeen).toBe(true);
    if (!afterEncounter) return;

    const away = arriveAtDestination(
      startVoyage(
        { ...afterEncounter, selectedTown: "dhaka" },
        2_000,
      ),
    );
    const returnArrival = arriveAtDestination(
      startVoyage(
        { ...away, selectedTown: "chittagong" },
        3_000,
      ),
    );
    expect(returnArrival.encounterPending).toBe(false);
  });

  it("migrates a pending version 6 Chittagong encounter as already introduced", async () => {
    const {
      chittagongIntroductionSeen: _chittagongIntroductionSeen,
      ...legacyState
    } = createNewGame("Asha");
    await writeLegacySave({
      ...legacyState,
      version: 6,
      currentTown: "chittagong",
      selectedTown: "chittagong",
      encounterPending: true,
    });

    const migrated = await loadGame();
    expect(migrated?.version).toBe(18);
    expect(migrated?.encounterPending).toBe(true);
    expect(migrated?.chittagongIntroductionSeen).toBe(true);
  });

  it("reopens a saved voyage without advancing it while the game was closed", async () => {
    const game = {
      ...createNewGame("Asha"),
      selectedTown: "sylhet" as const,
      sailingSpeed: 2 as const,
    };
    const route = getTownRoute(game.currentTown, game.selectedTown);
    expect(route).not.toBeNull();
    if (!route) return;
    const timing = getRouteTravelTime(route);
    const startedAt = 1_000;
    const voyage = checkpointVoyageProgress(
      startVoyage(game, startedAt),
      startedAt + timing.durationMs * 0.4 / game.sailingSpeed,
    );
    const elapsedAtSave = voyage.voyage?.elapsedMs;

    await saveGame(voyage);
    const reopenedAt = 1_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(reopenedAt);
    const restored = await loadGame();
    expect(restored?.version).toBe(18);
    expect(restored?.voyage).not.toBeNull();
    if (!restored?.voyage) return;
    expect(restored.voyage.elapsedMs).toBe(elapsedAtSave);
    expect(restored.voyage.progressUpdatedAt).toBe(reopenedAt);
    expect(restored.voyage.arrivalAt).toBe(
      reopenedAt +
        (timing.durationMs - elapsedAtSave!) / restored.sailingSpeed,
    );

    const progress = restored.voyage.elapsedMs / restored.voyage.durationMs;
    expect(progress).toBeCloseTo(0.4, 3);
    expect(pointAlongRiverRoute(restored.voyage.route, progress)).toEqual(
      pointAlongRiverRoute(route, progress),
    );
  });

  it("migrates version 17 fleets without changing ships or active voyage progress", async () => {
    const purchased = buyPlayerShip({
      ...createNewGame("Asha"),
      gold: 2_000,
      highestGold: 2_000,
      visitedTowns: ["dhaka", "sonargaon"],
    }).state;
    const underway = startVoyage(
      { ...purchased, selectedTown: "sylhet" },
      1_000,
    );
    const elapsed = checkpointVoyageProgress(underway, 1_000 + 30_000);
    const legacyFleet = elapsed.fleet.map(
      ({ automatedRoute: _automatedRoute, automationLog: _automationLog, ...ship }) =>
        ship,
    );
    await writeLegacySave({
      ...elapsed,
      version: 17,
      fleet: legacyFleet,
    });

    const restored = await loadGame();
    expect(restored?.version).toBe(18);
    expect(restored?.gold).toBe(purchased.gold);
    expect(restored?.fleet).toHaveLength(2);
    expect(restored?.fleet.map((ship) => ship.currentPort)).toEqual(
      elapsed.fleet.map((ship) => ship.currentPort),
    );
    expect(restored?.fleet.every((ship) => ship.automatedRoute === null)).toBe(true);
    expect(restored?.fleet.every((ship) => ship.automationLog.length === 0)).toBe(true);
    expect(restored?.voyage?.elapsedMs).toBe(elapsed.voyage?.elapsedMs);
    expect(restored?.voyage?.shipId).toBe(restored?.selectedShipId);
  });

  it("saves and reloads an automated ship mid-route without offline progress", async () => {
    const purchased = buyPlayerShip({
      ...createNewGame("Asha"),
      gold: 2_000,
      highestGold: 2_000,
      visitedTowns: ["dhaka", "sonargaon"],
    }).state;
    const configured = configureAutomatedTradeRoute(
      purchased,
      purchased.fleet[1].id,
      "sonargaon",
      [{ good: "lac", buyAtOrigin: true, sellAtDestination: true }],
      300,
    ).state;
    const traveling = advanceNpcWorld({ ...configured, sailingDay: 1 }, 1);
    const savedShip = traveling.fleet[1];
    expect(savedShip.automatedRoute?.phase).toBe("traveling");
    await saveGame(traveling);

    vi.spyOn(Date, "now").mockReturnValue(9_000_000_000);
    const restored = await loadGame();
    expect(restored?.version).toBe(18);
    expect(restored?.npcSimulationDay).toBe(traveling.npcSimulationDay);
    expect(restored?.fleet[1]).toEqual(savedShip);
    expect(restored?.marketStock).toEqual(traveling.marketStock);
  });

  it("does not produce farm goods from wall-clock time while the game is closed", async () => {
    const purchased = buyFarm({
      ...createNewGame("Asha"),
      gold: FARM_PRICE,
      highestGold: FARM_PRICE,
      selectedTown: "sylhet",
    }).state;
    const route = getTownRoute("dhaka", "sylhet");
    expect(route).not.toBeNull();
    if (!route) return;
    const started = checkpointVoyageProgress(
      startVoyage({
        ...purchased,
        farmOutput: { ...purchased.farmOutput, dhaka: 2 },
        farmProductionDay: { ...purchased.farmProductionDay, dhaka: 0 },
      }, 1_000),
      11_000,
    );
    const sailingDayAtSave = started.sailingDay;
    await saveGame(started);

    vi.spyOn(Date, "now").mockReturnValue(86_400_000_000);
    const reopened = await loadGame();
    expect(reopened?.farmOutput.dhaka).toBe(2);
    expect(reopened?.farmProductionDay.dhaka).toBe(0);
    expect(reopened?.sailingDay).toBe(sailingDayAtSave);
  });

  it.each(SAILING_SPEEDS)(
    "restores a voyage and its selected %s× speed",
    async (speed) => {
      const game = {
        ...createNewGame("Asha"),
        selectedTown: "sylhet" as const,
        sailingSpeed: speed,
      };
      const route = getTownRoute(game.currentTown, game.selectedTown);
      expect(route).not.toBeNull();
      if (!route) return;

      const timing = getRouteTravelTime(route);
      const startedAt = 1_000;
      const voyage = checkpointVoyageProgress(
        startVoyage(game, startedAt),
        startedAt + timing.durationMs * 0.4 / speed,
      );
      await saveGame(voyage);

      const reopenedAt = 1_000_000_000;
      vi.spyOn(Date, "now").mockReturnValue(reopenedAt);
      const restored = await loadGame();
      expect(restored?.sailingSpeed).toBe(speed);
      expect(restored?.voyage).not.toBeNull();
      if (!restored?.voyage) return;
      expect(
        getVoyageProgressMs(
          restored.voyage,
          restored.sailingSpeed,
          reopenedAt,
        ) / timing.durationMs,
      ).toBeCloseTo(0.4, 3);
    },
  );

  it("migrates a Stage 1 save to the market-stock schema", async () => {
    const { marketStock, ...stageOneState } = createNewGame("Noor");
    expect(marketStock.dhaka.rice).toBe(20);
    const legacySave = { ...stageOneState, version: 1 };
    await writeLegacySave(legacySave);

    const restored = await loadGame();
    expect(restored?.version).toBe(18);
    expect(restored?.marketStock.dhaka.rice).toBe(20);
    expect(restored?.captainName).toBe("Noor");
    expect(restored?.averagePurchasePrice.rice).toBeGreaterThan(0);
  });

  it("migrates a legacy version 2 journey without counting closed-app time", async () => {
    const now = Date.now();
    const route = planRiverRoute("dhaka", "sylhet");
    expect(route).not.toBeNull();
    if (!route) return;

    const oldDurationMs = 10_000;
    const legacyVoyage = {
      origin: "dhaka" as const,
      destination: "sylhet" as const,
      startedAt: now - oldDurationMs / 2,
      arrivalAt: now + oldDurationMs / 2,
      durationDays: 2,
      routeAlert: false,
      route,
    };
    await writeLegacySave({
      ...createNewGame("Asha"),
      version: 2,
      currentTown: "dhaka",
      selectedTown: "sylhet",
      voyage: legacyVoyage,
    });

    const restored = await loadGame();
    expect(restored?.version).toBe(18);
    expect(restored?.voyage).not.toBeNull();
    const restoredVoyage = restored?.voyage;
    if (!restoredVoyage) return;
    const expected = getRouteTravelTime(route);
    expect(restoredVoyage.arrivalAt - restoredVoyage.startedAt).toBeCloseTo(
      expected.durationMs,
      3,
    );
    expect(restoredVoyage.durationDays).toBe(expected.durationDays);
    expect(restoredVoyage.elapsedMs).toBe(0);
    expect(restoredVoyage.progressUpdatedAt).toBeGreaterThanOrEqual(now);
    const ship = pointAlongRiverRoute(restoredVoyage.route, 0);
    expect(ship).toEqual(
      pointAlongRiverRoute(route, 0),
    );
  });

  it("migrates a saved voyage from the previous map geometry without losing progress", async () => {
    const now = Date.now();
    const points = [
      { x: 334, y: 275 },
      { x: 352, y: 258 },
      { x: 347, y: 238 },
      { x: 322, y: 221 },
      { x: 352, y: 199 },
      { x: 407, y: 166 },
      { x: 465, y: 132 },
    ];
    const distance = points.slice(1).reduce(
      (total, point, index) =>
        total +
        Math.hypot(
          point.x - points[index].x,
          point.y - points[index].y,
        ),
      0,
    );
    const durationMs = 240_000;
    const elapsedMs = 60_000;
    const legacyRoute = {
      origin: "dhaka" as const,
      destination: "sylhet" as const,
      edgeIds: ["upper-river", "sylhet-branch"],
      points,
      distance,
    };
    const {
      chittagongIntroductionSeen: _chittagongIntroductionSeen,
      ...versionSixState
    } = createNewGame("Asha");
    const game = {
      ...versionSixState,
      version: 6 as const,
      selectedTown: "sylhet" as const,
      sailingSpeed: 2 as const,
      voyage: {
        origin: "dhaka" as const,
        destination: "sylhet" as const,
        startedAt: now - elapsedMs / 2,
        arrivalAt: now + (durationMs - elapsedMs) / 2,
        durationMs,
        elapsedMs,
        progressUpdatedAt: now,
        durationDays: 4,
        routeAlert: false,
        route: legacyRoute,
      },
    };
    await writeLegacySave(game);

    const restored = await loadGame();
    const restoredVoyage = restored?.voyage;
    expect(restoredVoyage).not.toBeNull();
    if (!restoredVoyage) return;

    const newRoute = planRiverRoute("dhaka", "sylhet");
    expect(restoredVoyage.route).toEqual(newRoute);
    expect(restored?.version).toBe(18);
    expect(restoredVoyage.elapsedMs / restoredVoyage.durationMs).toBeCloseTo(
      elapsedMs / durationMs,
      6,
    );
    expect(restored?.sailingSpeed).toBe(2);
    expect(restoredVoyage.arrivalAt).toBeCloseTo(
      restoredVoyage.progressUpdatedAt +
        (restoredVoyage.durationMs - restoredVoyage.elapsedMs) / 2,
      3,
    );
  });

  it("migrates a legacy version 3 journey without counting closed-app time", async () => {
    const now = Date.now();
    const route = planRiverRoute("dhaka", "sylhet");
    expect(route).not.toBeNull();
    if (!route) return;

    const timing = getRouteTravelTime(route);
    const { sailingSpeed: _sailingSpeed, ...currentState } =
      createNewGame("Asha");
    await writeLegacySave({
      ...currentState,
      version: 3,
      currentTown: "dhaka",
      selectedTown: "sylhet",
      voyage: {
        origin: "dhaka",
        destination: "sylhet",
        startedAt: now - timing.durationMs * 0.4,
        arrivalAt: now + timing.durationMs * 0.6,
        durationDays: timing.durationDays,
        routeAlert: false,
        route,
      },
    });

    const restored = await loadGame();
    expect(restored?.version).toBe(18);
    expect(restored?.sailingSpeed).toBe(1);
    expect(restored?.voyage?.elapsedMs).toBe(0);
    const migratedVoyage = restored?.voyage;
    expect(migratedVoyage).not.toBeNull();
    if (!migratedVoyage) return;
    expect(migratedVoyage.arrivalAt).toBeCloseTo(
      migratedVoyage.progressUpdatedAt +
        timing.durationMs -
        migratedVoyage.elapsedMs,
      6,
    );
  });

  it("migrates version 4 market holdings without resetting them and persists the new state", async () => {
    const game = createNewGame("Asha");
    const legacyMarketStock = Object.fromEntries(
      TOWNS.map((town) => [
        town.id,
        { rice: 20, muslin: 20, salt: town.id === "dhaka" ? 7 : 20 },
      ]),
    );
    const legacySave = {
      ...game,
      version: 4,
      cargo: { rice: 4, muslin: 2, salt: 3 },
      marketStock: legacyMarketStock,
    };
    await writeLegacySave(legacySave);

    const migrated = await loadGame();
    expect(migrated?.version).toBe(18);
    expect(migrated?.cargo.rice).toBe(4);
    expect(migrated?.cargo.muslin).toBe(2);
    expect(migrated?.cargo.salt).toBe(3);
    expect(migrated?.cargo.silk).toBe(0);
    expect(migrated?.averagePurchasePrice.rice).toBeGreaterThan(0);
    expect(migrated?.averagePurchasePrice.silk).toBe(0);
    expect(migrated?.marketStock.dhaka.salt).toBe(7);
    expect(migrated?.marketStock.dhaka.silk).toBe(
      createNewGame("Asha").marketStock.dhaka.silk,
    );
    expect(migrated?.marketStock.patna.saltpetre).toBe(
      createNewGame("Asha").marketStock.patna.saltpetre,
    );

    if (!migrated) return;
    await saveGame(migrated);
    await expect(loadGame()).resolves.toEqual(migrated);
  });
});
