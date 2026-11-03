import { beforeEach, describe, expect, it } from "vitest";
import { asVersion21 } from "../test/gold-save";
import { applyCommand } from "./commands";
import {
  GOODS,
  MARKET_MAX_PRICE_SHARE,
  MARKET_BASE_PRICES,
  MARKET_MAX_STOCK,
  MARKET_MIN_PRICE_SHARE,
  MARKET_PORTS,
  MARKET_SELL_SPREAD,
  advanceMarketStock,
  advanceWorld,
  arriveAtDestination,
  buyGood,
  checkpointVoyageProgress,
  createInitialMarketStock,
  createNewGame,
  getGoodPrice,
  getMarketDemand,
  getMarketSupply,
  getTradeQuote,
  sellGood,
  startVoyage,
  storeGoodInWarehouse,
  retrieveGoodFromWarehouse,
  buyWarehouse,
  tradeWithNpcMerchant,
  type GameState,
  type GoodId,
  type MarketPortId,
} from "./model";
import { isValidGameState, validateSave } from "./save-format";
import { listSaveBackups, openGameSession, readSaveBackup } from "./storage";
import saveV20 from "./__fixtures__/save-v20.json";

const T0 = 1_800_200_000_000;

function everyStall(check: (port: MarketPortId, good: GoodId) => void): void {
  for (const port of MARKET_PORTS) {
    for (const good of GOODS) check(port.id, good.id);
  }
}

function richGameAt(port: MarketPortId, good: GoodId, stock: number): GameState {
  const fresh = createNewGame("Maya");
  return {
    ...fresh,
    coins: 50_000_000,
    highestCoins: 50_000_000,
    currentTown: port,
    selectedTown: port,
    visitedTowns: [...new Set([...fresh.visitedTowns, port])],
    fleet: fresh.fleet.map((ship) => ({ ...ship, currentPort: port })),
    cargo: { rice: 0, salt: 0, muslin: 0, silk: 0, sugar: 0, saltpetre: 0, opium: 0, lac: 0 },
    averagePurchasePrice: { rice: 0, salt: 0, muslin: 0, silk: 0, sugar: 0, saltpetre: 0, opium: 0, lac: 0 },
    upgrades: { cannon: 0, hull: 0, hold: 3 },
    marketStock: { ...fresh.marketStock, [port]: { ...fresh.marketStock[port], [good]: stock } },
  };
}

