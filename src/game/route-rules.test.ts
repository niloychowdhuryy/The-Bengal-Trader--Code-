import { describe, expect, it } from "vitest";
import {
  GOODS,
  ROUTE_MINIMUM_MARGIN,
  VESSEL_CLASSES,
  advanceWorld,
  buyPlayerShip,
  cancelAutomatedTradeRoute,
  configureAutomatedTradeRoute,
  createNewGame,
  getGoodPrice,
  planRouteJourney,
  setAutomatedTradeRouteStatus,
  sellGood,
  type AutomatedTradeRule,
  type GameState,
  type GoodId,
  type PlayerShip,
  type TownId,
  type VesselClassId,
} from "./model";
import { DAILY_RUNNING_COST } from "./npc";
import { migrateLegacySave, validateSave } from "./save-format";

const SHIP = "player-ship-2";
const NO_GOODS = Object.fromEntries(GOODS.map((good) => [good.id, 0])) as Record<GoodId, number>;
const twoWay = (...goods: GoodId[]): AutomatedTradeRule[] =>
  goods.map((good) => ({ good, buyAtOrigin: true, sellAtDestination: true }));

interface Setup {
  vessel?: VesselClassId;
  rules?: AutomatedTradeRule[];
  capital?: number;
  stock?: Partial<Record<TownId, Partial<Record<GoodId, number>>>>;
}

// Hooghly and Tanda have nothing that pays by itself, so a shortage at Tanda makes this route worth sailing.
const TANDA_SHORT_OF_OPIUM = { tanda: { opium: 40 } };

/** A second ship in Hooghly, on a route to Tanda, with no merchants to move prices around. */
function routeGame({ vessel = "bora", rules = twoWay("opium"), capital = 15_000, stock = TANDA_SHORT_OF_OPIUM }: Setup = {}): GameState {
  const rich: GameState = {
    ...createNewGame("Maya", 8),
    npcMerchants: [],
    npcActivity: [],
    coins: 200_000,
    highestCoins: 200_000,
    currentTown: "hooghly",
    selectedTown: "hooghly",
    visitedTowns: ["dhaka", "hooghly", "tanda"],
  };
  const bought = buyPlayerShip(rich, vessel).state;
  const marketStock = { ...bought.marketStock };
  for (const [port, goods] of Object.entries(stock)) {
    marketStock[port as TownId] = { ...marketStock[port as TownId], ...goods };
  }
  const result = configureAutomatedTradeRoute({ ...bought, marketStock }, SHIP, "tanda", rules, capital);
  expect(result.error).toBeUndefined();
  return result.state;
}

const shipOf = (state: GameState): PlayerShip => state.fleet.find((ship) => ship.id === SHIP)!;
const held = (ship: PlayerShip) => GOODS.reduce((total, good) => total + ship.cargo[good.id], 0);

/** Moves the world on by whole days, keeping the player's clock with it. */
function daysPass(state: GameState, days: number): GameState {
  const until = state.worldDay + days;
  return advanceWorld({ ...state, sailingDay: until }, until);
}

/** Runs the route until it next docks at a port, and returns that first docked state. */
function untilDockedAt(state: GameState, port: TownId, limit = 30): GameState {
  let next = state;
  for (let day = 0; day < limit; day += 1) {
    next = daysPass(next, 1);
    const ship = shipOf(next);
    if (ship.automatedRoute!.phase === "docked" && ship.currentPort === port) return next;
  }
  throw new Error(`The route never docked at ${port}.`);
}

