import { describe, expect, it } from "vitest";
import { estimateNetWorth } from "../sim/metrics";
import { applyCommand, type GameCommand } from "./commands";
import {
  GOODS,
  MARKET_MAX_STOCK,
  MARKET_PORTS,
  RESCUE_PURSE,
  buyFarm,
  buyPlayerShip,
  buyResidence,
  buyUpgrade,
  buyWarehouse,
  configureAutomatedTradeRoute,
  createNewGame,
  getGoodPrice,
  getRecoveryOptions,
  getRescueTerms,
  isStranded,
  marryAtResidence,
  repairShip,
  repayDebt,
  syncSelectedShip,
  takeRescueLoan,
  type GameState,
  type GoodId,
  type TownId,
} from "./model";
import { migrateLegacySave, validateSave } from "./save-format";

const AT = 1_000_000;
const NO_GOODS = Object.fromEntries(GOODS.map((good) => [good.id, 0])) as Record<GoodId, number>;

function noContracts(state: GameState): GameState {
  return {
    ...state,
    missions: state.missions.map((mission) =>
      mission.type === "visit" ? { ...mission, status: "completed" as const } : mission,
    ),
  };
}

/** A real game with an empty hold, no contracts left, and the given hull and purse. */
function ruined(shipHull: number, coins: number): GameState {
  return syncSelectedShip(
    noContracts({ ...createNewGame("Ruined", 7), shipHull, coins, cargo: { ...NO_GOODS } }),
  );
}

function withSecondShip(state: GameState, change: Partial<GameState["fleet"][number]>): GameState {
  const bought = buyPlayerShip({ ...state, coins: 25_000 }, "river-boat").state;
  return {
    ...bought,
    coins: state.coins,
    fleet: bought.fleet.map((ship, index) => (index === 1 ? { ...ship, ...change } : ship)),
  };
}

describe("how a player gets stuck", () => {
  it("reaches a dead end through real commands alone, by never repairing", () => {
    let clock = AT;
    const send = (state: GameState, command: GameCommand) => {
      clock += 10;
      return applyCommand(state, command, clock).state;
    };
    let game = createNewGame("Neglect", 1);
    // Everything goes into the ship, then the rest is lost buying and selling at a loss.
    for (const { id } of GOODS) {
      if (game.cargo[id] > 0) game = send(game, { type: "sellGood", good: id, quantity: game.cargo[id] });
    }
    for (const upgrade of ["hold", "cannon", "hull"] as const) {
      game = send(game, { type: "buyUpgrade", upgrade });
    }
    for (;;) {
      const bought = applyCommand(game, { type: "buyGood", good: "rice", quantity: 1 }, clock);
      if (bought.status !== "applied") break;
      game = send(bought.state, { type: "sellGood", good: "rice", quantity: 1 });
    }
    // The ship wears out on empty voyages, and the last Coins go on partial repairs.
    const stops: TownId[] = ["sonargaon", "dhaka"];
    for (let voyage = 0; (game.shipHull > 0 || game.coins >= 100) && voyage < 400; voyage += 1) {
      if (game.shipHull === 0) game = send(game, { type: "repairShip" });
      game = send(game, { type: "selectDestination", town: stops[voyage % 2] });
      game = send(game, { type: "startVoyage" });
      clock = Math.ceil(game.voyage!.arrivalAt) + 10;
      game = send(game, { type: "arrive" });
    }
    expect(game.shipHull).toBe(0);
    expect(game.coins).toBeLessThan(100);
    expect(applyCommand(game, { type: "startVoyage" }, clock + 10).status).toBe("rejected");
    expect(applyCommand(game, { type: "repairShip" }, clock + 10).error).toBe("coins");
    expect(isStranded(game)).toBe(true);

    const rescued = applyCommand(game, { type: "takeRescueLoan" }, clock + 10);
    expect(rescued.status).toBe("applied");
    const moving = send(
      send(rescued.state, { type: "selectDestination", town: "sonargaon" }),
      { type: "startVoyage" },
    );
    expect(moving.voyage).not.toBeNull();
  });

  it("repairs part of the damage when the purse can't pay for all of it", () => {
    const { state } = repairShip(ruined(0, 750));
    expect(state.shipHull).toBe(7);
    expect(state.coins).toBe(50);
    expect(isStranded(state)).toBe(true);
    expect(state.debtOwed).toBe(0);
  });
});