describe("buying and selling at one stall", () => {
  it("always loses money, at every stall, stock level and order of trades", () => {
    everyStall((port, good) => {
      for (let stock = 1; stock <= MARKET_MAX_STOCK; stock += 1) {
        for (const alert of [false, true]) {
          const buy = getGoodPrice(port, good, "buy", alert, stock);
          const sellBack = getGoodPrice(port, good, "sell", alert, stock - 1);
          expect(sellBack, `${port} ${good} at ${stock}`).toBeLessThan(buy);
        }
      }
      for (let stock = 0; stock < MARKET_MAX_STOCK; stock += 1) {
        // Selling first and buying back is the same unit in the other order.
        const sell = getGoodPrice(port, good, "sell", false, stock);
        const buyBack = getGoodPrice(port, good, "buy", false, stock + 1);
        expect(sell, `${port} ${good} at ${stock}`).toBeLessThan(buyBack);
      }
    });
  });

  it("loses about the discount at any quantity, and more on no stall", () => {
    everyStall((port, good) => {
      const start = createInitialMarketStock()[port][good];
      for (const quantity of [1, 2, 5, 12, 30, 48]) {
        if (quantity > start) continue;
        const game = richGameAt(port, good, start);
        const paid = getTradeQuote(game, port, good, "buy", quantity)!.total;
        const afterBuying = { ...game, marketStock: { ...game.marketStock, [port]: { ...game.marketStock[port], [good]: start - quantity } } };
        const received = getTradeQuote(afterBuying, port, good, "sell", quantity)!.total;
        expect(received, `${port} ${good} × ${quantity}`).toBeLessThan(paid);
        expect(received / paid).toBeLessThanOrEqual(1 - MARKET_SELL_SPREAD);
        expect(received / paid).toBeGreaterThan(1 - MARKET_SELL_SPREAD - 0.05);
      }
    });
  });

  it("loses steadily when repeated through real commands, ending where it started", () => {
    for (const stock of [120, 60, 15, 3, 1]) {
      const start = richGameAt("dhaka", "opium", stock);
      let game = start;
      let previous = game.coins;
      for (let loop = 0; loop < 300; loop += 1) {
        game = applyCommand(game, { type: "buyGood", good: "opium", quantity: 1 }, T0).state;
        game = applyCommand(game, { type: "sellGood", good: "opium", quantity: 1 }, T0).state;
        expect(game.coins).toBeLessThan(previous);
        previous = game.coins;
      }
      expect(game.marketStock.dhaka.opium).toBe(stock);
      expect(game.cargo.opium).toBe(0);
    }
  });

  it("can't be pumped: buying first never improves what other goods then sell for", () => {
    everyStall((port, good) => {
      const start = createInitialMarketStock()[port][good];
      const carried = 6;
      const pump = 12;
      if (start < pump) return;
      const sell = (from: number, count: number) => {
        let total = 0;
        for (let unit = 0; unit < count; unit += 1) total += getGoodPrice(port, good, "sell", false, from + unit);
        return total;
      };
      let pumpCost = 0;
      for (let unit = 0; unit < pump; unit += 1) pumpCost += getGoodPrice(port, good, "buy", false, start - unit);
      const straight = sell(start, carried);
      const pumped = sell(start - pump, pump + carried) - pumpCost;
      expect(pumped, `${port} ${good}`).toBeLessThan(straight);
    });
  });

  it("makes no money through a warehouse", () => {
    let game = buyWarehouse(richGameAt("dhaka", "silk", 60)).state;
    game = buyGood(game, "silk", 4).state;
    const before = game.coins;
    for (let trip = 0; trip < 4; trip += 1) {
      game = storeGoodInWarehouse(game, "silk").state;
      game = retrieveGoodFromWarehouse(game, "silk").state;
    }
    expect(game.coins).toBe(before);
    expect(game.marketStock.dhaka.silk).toBe(56);
    expect(game.averagePurchasePrice.silk).toBeGreaterThan(0);
  });

  it("makes no money by buying from a merchant and selling to the stall", () => {
    const fresh = createNewGame("Maya");
    const merchant = fresh.npcMerchants[0];
    let game: GameState = {
      ...fresh,
      coins: 100_000,
      highestCoins: 100_000,
      npcMerchants: fresh.npcMerchants.map((entry) =>
        entry.id === merchant.id ? { ...entry, cargo: { ...entry.cargo, silk: 3 }, cargoCost: { ...entry.cargoCost, silk: 1_000 } } : entry,
      ),
    };
    for (let unit = 0; unit < 3; unit += 1) {
      const before = game.coins;
      game = tradeWithNpcMerchant(game, merchant.id, "silk").state;
      game = sellGood(game, "silk").state;
      expect(game.coins).toBeLessThan(before);
    }
  });
});

describe("real trading between towns", () => {
  it("still pays where towns differ", () => {
    const start = createInitialMarketStock();
    let profitable = 0;
    for (const from of MARKET_PORTS) {
      for (const to of MARKET_PORTS) {
        if (from.id === to.id) continue;
        if (
          GOODS.some(
            (good) =>
              getGoodPrice(to.id, good.id, "sell", false, start[to.id][good.id]) >
              getGoodPrice(from.id, good.id, "buy", false, start[from.id][good.id]),
          )
        ) {
          profitable += 1;
        }
      }
    }
    expect(profitable).toBeGreaterThan(100);
  });

  it("wears down as stock moves, so a full hold earns less per unit than a small one", () => {
    const stock = createInitialMarketStock();
    const margin = (unit: number) =>
      getGoodPrice("tanda", "silk", "sell", false, stock.tanda.silk + unit) -
      getGoodPrice("kasimbazar", "silk", "buy", false, stock.kasimbazar.silk - unit);
    expect(margin(0)).toBeGreaterThan(0);
    expect(margin(30)).toBeLessThan(margin(0));
  });
});

describe("prices", () => {
  it("stay within their limits, and only ever rise as stock falls", () => {
    everyStall((port, good) => {
      const base = MARKET_BASE_PRICES[good];
      let previous = Number.POSITIVE_INFINITY;
      for (let stock = 0; stock <= MARKET_MAX_STOCK; stock += 1) {
        const price = getGoodPrice(port, good, "buy", false, stock);
        expect(price).toBeLessThanOrEqual(previous);
        expect(price).toBeGreaterThanOrEqual(Math.floor(base * MARKET_MIN_PRICE_SHARE) - 5);
        expect(price).toBeLessThanOrEqual(Math.ceil(base * MARKET_MAX_PRICE_SHARE) + 5);
        previous = price;
      }
    });
  });

  it("keep regional advantages: producers are cheaper than big buyers", () => {
    const stock = createInitialMarketStock();
    expect(getMarketSupply("dhaka", "muslin")).toBe(3);
    expect(getGoodPrice("dhaka", "muslin", "buy", false, stock.dhaka.muslin)).toBeLessThan(
      getGoodPrice("kasimbazar", "muslin", "buy", false, stock.kasimbazar.muslin),
    );
  });
});