describe("when a route sails", () => {
  it("buys and sails when the round trip clears the margin", () => {
    const start = routeGame();
    const outlook = planRouteJourney(start, shipOf(start))!;
    expect(outlook.margin).toBeGreaterThanOrEqual(ROUTE_MINIMUM_MARGIN);
    const ship = shipOf(daysPass(start, 1));
    expect(ship.automatedRoute).toMatchObject({ phase: "traveling", destinationPort: "tanda", waiting: null });
    expect(ship.cargo.opium).toBeGreaterThan(0);
  });

  it("waits, buying nothing, when no selected good would make the margin", () => {
    // Lac costs the same at both ends, so the spread alone makes it lose either way.
    const start = routeGame({ rules: twoWay("lac") });
    const next = daysPass(start, 1);
    const ship = shipOf(next);
    expect(ship.automatedRoute).toMatchObject({
      phase: "docked",
      capital: 15_000,
      runningCostPaid: 0,
      waiting: { reason: "margin", expectedMargin: null },
    });
    expect(held(ship)).toBe(0);
    expect(next.marketStock.hooghly.lac).toBe(start.marketStock.hooghly.lac);
    expect(ship.automationLog.at(-1)?.message).toContain("Waiting");
  });

  it("counts running costs, so a margin that clears 10% per unit can still not be enough", () => {
    // Make one unit's margin only just clear the bar, then the voyage's cost has to fit too.
    const stocks = Array.from({ length: 120 }, (_, stock) => stock + 1);
    const base = routeGame({ rules: twoWay("lac") });
    const buy = getGoodPrice("hooghly", "lac", "buy", true, base.marketStock.hooghly.lac);
    const tandaStock = stocks.find((stock) => {
      const sell = getGoodPrice("tanda", "lac", "sell", true, stock);
      return sell >= buy * 1.11 && sell <= buy * 1.16;
    });
    expect(tandaStock).toBeDefined();
    const start = routeGame({ vessel: "patello", rules: twoWay("lac"), stock: { tanda: { lac: tandaStock! } } });
    const outlook = planRouteJourney(start, shipOf(start))!;
    expect(outlook.outbound.cost).toBeGreaterThan(0);
    expect(outlook.margin).toBeLessThan(ROUTE_MINIMUM_MARGIN);
    const ship = shipOf(daysPass(start, 1));
    expect(ship.automatedRoute!.waiting).toMatchObject({ reason: "margin" });
    expect(ship.automatedRoute!.waiting!.expectedMargin).toBeLessThan(ROUTE_MINIMUM_MARGIN);
    expect(held(ship)).toBe(0);
  });

  it("starts sailing once prices improve", () => {
    const waiting = daysPass(routeGame({ rules: twoWay("lac") }), 1);
    expect(shipOf(waiting).automatedRoute!.waiting).not.toBeNull();
    const better = { ...waiting, marketStock: { ...waiting.marketStock, tanda: { ...waiting.marketStock.tanda, lac: 5 } } };
    const ship = shipOf(daysPass(better, 1));
    expect(ship.automatedRoute).toMatchObject({ phase: "traveling", waiting: null });
    expect(ship.cargo.lac).toBeGreaterThan(0);
  });

  it("waits when paused, and doesn't call that a problem", () => {
    const start = routeGame();
    const paused = setAutomatedTradeRouteStatus(start, SHIP, "paused").state;
    expect(shipOf(daysPass(paused, 3)).automatedRoute).toMatchObject({ phase: "docked", waiting: null });
  });
});

describe("both directions", () => {
  // Plenty at Tanda and scarce at Hooghly, so this good only pays on the way back.
  const homewardOnly = { hooghly: { lac: 5 }, tanda: { lac: 118 } };

  it("sails out empty for a load worth bringing back", () => {
    const start = routeGame({ rules: twoWay("lac"), stock: homewardOnly });
    const outlook = planRouteJourney(start, shipOf(start))!;
    expect(outlook.outbound.cost).toBe(0);
    expect(outlook.homebound.cost).toBeGreaterThan(0);
    const leaving = shipOf(daysPass(start, 1));
    expect(leaving.automatedRoute!.phase).toBe("traveling");
    expect(held(leaving)).toBe(0);

    const atTanda = untilDockedAt(start, "tanda");
    const loaded = shipOf(daysPass(atTanda, 1));
    expect(loaded.cargo.lac).toBeGreaterThan(0);
    expect(loaded.automatedRoute).toMatchObject({ direction: "return", destinationPort: "hooghly" });

    const home = untilDockedAt(daysPass(atTanda, 1), "hooghly");
    const capitalAtHome = shipOf(home).automatedRoute!.capital;
    const afterSale = shipOf(daysPass(home, 1));
    expect(afterSale.cargo.lac).toBe(0);
    expect(afterSale.automatedRoute!.capital).toBeGreaterThan(capitalAtHome);
  });

  it("keeps a one-way rule one way", () => {
    const oneWay = [{ good: "lac" as GoodId, buyAtOrigin: true, sellAtDestination: false }, { good: "silk" as GoodId, buyAtOrigin: false, sellAtDestination: true }];
    const start = routeGame({ rules: oneWay, stock: homewardOnly });
    const outlook = planRouteJourney(start, shipOf(start))!;
    expect(outlook.homebound.units.lac).toBeUndefined();
    expect(outlook.homebound.units.silk).toBeUndefined();
  });
});