describe("who counts as stranded", () => {
  it("is nobody with enough for one hull, even at 0 hull", () => {
    expect(isStranded(ruined(0, 100))).toBe(false);
    expect(isStranded(ruined(0, 99))).toBe(true);
  });

  it("charges a Patello's higher rate", () => {
    const patello = withSecondShip(ruined(0, 120), { vesselClass: "patello", shipHull: 0 });
    const selected = syncSelectedShip({
      ...patello,
      fleet: patello.fleet.filter((ship) => ship.id === patello.fleet[1].id),
      selectedShipId: patello.fleet[1].id,
    });
    expect(isStranded(selected)).toBe(true);
    expect(getRescueTerms(selected)?.owed).toBe(Math.ceil(((880 + 300) * 1.25) / 5) * 5);
  });

  it("is nobody who can still trade, at any hull above 0", () => {
    expect(isStranded(ruined(1, 400))).toBe(false);
    const cheapest = Math.min(
      ...MARKET_PORTS.flatMap((port) =>
        GOODS.map((good) =>
          getGoodPrice(port.id, good.id, "buy", true, createNewGame("x").marketStock[port.id][good.id]),
        ),
      ),
    );
    expect(isStranded(ruined(1, cheapest))).toBe(false);
    expect(isStranded(ruined(1, cheapest - 5))).toBe(true);
  });

  it("is nobody who has cargo to sell", () => {
    const state = { ...ruined(0, 0), cargo: { ...NO_GOODS, rice: 1 } };
    expect(getRecoveryOptions(state)).toEqual(["sell-cargo"]);
    expect(isStranded(state)).toBe(false);
  });

  it("is someone whose cargo no stall here can take while the ship can't sail", () => {
    const base = ruined(0, 0);
    const full = {
      ...base,
      cargo: { ...NO_GOODS, rice: 1 },
      marketStock: {
        ...base.marketStock,
        [base.currentTown]: { ...base.marketStock[base.currentTown], rice: MARKET_MAX_STOCK },
      },
    };
    expect(isStranded(full)).toBe(true);
    expect(isStranded({ ...full, shipHull: 1 })).toBe(false);
  });

  it("is nobody with goods in a warehouse in reach", () => {
    const base = ruined(0, 0);
    const here = {
      ...base,
      ownedWarehouses: [base.currentTown],
      warehouseStock: {
        ...base.warehouseStock,
        [base.currentTown]: { ...NO_GOODS, salt: 1 },
      },
    };
    expect(getRecoveryOptions(here)).toEqual(["warehouse"]);
    const elsewhere = {
      ...base,
      ownedWarehouses: ["hooghly" as TownId],
      warehouseStock: { ...base.warehouseStock, hooghly: { ...NO_GOODS, salt: 1 } },
    };
    expect(isStranded(elsewhere)).toBe(true);
    expect(isStranded({ ...elsewhere, shipHull: 1 })).toBe(false);
  });

  it("is nobody with a farm's crop in reach", () => {
    const base = ruined(0, 0);
    const empty = { ...base, ownedFarms: [base.currentTown] };
    expect(isStranded(empty)).toBe(true);
    expect(isStranded({ ...empty, farmOutput: { ...base.farmOutput, [base.currentTown]: 1 } })).toBe(false);
    // Sailing grows the crop, so a ship that can sail will always have this.
    expect(isStranded({ ...empty, shipHull: 1 })).toBe(false);
  });

  it("is nobody with another sound ship in the same port", () => {
    const here = withSecondShip(ruined(0, 0), {});
    expect(getRecoveryOptions(here)).toEqual(["other-ship"]);
    expect(isStranded(withSecondShip(ruined(0, 0), { shipHull: 0 }))).toBe(true);
    expect(isStranded(withSecondShip(ruined(0, 0), { currentPort: "hooghly" }))).toBe(true);
  });

  it("is nobody with route capital they can call back", () => {
    const route = {
      origin: "dhaka" as TownId,
      destination: "sonargaon" as TownId,
      rules: [],
      status: "running" as const,
      phase: "docked" as const,
      direction: "outbound" as const,
      destinationPort: "sonargaon" as TownId,
      travelDaysRemaining: 0,
      travelDaysTotal: 0,
      capital: 500,
    };
    const docked = withSecondShip(ruined(0, 0), { automatedRoute: route, currentPort: "hooghly" });
    expect(getRecoveryOptions(docked)).toEqual(["route-capital"]);
    // The world only moves while sailing, so this ship would never come home.
    const atSea = withSecondShip(ruined(0, 0), {
      automatedRoute: { ...route, phase: "traveling", travelDaysRemaining: 3 },
      currentPort: "hooghly",
    });
    expect(isStranded(atSea)).toBe(true);
  });

  it("is nobody who can still earn from a visit contract", () => {
    const withContract = { ...createNewGame("Visit", 7), shipHull: 1, coins: 0, cargo: { ...NO_GOODS } };
    expect(getRecoveryOptions(syncSelectedShip(withContract))).toEqual(["visit-contract"]);
    expect(isStranded(syncSelectedShip({ ...withContract, shipHull: 0 }))).toBe(true);
  });

  it("is nobody in the middle of a voyage or an encounter", () => {
    expect(isStranded({ ...ruined(0, 0), encounterPending: true })).toBe(false);
    expect(takeRescueLoan({ ...ruined(0, 0), encounterPending: true }).error).toBe("unavailable");
  });
});

