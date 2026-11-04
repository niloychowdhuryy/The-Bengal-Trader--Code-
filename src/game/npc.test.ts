import { beforeEach, describe, expect, it } from "vitest";
import {
  GOODS,
  MARKET_MAX_STOCK,
  MARKET_PORTS,
  TOWNS,
  VESSEL_CLASSES,
  advanceWorld,
  createNewGame,
  getMerchantProfile,
  getMerchantRoute,
  getShipRouteDays,
  isLaidUp,
  tradeWithNpcMerchant,
  type GameState,
  type NpcMerchant,
} from "./model";
import { LEGACY_MERCHANT_IDS, MERCHANT_ROSTER } from "./npc-roster";
import { isValidGameState, validateSave } from "./save-format";
import { listSaveBackups, openGameSession, readSaveBackup } from "./storage";
import { measureNpcWorld } from "../sim/experiments";

const T0 = 1_800_300_000_000;

function runDays(start: GameState, days: number): GameState {
  let state = start;
  for (let day = start.worldDay + 1; day <= start.worldDay + days; day += 1) {
    state = advanceWorld({ ...state, sailingDay: day }, day);
  }
  return state;
}

function units(merchant: NpcMerchant): number {
  return GOODS.reduce((total, good) => total + merchant.cargo[good.id], 0);
}

describe("the roster", () => {
  it("has 26 distinct merchants, keeping the original four", () => {
    expect(MERCHANT_ROSTER).toHaveLength(26);
    expect(new Set(MERCHANT_ROSTER.map((merchant) => merchant.id)).size).toBe(26);
    expect(new Set(MERCHANT_ROSTER.map((merchant) => merchant.name)).size).toBe(26);
    expect(new Set(MERCHANT_ROSTER.map((merchant) => merchant.description)).size).toBe(26);
    for (const id of LEGACY_MERCHANT_IDS) expect(getMerchantProfile(id)).toBeDefined();
  });

  it("gives every port a resident, and every home a ship that can reach it", () => {
    const homes = new Set(MERCHANT_ROSTER.map((merchant) => merchant.homePort));
    for (const town of TOWNS) expect(homes, town.id).toContain(town.id);
    for (const merchant of MERCHANT_ROSTER) {
      expect(VESSEL_CLASSES[merchant.vesselClass].barredPorts, merchant.id).not.toContain(merchant.homePort);
      for (const port of merchant.preferredPorts) expect(TOWNS.map((town) => town.id)).toContain(port);
    }
  });

  it("mixes wealth, ships, strategies and temperaments", () => {
    const coins = MERCHANT_ROSTER.map((merchant) => merchant.startingCoins);
    expect(Math.max(...coins) / Math.min(...coins)).toBeGreaterThan(10);
    for (const field of ["vesselClass", "strategy", "temperament"] as const) {
      expect(new Set(MERCHANT_ROSTER.map((merchant) => merchant[field])).size).toBe(3);
    }
    expect(new Set(MERCHANT_ROSTER.map((merchant) => merchant.ambitious)).size).toBe(2);
  });

  it("starts a new game valid, with every merchant at home and funded by the roster", () => {
    const game = createNewGame("Maya");
    expect(isValidGameState(game)).toBe(true);
    for (const merchant of game.npcMerchants) {
      const profile = getMerchantProfile(merchant.id)!;
      expect(merchant.currentPort).toBe(profile.homePort);
      expect(merchant.budget).toBe(profile.startingCoins);
      expect(merchant.cargoCapacity).toBe(VESSEL_CLASSES[profile.vesselClass].baseHold);
    }
  });
});