describe("stock recovery", () => {
  it("moves a shortage and a surplus back, without overshooting or stopping short", () => {
    everyStall((port, good) => {
      const target = createInitialMarketStock()[port][good];
      for (const start of [0, MARKET_MAX_STOCK]) {
        let market: GameState["marketStock"] = {
          ...createInitialMarketStock(),
          [port]: { ...createInitialMarketStock()[port], [good]: start },
        };
        let previousGap = Math.abs(start - target);
        let days = 0;
        while (market[port][good] !== target) {
          market = advanceMarketStock(market, 1);
          const gap = Math.abs(market[port][good] - target);
          expect(gap).toBeLessThan(previousGap);
          // It may reach its target, but never crosses to the other side.
          expect((market[port][good] - target) * (start - target)).toBeGreaterThanOrEqual(0);
          previousGap = gap;
          days += 1;
          expect(days).toBeLessThan(60);
        }
        expect(days, `${port} ${good}`).toBeGreaterThan(3);
      }
    });
  });

  it("differs by town: producers restock faster and big buyers clear a surplus faster", () => {
    const daysToHalf = (port: MarketPortId, good: GoodId, start: number) => {
      const target = createInitialMarketStock()[port][good];
      let market: GameState["marketStock"] = {
        ...createInitialMarketStock(),
        [port]: { ...createInitialMarketStock()[port], [good]: start },
      };
      let days = 0;
      while (Math.abs(market[port][good] - target) > Math.abs(start - target) / 2) {
        market = advanceMarketStock(market, 1);
        days += 1;
      }
      return days;
    };
    expect(getMarketSupply("dhaka", "muslin")).toBe(3);
    expect(getMarketSupply("dhaka", "silk")).toBe(2);
    expect(daysToHalf("dhaka", "muslin", 0)).toBeLessThan(daysToHalf("dhaka", "silk", 0));
    expect(getMarketDemand("dhaka", "rice")).toBe(3);
    expect(getMarketDemand("dhaka", "saltpetre")).toBe(1);
    expect(daysToHalf("dhaka", "rice", MARKET_MAX_STOCK)).toBeLessThan(
      daysToHalf("dhaka", "saltpetre", MARKET_MAX_STOCK),
    );
  });
});

describe("the world clock", () => {
  function emptied(): GameState {
    const fresh = createNewGame("Maya");
    return {
      ...fresh,
      npcMerchants: [],
      marketStock: { ...fresh.marketStock, dhaka: { ...fresh.marketStock.dhaka, silk: 0 } },
    };
  }

  it("runs each whole day once, however it's asked", () => {
    const game = emptied();
    const inOneGo = advanceWorld(game, 5);
    let stepByStep = game;
    for (const day of [0.5, 1, 1, 1.9, 2, 3.2, 3.2, 4, 5, 5]) {
      stepByStep = advanceWorld({ ...stepByStep, sailingDay: day }, day);
    }
    expect(stepByStep.marketStock).toEqual(inOneGo.marketStock);
    expect(stepByStep.worldDay).toBe(5);
    expect(inOneGo.marketStock).toEqual(advanceMarketStock(game.marketStock, 5));
  });

  it("doesn't move for part of a day, or when asked about a day it has passed", () => {
    const game = emptied();
    expect(advanceWorld(game, 0.99).marketStock).toEqual(game.marketStock);
    const onDayTwo = advanceWorld(game, 2);
    expect(advanceWorld(onDayTwo, 2).marketStock).toEqual(onDayTwo.marketStock);
    expect(() => advanceWorld(onDayTwo, 1)).toThrow();
  });

  it("doesn't count a voyage twice between checkpoints and arrival", () => {
    const start = { ...emptied(), selectedTown: "sylhet" as const };
    const plain = arriveAtDestination(startVoyage(start, 1_000));

    let checked = startVoyage(start, 1_000);
    const voyage = checked.voyage!;
    for (let step = 1; step <= 9; step += 1) {
      checked = checkpointVoyageProgress(checked, 1_000 + (voyage.durationMs * step) / 10);
    }
    checked = checkpointVoyageProgress(checked, 1_000 + voyage.durationMs);
    const afterCheckpoints = arriveAtDestination(checked);

    expect(afterCheckpoints.marketStock).toEqual(plain.marketStock);
    expect(afterCheckpoints.worldDay).toBe(plain.worldDay);
  });

  it("doesn't move when a player is docked, trading or looking around", () => {
    let game = createNewGame("Maya");
    const day = game.worldDay;
    const rice = game.marketStock.dhaka.rice;
    game = applyCommand(game, { type: "buyGood", good: "rice", quantity: 1 }, T0).state;
    game = applyCommand(game, { type: "selectDestination", town: "hooghly" }, T0 + 60_000_000).state;
    expect(game.worldDay).toBe(day);
    expect(game.marketStock.dhaka.rice).toBe(rice - 1);
  });

  it("doesn't move while a game is closed, however long for", () => {
    const game = validateSave(saveV20, T0);
    const muchLater = validateSave(JSON.parse(JSON.stringify(game)), T0 + 30 * 24 * 60 * 60 * 1000);
    expect(muchLater.worldDay).toBe(game.worldDay);
    expect(muchLater.marketStock).toEqual(game.marketStock);
    expect(muchLater.npcMerchants).toEqual(game.npcMerchants);
  });
});

