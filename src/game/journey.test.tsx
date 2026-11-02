import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import BengalMap from "../components/BengalMap";
import { applyCommand, type RecordedCommand } from "./commands";
import {
  advanceNpcWorld,
  buyPlayerShip,
  checkpointVoyageProgress,
  configureAutomatedTradeRoute,
  createNewGame,
  getShipReturnPlan,
  orderShipReturn,
  selectPlayerShip,
  startVoyage,
  syncSelectedShip,
  type GameState,
} from "./model";
import { getRouteStateAt } from "./navigation";
import { replayCommands } from "./replay";
import { isValidGameState, validateSave } from "./save-format";
import fixture from "./__fixtures__/save-v19.json";

const T0 = 1_800_000_000_000;

function loaded(): GameState {
  return { ...createNewGame("Maya"), gold: 4_000, highestGold: 4_000 };
}

// Dhaka to Sonargaon goes by boat, then by cart.
function toSonargaon(state = loaded()): GameState {
  return startVoyage({ ...state, selectedTown: "sonargaon" }, T0);
}

function timeWhen(state: GameState, mode: "water" | "land", transferring = false): number {
  const voyage = state.voyage!;
  for (let step = 0; step <= 400; step += 1) {
    const current = getRouteStateAt(voyage.route, step / 400);
    if (current.mode === mode && current.transferring === transferring) {
      return T0 + (voyage.durationMs * step) / 400;
    }
  }
  throw new Error("That stage isn't on this journey.");
}

describe("cargo and journey through a transfer", () => {
  it("passes through boat, transfer and cart stages", () => {
    const sailing = toSonargaon();
    expect(sailing.voyage!.route.legs.map((leg) => leg.mode)).toEqual(["water", "land"]);
    expect(timeWhen(sailing, "water")).toBeLessThan(timeWhen(sailing, "land", true));
    expect(timeWhen(sailing, "land", true)).toBeLessThan(timeWhen(sailing, "land"));
  });

  it("keeps cargo, cost, ownership and destination unchanged through every stage", () => {
    const start = applyCommand(loaded(), { type: "buyGood", good: "salt", quantity: 3 }, T0).state;
    const sailing = toSonargaon(start);
    for (const at of [timeWhen(sailing, "water"), timeWhen(sailing, "land", true), timeWhen(sailing, "land")]) {
      const during = checkpointVoyageProgress(sailing, at);
      expect(during.cargo).toEqual(start.cargo);
      expect(during.averagePurchasePrice).toEqual(start.averagePurchasePrice);
      expect(during.gold).toBe(start.gold);
      expect(during.selectedShipId).toBe(start.selectedShipId);
      expect(during.voyage!.destination).toBe("sonargaon");
      expect(during.fleet.map((ship) => ship.cargo)).toEqual(start.fleet.map((ship) => ship.cargo));
    }
    const arrived = applyCommand(sailing, { type: "arrive" }, Math.ceil(sailing.voyage!.arrivalAt)).state;
    expect(arrived.currentTown).toBe("sonargaon");
    expect(arrived.cargo).toEqual(start.cargo);
    expect(arrived.gold).toBe(start.gold);
  });

  it("refuses arriving during the cart stage, and trading mid-transfer", () => {
    const sailing = toSonargaon();
    const onLand = timeWhen(sailing, "land");
    expect(applyCommand(sailing, { type: "arrive" }, Math.floor(onLand)).error).toBe("voyage-not-finished");
    expect(applyCommand(sailing, { type: "sellGood", good: "rice", quantity: 1 }, Math.floor(timeWhen(sailing, "land", true))).error)
      .toBe("not-docked");
  });

  it("replays a journey with a transfer to the same result", () => {
    const base = { ...loaded(), selectedTown: "hooghly" as const };
    const commands: RecordedCommand[] = [
      { seq: 1, at: T0, command: { type: "selectDestination", town: "sonargaon" } },
      { seq: 2, at: T0, command: { type: "startVoyage" } },
    ];
    const sailing = applyCommand(applyCommand(base, commands[0].command, T0).state, commands[1].command, T0).state;
    const at = Math.ceil(sailing.voyage!.arrivalAt);
    commands.push({ seq: 3, at, command: { type: "arrive" } });
    const replay = replayCommands({ state: base, lastSeq: 0, lastAt: 0 }, commands, { receivedAt: at });
    expect(replay.status).toBe("accepted");
    if (replay.status === "accepted") expect(replay.state.currentTown).toBe("sonargaon");
  });
});