describe("the merchants' economy, over 200 days on several seeds", () => {
  const worlds = [1, 2, 3].map((seed) => measureNpcWorld(seed));

  it("creates no goods and no money", () => {
    for (const world of worlds) {
      expect(world.goodsUnaccounted).toBe(0);
      expect(world.purseGrewWithoutSale).toBe(0);
    }
  });

  it("obeys vessel limits and never moves a ship without a journey", () => {
    for (const world of worlds) expect(world.restrictionBreaks).toBe(0);
  });

  it("keeps every merchant trading, with no permanent stalls", () => {
    for (const world of worlds) {
      expect(world.stalledAtEnd).toBeLessThanOrEqual(2);
      expect(world.laidUpAtEnd).toBeLessThanOrEqual(3);
      for (const merchant of world.merchants) expect(merchant.trips, merchant.name).toBeGreaterThan(5);
    }
  });

  it("makes personalities behave differently", () => {
    const of = (temperament: string) =>
      worlds[0].merchants.filter((merchant) => merchant.temperament === temperament);
    const mean = (list: typeof worlds[0]["merchants"], pick: (m: (typeof list)[0]) => number) =>
      list.reduce((total, merchant) => total + pick(merchant), 0) / list.length;
    const cautious = of("cautious");
    const bold = of("bold");
    expect(mean(bold, (merchant) => merchant.unitsSold)).toBeGreaterThan(mean(cautious, (merchant) => merchant.unitsSold));
    expect(mean(bold, (merchant) => merchant.averageTripDays)).toBeGreaterThan(mean(cautious, (merchant) => merchant.averageTripDays));
    expect(mean(cautious, (merchant) => merchant.profitPerUnit)).toBeGreaterThan(mean(bold, (merchant) => merchant.profitPerUnit));
  });

  it("lets merchants grow and fall without one taking everything", () => {
    for (const world of worlds) {
      expect(world.topThreeShareAt[200]).toBeLessThan(0.45);
      expect(world.giniAt[200]).toBeLessThan(0.5);
      const growth = world.merchants.map((merchant) => merchant.worthAt[200] / merchant.startWorth);
      expect(Math.max(...growth)).toBeLessThan(10);
      expect(new Set(growth.map((value) => Math.round(value * 10))).size).toBeGreaterThan(4);
    }
  });

  it("moves prices without leaving stalls empty or the market wild", () => {
    for (const world of worlds) {
      for (const day of [30, 90, 200]) {
        const market = world.marketAt[day];
        expect(market.stallsMoved).toBeGreaterThan(0);
        expect(market.stallsNearEmpty).toBeLessThanOrEqual(6);
        expect(market.stallsNearFull).toBeLessThanOrEqual(6);
        expect(market.priceIndex).toBeGreaterThan(0.9);
        expect(market.priceIndex).toBeLessThan(1.15);
      }
    }
  });
});

describe("loading and investment, over 200 days", () => {
  const worlds = [1, 2, 3, 4, 5].map((seed) => measureNpcWorld(seed));
  const load = (world: (typeof worlds)[0], vessel: string) =>
    world.loads.find((entry) => entry.vessel === vessel)!;

  it("gives larger ships larger loads", () => {
    for (const world of worlds) {
      expect(load(world, "patello").unitsPerLoadedVoyage).toBeGreaterThan(load(world, "bora").unitsPerLoadedVoyage * 1.4);
      expect(load(world, "river-boat").unitsPerLoadedVoyage).toBeGreaterThan(load(world, "bora").unitsPerLoadedVoyage);
    }
  });

  it("doesn't fill holds for the sake of it", () => {
    for (const world of worlds) {
      for (const entry of world.loads) {
        expect(entry.loadedHoldUse, entry.vessel).toBeLessThan(0.9);
        expect(entry.loadedHoldUse, entry.vessel).toBeGreaterThan(0.2);
      }
    }
  });

  it("leaves stalls well stocked", () => {
    for (const world of worlds) {
      expect(world.lowestStock).toBeGreaterThanOrEqual(18);
      expect(world.stallDaysAtReserve).toBe(0);
    }
  });

  it("sees merchants buy bigger ships, without any one world running away", () => {
    const purchases = worlds.reduce((total, world) => total + world.shipPurchases.length, 0);
    expect(purchases).toBeGreaterThanOrEqual(worlds.length);
    for (const world of worlds) {
      expect(world.shipPurchases.length).toBeLessThanOrEqual(10);
      expect(world.topThreeShareAt[200]).toBeLessThan(0.4);
      const small = world.tiers.find((tier) => tier.tier === "Small")!;
      expect(small.medianGrowth).toBeGreaterThan(1);
      expect(small.lowestGrowth).toBeGreaterThan(0.5);
    }
  });

  it("never buys a Patello for a merchant whose waters it can't reach", () => {
    for (const world of worlds) {
      for (const purchase of world.shipPurchases) {
        expect(purchase).not.toMatch(/^(Yusuf Ali|Haridas Kundu): river-boat to patello/);
      }
    }
  });
});

