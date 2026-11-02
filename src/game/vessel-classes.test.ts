import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GOODS,
  MARKET_MAX_STOCK,
  MARKET_PORTS,
  MAX_AUTOMATED_ROUTE_CAPITAL,
  SHIPYARD_PORTS,
  VESSEL_CLASSES,
  VESSEL_CLASS_IDS,
  advanceNpcWorld,
  arriveAtDestination,
  buyPlayerShip,
  buyUpgrade,
  cancelAutomatedTradeRoute,
  checkpointVoyageProgress,
  configureAutomatedTradeRoute,
  createNewGame,
  getCargoCapacity,
  getGoodPrice,
  getShipMaximumHull,
  getShipReturnPlan,
  getShipRouteConditions,
  getShipRoutePreview,
  getVesselCargoCapacity,
  getVesselMaximumHull,
  isShipOutOfReach,
  orderShipReturn,
  repairShip,
  selectPlayerShip,
  startVoyage,
  syncSelectedShip,
  type GameState,
  type PlayerShip,
  type TownId,
  type VesselClassId,
} from "./model";
import {
  RIVER_EDGES, planRiverRoute } from "./navigation";
import { loadGame, saveGame } from "./storage";
import {
  MAX_NORMAL_VOYAGE_DURATION_MS,
  getRouteTravelTime,
} from "./travel-time";

const RICH: Partial<GameState> = {
  gold: 4_000,
  highestGold: 4_000,
  visitedTowns: ["dhaka", "sonargaon", "sylhet"],
};

function withShip(vesselClass: VesselClassId): GameState {
  return buyPlayerShip({ ...createNewGame("Maya"), ...RICH }, vesselClass).state;
}

function sailing(vesselClass: VesselClassId): GameState {
  return selectPlayerShip(withShip(vesselClass), "player-ship-2").state;
}

function updateShip(
  state: GameState,
  shipId: string,
  change: Partial<PlayerShip>,
): GameState {
  return {
    ...state,
    fleet: state.fleet.map((ship) =>
      ship.id === shipId ? { ...ship, ...change } : ship,
    ),
  };
}