describe("the map shows the right vehicle", () => {
  function shown(state: GameState, now: number) {
    const map = render(<BengalMap state={state} now={now} onSelectTown={() => undefined} />);
    const result = {
      boats: map.container.querySelectorAll(".bengal-trading-vessel").length,
      moving: map.container.querySelectorAll(".vessel-under-sail").length,
      carts: map.container.querySelectorAll(".bengal-land-cart").length,
      roads: map.container.querySelectorAll(".route-leg-land").length,
      rivers: map.container.querySelectorAll(".route-leg-water").length,
      transferPoints: map.container.querySelectorAll(".route-transfer-point").length,
    };
    map.unmount();
    return result;
  }
  // NPCs start docked, so only the player's vehicle is on the move.
  it("draws a boat, then both during transfer, then a cart", () => {
    const sailing = toSonargaon();
    expect(shown(sailing, timeWhen(sailing, "water"))).toMatchObject({ moving: 1, carts: 0, roads: 1, rivers: 1, transferPoints: 1 });
    expect(shown(sailing, timeWhen(sailing, "land", true))).toMatchObject({ moving: 0, boats: 1, carts: 1 });
    expect(shown(sailing, timeWhen(sailing, "land"))).toMatchObject({ moving: 0, boats: 0, carts: 1 });
  });

  it("draws no road or cart on an all-water journey", () => {
    const sailing = startVoyage({ ...loaded(), selectedTown: "hooghly" }, T0);
    expect(shown(sailing, T0 + 5_000)).toMatchObject({ moving: 1, carts: 0, roads: 0, transferPoints: 0 });
  });

  it("previews a road before sailing", () => {
    expect(shown({ ...loaded(), selectedTown: "sonargaon" }, T0)).toMatchObject({ roads: 1, rivers: 1, carts: 0 });
  });
});

describe("other ships under the new network", () => {
  function withBoat(): GameState {
    return buyPlayerShip({ ...loaded(), visitedTowns: ["dhaka", "bakla-chandradwip"] }, "river-boat").state;
  }

  it("runs an automated route to a port with a cart road, keeping cargo bounded", () => {
    const routed = configureAutomatedTradeRoute(
      withBoat(),
      "player-ship-2",
      "bakla-chandradwip",
      [{ good: "rice", buyAtOrigin: true, sellAtDestination: true }],
      500,
    );
    expect(routed.error).toBeUndefined();
    let state = routed.state;
    const reached = new Set<string>();
    for (let day = 1; day <= 40; day += 1) {
      state = advanceNpcWorld({ ...state, sailingDay: day }, day);
      const ship = state.fleet[1];
      reached.add(ship.currentPort);
      expect(ship.cargo.rice).toBeLessThanOrEqual(ship.cargoCapacity);
      expect(ship.automatedRoute!.capital).toBeGreaterThanOrEqual(0);
      expect(isValidGameState(syncSelectedShip(state)), `day ${day}`).toBe(true);
    }
    expect(reached).toEqual(new Set(["dhaka", "bakla-chandradwip"]));
  });

  it("refuses a Patello route to a barred port, even though a cart road exists there", () => {
    const state = buyPlayerShip(
      { ...loaded(), visitedTowns: ["dhaka", "balasore", "sylhet"] },
      "patello",
    ).state;
    for (const port of ["balasore", "sylhet"] as const) {
      expect(
        configureAutomatedTradeRoute(state, "player-ship-2", port, [{ good: "rice", buyAtOrigin: true, sellAtDestination: true }], 100).error,
      ).toBe("too-large");
    }
  });

  it("brings a stranded ship back by a valid route", () => {
    const patello = selectPlayerShip(buyPlayerShip(loaded(), "patello").state, "player-ship-2").state;
    const stranded = {
      ...patello,
      fleet: patello.fleet.map((ship) => (ship.id === "player-ship-1" ? { ...ship, currentPort: "balasore" as const } : ship)),
    };
    const plan = getShipReturnPlan(stranded, "player-ship-1");
    expect(plan?.destination).toBe("dhaka");
    let state = orderShipReturn(stranded, "player-ship-1").state;
    const cargo = state.fleet[0].cargo;
    for (let day = 1; day <= plan!.days; day += 1) state = advanceNpcWorld({ ...state, sailingDay: day }, day);
    expect(state.fleet[0].currentPort).toBe("dhaka");
    expect(state.fleet[0].cargo).toEqual(cargo);
    expect(state.fleet[0].returnOrder).toBeNull();
  });
});