describe("moving saves to the new market", () => {
  beforeEach(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("bengal-trader");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
  );

  const oldGame = () =>
    asVersion21({
      ...createNewGame("Maya"),
      coins: 40_000,
      highestCoins: 40_000,
      marketStock: {
        ...createInitialMarketStock(),
        dhaka: { ...createInitialMarketStock().dhaka, silk: 21 },
      },
    });

  it("keeps each stall's share of its stock, so old stalls hold three times the units", () => {
    const old = oldGame();
    expect(old.marketStock.dhaka.silk).toBe(7);
    const game = validateSave(old, T0);
    expect(game.version).toBe(22);
    expect(game.marketStock.dhaka.silk).toBe(21);
    expect(game.marketStock).toEqual(
      Object.fromEntries(
        Object.entries(old.marketStock as Record<string, Record<string, number>>).map(([port, stalls]) => [
          port,
          Object.fromEntries(Object.entries(stalls).map(([good, stock]) => [good, stock * 3])),
        ]),
      ),
    );
    expect(isValidGameState(game)).toBe(true);
  });

  it("keeps money, cargo and cost basis untouched", () => {
    const old = oldGame();
    const game = validateSave(old, T0);
    expect(game.coins).toBe(old.coins);
    expect(game.highestCoins).toBe(old.highestCoins);
    expect(game.cargo).toEqual(old.cargo);
    expect(game.averagePurchasePrice).toEqual(old.averagePurchasePrice);
    expect(game.fleet).toEqual(old.fleet);
    expect(game.missions).toEqual(old.missions);
    expect(game.npcMerchants).toEqual(old.npcMerchants);
  });

  it("moves the old clock onto the world clock", () => {
    const old = { ...oldGame(), npcSimulationDay: 12, sailingDay: 12.4 };
    const game = validateSave(old, T0);
    expect(game.worldDay).toBe(12);
    expect("npcSimulationDay" in game).toBe(false);
  });

  it("gives a voyage under way the recovery it was due on arrival, once only", () => {
    const sailing = startVoyage(
      { ...createNewGame("Maya"), selectedTown: "sylhet", npcMerchants: createNewGame("Maya").npcMerchants },
      1_000,
    );
    const old = {
      ...asVersion21({
        ...sailing,
        marketStock: { ...sailing.marketStock, dhaka: { ...sailing.marketStock.dhaka, silk: 21 } },
      }),
      npcSimulationDay: 2,
      sailingDay: 0,
    };
    const game = validateSave(old, T0);
    const expected = advanceMarketStock(
      { ...createInitialMarketStock(), dhaka: { ...createInitialMarketStock().dhaka, silk: 21 } },
      2,
    );
    expect(game.marketStock.dhaka.silk).toBe(expected.dhaka.silk);
    expect(game.worldDay).toBe(2);
    const again = validateSave(JSON.parse(JSON.stringify(game)), T0 + 1_000);
    expect(again.marketStock).toEqual(game.marketStock);
  });

  it("gives a docked game no extra recovery", () => {
    const game = validateSave({ ...oldGame(), npcSimulationDay: 3, sailingDay: 3.5 }, T0);
    expect(game.marketStock.dhaka.silk).toBe(21);
  });

  it("carries a v20 save all the way through, and keeps its stock's share", () => {
    const game = validateSave(saveV20, T0);
    expect(game.version).toBe(22);
    expect(game.coins).toBe(saveV20.gold * 50);
    // One day's recovery was still due at the moment that save was written.
    expect(game.worldDay).toBe(saveV20.npcSimulationDay);
    expect(game.marketStock.patna.rice).toBeGreaterThan(0);
    expect(isValidGameState(game)).toBe(true);
  });

  it("backs up a version 21 save before upgrading it", async () => {
    const old = oldGame();
    const open = indexedDB.open("bengal-trader", 2);
    await new Promise<void>((resolve) => {
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
    expect(session.game?.version).toBe(22);
    expect(session.log?.provenance).toBe("imported");
    expect((await readSaveBackup("save-backup:migration:v21"))?.save).toEqual(old);
    expect((await listSaveBackups()).map((backup) => backup.saveVersion)).toEqual([21]);
  });
});