describe("a merchant's investment", () => {
  function atYard(changes: Partial<NpcMerchant>, id = "karim-sheikh"): GameState {
    const game = createNewGame("Maya", 4);
    return {
      ...game,
      worldDay: 49,
      sailingDay: 49,
      npcMerchants: game.npcMerchants.map((merchant) =>
        merchant.id === id
          ? {
              ...merchant,
              currentPort: "hooghly" as const,
              destinationPort: "hooghly" as const,
              tripsCompleted: 25,
              unitsSold: 150,
              realizedProfit: 60_000,
              ...changes,
            }
          : merchant,
      ),
    };
  }
  const after = (state: GameState, id = "karim-sheikh") =>
    advanceWorld(state, 50).npcMerchants.find((merchant) => merchant.id === id)!;

  it("buys a bigger ship when trade justifies it, at real cost, keeping a reserve", () => {
    const before = atYard({ budget: 60_000 });
    const merchant = after(before);
    expect(merchant.vesselClass).toBe("river-boat");
    // Twelve for the ship, and six for the bigger hold it also fitted that day.
    expect(merchant.cargoCapacity).toBe(18);
    expect(merchant.budget).toBeGreaterThan(5_000);
    expect(merchant.budget).toBeLessThan(60_000 - 14_000);
  });

  it("won't buy one that would leave too little to trade with", () => {
    expect(after(atYard({ budget: 16_000 })).vesselClass).toBe("bora");
  });

  it("won't buy one without a record of profitable trade", () => {
    expect(after(atYard({ budget: 400_000, tripsCompleted: 2 })).vesselClass).toBe("bora");
    expect(after(atYard({ budget: 400_000, realizedProfit: -500 })).vesselClass).toBe("bora");
  });

  it("only buys at a shipyard", () => {
    const elsewhere = atYard({ budget: 400_000, currentPort: "satgaon", destinationPort: "satgaon" });
    expect(after(elsewhere).vesselClass).toBe("bora");
  });

  it("won't buy a ship that can't reach its home waters", () => {
    const state = atYard(
      { budget: 900_000, vesselClass: "river-boat", cargoCapacity: 12 },
      "yusuf-ali",
    );
    expect(after(state, "yusuf-ali").vesselClass).toBe("river-boat");
  });

  it("asks more of a merchant who isn't ambitious", () => {
    const state = atYard({ budget: 21_000 }, "salim-mia");
    expect(after(state, "salim-mia").vesselClass).toBe("bora");
  });
});