describe("the moneylender's advance", () => {
  it("gets a ship moving, with the debt recorded", () => {
    const { state, error } = takeRescueLoan({ ...ruined(0, 50), reputation: 5 });
    expect(error).toBeUndefined();
    expect(state.shipHull).toBe(2);
    expect(state.coins).toBe(RESCUE_PURSE);
    // (200 of repairs + 950 lent) with a quarter on top, up to the next 5 Coins.
    expect(state.debtOwed).toBe(1_440);
    expect(state.rescuesTaken).toBe(1);
    expect(state.reputation).toBe(3);
    expect(state.fleet[0].shipHull).toBe(2);
    expect(isStranded(state)).toBe(false);
  });

  it("doesn't touch a hull that can already sail", () => {
    const { state } = takeRescueLoan(ruined(5, 0));
    expect(state.shipHull).toBe(5);
    expect(state.debtOwed).toBe(1_250);
  });

  it("never takes reputation below zero", () => {
    expect(takeRescueLoan(ruined(0, 0)).state.reputation).toBe(0);
  });

  it("is refused to anyone who isn't stranded", () => {
    const fresh = createNewGame("Fine", 7);
    expect(takeRescueLoan(fresh).error).toBe("not-stranded");
    expect(applyCommand(fresh, { type: "takeRescueLoan" }, AT).status).toBe("rejected");
    expect(takeRescueLoan(ruined(0, 100)).error).toBe("not-stranded");
    expect(takeRescueLoan({ ...ruined(0, 0), cargo: { ...NO_GOODS, rice: 1 } }).error).toBe("not-stranded");
  });

  it("can't be taken twice in a row", () => {
    const once = takeRescueLoan(ruined(0, 0)).state;
    expect(takeRescueLoan(once).error).toBe("not-stranded");
  });

  it("always leaves the player worth less than before", () => {
    const before = ruined(0, 0);
    const after = takeRescueLoan(before).state;
    expect(estimateNetWorth(after)).toBeLessThan(estimateNetWorth(before));
  });

  it("loses money on every cycle of borrowing and repaying", () => {
    let state = ruined(0, 0);
    let worth = estimateNetWorth(state);
    let coinsReceived = 0;
    for (let cycle = 0; cycle < 25; cycle += 1) {
      const coinsBefore = state.coins;
      state = takeRescueLoan(state).state;
      coinsReceived += state.coins - coinsBefore;
      const nextWorth = estimateNetWorth(state);
      expect(nextWorth).toBeLessThan(worth);
      worth = nextWorth;
      // Handing the purse straight back makes the player eligible again, and only deepens the debt.
      state = repayDebt(state).state;
      expect(estimateNetWorth(state)).toBe(worth);
      expect(state.coins).toBe(0);
    }
    expect(state.debtOwed).toBeGreaterThan(coinsReceived * 0.25 - 1);
    expect(state.rescuesTaken).toBe(25);
  });

  it("can't be turned into ships, upgrades, property or route capital", () => {
    const rich = { ...takeRescueLoan(ruined(0, 0)).state, coins: 1_000_000, highestCoins: 1_000_000 };
    expect(buyUpgrade(rich, "hold").error).toBe("in-debt");
    expect(buyPlayerShip(rich, "bora").error).toBe("in-debt");
    expect(buyWarehouse(rich).error).toBe("in-debt");
    expect(buyFarm(rich).error).toBe("in-debt");
    expect(buyResidence(rich).error).toBe("in-debt");
    expect(marryAtResidence({ ...rich, residenceTown: rich.currentTown }).error).toBe("in-debt");
    const twoShips = {
      ...withSecondShip({ ...rich, debtOwed: 0 }, {}),
      debtOwed: rich.debtOwed,
      coins: 1_000_000,
      visitedTowns: ["dhaka", "sonargaon"] as TownId[],
    };
    const rules = [{ good: "rice" as GoodId, buyAtOrigin: true, sellAtDestination: true }];
    expect(
      configureAutomatedTradeRoute(twoShips, twoShips.fleet[1].id, "sonargaon", rules, 1_000).error,
    ).toBe("in-debt");
    // Everything that keeps a merchant trading still works.
    expect(
      configureAutomatedTradeRoute(twoShips, twoShips.fleet[1].id, "sonargaon", rules, 0).error,
    ).toBeUndefined();
    expect(repairShip({ ...rich, shipHull: 1 }).error).toBeUndefined();
  });

  it("frees those purchases again once repaid", () => {
    const owing = { ...takeRescueLoan(ruined(0, 0)).state, coins: 10_000 };
    const cleared = repayDebt(owing).state;
    expect(cleared.debtOwed).toBe(0);
    expect(cleared.coins).toBe(10_000 - owing.debtOwed);
    expect(buyUpgrade(cleared, "hold").error).toBeUndefined();
  });

  it("takes part payment, and refuses a repayment with nothing to pay", () => {
    const owing = takeRescueLoan(ruined(0, 0)).state;
    const part = repayDebt({ ...owing, coins: 300 }).state;
    expect(part.coins).toBe(0);
    expect(part.debtOwed).toBe(owing.debtOwed - 300);
    expect(repayDebt(part).error).toBe("coins");
    expect(repayDebt(createNewGame("Clear")).error).toBe("no-debt");
  });

  it("gives a merchant enough to trade their way out", () => {
    // Plays on from a rescue, always taking the best single route, with no help from contracts.
    let clock = AT;
    const send = (state: GameState, command: GameCommand) => {
      clock += 10;
      return applyCommand(state, command, clock).state;
    };
    const price = (state: GameState, port: TownId, good: GoodId, type: "buy" | "sell") =>
      getGoodPrice(port, good, type, false, state.marketStock[port][good]);
    let game = takeRescueLoan(ruined(0, 0)).state;
    let voyages = 0;
    for (; game.coins < game.debtOwed && voyages < 400; voyages += 1) {
      for (const { id } of GOODS) {
        if (game.cargo[id] > 0) game = send(game, { type: "sellGood", good: id, quantity: game.cargo[id] });
      }
      if (game.shipHull <= 1) game = send(game, { type: "repairShip" });
      const here = game.currentTown;
      let best: { port: TownId; good: GoodId; margin: number } = { port: "sonargaon", good: "rice", margin: -Infinity };
      for (const port of MARKET_PORTS) {
        if (port.id === here) continue;
        for (const { id } of GOODS) {
          const margin = price(game, port.id, id, "sell") - price(game, here, id, "buy");
          if (price(game, here, id, "buy") <= game.coins && margin > best.margin) {
            best = { port: port.id, good: id, margin };
          }
        }
      }
      for (let unit = 0; unit < 10; unit += 1) {
        const next = applyCommand(game, { type: "buyGood", good: best.good, quantity: 1 }, clock);
        if (next.status !== "applied") break;
        game = next.state;
      }
      game = send(game, { type: "selectDestination", town: best.port });
      game = send(game, { type: "startVoyage" });
      if (!game.voyage) throw new Error(`Could not sail: ${game.lastMessage}`);
      clock = Math.ceil(game.voyage.arrivalAt) + 10;
      game = send(game, { type: "arrive" });
      if (game.encounterPending) game = send(game, { type: "resolveEncounter" });
    }
    expect(game.coins).toBeGreaterThanOrEqual(game.debtOwed);
    expect(voyages).toBeLessThan(60);
    expect(repayDebt(game).state.debtOwed).toBe(0);
  });
});

describe("saving a debt", () => {
  it("gives older saves no debt, and keeps a debt across a reload", () => {
    const { debtOwed: _debt, rescuesTaken: _rescues, ...old } = createNewGame("Old");
    const migrated = validateSave(migrateLegacySave({ ...old, version: 23 }));
    expect(migrated.version).toBe(24);
    expect(migrated.debtOwed).toBe(0);
    expect(migrated.rescuesTaken).toBe(0);

    const owing = takeRescueLoan(
      syncSelectedShip({
        ...createNewGame("Owing", 7),
        shipHull: 0,
        coins: 0,
        cargo: { ...NO_GOODS },
        averagePurchasePrice: { ...NO_GOODS },
      }),
    ).state;
    expect(owing.debtOwed).toBeGreaterThan(0);
    expect(validateSave(JSON.parse(JSON.stringify(owing))).debtOwed).toBe(owing.debtOwed);
  });

  it("refuses a save with a debt that no rescue explains, or a negative one", () => {
    const fresh = createNewGame("Tampered");
    expect(() => validateSave({ ...fresh, debtOwed: 500 })).toThrow();
    expect(() => validateSave({ ...fresh, debtOwed: -1, rescuesTaken: 1 })).toThrow();
  });
});