describe("running costs", () => {
  it("match the merchants' rates, and are paid once for each voyage at departure", () => {
    for (const vessel of ["bora", "river-boat", "patello"] as VesselClassId[]) {
      const start = routeGame({ vessel });
      const before = shipOf(start).automatedRoute!.capital;
      const next = shipOf(daysPass(start, 1));
      const route = next.automatedRoute!;
      const goodsPaid = next.averagePurchasePrice.opium * next.cargo.opium;
      expect(route.runningCostPaid).toBe(DAILY_RUNNING_COST[vessel] * route.travelDaysTotal);
      expect(route.capital).toBeCloseTo(before - goodsPaid - route.runningCostPaid, 5);
    }
  });

  it("aren't charged while sailing or waiting in port", () => {
    const sailing = daysPass(routeGame(), 1);
    if (shipOf(sailing).automatedRoute!.travelDaysRemaining > 1) {
      const later = shipOf(daysPass(sailing, 1)).automatedRoute!;
      expect(later.runningCostPaid).toBe(shipOf(sailing).automatedRoute!.runningCostPaid);
    }
    const waiting = daysPass(routeGame({ rules: twoWay("lac") }), 10);
    expect(shipOf(waiting).automatedRoute).toMatchObject({ capital: 15_000, runningCostPaid: 0 });
  });

  it("come out of the route's Coins, never the player's purse", () => {
    const start = routeGame();
    expect(daysPass(start, 3).coins).toBe(start.coins);
  });

  it("leave a route with nothing owed when it's cancelled", () => {
    const start = routeGame({ rules: twoWay("lac") });
    const cancelled = cancelAutomatedTradeRoute(start, SHIP).state;
    expect(cancelled.coins).toBe(start.coins + 15_000);
  });
});

describe("a route short of Coins", () => {
  it("waits, and says why, if it can't pay for the voyage", () => {
    const start = routeGame({ capital: 10 });
    const ship = shipOf(daysPass(start, 1));
    expect(ship.automatedRoute).toMatchObject({
      phase: "docked",
      capital: 10,
      waiting: { reason: "coins", expectedMargin: null },
    });
    expect(ship.automationLog.at(-1)?.message).toContain("not enough route Coins");
  });

  it("only buys what its Coins can cover after the round trip's running cost", () => {
    const opiumPrice = getGoodPrice("hooghly", "opium", "buy", true, createNewGame("x").marketStock.hooghly.opium);
    const start = routeGame({ capital: opiumPrice + 400 });
    const ship = shipOf(daysPass(start, 1));
    expect(ship.cargo.opium).toBe(1);
    expect(ship.automatedRoute!.capital).toBeGreaterThanOrEqual(0);
  });

  it("never goes below zero Coins over a long run on a poor purse", () => {
    let state = routeGame({ capital: 2_500, rules: twoWay("silk", "muslin", "sugar") });
    for (let day = 0; day < 120; day += 1) {
      state = daysPass(state, 1);
      expect(shipOf(state).automatedRoute!.capital).toBeGreaterThanOrEqual(0);
    }
  });

  it("sells its goods to raise the fare rather than being stuck for good", () => {
    const start = routeGame({ capital: 0 + 10, rules: twoWay("rice") });
    const stranded = {
      ...start,
      fleet: start.fleet.map((ship) =>
        ship.id === SHIP
          ? { ...ship, cargo: { ...NO_GOODS, rice: 4 }, averagePurchasePrice: { ...NO_GOODS, rice: 5_000 } }
          : ship,
      ),
    };
    const ship = shipOf(daysPass(stranded, 1));
    expect(ship.cargo.rice).toBeLessThan(4);
    expect(ship.automatedRoute!.capital).toBeGreaterThan(10);
  });
});