describe("a merchant's day", () => {
  it("gives the same world for the same seed, and another for a different one", () => {
    const game = createNewGame("Maya", 5);
    const once = runDays(game, 30);
    expect(runDays(structuredClone(game), 30)).toEqual(once);
    expect(runDays(createNewGame("Maya", 6), 30).marketStock).not.toEqual(once.marketStock);
  });

  it("gives the same result however the days are asked for", () => {
    const game = createNewGame("Maya", 5);
    const inOneGo = advanceWorld(game, 20);
    expect(inOneGo.npcMerchants).toEqual(runDays(game, 20).npcMerchants);
    expect(inOneGo.marketStock).toEqual(runDays(game, 20).marketStock);
  });

  it("travels for exactly the days its ship's route takes, then arrives", () => {
    let state = createNewGame("Maya", 7);
    const started = new Map<string, NpcMerchant>();
    for (let day = 1; day <= 60; day += 1) {
      const next = advanceWorld({ ...state, sailingDay: day }, day);
      for (const merchant of next.npcMerchants) {
        const before = state.npcMerchants.find((entry) => entry.id === merchant.id)!;
        if (before.phase === "docked" && merchant.phase === "traveling") {
          const route = getMerchantRoute(merchant.currentPort, merchant.destinationPort, merchant.vesselClass)!;
          expect(merchant.travelDaysTotal).toBe(getShipRouteDays(route, merchant.vesselClass));
          started.set(merchant.id, merchant);
        }
        if (before.phase === "traveling" && merchant.phase === "traveling") {
          expect(merchant.travelDaysRemaining).toBe(before.travelDaysRemaining - 1);
          expect(merchant.currentPort).toBe(before.currentPort);
        }
        if (before.phase === "traveling" && merchant.phase === "docked") {
          expect(before.travelDaysRemaining).toBe(1);
          expect(merchant.currentPort).toBe(before.destinationPort);
        }
      }
      state = next;
    }
    expect(started.size).toBe(26);
  });

  it("never sends a Patello to a port it's barred from", () => {
    let state = createNewGame("Maya", 3);
    for (let day = 1; day <= 200; day += 1) {
      state = advanceWorld({ ...state, sailingDay: day }, day);
      for (const merchant of state.npcMerchants) {
        const barred = VESSEL_CLASSES[merchant.vesselClass].barredPorts;
        expect(barred).not.toContain(merchant.currentPort);
        expect(barred).not.toContain(merchant.destinationPort);
      }
    }
  });

  it("stays valid as a save throughout", () => {
    let state = createNewGame("Maya", 11);
    for (const stretch of [1, 9, 20, 60, 110]) {
      state = runDays(state, stretch);
      expect(isValidGameState({ ...state })).toBe(true);
      expect(state.npcActivity.length).toBeLessThanOrEqual(60);
    }
  });

  it("keeps some stock for the town, so a rival can't leave nothing to buy", () => {
    let state = createNewGame("Maya", 2);
    for (let day = 1; day <= 200; day += 1) {
      state = advanceWorld({ ...state, sailingDay: day }, day);
      for (const port of MARKET_PORTS) {
        for (const good of GOODS) {
          expect(state.marketStock[port.id][good.id]).toBeGreaterThan(0);
          expect(state.marketStock[port.id][good.id]).toBeLessThanOrEqual(MARKET_MAX_STOCK);
        }
      }
    }
  });

  it("doesn't pay a merchant with nothing to anybody's benefit: the broke stay broke", () => {
    const game = createNewGame("Maya", 4);
    const broke = {
      ...game,
      npcMerchants: game.npcMerchants.map((merchant) =>
        merchant.id === "sona-das" ? { ...merchant, budget: 10 } : merchant,
      ),
    };
    const later = runDays(broke, 120).npcMerchants.find((merchant) => merchant.id === "sona-das")!;
    expect(later.budget).toBe(10);
    expect(later.phase).toBe("docked");
    expect(later.currentPort).toBe(later.homePort);
    expect(units(later)).toBe(0);
    expect(isLaidUp(later)).toBe(true);
  });

  it("lets a poor merchant with cargo sell at a loss rather than stay stuck", () => {
    const game = createNewGame("Maya", 4);
    const costly = {
      ...game,
      npcMerchants: game.npcMerchants.map((merchant) =>
        merchant.id === "tara-devi"
          ? {
              ...merchant,
              budget: 5,
              cargo: { ...merchant.cargo, silk: 3 },
              cargoCost: { ...merchant.cargoCost, silk: 100_000 },
            }
          : merchant,
      ),
    };
    const later = runDays(costly, 3).npcMerchants.find((merchant) => merchant.id === "tara-devi")!;
    expect(later.cargo.silk).toBe(0);
    expect(later.budget).toBeGreaterThan(5);
    expect(later.realizedProfit).toBeLessThan(0);
  });

  it("has no purse limit: a sale to the player is kept in full", () => {
    const game = { ...createNewGame("Maya", 4), coins: 900_000, highestCoins: 900_000 };
    const rich = game.npcMerchants.map((merchant) =>
      merchant.id === "abdul-rahman"
        ? { ...merchant, budget: 2_000_000, cargo: { ...merchant.cargo, silk: 1 }, cargoCost: { ...merchant.cargoCost, silk: 100 } }
        : merchant,
    );
    const traded = tradeWithNpcMerchant({ ...game, npcMerchants: rich }, "abdul-rahman", "silk");
    expect(traded.error).toBeUndefined();
    const merchant = traded.state.npcMerchants.find((entry) => entry.id === "abdul-rahman")!;
    expect(merchant.budget).toBeGreaterThan(2_000_000);
  });

  it("doesn't touch the player's money, cargo or ships", () => {
    const game = createNewGame("Maya", 9);
    const later = runDays(game, 40);
    expect(later.coins).toBe(game.coins);
    expect(later.cargo).toEqual(game.cargo);
    expect(later.fleet).toEqual(game.fleet);
  });
});