describe("existing saves", () => {
  it("moves a version 19 voyage onto the new network, keeping its progress and cargo", () => {
    const saved = fixture as unknown as GameState;
    const game = validateSave(fixture, T0);
    expect(game.version).toBe(20);
    expect(isValidGameState(game)).toBe(true);
    expect(game.cargo).toEqual(saved.cargo);
    expect(game.gold).toBe(saved.gold);
    expect(game.fleet.map((ship) => ship.id)).toEqual(saved.fleet.map((ship) => ship.id));
    expect(game.fleet.map((ship) => ship.cargo)).toEqual(saved.fleet.map((ship) => ship.cargo));
    expect(game.voyage!.route.points).not.toEqual(saved.voyage!.route.points);
    expect(game.voyage!.elapsedMs / game.voyage!.durationMs).toBeCloseTo(
      saved.voyage!.elapsedMs / saved.voyage!.durationMs,
    );
    // Keeps going to the same place, under the same rules, with no extra closed-app time.
    const arrived = applyCommand(game, { type: "arrive" }, Math.ceil(game.voyage!.arrivalAt));
    expect(arrived.state.currentTown).toBe("sonargaon");
    expect(applyCommand(game, { type: "arrive" }, T0 + 1).error).toBe("voyage-not-finished");
  });

  it("keeps a traveling merchant and automated ship valid after migrating", () => {
    let state = configureAutomatedTradeRoute(
      buyPlayerShip({ ...loaded(), visitedTowns: ["dhaka", "sonargaon"] }, "river-boat").state,
      "player-ship-2",
      "sonargaon",
      [{ good: "rice", buyAtOrigin: true, sellAtDestination: true }],
      300,
    ).state;
    for (let day = 1; day <= 3; day += 1) state = advanceNpcWorld({ ...state, sailingDay: day }, day);
    const asOld = {
      ...state,
      version: 19,
      npcMerchants: state.npcMerchants.map((merchant) =>
        merchant.phase === "traveling"
          ? { ...merchant, travelDaysTotal: 99, travelDaysRemaining: 50 }
          : merchant,
      ),
    };
    const migrated = validateSave(asOld, T0);
    expect(migrated.version).toBe(20);
    for (const merchant of migrated.npcMerchants) {
      if (merchant.phase === "traveling") {
        expect(merchant.travelDaysRemaining).toBeLessThanOrEqual(merchant.travelDaysTotal);
        expect(merchant.travelDaysTotal).toBeLessThan(10);
      }
    }
  });

  it("drops closures naming channels that no longer exist", () => {
    const old = { ...loaded(), version: 19, navigationConditions: { eventBlockages: ["upper-river"] } };
    expect(validateSave(old, T0).navigationConditions.eventBlockages).toEqual([]);
  });

  it("rejects an active voyage whose route was tampered with", () => {
    const sailing = toSonargaon();
    const tampered = {
      ...sailing,
      voyage: { ...sailing.voyage!, route: { ...sailing.voyage!.route, legs: [] } },
    };
    expect(isValidGameState(tampered)).toBe(false);
  });
});