function writeRawSave(value: unknown): Promise<void> {
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

describe("vessel classes", () => {
  it("defines the approved class stats", () => {
    const rows = VESSEL_CLASS_IDS.map((id) => {
      const vessel = VESSEL_CLASSES[id];
      return [
        vessel.price,
        vessel.baseHold,
        vessel.baseHull,
        vessel.repairCostPerHull,
        vessel.travelFactor,
        vessel.draft,
      ];
    });
    expect(rows).toEqual([
      [500, 12, 8, 2, 1, 1.4],
      [350, 8, 6, 2, 0.8, 1.2],
      [900, 30, 14, 3, 1.25, 1.5],
    ]);
    const fullyUpgraded = { cannon: 3, hull: 2, hold: 3 };
    expect(VESSEL_CLASS_IDS.map((id) => getVesselCargoCapacity(id, fullyUpgraded)))
      .toEqual([30, 17, 48]);
    expect(VESSEL_CLASS_IDS.map((id) => getVesselMaximumHull(id, fullyUpgraded)))
      .toEqual([14, 12, 20]);
  });

  it("starts new games with an unchanged River boat", () => {
    const game = createNewGame("Maya");
    expect(game.version).toBe(20);
    expect(game.fleet[0].vesselClass).toBe("river-boat");
    expect(getCargoCapacity(game)).toBe(12);
    expect(getShipMaximumHull(game)).toBe(8);
  });

  it.each<[VesselClassId, string, number, number]>([
    ["river-boat", "River Trader II", 12, 8],
    ["bora", "Bora II", 8, 6],
    ["patello", "Patello II", 30, 14],
  ])("buys a %s at each shipyard", (vesselClass, name, hold, hull) => {
    for (const port of SHIPYARD_PORTS) {
      const start = {
        ...createNewGame("Maya"),
        ...RICH,
        currentTown: port,
        selectedTown: port,
      };
      const bought = buyPlayerShip(syncSelectedShip(start), vesselClass);
      expect(bought.error).toBeUndefined();
      const ship = bought.state.fleet[1];
      expect(ship).toMatchObject({
        name,
        vesselClass,
        currentPort: port,
        cargoCapacity: hold,
        shipHull: hull,
      });
      expect(bought.state.gold).toBe(4_000 - VESSEL_CLASSES[vesselClass].price);
    }
  });

  it("refuses a class the player cannot afford or a port without a shipyard", () => {
    const poor = { ...createNewGame("Maya"), gold: 400, highestGold: 400 };
    expect(buyPlayerShip(poor, "bora").error).toBeUndefined();
    expect(buyPlayerShip(poor, "river-boat").error).toBe("gold");
    expect(buyPlayerShip(poor, "patello").error).toBe("gold");
    expect(
      buyPlayerShip(
        syncSelectedShip({ ...createNewGame("Maya"), ...RICH, currentTown: "sylhet" }),
        "patello",
      ).error,
    ).toBe("not-shipyard");
  });

  it("applies class upgrade steps and repair rates", () => {
    const bora = sailing("bora");
    const upgradedBora = buyUpgrade(bora, "hold").state;
    expect(getCargoCapacity(upgradedBora)).toBe(11);
    expect(upgradedBora.fleet[1].cargoCapacity).toBe(11);

    const patello = sailing("patello");
    const upgradedPatello = buyUpgrade(patello, "hold").state;
    expect(getCargoCapacity(upgradedPatello)).toBe(36);
    expect(getShipMaximumHull(buyUpgrade(patello, "hull").state)).toBe(17);

    const damaged = { ...patello, shipHull: 10 };
    expect(repairShip(damaged).state.gold).toBe(damaged.gold - 12);
    const damagedBora = { ...bora, shipHull: 4 };
    expect(repairShip(damagedBora).state.gold).toBe(damagedBora.gold - 4);
  });
});

describe("draft and port access", () => {
  const ports = MARKET_PORTS.map((port) => port.id as TownId);
  const reachableFrom = (origin: TownId, vesselClass: VesselClassId) =>
    ports.filter(
      (port) =>
        port === origin ||
        planRiverRoute(origin, port, getShipRouteConditions({}, vesselClass)),
    );

  it("keeps every class on one connected network containing every shipyard", () => {
    for (const vesselClass of VESSEL_CLASS_IDS) {
      const network = reachableFrom("dhaka", vesselClass);
      for (const shipyard of SHIPYARD_PORTS) {
        expect(network).toContain(shipyard);
      }
      for (const port of network) {
        expect(reachableFrom(port, vesselClass).sort()).toEqual([...network].sort());
      }
    }
  });

  it("gives River boats and Boras all 15 ports and Patellos 13", () => {
    expect(reachableFrom("dhaka", "river-boat")).toHaveLength(15);
    expect(reachableFrom("dhaka", "bora")).toHaveLength(15);
    const patello = reachableFrom("dhaka", "patello");
    expect(patello).toHaveLength(13);
    expect(patello).not.toContain("sylhet");
    expect(patello).not.toContain("balasore");
    expect(patello).toContain("chittagong");
    expect(patello).toContain("sandwip");
  });

  it("keeps River boat routes identical to the undrafted network", () => {
    for (const origin of ports) {
      for (const destination of ports) {
        if (origin === destination) continue;
        expect(
          planRiverRoute(origin, destination, getShipRouteConditions({}, "river-boat"))
            ?.edgeIds,
        ).toEqual(planRiverRoute(origin, destination)?.edgeIds);
      }
    }
  });

  it("explains a blocked Patello voyage and starts nothing", () => {
    const patello = { ...sailing("patello"), selectedTown: "sylhet" as const };
    expect(getShipRoutePreview(patello, "sylhet")).toMatchObject({
      route: null,
      travelTime: null,
      tooLarge: true,
    });
    const refused = startVoyage(patello, 1_000);
    expect(refused.voyage).toBeNull();
    expect(refused.voyagesStarted).toBe(patello.voyagesStarted);
    expect(refused.lastMessage).toMatch(/too large for the narrow channels to Sylhet/);
  });

  it("previews and sails the longer Patello route", () => {
    const patello = syncSelectedShip({
      ...sailing("patello"),
      selectedTown: "malda",
    });
    const preview = getShipRoutePreview(patello, "malda");
    const direct = planRiverRoute("dhaka", "malda")!;
    expect(preview.route!.distance).toBeGreaterThan(direct.distance);
    expect(preview.standardTravelTime!.durationDays).toBeLessThan(
      preview.travelTime!.durationDays,
    );
    const voyage = startVoyage(patello, 1_000).voyage!;
    expect(voyage.route.edgeIds).toEqual(preview.route!.edgeIds);
    expect(voyage.durationMs).toBe(preview.travelTime!.durationMs);

    const river = { ...createNewGame("Maya"), selectedTown: "malda" as const };
    expect(getShipRoutePreview(river, "malda").standardTravelTime).toBeNull();
  });

  it("applies class travel time, the Chittagong alert and the five-minute cap", () => {
    // Dhaka to Hooghly is all water, so the whole journey scales with the vessel.
    const route = planRiverRoute("dhaka", "hooghly")!;
    expect(route.legs.map((leg) => leg.mode)).toEqual(["water"]);
    const base = getRouteTravelTime(route).durationMs;
    expect(startVoyage({ ...sailing("bora"), selectedTown: "hooghly" }, 1_000).voyage!.durationMs)
      .toBeCloseTo(base * 0.8);
    expect(startVoyage({ ...sailing("patello"), selectedTown: "hooghly" }, 1_000).voyage!.durationMs)
      .toBeCloseTo(base * 1.25);
    expect(startVoyage({ ...withShip("bora"), selectedTown: "hooghly" }, 1_000).voyage!.durationMs)
      .toBe(base);

    const chittagong = planRiverRoute("dhaka", "chittagong")!;
    expect(
      startVoyage({ ...sailing("patello"), selectedTown: "chittagong" }, 1_000).voyage!
        .durationMs,
    ).toBe(getRouteTravelTime(chittagong, true, 1.25).durationMs);

    let longest = 0;
    for (const origin of ports) {
      for (const destination of ports) {
        const longRoute =
          origin !== destination
            ? planRiverRoute(origin, destination, getShipRouteConditions({}, "patello"))
            : null;
        if (longRoute) {
          longest = Math.max(
            longest,
            getRouteTravelTime(longRoute, false, 1.25).durationMs,
          );
        }
      }
    }
    expect(longest).toBe(MAX_NORMAL_VOYAGE_DURATION_MS);
  });

  it("credits the class's in-game days on arrival", () => {
    const voyage = startVoyage({ ...sailing("patello"), selectedTown: "sonargaon" }, 1_000);
    const arrived = arriveAtDestination(voyage);
    expect(arrived.sailingDay).toBe(voyage.voyage!.durationDays);
    expect(arrived.currentTown).toBe("sonargaon");
    expect(arrived.fleet[1].currentPort).toBe("sonargaon");
  });
});

describe("automated routes by class", () => {
  const riceRule = [{ good: "rice" as const, buyAtOrigin: true, sellAtDestination: true }];
  const shipId = "player-ship-2";

  // Keeps NPC merchants away so stock changes come only from the ship under test.
  function withoutNpcTrade(state: GameState): GameState {
    return {
      ...state,
      npcMerchants: state.npcMerchants.map((merchant) => ({
        ...merchant,
        phase: "traveling" as const,
        travelDaysRemaining: 999,
        travelDaysTotal: 999,
      })),
    };
  }

  function assign(vesselClass: VesselClassId, capital: number): GameState {
    return withoutNpcTrade(
      configureAutomatedTradeRoute(
        withShip(vesselClass),
        shipId,
        "sonargaon",
        riceRule,
        capital,
      ).state,
    );
  }

  it("refuses a route the ship is too large for", () => {
    const result = configureAutomatedTradeRoute(
      withShip("patello"),
      shipId,
      "sylhet",
      riceRule,
      100,
    );
    expect(result.error).toBe("too-large");
    expect(result.state.gold).toBe(withShip("patello").gold);
    expect(
      configureAutomatedTradeRoute(withShip("river-boat"), shipId, "sylhet", riceRule, 100)
        .error,
    ).toBeUndefined();
  });

  it("keeps River boats and Boras at one unit per good", () => {
    for (const vesselClass of ["river-boat", "bora"] as const) {
      const assigned = assign(vesselClass, 500);
      const next = advanceNpcWorld(assigned, 1);
      expect(next.fleet[1].cargo.rice).toBe(1);
      expect(next.marketStock.dhaka.rice).toBe(assigned.marketStock.dhaka.rice - 1);
    }
  });

  it("lets a Patello trade up to four units per good, repricing each one", () => {
    const assigned = assign("patello", 1_000);
    let stock = assigned.marketStock.dhaka.rice;
    let expectedCost = 0;
    for (let unit = 0; unit < 4; unit += 1) {
      expectedCost += getGoodPrice("dhaka", "rice", "buy", true, stock);
      stock -= 1;
    }
    const bought = advanceNpcWorld(assigned, 1);
    const ship = bought.fleet[1];
    expect(ship.cargo.rice).toBe(4);
    expect(bought.marketStock.dhaka.rice).toBe(stock);
    expect(ship.automatedRoute!.capital).toBe(1_000 - expectedCost);
    expect(ship.averagePurchasePrice.rice).toBeCloseTo(expectedCost / 4);
    expect(ship.automationLog.at(-2)!.message).toBe(
      `Bought 4 Rice for ${expectedCost} gold.`,
    );

    let current = bought;
    for (let day = 2; day <= 8 && current.fleet[1].cargo.rice === 4; day += 1) {
      current = advanceNpcWorld(current, day);
    }
    expect(current.fleet[1].cargo.rice).toBe(0);
  });

  it("stops Patello trading at capital, stock, hold and market limits", () => {
    const assigned = assign("patello", 1_000);

    const priceOne = getGoodPrice("dhaka", "rice", "buy", true, assigned.marketStock.dhaka.rice);
    const lowCapital = updateShip(assigned, shipId, {
      automatedRoute: { ...assigned.fleet[1].automatedRoute!, capital: priceOne },
    });
    const capitalLimited = advanceNpcWorld(lowCapital, 1).fleet[1];
    expect(capitalLimited.cargo.rice).toBe(1);
    expect(capitalLimited.automatedRoute!.capital).toBe(0);

    const lowStock = {
      ...assigned,
      marketStock: {
        ...assigned.marketStock,
        dhaka: { ...assigned.marketStock.dhaka, rice: 2 },
      },
    };
    const stockLimited = advanceNpcWorld(lowStock, 1);
    expect(stockLimited.fleet[1].cargo.rice).toBe(2);
    expect(stockLimited.marketStock.dhaka.rice).toBe(0);

    const nearlyFull = updateShip(assigned, shipId, {
      cargo: { ...assigned.fleet[1].cargo, salt: 29 },
      averagePurchasePrice: { ...assigned.fleet[1].averagePurchasePrice, salt: 10 },
    });
    const holdLimited = advanceNpcWorld(nearlyFull, 1).fleet[1];
    expect(holdLimited.cargo.rice).toBe(1);

    const atDestination = {
      ...updateShip(assigned, shipId, {
        currentPort: "sonargaon",
        cargo: { ...assigned.fleet[1].cargo, rice: 10 },
        averagePurchasePrice: { ...assigned.fleet[1].averagePurchasePrice, rice: 10 },
        automatedRoute: {
          ...assigned.fleet[1].automatedRoute!,
          destinationPort: "dhaka",
          capital: MAX_AUTOMATED_ROUTE_CAPITAL - 1,
        },
      }),
    };
    const capped = advanceNpcWorld(atDestination, 1).fleet[1];
    expect(capped.cargo.rice).toBe(10);
    expect(capped.automatedRoute!.capital).toBeLessThanOrEqual(MAX_AUTOMATED_ROUTE_CAPITAL);

    const fullStall = {
      ...updateShip(atDestination, shipId, {
        automatedRoute: { ...atDestination.fleet[1].automatedRoute!, capital: 0 },
      }),
    };
    const nearlyFullStall = {
      ...fullStall,
      marketStock: {
        ...fullStall.marketStock,
        sonargaon: { ...fullStall.marketStock.sonargaon, rice: MARKET_MAX_STOCK - 2 },
      },
    };
    const sold = advanceNpcWorld(nearlyFullStall, 1);
    expect(sold.fleet[1].cargo.rice).toBe(8);
    expect(sold.marketStock.sonargaon.rice).toBe(MARKET_MAX_STOCK);
  });

  it("creates no goods or money over a long Patello run", () => {
    const assigned = configureAutomatedTradeRoute(
      withShip("patello"),
      shipId,
      "sonargaon",
      GOODS.map((good) => ({ good: good.id, buyAtOrigin: true, sellAtDestination: true })),
      3_000,
    ).state;
    let current = assigned;
    for (let day = 1; day <= 200; day += 1) {
      current = advanceNpcWorld(current, day);
      const ship = current.fleet[1];
      const cargo = GOODS.reduce((total, good) => total + ship.cargo[good.id], 0);
      expect(cargo).toBeLessThanOrEqual(ship.cargoCapacity);
      expect(ship.automatedRoute!.capital).toBeGreaterThanOrEqual(0);
      expect(ship.automatedRoute!.capital).toBeLessThanOrEqual(MAX_AUTOMATED_ROUTE_CAPITAL);
      for (const port of MARKET_PORTS) {
        for (const good of GOODS) {
          const stock = current.marketStock[port.id][good.id];
          expect(stock).toBeGreaterThanOrEqual(0);
          expect(stock).toBeLessThanOrEqual(MARKET_MAX_STOCK);
        }
      }
    }
    expect(current.gold).toBe(assigned.gold);
  });

  it("uses class travel days for automated voyages", () => {
    const route = planRiverRoute("dhaka", "sylhet")!;
    const assigned = configureAutomatedTradeRoute(
      withShip("bora"),
      shipId,
      "sylhet",
      riceRule,
      100,
    ).state;
    expect(advanceNpcWorld(assigned, 1).fleet[1].automatedRoute!.travelDaysTotal).toBe(
      Math.ceil(getRouteTravelTime(route, false, 0.8).durationDays),
    );
  });

  it("makes an incompatible saved route wait safely without trading", () => {
    const assigned = assign("patello", 500);
    const incompatible = updateShip(assigned, shipId, {
      automatedRoute: {
        ...assigned.fleet[1].automatedRoute!,
        destination: "sylhet",
        destinationPort: "sylhet",
      },
    });
    let current = incompatible;
    for (let day = 1; day <= 5; day += 1) current = advanceNpcWorld(current, day);
    const ship = current.fleet[1];
    expect(ship.currentPort).toBe("dhaka");
    expect(ship.automatedRoute!.phase).toBe("docked");
    expect(ship.automatedRoute!.capital).toBe(500);
    expect(ship.cargo.rice).toBe(0);
    expect(ship.automationLog.map((entry) => entry.message)).toEqual([
      "Too large for the channels to Sylhet; waiting at port.",
    ]);

    const cancelled = cancelAutomatedTradeRoute(current, shipId);
    expect(cancelled.error).toBeUndefined();
    expect(cancelled.state.gold).toBe(incompatible.gold + 500);
  });
});

describe("return orders", () => {
  function strandedRiverBoat(): GameState {
    const patello = sailing("patello");
    return updateShip(patello, "player-ship-1", {
      currentPort: "sylhet",
      cargo: { ...patello.fleet[0].cargo, salt: 2 },
      averagePurchasePrice: { ...patello.fleet[0].averagePurchasePrice, salt: 12 },
    });
  }

  it("is only offered for a ship the selected ship cannot reach", () => {
    expect(isShipOutOfReach(strandedRiverBoat(), "player-ship-1")).toBe(true);
    expect(getShipReturnPlan(strandedRiverBoat(), "player-ship-1")).toMatchObject({
      destination: "dhaka",
    });

    const reachable = updateShip(sailing("patello"), "player-ship-1", {
      currentPort: "sonargaon",
    });
    expect(isShipOutOfReach(reachable, "player-ship-1")).toBe(false);
    expect(orderShipReturn(reachable, "player-ship-1").error).toBe("not-needed");

    const riverSelected = updateShip(withShip("bora"), "player-ship-2", {
      currentPort: "sylhet",
    });
    expect(isShipOutOfReach(riverSelected, "player-ship-2")).toBe(false);
    expect(orderShipReturn(strandedRiverBoat(), "player-ship-2").error).toBe("not-needed");
    expect(orderShipReturn(strandedRiverBoat(), "missing").error).toBe("not-owned");
    expect(
      orderShipReturn({ ...strandedRiverBoat(), encounterPending: true }, "player-ship-1").error,
    ).toBe("unavailable");
  });

  it("brings a stranded ship back with its cargo, then lets the player switch to it", () => {
    const stranded = strandedRiverBoat();
    const plan = getShipReturnPlan(stranded, "player-ship-1")!;
    const ordered = orderShipReturn(stranded, "player-ship-1");
    expect(ordered.error).toBeUndefined();
    expect(ordered.state.gold).toBe(stranded.gold);
    expect(ordered.state.fleet[0].returnOrder).toEqual({
      destination: "dhaka",
      travelDaysRemaining: plan.days,
      travelDaysTotal: plan.days,
    });

    expect(orderShipReturn(ordered.state, "player-ship-1").error).toBe("not-needed");
    expect(selectPlayerShip(ordered.state, "player-ship-1").error).toBe("returning");
    expect(
      configureAutomatedTradeRoute(
        ordered.state,
        "player-ship-1",
        "dhaka",
        [{ good: "rice", buyAtOrigin: true, sellAtDestination: true }],
        10,
      ).error,
    ).toBe("not-docked");

    const midway = advanceNpcWorld(ordered.state, plan.days - 1);
    expect(midway.fleet[0].currentPort).toBe("sylhet");
    const arrived = advanceNpcWorld(midway, plan.days);
    const ship = arrived.fleet[0];
    expect(ship.currentPort).toBe("dhaka");
    expect(ship.returnOrder).toBeNull();
    expect(ship.cargo.salt).toBe(2);
    expect(ship.averagePurchasePrice.salt).toBe(12);
    expect(ship.automationLog.at(-1)!.message).toBe("Returned to Dhaka.");

    const switched = selectPlayerShip(arrived, "player-ship-1");
    expect(switched.error).toBeUndefined();
    expect(switched.state.selectedShipId).toBe("player-ship-1");
  });

  it("heads for the selected ship's destination while it is sailing", () => {
    const voyage = startVoyage(
      { ...strandedRiverBoat(), selectedTown: "sonargaon" },
      1_000,
    );
    expect(getShipReturnPlan(voyage, "player-ship-1")!.destination).toBe("sonargaon");
    expect(orderShipReturn(voyage, "player-ship-1").error).toBeUndefined();
  });

  it("recovers an automated ship stranded after its route is cancelled", () => {
    const stranded = updateShip(strandedRiverBoat(), "player-ship-1", {
      automatedRoute: {
        origin: "sylhet",
        destination: "dhaka",
        rules: [{ good: "rice", buyAtOrigin: true, sellAtDestination: true }],
        status: "paused",
        phase: "docked",
        direction: "outbound",
        destinationPort: "dhaka",
        travelDaysRemaining: 0,
        travelDaysTotal: 0,
        capital: 50,
      },
    });
    expect(isShipOutOfReach(stranded, "player-ship-1")).toBe(false);
    const cancelled = cancelAutomatedTradeRoute(stranded, "player-ship-1").state;
    expect(isShipOutOfReach(cancelled, "player-ship-1")).toBe(true);
    expect(orderShipReturn(cancelled, "player-ship-1").error).toBeUndefined();
  });

  it("waits, without stranding, while a closure blocks the return", () => {
    const closed = {
      ...strandedRiverBoat(),
      navigationConditions: {
        eventBlockages: RIVER_EDGES.filter((edge) => edge.from === "sylhet" || edge.to === "sylhet").map((edge) => edge.id),
      },
    };
    expect(isShipOutOfReach(closed, "player-ship-1")).toBe(true);
    expect(getShipReturnPlan(closed, "player-ship-1")).toBeNull();
    expect(orderShipReturn(closed, "player-ship-1").error).toBe("no-route");
    const reopened = { ...closed, navigationConditions: {} };
    expect(orderShipReturn(reopened, "player-ship-1").error).toBeUndefined();
  });
});

describe("version 19 saves", () => {
  beforeEach(() => {
    indexedDB.deleteDatabase("bengal-trader");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function asVersion18(state: GameState): unknown {
    return {
      ...state,
      version: 18,
      fleet: state.fleet.map(
        ({ vesselClass: _vesselClass, returnOrder: _returnOrder, ...ship }) => ship,
      ),
    };
  }

  it("migrates version 18 ships, routes and voyages without changing them", async () => {
    const start = buyPlayerShip(
      buyPlayerShip({ ...createNewGame("Maya"), ...RICH }).state,
    ).state;
    const upgraded = buyUpgrade(buyUpgrade(start, "hold").state, "hull").state;
    const damaged = { ...upgraded, shipHull: 5 };
    const routed = configureAutomatedTradeRoute(
      syncSelectedShip(damaged),
      "player-ship-2",
      "sonargaon",
      [{ good: "lac", buyAtOrigin: true, sellAtDestination: false },
        { good: "rice", buyAtOrigin: false, sellAtDestination: true }],
      300,
    ).state;
    const midRoute = advanceNpcWorld({ ...routed, sailingDay: 1 }, 1);
    const voyage = checkpointVoyageProgress(
      startVoyage({ ...midRoute, selectedTown: "sylhet" }, 1_000),
      31_000,
    );
    expect(voyage.fleet[1].automatedRoute!.phase).toBe("traveling");
    await writeRawSave(asVersion18(voyage));

    vi.spyOn(Date, "now").mockReturnValue(9_000_000_000);
    const restored = (await loadGame())!;
    expect(restored.version).toBe(20);
    expect(restored.gold).toBe(voyage.gold);
    expect(restored.highestGold).toBe(voyage.highestGold);
    restored.fleet.forEach((ship, index) => {
      expect(ship).toEqual({
        ...voyage.fleet[index],
        vesselClass: "river-boat",
        returnOrder: null,
      });
    });
    expect(restored.voyage!.elapsedMs).toBe(voyage.voyage!.elapsedMs);
    expect(restored.voyage!.durationMs).toBe(voyage.voyage!.durationMs);
    expect(restored.voyage!.route).toEqual(voyage.voyage!.route);
    expect(restored.npcSimulationDay).toBe(voyage.npcSimulationDay);
    expect(restored.marketStock).toEqual(voyage.marketStock);

    const arrived = arriveAtDestination(restored);
    expect(arrived.currentTown).toBe("sylhet");
  });

  it("saves and reloads class ships at their class limits", async () => {
    const patello = sailing("patello");
    const loaded = {
      ...patello,
      cargo: { ...patello.cargo, rice: 30 },
      averagePurchasePrice: { ...patello.averagePurchasePrice, rice: 9 },
    };
    await saveGame(loaded);
    const restored = (await loadGame())!;
    expect(restored.fleet[1].vesselClass).toBe("patello");
    expect(restored.cargo.rice).toBe(30);
    expect(getCargoCapacity(restored)).toBe(30);

    await saveGame({ ...sailing("bora"), shipHull: 6 });
    expect((await loadGame())!.fleet[1].vesselClass).toBe("bora");
  });

  it("reloads a Patello voyage with its class timing and no closed-app progress", async () => {
    const voyage = startVoyage({ ...sailing("patello"), selectedTown: "sonargaon" }, 1_000);
    await saveGame(voyage);
    vi.spyOn(Date, "now").mockReturnValue(9_000_000_000);
    const restored = (await loadGame())!;
    expect(restored.voyage!.durationMs).toBe(voyage.voyage!.durationMs);
    expect(restored.voyage!.elapsedMs).toBe(0);
  });

  it("reloads a return order and an incompatible route rather than rejecting them", async () => {
    const patello = sailing("patello");
    const ordered = orderShipReturn(
      updateShip(patello, "player-ship-1", { currentPort: "sylhet" }),
      "player-ship-1",
    ).state;
    await saveGame(ordered);
    expect((await loadGame())!.fleet[0].returnOrder).toEqual(ordered.fleet[0].returnOrder);

    const unselected = configureAutomatedTradeRoute(
      withShip("patello"),
      "player-ship-2",
      "sonargaon",
      [{ good: "rice", buyAtOrigin: true, sellAtDestination: true }],
      100,
    ).state;
    const incompatible = updateShip(unselected, "player-ship-2", {
      automatedRoute: {
        ...unselected.fleet[1].automatedRoute!,
        destination: "sylhet",
        destinationPort: "sylhet",
      },
    });
    await saveGame(incompatible);
    expect((await loadGame())!.fleet[1].automatedRoute!.destination).toBe("sylhet");
  });

  it.each<[string, (state: GameState) => GameState]>([
    ["an unknown class", (state) =>
      updateShip(state, "player-ship-2", {
        vesselClass: "galleon" as VesselClassId,
      })],
    ["a capacity that does not match the class", (state) =>
      updateShip(state, "player-ship-2", { cargoCapacity: 12 })],
    ["hull above the class maximum", (state) =>
      updateShip(state, "player-ship-2", { shipHull: 15 })],
    ["a return order on the selected ship", (state) => ({
      ...state,
      selectedShipId: "player-ship-2",
      shipHull: 14,
      fleet: state.fleet.map((ship) =>
        ship.id === "player-ship-2"
          ? {
              ...ship,
              returnOrder: {
                destination: "sonargaon" as const,
                travelDaysRemaining: 1,
                travelDaysTotal: 1,
              },
            }
          : ship,
      ),
    })],
    ["a return order with invalid days", (state) =>
      updateShip(state, "player-ship-2", {
        returnOrder: {
          destination: "sonargaon",
          travelDaysRemaining: 5,
          travelDaysTotal: 2,
        },
      })],
    ["a return order on an automated ship", (state) =>
      updateShip(state, "player-ship-2", {
        returnOrder: {
          destination: "sonargaon",
          travelDaysRemaining: 1,
          travelDaysTotal: 1,
        },
        automatedRoute: {
          origin: "dhaka",
          destination: "sonargaon",
          rules: [{ good: "rice", buyAtOrigin: true, sellAtDestination: true }],
          status: "running",
          phase: "docked",
          direction: "outbound",
          destinationPort: "sonargaon",
          travelDaysRemaining: 0,
          travelDaysTotal: 0,
          capital: 0,
        },
      })],
  ])("rejects %s", async (_label, corrupt) => {
    await writeRawSave(corrupt(withShip("patello")));
    await expect(loadGame()).rejects.toThrow("unsupported version");
  });

  it("still repairs a gold peak on version 18 saves", async () => {
    await writeRawSave(
      asVersion18({
        ...createNewGame("Maya"),
        gold: 280,
        highestGold: 200,
        completedMilestones: [],
      }),
    );
    const restored = (await loadGame())!;
    expect(restored.version).toBe(20);
    expect(restored.highestGold).toBe(280);
    expect(restored.completedMilestones).toContain("prosperous_merchant");
  });
});