describe("moving a version 22 save to the living merchants", () => {
  function version22(): Record<string, unknown> {
    const fresh = createNewGame("Maya");
    const { worldSeed: _seed, ...rest } = fresh;
    const empty = fresh.npcMerchants[0].cargo;
    return {
      ...rest,
      version: 22,
      coins: 73_450,
      highestCoins: 90_000,
      worldDay: 40,
      sailingDay: 40.5,
      npcActivity: [
        { id: "a", merchantId: "govinda-das", town: "patna", sailingDay: 39, message: "arrived" },
      ],
      npcMerchants: [
        {
          id: "abdul-rahman", name: "Abdul Rahman", homePort: "dhaka", strategy: "specialist",
          currentPort: "hooghly", destinationPort: "patna", phase: "traveling",
          cargo: { ...empty, rice: 3 }, cargoCost: { ...empty, rice: 410 }, cargoCapacity: 3, budget: 7_000,
          preferences: ["rice", "salt", "muslin"], preferredPorts: ["patna", "sonargaon", "hooghly"],
          travelDaysRemaining: 1, travelDaysTotal: 2,
        },
        {
          id: "mariam-banu", name: "Mariam Banu", homePort: "sonargaon", strategy: "arbitrage",
          currentPort: "satgaon", destinationPort: "satgaon", phase: "docked",
          cargo: empty, cargoCost: empty, cargoCapacity: 3, budget: 9_000,
          preferences: ["muslin", "silk", "sugar", "lac", "salt"], preferredPorts: [],
          travelDaysRemaining: 0, travelDaysTotal: 0,
        },
        {
          id: "govinda-das", name: "Govinda Das", homePort: "kasimbazar", strategy: "specialist",
          currentPort: "patna", destinationPort: "patna", phase: "docked",
          cargo: empty, cargoCost: empty, cargoCapacity: 3, budget: 40_000,
          preferences: ["silk", "saltpetre", "lac"], preferredPorts: ["patna", "hooghly", "rajmahal"],
          travelDaysRemaining: 0, travelDaysTotal: 0,
        },
        {
          id: "fatima-khatun", name: "Fatima Khatun", homePort: "patna", strategy: "regional",
          currentPort: "tanda", destinationPort: "tanda", phase: "docked",
          cargo: empty, cargoCost: empty, cargoCapacity: 3, budget: 850,
          preferences: ["saltpetre", "opium", "silk"], preferredPorts: ["rajmahal", "tanda", "malda", "kasimbazar"],
          travelDaysRemaining: 0, travelDaysTotal: 0,
        },
      ],
    };
  }

  beforeEach(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("bengal-trader");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
  );

  it("adds 22 merchants, and leaves the player's game alone", () => {
    const old = version22();
    const game = validateSave(old, T0);
    expect(game.version).toBe(28);
    expect(game.npcMerchants).toHaveLength(26);
    expect(isValidGameState(game)).toBe(true);
    expect(game.coins).toBe(73_450);
    expect(game.highestCoins).toBe(90_000);
    expect(game.worldDay).toBe(40);
    expect(game.marketStock).toEqual(old.marketStock);
    expect(game.fleet).toEqual(old.fleet);
    expect(game.missions).toEqual(old.missions);
    expect(game.npcActivity).toEqual(old.npcActivity);
  });

  it("keeps the original four where they are, with their cargo", () => {
    const game = validateSave(version22(), T0);
    const abdul = game.npcMerchants.find((merchant) => merchant.id === "abdul-rahman")!;
    expect(abdul.phase).toBe("traveling");
    expect(abdul.currentPort).toBe("hooghly");
    expect(abdul.destinationPort).toBe("patna");
    expect(abdul.cargo.rice).toBe(3);
    expect(abdul.cargoCost.rice).toBe(410);
    expect(abdul.cargoCapacity).toBe(12);
    expect(abdul.travelDaysRemaining).toBeLessThanOrEqual(abdul.travelDaysTotal);
    expect(game.npcMerchants.find((merchant) => merchant.id === "mariam-banu")!.currentPort).toBe("satgaon");
  });

  it("restores purses the old cap cut short, once, and never lowers one", () => {
    const game = validateSave(version22(), T0);
    const budget = (id: string) => game.npcMerchants.find((merchant) => merchant.id === id)!.budget;
    expect(budget("fatima-khatun")).toBe(getMerchantProfile("fatima-khatun")!.startingCoins);
    expect(budget("govinda-das")).toBe(40_000);
    const again = validateSave(JSON.parse(JSON.stringify(game)), T0 + 1_000);
    expect(again.npcMerchants).toEqual(game.npcMerchants);
  });

  it("gives the same world seed each time, and keeps playing", () => {
    const game = validateSave(version22(), T0);
    expect(validateSave(version22(), T0).worldSeed).toBe(game.worldSeed);
    const later = runDays(game, 20);
    expect(isValidGameState(later)).toBe(true);
    expect(later.npcMerchants.some((merchant) => merchant.tripsCompleted > 0)).toBe(true);
  });

  it("backs up the version 22 save first", async () => {
    const old = version22();
    await new Promise<void>((resolve) => {
      const open = indexedDB.open("bengal-trader", 2);
      open.onupgradeneeded = () => open.result.createObjectStore("save");
      open.onsuccess = () => {
        const transaction = open.result.transaction("save", "readwrite");
        transaction.objectStore("save").put(old, "captain");
        transaction.oncomplete = () => {
          open.result.close();
          resolve();
        };
      };
    });
    const session = await openGameSession(T0);
    expect(session.game?.version).toBe(28);
    expect((await readSaveBackup("save-backup:migration:v22"))?.save).toEqual(old);
    expect((await listSaveBackups()).map((backup) => backup.saveVersion)).toEqual([22]);
  });
});