describe("what a route carries", () => {
  it("trades three times the old quantity per good", () => {
    expect(VESSEL_CLASSES["river-boat"].routeUnitsPerGood).toBe(3);
    expect(VESSEL_CLASSES.bora.routeUnitsPerGood).toBe(3);
    expect(VESSEL_CLASSES.patello.routeUnitsPerGood).toBe(12);
    const ship = shipOf(daysPass(routeGame({ vessel: "river-boat" }), 1));
    expect(ship.cargo.opium).toBe(3);
  });

  it("stops at the ship's hold", () => {
    const start = routeGame({
      rules: twoWay("silk", "muslin", "sugar", "rice", "opium"),
      stock: { tanda: { silk: 20, muslin: 20, sugar: 20, rice: 20, opium: 40 } },
    });
    const ship = shipOf(daysPass(start, 1));
    expect(held(ship)).toBeLessThanOrEqual(ship.cargoCapacity);
    expect(held(ship)).toBe(VESSEL_CLASSES.bora.baseHold);
  });

  it("buys the best-paying goods first, not the order they were ticked", () => {
    const start = routeGame({
      rules: twoWay("saltpetre", "opium"),
      capital: 5_500,
      stock: { tanda: { opium: 40, saltpetre: 40 } },
    });
    expect(planRouteJourney(start, shipOf(start))!.outbound.units.opium).toBe(3);
  });

  it("stops buying a good once the price it has pushed up would lose the margin", () => {
    const start = routeGame({ vessel: "patello", rules: twoWay("opium"), capital: 100_000, stock: { tanda: { opium: 50 } } });
    const outlook = planRouteJourney(start, shipOf(start))!;
    expect(outlook.outbound.units.opium).toBeGreaterThan(0);
    expect(outlook.outbound.units.opium).toBeLessThan(VESSEL_CLASSES.patello.routeUnitsPerGood);
    let stock = start.marketStock.hooghly.opium;
    let sold = start.marketStock.tanda.opium;
    for (let unit = 0; unit < (outlook.outbound.units.opium ?? 0); unit += 1) {
      const buy = getGoodPrice("hooghly", "opium", "buy", true, stock);
      const sell = getGoodPrice("tanda", "opium", "sell", true, sold);
      expect(sell).toBeGreaterThanOrEqual(buy * (1 + ROUTE_MINIMUM_MARGIN));
      stock -= 1;
      sold += 1;
    }
  });

  it("holds goods at a loss only while the other end pays better", () => {
    const start = routeGame();
    const atTanda = untilDockedAt(start, "tanda");
    const costly = (state: GameState) => ({
      ...state,
      fleet: state.fleet.map((ship) =>
        ship.id === SHIP
          ? { ...ship, cargo: { ...NO_GOODS, opium: 3 }, averagePurchasePrice: { ...NO_GOODS, opium: 9_000 } }
          : ship,
      ),
    });
    // Opium sells for more at Tanda, so that's where the loss is taken.
    expect(shipOf(daysPass(costly(atTanda), 1)).cargo.opium).toBe(0);
    // Hooghly pays less, so the ship carries it on rather than selling here.
    const atHooghly = daysPass(costly(start), 1);
    expect(shipOf(atHooghly).cargo.opium).toBeGreaterThanOrEqual(3);
    expect(shipOf(atHooghly).automatedRoute!.phase).toBe("traveling");
  });

  it("never gets stuck for good with goods it bought before prices fell", () => {
    // Bought expensively, with nothing worth buying at either end afterwards.
    const start = routeGame({ rules: twoWay("lac") });
    let state: GameState = {
      ...start,
      fleet: start.fleet.map((ship) =>
        ship.id === SHIP
          ? { ...ship, cargo: { ...NO_GOODS, lac: 4 }, averagePurchasePrice: { ...NO_GOODS, lac: 5_000 } }
          : ship,
      ),
    };
    for (let day = 0; day < 40; day += 1) state = daysPass(state, 1);
    expect(shipOf(state).cargo.lac).toBe(0);
    expect(shipOf(state).automatedRoute!.capital).toBeGreaterThan(0);
  });

  it("takes prices from stock shared with the player", () => {
    const start = routeGame();
    const next = daysPass(start, 1);
    expect(next.marketStock.hooghly.opium).toBeLessThan(start.marketStock.hooghly.opium);
    expect(sellGood(next, "rice", 1).state.coins).toBeGreaterThan(next.coins);
  });
});

describe("routes in saves", () => {
  it("keep their running costs and reason for waiting through a reload", () => {
    const waiting = daysPass(routeGame({ rules: twoWay("lac") }), 1);
    const reloaded = validateSave(JSON.parse(JSON.stringify({ ...waiting, npcMerchants: createNewGame("Maya", 8).npcMerchants })));
    expect(shipOf(reloaded).automatedRoute).toEqual(shipOf(waiting).automatedRoute);

    const sailing = daysPass(routeGame(), 1);
    const again = validateSave(JSON.parse(JSON.stringify({ ...sailing, npcMerchants: createNewGame("Maya", 8).npcMerchants })));
    expect(shipOf(again).automatedRoute!.runningCostPaid).toBeGreaterThan(0);
  });

  it("wait with their Coins intact, and say why, when the goods they were set up with stop paying", () => {
    // Silk from Hooghly to Tanda was among the best routes before version 29.
    const start = routeGame({ rules: twoWay("silk"), stock: {} });
    const ship = shipOf(daysPass(start, 1));
    expect(ship.automatedRoute).toMatchObject({ phase: "docked", capital: 15_000, runningCostPaid: 0 });
    expect(ship.automatedRoute!.waiting?.reason).toBe("margin");
    expect(ship.automationLog.at(-1)?.message).toContain("no round trip would make");
    expect(cancelAutomatedTradeRoute(daysPass(start, 1), SHIP).error).toBeUndefined();
  });

  it("upgrade from version 27 owing nothing, and keep trading", () => {
    const start = routeGame();
    const old = {
      ...start,
      version: 27,
      npcMerchants: createNewGame("Maya", 8).npcMerchants,
      fleet: start.fleet.map((ship) => {
        if (!ship.automatedRoute) return ship;
        const { runningCostPaid: _paid, waiting: _waiting, ...route } = ship.automatedRoute;
        return { ...ship, automatedRoute: route };
      }),
    };
    const migrated = validateSave(migrateLegacySave(old));
    expect(migrated.version).toBe(29);
    expect(shipOf(migrated).automatedRoute).toMatchObject({ capital: 15_000, runningCostPaid: 0, waiting: null });
    expect(shipOf(daysPass(migrated, 1)).automatedRoute!.phase).toBe("traveling");
  });

  it.each([
    ["a negative running cost", { runningCostPaid: -1 }],
    ["an unknown reason for waiting", { waiting: { reason: "weather", expectedMargin: null } }],
    ["a margin that isn't a number", { waiting: { reason: "margin", expectedMargin: "high" } }],
  ])("refuse %s", (_label, change) => {
    const start = routeGame();
    const bad = {
      ...start,
      npcMerchants: createNewGame("Maya", 8).npcMerchants,
      fleet: start.fleet.map((ship) =>
        ship.automatedRoute ? { ...ship, automatedRoute: { ...ship.automatedRoute, ...change } } : ship,
      ),
    };
    expect(() => validateSave(bad)).toThrow();
  });
});
