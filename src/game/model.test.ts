import { describe, expect, it } from "vitest";
import { PORT_QUAYS, RIVER_EDGES } from "./navigation";
import {
  GOODS,
  CURRENT_MARKET_GOODS,
  MARKET_MAX_STOCK,
  MARKET_MAX_PRICE_SHARE,
  MARKET_PORTS,
  ADDITIONAL_SHIP_PRICE,
  MAX_AUTOMATED_ROUTE_CAPITAL,
  MAX_PLAYER_SHIPS,
  SHIPYARD_PORTS,
  TOWNS,
  advanceMarketStock,
  advanceWorld,
  acceptMission,
  advanceFarmProduction,
  arriveAtDestination,
  buyGood,
  buyGoodAtPort,
  buyPlayerShip,
  cancelAutomatedTradeRoute,
  configureAutomatedTradeRoute,
  buyFarm,
  marryAtResidence,
  buyResidence,
  buyWarehouse,
  buyUpgrade,
  changeVoyageSpeed,
  checkpointVoyageProgress,
  createNewGame,
  createMissionBoard,
  getNpcMerchant,
  getNpcTradingIntent,
  getCargoCapacity,
  getCargoUsed,
  getWarehouseCapacity,
  getWarehouseUsed,
  collectFarmOutput,
  getMarketDemand,
  getMarketSupply,
  getGoodPrice,
  getMilestoneProgress,
  getTradeQuote,
  getJourneyDistance,
  getTownRoute,
  getShipAttack,
  getShipDefence,
  isHistoricalRouteAlertActive,
  repairShip,
  resolveRiverEncounter,
  resumeVoyage,
  sellGood,
  sellGoodAtPort,
  selectPlayerShip,
  setAutomatedTradeRouteStatus,
  storeGoodInWarehouse,
  retrieveGoodFromWarehouse,
  startVoyage,
  tradeWithNpcMerchant,
  WAREHOUSE_CAPACITY,
  WAREHOUSE_PRICE,
  RESIDENCE_PRICE,
  FARM_DAILY_OUTPUT,
  FARM_OUTPUT_CAPACITY,
  FARM_PRICE,
  MARRIAGE_HOUSEHOLD_COST,
  type TownId,
} from "./model";
import {
  getRouteTravelTime,
  MAX_NORMAL_VOYAGE_DURATION_MS,
} from "./travel-time";

describe("first playable journey", () => {
  it("starts a clear new game in the first town", () => {
    const game = createNewGame("Maya");
    expect(game.captainName).toBe("Maya");
    expect(game.currentTown).toBe("dhaka");
    expect(game.coins).toBe(5_000);
    expect(getCargoUsed(game)).toBe(3);
  });

  describe("missions, local standing, and travel events", () => {
    it("generates four stable offers for every port", () => {
      const first = createMissionBoard();
      expect(first).toHaveLength(60);
      expect(TOWNS).toHaveLength(15);
      expect(GOODS).toHaveLength(8);
      expect(createMissionBoard()).toEqual(first);
      for (const town of TOWNS) {
        expect(first.filter((mission) => mission.origin === town.id).map((mission) => mission.type))
          .toEqual(["delivery", "purchase_delivery", "visit", "profitable_trade"]);
      }
    });

    describe("NPC merchants", () => {
      it("uses distinct merchant strategies and keeps player encounters optional at ports", () => {
        const game = createNewGame("Maya");
        const [specialist, arbitrage, , regional] = game.npcMerchants;
        expect(specialist.strategy).toBe("specialist");
        expect(arbitrage.strategy).toBe("arbitrage");
        expect(regional.strategy).toBe("regional");
        expect(getNpcTradingIntent(specialist)).toContain("Specialises");
        expect(getNpcTradingIntent(arbitrage)).toContain("best price difference");
        expect(getNpcTradingIntent(regional)).toContain("nearby ports");

        const dockedMerchant = {
          ...specialist,
          cargo: { ...specialist.cargo, rice: 1 },
          cargoCost: { ...specialist.cargoCost, rice: 250 },
          budget: 8_950,
        };
        const atPort = {
          ...game,
          coins: 25_000,
          npcMerchants: [dockedMerchant, ...game.npcMerchants.slice(1)],
        };
        const price = getGoodPrice(
          "dhaka",
          "rice",
          "buy",
          false,
          atPort.marketStock.dhaka.rice,
        );
        const traded = tradeWithNpcMerchant(atPort, specialist.id, "rice");
        expect(traded.error).toBeUndefined();
        expect(traded.state.coins).toBe(25_000 - price);
        expect(traded.state.cargo.rice).toBe(game.cargo.rice + 1);
        expect(getNpcMerchant(traded.state, specialist.id)?.cargo.rice).toBe(0);
        expect(getNpcMerchant(traded.state, specialist.id)?.budget).toBe(8_950 + price);
        expect(traded.state.marketStock).toEqual(atPort.marketStock);
        expect(tradeWithNpcMerchant(traded.state, specialist.id, "rice").error)
          .toBe("no-cargo");
        expect(
          tradeWithNpcMerchant(
            { ...atPort, coins: 0 },
            specialist.id,
            "rice",
          ).error,
        ).toBe("coins");
        expect(
          tradeWithNpcMerchant(
            {
              ...atPort,
              cargo: { ...atPort.cargo, rice: 11, muslin: 1 },
            },
            specialist.id,
            "rice",
          ).error,
        ).toBe("space");

        const sailing = startVoyage(
          { ...game, selectedTown: "patna", voyagesStarted: 100 },
          1000,
        );
        expect(sailing.voyage).not.toBeNull();
        expect(
          tradeWithNpcMerchant(sailing, specialist.id, "rice").error,
        ).toBe("not-at-port");
      });

      it("does not simulate NPC movement or trade during closed-app time", () => {
        const game = {
          ...createNewGame("Maya"),
          selectedTown: "patna" as const,
        };
        const sailing = startVoyage(game, 1000);
        const firstDayCheckpointAt =
          1000 + sailing.voyage!.durationMs / sailing.voyage!.durationDays;
        const checkpointed = checkpointVoyageProgress(
          sailing,
          firstDayCheckpointAt,
        );
        expect(checkpointed.worldDay).toBe(1);
        const savedMerchants = structuredClone(checkpointed.npcMerchants);
        const savedMarket = structuredClone(checkpointed.marketStock);
        const reopened = resumeVoyage(checkpointed, 86_461_000);
        expect(reopened.npcMerchants).toEqual(savedMerchants);
        expect(reopened.marketStock).toEqual(savedMarket);
        expect(reopened.worldDay).toBe(1);
      });
    });

    it("limits acceptance to two available contracts at the issuing port", () => {
      const game = createNewGame("Maya");
      const first = acceptMission(game, "dhaka:delivery");
      expect(first.error).toBeUndefined();
      expect(first.state.missions.find((mission) => mission.id === "dhaka:delivery")?.status)
        .toBe("active");
      const second = acceptMission(first.state, "dhaka:purchase-delivery");
      expect(second.error).toBeUndefined();
      expect(acceptMission(second.state, "dhaka:visit").error).toBe("active-limit");
      expect(acceptMission(game, "patna:delivery").error).toBe("not-available");
    });

    it("delivers cargo on arrival and pays a one-time contract reward and local standing", () => {
      const base = createNewGame("Maya");
      const offer = base.missions.find((mission) => mission.id === "dhaka:delivery")!;
      const loaded = {
        ...base,
        cargo: { ...base.cargo, muslin: offer.quantity },
        averagePurchasePrice: { ...base.averagePurchasePrice, muslin: 10 },
      };
      const accepted = acceptMission(loaded, offer.id).state;
      const sailing = startVoyage(
        { ...accepted, selectedTown: offer.destination },
        1000,
      );
      const arrival = arriveAtDestination(sailing);

      expect(arrival.missions.find((mission) => mission.id === offer.id)?.status)
        .toBe("completed");
      expect(arrival.cargo.muslin).toBe(0);
      expect(arrival.coins).toBe(base.coins + offer.rewardCoins);
      expect(arrival.reputation).toBe(3);
      expect(arrival.localStanding.dhaka).toBe(5);
      expect(arriveAtDestination(arrival).coins).toBe(arrival.coins);
    });

    it("tracks merchant purchases and requires the purchased quantity for delivery", () => {
      const base = {
        ...createNewGame("Maya"),
        coins: 25_000,
        highestCoins: 25_000,
      };
      const offer = base.missions.find((mission) => mission.id === "dhaka:purchase-delivery")!;
      const accepted = acceptMission(base, offer.id).state;
      const bought = buyGoodAtPort(accepted, "dhaka", offer.good!, offer.quantity);
      expect(bought.error).toBeUndefined();
      expect(
        bought.state.missions.find((mission) => mission.id === offer.id)?.purchasedQuantity,
      ).toBe(offer.quantity);

      const arrival = arriveAtDestination(
        startVoyage(
          { ...bought.state, selectedTown: offer.destination },
          1000,
        ),
      );
      expect(arrival.missions.find((mission) => mission.id === offer.id)?.status)
        .toBe("completed");
      expect(arrival.cargo[offer.good!]).toBe(0);
    });

    it("completes visit and profitable-trade objectives through their matching game actions", () => {
      const base = createNewGame("Maya");
      const visit = base.missions.find((mission) => mission.id === "dhaka:visit")!;
      const visited = arriveAtDestination(
        startVoyage(
          { ...acceptMission(base, visit.id).state, selectedTown: visit.destination },
          1000,
        ),
      );
      expect(visited.missions.find((mission) => mission.id === visit.id)?.status)
        .toBe("completed");

      const trade = base.missions.find(
        (mission) => mission.id === "dhaka:profitable-trade",
      )!;
      const tradeState = {
        ...acceptMission(base, trade.id).state,
        cargo: { ...base.cargo, [trade.good!]: 4 },
        averagePurchasePrice: { ...base.averagePurchasePrice, [trade.good!]: 1 },
      };
      const sold = sellGoodAtPort(tradeState, "dhaka", trade.good!, 4);
      expect(sold.error).toBeUndefined();
      expect(sold.state.missions.find((mission) => mission.id === trade.id)?.status)
        .toBe("completed");
      expect(sold.state.localStanding.dhaka).toBe(5);
    });

    it("expires active contracts only after sailing days pass their deadline", () => {
      const game = createNewGame("Maya");
      const offer = game.missions.find((mission) => mission.id === "dhaka:visit")!;
      const accepted = acceptMission(game, offer.id).state;
      const nearDeadline = {
        ...accepted,
        missions: accepted.missions.map((mission) =>
          mission.id === offer.id ? { ...mission, deadlineSailingDay: 0.1 } : mission,
        ),
        selectedTown: offer.destination,
      };
      const expired = arriveAtDestination(startVoyage(nearDeadline, 1000));
      expect(expired.missions.find((mission) => mission.id === offer.id)?.status)
        .toBe("expired");
      expect(expired.coins).toBe(game.coins);
    });

    it("caps local standing at 100 when a contract is completed", () => {
      const initial = createNewGame("Maya");
      const base = {
        ...initial,
        localStanding: {
          ...initial.localStanding,
          dhaka: 98,
        },
      };
      const offer = base.missions.find((mission) => mission.id === "dhaka:visit")!;
      const accepted = acceptMission(base, offer.id).state;
      const arrival = arriveAtDestination(
        startVoyage(
          { ...accepted, selectedTown: offer.destination },
          1000,
        ),
      );
      expect(arrival.localStanding.dhaka).toBe(100);
    });

    it("resolves deterministic travel events automatically on arrival", () => {
      const pilotVoyage = startVoyage(
        {
          ...createNewGame("Maya"),
          selectedTown: "sonargaon",
          voyagesStarted: 4,
        },
        1000,
      );
      expect(pilotVoyage.voyage?.travelEvent).toBe("river-pilot");
      expect(arriveAtDestination(pilotVoyage).localStanding.sonargaon).toBe(2);

      const roughVoyage = startVoyage(
        {
          ...createNewGame("Maya"),
          selectedTown: "sonargaon",
          shipHull: 5,
          voyagesStarted: 9,
        },
        1000,
      );
      expect(roughVoyage.voyage?.travelEvent).toBe("rough-water");
      expect(arriveAtDestination(roughVoyage).shipHull).toBe(4);
    });
  });

  it("selects a route, sails, and arrives at the selected town", () => {
    const game = {
      ...createNewGame("Maya"),
      selectedTown: "sylhet" as const,
    };
    const voyage = startVoyage(game, 1000);
    expect(voyage.voyage?.destination).toBe("sylhet");
    expect(voyage.voyage?.durationDays).toBeGreaterThan(0);
    expect(getJourneyDistance("dhaka", "sylhet")).toBeGreaterThan(0);

    const arrival = arriveAtDestination(voyage);
    expect(arrival.currentTown).toBe("sylhet");
    expect(arrival.voyage).toBeNull();
    expect(arrival.sailingDay).toBe(voyage.voyage?.durationDays);
    expect(arriveAtDestination(arrival).sailingDay).toBe(arrival.sailingDay);
  });

  it("supports selecting, sailing to, and arriving at an added upper-river destination", () => {
    const game = {
      ...createNewGame("Maya"),
      selectedTown: "patna" as const,
    };
    const route = getTownRoute(game.currentTown, game.selectedTown);
    expect(route).not.toBeNull();
    if (!route) return;

    expect(route.points[0]).toEqual(PORT_QUAYS.dhaka);
    expect(route.points.at(-1)).toEqual(PORT_QUAYS.patna);
    expect(route.edgeIds.length).toBeGreaterThan(1);

    const voyage = startVoyage(game, 1000);
    expect(voyage.voyage?.destination).toBe("patna");
    const arrival = arriveAtDestination(voyage);
    expect(arrival.currentTown).toBe("patna");
    expect(arrival.sailingDay).toBe(voyage.voyage?.durationDays);
  });

  it("uses the same river-distance estimate for preview, sailing, and game days", () => {
    const game = {
      ...createNewGame("Maya"),
      selectedTown: "sylhet" as const,
    };
    const route = getTownRoute(game.currentTown, game.selectedTown);
    expect(route).not.toBeNull();
    if (!route) return;

    const preview = getRouteTravelTime(route);
    const voyage = startVoyage(game, 1000).voyage;
    expect(voyage).not.toBeNull();
    if (!voyage) return;
    expect(voyage.arrivalAt - voyage.startedAt).toBe(preview.durationMs);
    expect(voyage.durationDays).toBe(preview.durationDays);
    expect(voyage.durationDays).toBe(
      (voyage.arrivalAt - voyage.startedAt) / 60_000,
    );
    expect(voyage.arrivalAt - voyage.startedAt).toBeLessThanOrEqual(
      MAX_NORMAL_VOYAGE_DURATION_MS,
    );
  });

  it.each([1, 2, 4] as const)(
    "keeps the in-game voyage duration constant at %s× speed",
    (speed) => {
      const state = {
        ...createNewGame("Maya"),
        selectedTown: "sylhet" as const,
        sailingSpeed: speed,
      };
      const timing = getRouteTravelTime(getTownRoute("dhaka", "sylhet")!);
      const voyage = startVoyage(state, 1000);

      expect(voyage.voyage?.arrivalAt).toBe(
        1000 + timing.durationMs / speed,
      );
      expect(voyage.voyage?.durationDays).toBe(timing.durationDays);
      const arrival = arriveAtDestination(voyage);
      expect(arrival.sailingDay).toBe(timing.durationDays);
      expect(arriveAtDestination(arrival).sailingDay).toBe(
        timing.durationDays,
      );
    },
  );

  it("applies speed changes only to the remaining real-time duration", () => {
    const state = {
      ...createNewGame("Maya"),
      selectedTown: "sylhet" as const,
    };
    const timing = getRouteTravelTime(getTownRoute("dhaka", "sylhet")!);
    const voyage = startVoyage(state, 1000);
    const fast = changeVoyageSpeed(voyage, 2, 61_000);

    expect(fast.voyage?.elapsedMs).toBe(60_000);
    expect(fast.voyage?.arrivalAt).toBe(
      61_000 + (timing.durationMs - 60_000) / 2,
    );
    expect(fast.sailingSpeed).toBe(2);
    expect(changeVoyageSpeed(fast, 4, 71_000).voyage?.elapsedMs).toBe(
      80_000,
    );
  });

  it("pauses a voyage across close and reopen without counting closed time", () => {
    const state = {
      ...createNewGame("Maya"),
      selectedTown: "sylhet" as const,
      sailingSpeed: 2 as const,
    };
    const started = startVoyage(state, 1_000);
    const pausedAt = checkpointVoyageProgress(started, 11_000);
    const savedElapsed = pausedAt.voyage?.elapsedMs;
    expect(savedElapsed).toBe(20_000);

    const reopenedAt = 10_000_000;
    const resumed = resumeVoyage(pausedAt, reopenedAt);
    expect(resumed.voyage?.elapsedMs).toBe(savedElapsed);
    expect(resumed.voyage?.progressUpdatedAt).toBe(reopenedAt);
    expect(resumed.voyage?.arrivalAt).toBe(
      reopenedAt +
        (resumed.voyage!.durationMs - savedElapsed!) / state.sailingSpeed,
    );
    expect(
      checkpointVoyageProgress(resumed, reopenedAt).voyage?.elapsedMs,
    ).toBe(savedElapsed);

    const afterSailing = checkpointVoyageProgress(resumed, reopenedAt + 5_000);
    expect(afterSailing.voyage?.elapsedMs).toBe(savedElapsed! + 10_000);
  });

  it("arrives once after a paused voyage resumes and completes", () => {
    const started = startVoyage(
      {
        ...createNewGame("Maya"),
        selectedTown: "sylhet" as const,
      },
      1_000,
    );
    const paused = checkpointVoyageProgress(started, 21_000);
    const resumed = resumeVoyage(paused, 1_000_000);
    const completed = checkpointVoyageProgress(
      resumed,
      resumed.voyage!.arrivalAt,
    );
    const arrival = arriveAtDestination(completed);

    expect(arrival.currentTown).toBe("sylhet");
    expect(arrival.voyage).toBeNull();
    expect(arrival.sailingDay).toBe(started.voyage?.durationDays);
    expect(arriveAtDestination(arrival).sailingDay).toBe(arrival.sailingDay);
  });

  it("buys and sells goods with the displayed local prices", () => {
    const game = createNewGame("Maya");
    const bought = buyGood(game, "salt");
    expect(bought.state.coins).toBe(4_310);
    expect(bought.state.cargo.salt).toBe(1);
    const sold = sellGood(bought.state, "salt");
    expect(sold.state.coins).toBe(4_915);
    expect(sold.state.cargo.salt).toBe(0);
    expect(getGoodPrice("dhaka", "salt", "sell", false, 59)).toBe(605);
    expect(sellGood(game, "salt").error).toBe("empty");
  });

  it("allows one affordable warehouse per port and adds local storage capacity", () => {
    const newGame = createNewGame("Maya");
    expect(buyWarehouse(newGame).error).toBe("coins");

    const richGame = {
      ...newGame,
      coins: WAREHOUSE_PRICE * 2,
      highestCoins: WAREHOUSE_PRICE * 2,
    };
    const purchased = buyWarehouse(richGame);
    expect(purchased.error).toBeUndefined();
    expect(purchased.state.coins).toBe(WAREHOUSE_PRICE);
    expect(purchased.state.ownedWarehouses).toEqual(["dhaka"]);
    expect(getWarehouseCapacity(purchased.state, "dhaka")).toBe(
      WAREHOUSE_CAPACITY,
    );
    expect(getWarehouseCapacity(purchased.state, "patna")).toBe(0);
    expect(buyWarehouse(purchased.state).error).toBe("already-owned");
    const atPatna = {
      ...purchased.state,
      currentTown: "patna" as const,
      selectedTown: "patna" as const,
    };
    expect(buyWarehouse(atPatna).state.ownedWarehouses)
      .toEqual(["dhaka", "patna"]);
    expect(TOWNS).toHaveLength(15);
    expect(GOODS).toHaveLength(8);
  });

  it("allows one affordable persistent residence at the player's chosen port", () => {
    const newGame = createNewGame("Maya");
    expect(newGame.residenceTown).toBeNull();
    expect(buyResidence(newGame).error).toBe("coins");

    const richGame = {
      ...newGame,
      coins: RESIDENCE_PRICE + 2000,
      highestCoins: RESIDENCE_PRICE + 2000,
    };
    const purchased = buyResidence(richGame);
    expect(purchased.error).toBeUndefined();
    expect(purchased.state.coins).toBe(2000);
    expect(purchased.state.residenceTown).toBe("dhaka");
    expect(purchased.state.lastMessage).toContain("Dhaka");
    expect(buyResidence(purchased.state).error).toBe("already-owned");

    const atPatna = {
      ...purchased.state,
      currentTown: "patna" as const,
      selectedTown: "patna" as const,
    };
    expect(buyResidence(atPatna).state.residenceTown).toBe("dhaka");
  });

  it("allows one affordable farm in each chosen port without locking content", () => {
    const newGame = createNewGame("Maya");
    expect(buyFarm(newGame).error).toBe("coins");

    const richGame = {
      ...newGame,
      coins: FARM_PRICE * 2,
      highestCoins: FARM_PRICE * 2,
    };
    const purchased = buyFarm(richGame);
    expect(purchased.error).toBeUndefined();
    expect(purchased.state.coins).toBe(FARM_PRICE);
    expect(purchased.state.ownedFarms).toEqual(["dhaka"]);
    expect(purchased.state.farmProductionDay.dhaka).toBe(0);
    expect(buyFarm(purchased.state).error).toBe("already-owned");

    const atPatna = {
      ...purchased.state,
      currentTown: "patna" as const,
      selectedTown: "patna" as const,
    };
    expect(buyFarm(atPatna).state.ownedFarms).toEqual(["dhaka", "patna"]);
    expect(TOWNS).toHaveLength(15);
    expect(GOODS).toHaveLength(8);
  });

  it("requires the owned residence and enough coins before marriage can be established", () => {
    const newGame = createNewGame("Maya");
    expect(marryAtResidence(newGame).error).toBe("no-residence");

    const withResidence = {
      ...newGame,
      residenceTown: "dhaka" as const,
      coins: MARRIAGE_HOUSEHOLD_COST - 1,
      sailingDay: 2.5,
    };
    expect(marryAtResidence(withResidence).error).toBe("coins");

    const awayFromHome = {
      ...withResidence,
      currentTown: "patna" as const,
      selectedTown: "patna" as const,
      coins: MARRIAGE_HOUSEHOLD_COST,
    };
    expect(marryAtResidence(awayFromHome).error).toBe("away-from-residence");
    const underway = startVoyage({
      ...withResidence,
      coins: MARRIAGE_HOUSEHOLD_COST,
    }, 1_000);
    expect(marryAtResidence(underway).error).toBe("away-from-residence");

    const married = marryAtResidence({
      ...withResidence,
      coins: MARRIAGE_HOUSEHOLD_COST + 1000,
    });
    expect(married.error).toBeUndefined();
    expect(married.state.coins).toBe(1000);
    expect(married.state.household.spouse).toEqual({
      status: "married",
      marriedAtSailingDay: 2.5,
    });
    expect(married.state.household.children).toEqual([]);
    expect(married.state.household.inheritance.designatedHeirId).toBeNull();
    expect(marryAtResidence(married.state).error).toBe("already-married");
  });

  it("produces one Rice per full in-game sailing day and preserves partial days", () => {
    const purchased = buyFarm({
      ...createNewGame("Maya"),
      coins: FARM_PRICE,
      highestCoins: FARM_PRICE,
    }).state;
    const route = getTownRoute("dhaka", "sonargaon");
    expect(route).not.toBeNull();
    if (!route) return;

    const makeArrival = (state: typeof purchased, durationDays: number) =>
      arriveAtDestination({
        ...state,
        selectedTown: "sonargaon",
        voyage: {
          shipId: state.selectedShipId,
          origin: state.currentTown,
          destination: "sonargaon",
          startedAt: 0,
          arrivalAt: 60_000,
          durationMs: 60_000,
          elapsedMs: 60_000,
          progressUpdatedAt: 60_000,
          durationDays,
          routeAlert: false,
          route,
          travelEvent: null,
        },
      });

    const firstLeg = makeArrival(purchased, 0.6);
    expect(firstLeg.farmOutput.dhaka).toBe(0);
    expect(firstLeg.farmProductionDay.dhaka).toBe(0);
    expect(arriveAtDestination(firstLeg)).toEqual(firstLeg);

    const returnRoute = getTownRoute("sonargaon", "dhaka");
    expect(returnRoute).not.toBeNull();
    if (!returnRoute) return;
    const secondLeg = arriveAtDestination({
      ...firstLeg,
      selectedTown: "dhaka",
      voyage: {
        shipId: firstLeg.selectedShipId,
        origin: "sonargaon",
        destination: "dhaka",
        startedAt: 0,
        arrivalAt: 60_000,
        durationMs: 60_000,
        elapsedMs: 60_000,
        progressUpdatedAt: 60_000,
        durationDays: 0.6,
        routeAlert: false,
        route: returnRoute,
        travelEvent: null,
      },
    });
    expect(secondLeg.sailingDay).toBeCloseTo(1.2);
    expect(secondLeg.farmOutput.dhaka).toBe(FARM_DAILY_OUTPUT);
    expect(secondLeg.farmProductionDay.dhaka).toBe(1);
  });

  it("caps farm output and discards production while local storage is full", () => {
    const purchased = buyFarm({
      ...createNewGame("Maya"),
      coins: FARM_PRICE,
    }).state;
    const nearlyFull = {
      ...purchased,
      farmOutput: { ...purchased.farmOutput, dhaka: FARM_OUTPUT_CAPACITY - 1 },
    };
    const full = advanceFarmProduction(nearlyFull, 5);
    expect(full.farmOutput.dhaka).toBe(FARM_OUTPUT_CAPACITY);
    expect(full.farmProductionDay.dhaka).toBe(5);

    const afterFull = advanceFarmProduction(full, 8);
    expect(afterFull.farmOutput.dhaka).toBe(FARM_OUTPUT_CAPACITY);
    expect(afterFull.farmProductionDay.dhaka).toBe(8);
  });

  it("collects farm output into ship cargo only up to free capacity", () => {
    const purchased = buyFarm({
      ...createNewGame("Maya"),
      coins: FARM_PRICE,
    }).state;
    const ready = {
      ...purchased,
      farmOutput: { ...purchased.farmOutput, dhaka: 5 },
      averagePurchasePrice: { ...purchased.averagePurchasePrice, rice: 10 },
    };
    const collected = collectFarmOutput(ready);
    expect(collected.error).toBeUndefined();
    expect(collected.collected).toBe(5);
    expect(collected.state.cargo.rice).toBe(7);
    expect(collected.state.averagePurchasePrice.rice).toBeCloseTo(20 / 7);
    expect(collected.state.farmOutput.dhaka).toBe(0);

    const fullHold = {
      ...ready,
      cargo: { ...ready.cargo, rice: 11 },
    };
    const failed = collectFarmOutput(fullHold);
    expect(failed.error).toBe("cargo-full");
    expect(failed.state.farmOutput.dhaka).toBe(5);

    const partial = collectFarmOutput({
      ...ready,
      farmOutput: { ...ready.farmOutput, dhaka: FARM_OUTPUT_CAPACITY },
    });
    expect(partial.collected).toBe(9);
    expect(partial.state.farmOutput.dhaka).toBe(FARM_OUTPUT_CAPACITY - 9);
  });

  it("stores and retrieves warehouse goods within local capacity and preserves cost basis", () => {
    const purchased = buyWarehouse({
      ...createNewGame("Maya"),
      coins: WAREHOUSE_PRICE,
    }).state;
    const withCargo = {
      ...purchased,
      cargo: { ...purchased.cargo, rice: 4 },
      averagePurchasePrice: { ...purchased.averagePurchasePrice, rice: 10 },
    };

    const stored = storeGoodInWarehouse(withCargo, "rice");
    expect(stored.error).toBeUndefined();
    expect(stored.state.cargo.rice).toBe(3);
    expect(stored.state.averagePurchasePrice.rice).toBe(10);
    expect(stored.state.warehouseStock.dhaka.rice).toBe(1);
    expect(stored.state.warehouseAveragePurchasePrice.dhaka.rice).toBe(10);
    expect(getWarehouseUsed(stored.state, "dhaka")).toBe(1);

    const retrieved = retrieveGoodFromWarehouse(stored.state, "rice");
    expect(retrieved.error).toBeUndefined();
    expect(retrieved.state.cargo.rice).toBe(4);
    expect(retrieved.state.averagePurchasePrice.rice).toBe(10);
    expect(retrieved.state.warehouseStock.dhaka.rice).toBe(0);
    expect(retrieved.state.warehouseAveragePurchasePrice.dhaka.rice).toBe(0);

    expect(storeGoodInWarehouse(createNewGame("Maya"), "rice").error)
      .toBe("not-owned");
    expect(retrieveGoodFromWarehouse(purchased, "rice").error).toBe("empty");
    const fullWarehouse = {
      ...stored.state,
      warehouseStock: {
        ...stored.state.warehouseStock,
        dhaka: { ...stored.state.warehouseStock.dhaka, rice: WAREHOUSE_CAPACITY },
      },
    };
    expect(getWarehouseUsed(fullWarehouse, "dhaka")).toBe(WAREHOUSE_CAPACITY);
    expect(storeGoodInWarehouse(fullWarehouse, "rice").error).toBe("full");
    const fullShip = {
      ...stored.state,
      cargo: { ...stored.state.cargo, rice: 12, muslin: 0 },
      warehouseStock: {
        ...stored.state.warehouseStock,
        dhaka: { ...stored.state.warehouseStock.dhaka, rice: 1 },
      },
    };
    expect(retrieveGoodFromWarehouse(fullShip, "rice").error).toBe("cargo-full");
  });

  it("awards reputation only once for a first visit and a profitable market-good pair", () => {
    let game = createNewGame("Maya");
    const visit = (destination: "sonargaon" | "dhaka", now: number) => {
      const voyage = startVoyage(
        { ...game, selectedTown: destination },
        now,
      );
      game = arriveAtDestination(voyage);
    };

    visit("sonargaon", 1_000);
    expect(game.reputation).toBe(1);
    visit("dhaka", 2_000);
    visit("sonargaon", 3_000);
    expect(game.reputation).toBe(1);

    const trader = {
      ...game,
      cargo: { ...game.cargo, rice: 1 },
      averagePurchasePrice: { ...game.averagePurchasePrice, rice: 1 },
    };
    const profitableSale = sellGood(trader, "rice");
    expect(profitableSale.error).toBeUndefined();
    expect(profitableSale.state.reputation).toBe(2);
    expect(profitableSale.state.profitableTradeMarks).toContain("sonargaon:rice");
    expect(profitableSale.state.lastMessage).toContain("+1 reputation");

    const repeatedSale = sellGood(
      {
        ...profitableSale.state,
        cargo: { ...profitableSale.state.cargo, rice: 1 },
        averagePurchasePrice: {
          ...profitableSale.state.averagePurchasePrice,
          rice: 1,
        },
      },
      "rice",
    );
    expect(repeatedSale.state.reputation).toBe(2);

    const unprofitableSale = sellGood(
      {
        ...game,
        cargo: { ...game.cargo, rice: 1 },
        averagePurchasePrice: {
          ...game.averagePurchasePrice,
          rice: 1_000,
        },
      },
      "rice",
    );
    expect(unprofitableSale.state.reputation).toBe(1);
  });

  it("tracks optional visit, trade-variety, and wealth milestones without locking content", () => {
    let game = createNewGame("Maya");
    const visit = (destination: TownId, now: number) => {
      game = arriveAtDestination(
        (() => {
          const voyage = startVoyage(
            { ...game, selectedTown: destination },
            now,
          );
          return voyage;
        })(),
      );
    };
    visit("sonargaon", 1_000);
    visit("dhaka", 2_000);
    visit("sylhet", 3_000);
    visit("patna", 4_000);
    visit("kasimbazar", 5_000);

    const explorer = getMilestoneProgress(game).find(
      (milestone) => milestone.id === "river_explorer",
    );
    expect(explorer).toMatchObject({ current: 5, target: 5, completed: true });

    game = {
      ...game,
      coins: 12_450,
      highestCoins: 12_450,
      cargo: { ...game.cargo, rice: 1 },
      averagePurchasePrice: { ...game.averagePurchasePrice, rice: 1 },
    };
    const firstSale = sellGood(game, "rice").state;
    expect(
      getMilestoneProgress(firstSale).find(
        (milestone) => milestone.id === "prosperous_merchant",
      ),
    ).toMatchObject({ current: 12_500, completed: true });
    const afterSpending = buyGood(
      { ...firstSale, coins: firstSale.coins - 5_000 },
      "salt",
    ).state;
    expect(afterSpending.completedMilestones).toContain("prosperous_merchant");

    let markedMarkets = {
      ...createNewGame("Maya"),
      cargo: { ...createNewGame("Maya").cargo, rice: 1 },
      averagePurchasePrice: {
        ...createNewGame("Maya").averagePurchasePrice,
        rice: 0,
      },
    };
    for (const port of ["dhaka", "sonargaon", "kasimbazar", "sylhet", "hooghly"] as const) {
      markedMarkets = {
        ...markedMarkets,
        cargo: { ...markedMarkets.cargo, rice: 1 },
      };
      markedMarkets = sellGoodAtPort(markedMarkets, port, "rice").state;
    }
    expect(
      getMilestoneProgress(markedMarkets).find(
        (milestone) => milestone.id === "trusted_trader",
      ),
    ).toMatchObject({ current: 5, target: 5, completed: true });
    expect(TOWNS).toHaveLength(15);
    expect(GOODS).toHaveLength(8);
    for (const port of MARKET_PORTS) {
      for (const good of GOODS) {
        expect(getTradeQuote(markedMarkets, port.id, good.id, "buy", 1))
          .not.toBeNull();
      }
    }
  });

  it("defines all eight goods in every documented port economy", () => {
    const game = createNewGame("Maya");

    expect(GOODS).toHaveLength(8);
    expect(CURRENT_MARKET_GOODS.map((good) => good.id)).toEqual(
      GOODS.map((good) => good.id),
    );
    expect(MARKET_PORTS).toHaveLength(15);
    for (const port of MARKET_PORTS) {
      for (const good of GOODS) {
        expect(game.marketStock[port.id][good.id]).toBeGreaterThanOrEqual(0);
        expect(game.marketStock[port.id][good.id]).toBeLessThanOrEqual(
          MARKET_MAX_STOCK,
        );
        expect(getMarketSupply(port.id, good.id)).toBeGreaterThanOrEqual(1);
        expect(getMarketDemand(port.id, good.id)).toBeGreaterThanOrEqual(1);
        expect(getGoodPrice(port.id, good.id, "buy")).toBeGreaterThan(0);
        expect(getGoodPrice(port.id, good.id, "sell")).toBeGreaterThan(0);
      }
    }
  });

  it("supports deterministic buy and sell transactions for every good at every market", () => {
    const emptyCargo = {
      rice: 0,
      salt: 0,
      muslin: 0,
      silk: 0,
      sugar: 0,
      saltpetre: 0,
      opium: 0,
      lac: 0,
    };

    for (const port of MARKET_PORTS) {
      for (const good of GOODS) {
        const initial = {
          ...createNewGame("Maya"),
          coins: 50_000,
          cargo: emptyCargo,
        };
        const bought = buyGoodAtPort(initial, port.id, good.id);
        expect(bought.error).toBeUndefined();
        expect(bought.state.cargo[good.id]).toBe(1);
        expect(bought.state.marketStock[port.id][good.id]).toBe(
          initial.marketStock[port.id][good.id] - 1,
        );

        const sold = sellGoodAtPort(bought.state, port.id, good.id);
        expect(sold.error).toBeUndefined();
        expect(sold.state.cargo[good.id]).toBe(0);
        expect(sold.state.marketStock[port.id][good.id]).toBe(
          initial.marketStock[port.id][good.id],
        );
        expect(sold.state.coins).toBeLessThan(initial.coins);
      }
    }
  });

  it("prices bulk trades unit by unit and tracks weighted purchase cost", () => {
    let game = { ...createNewGame("Maya"), coins: 50_000 };
    const firstPurchase = buyGood(game, "salt");
    expect(firstPurchase.error).toBeUndefined();
    game = firstPurchase.state;
    const previousAverage = game.averagePurchasePrice.salt;
    const previousStock = game.marketStock.dhaka.salt;
    const secondQuote = getTradeQuote(game, "dhaka", "salt", "buy", 2);
    expect(secondQuote).not.toBeNull();
    if (!secondQuote) return;

    const secondPurchase = buyGood(game, "salt", 2);
    expect(secondPurchase.error).toBeUndefined();
    game = secondPurchase.state;
    expect(game.cargo.salt).toBe(3);
    expect(game.averagePurchasePrice.salt).toBeCloseTo(
      (previousAverage + secondQuote.total) / 3,
      6,
    );
    expect(game.marketStock.dhaka.salt).toBe(previousStock - 2);

    const averageBeforeSale = game.averagePurchasePrice.salt;
    const partialSale = sellGood(game, "salt", 1);
    expect(partialSale.error).toBeUndefined();
    expect(partialSale.state.cargo.salt).toBe(2);
    expect(partialSale.state.averagePurchasePrice.salt).toBe(averageBeforeSale);

    const finalSale = sellGood(partialSale.state, "salt", 2);
    expect(finalSale.error).toBeUndefined();
    expect(finalSale.state.cargo.salt).toBe(0);
    expect(finalSale.state.averagePurchasePrice.salt).toBe(0);
  });

  it("rejects unaffordable, oversized, invalid, and unavailable trades without changing state", () => {
    const game = createNewGame("Maya");
    expect(buyGood({ ...game, coins: 0 }, "salt").error).toBe("coins");
    expect(buyGood(game, "salt", 0).error).toBe("quantity");
    expect(buyGood(game, "salt", 1.5).error).toBe("quantity");
    expect(sellGood(game, "salt", 1).error).toBe("empty");
    expect(
      buyGoodAtPort(
        {
          ...game,
          marketStock: {
            ...game.marketStock,
            dhaka: { ...game.marketStock.dhaka, salt: 0 },
          },
        },
        "dhaka",
        "salt",
      ).error,
    ).toBe("out-of-stock");
    expect(getTradeQuote(game, "dhaka", "salt", "buy", 0)).toBeNull();
  });

  it("shows distinct stock and local prices across port economies", () => {
    const game = createNewGame("Maya");
    const tandaSilk = getGoodPrice(
      "tanda",
      "silk",
      "buy",
      false,
      game.marketStock.tanda.silk,
    );
    const kasimbazarSilk = getGoodPrice(
      "kasimbazar",
      "silk",
      "buy",
      false,
      game.marketStock.kasimbazar.silk,
    );
    expect(game.marketStock.tanda.silk).not.toBe(
      game.marketStock.kasimbazar.silk,
    );
    expect(tandaSilk).not.toBe(kasimbazarSilk);
  });

  it("changes local quotes as the player buys and sells stock", () => {
    const starting = createNewGame("Maya");
    const startingQuote = getGoodPrice(
      "dhaka",
      "muslin",
      "buy",
      false,
      starting.marketStock.dhaka.muslin,
    );
    const bought = buyGood(starting, "muslin");
    expect(bought.state.marketStock.dhaka.muslin).toBe(
      starting.marketStock.dhaka.muslin - 1,
    );
    expect(
      getGoodPrice(
        "dhaka",
        "muslin",
        "buy",
        false,
        bought.state.marketStock.dhaka.muslin,
      ),
    ).toBeGreaterThan(startingQuote);

    const seller = {
      ...starting,
      cargo: { ...starting.cargo, rice: 0, salt: 2 },
    };
    const firstSale = sellGood(seller, "salt").state;
    const secondSale = sellGood(firstSale, "salt").state;
    expect(secondSale.marketStock.dhaka.salt).toBe(
      starting.marketStock.dhaka.salt + 2,
    );
    expect(
      getGoodPrice(
        "dhaka",
        "salt",
        "buy",
        false,
        secondSale.marketStock.dhaka.salt,
      ),
    ).toBeLessThan(
      getGoodPrice(
        "dhaka",
        "salt",
        "buy",
        false,
        starting.marketStock.dhaka.salt,
      ),
    );
  });

  it("moves each stall one unit per full sailing day toward profile stock", () => {
    const starting = createNewGame("Maya");
    const alteredStock = {
      ...starting.marketStock,
      dhaka: {
        ...starting.marketStock.dhaka,
        rice: 10,
        salt: 90,
      },
    };
    const recovered = advanceMarketStock(alteredStock, 1.9);

    // One whole day. Rice closes 8% of its gap, and Dhaka, a big salt buyer, 12% of its surplus.
    expect(recovered.dhaka.rice).toBe(14);
    expect(recovered.dhaka.salt).toBe(86);
    expect(recovered.dhaka.muslin).toBe(
      starting.marketStock.dhaka.muslin,
    );
    expect(recovered.patna.opium).toBe(starting.marketStock.patna.opium);
  });

  it("keeps all market stock between zero and forty while recovering toward baseline", () => {
    const starting = createNewGame("Maya");
    const extremeStock = Object.fromEntries(
      MARKET_PORTS.map((port, index) => [
        port.id,
        Object.fromEntries(
          GOODS.map((good, goodIndex) => [
            good.id,
            (index + goodIndex) % 2 === 0 ? 0 : MARKET_MAX_STOCK,
          ]),
        ),
      ]),
    ) as typeof starting.marketStock;
    const recovered = advanceMarketStock(extremeStock, 100);

    for (const port of MARKET_PORTS) {
      for (const good of GOODS) {
        expect(recovered[port.id][good.id]).toBe(
          starting.marketStock[port.id][good.id],
        );
        expect(recovered[port.id][good.id]).toBeGreaterThanOrEqual(0);
        expect(recovered[port.id][good.id]).toBeLessThanOrEqual(
          MARKET_MAX_STOCK,
        );
        for (const stock of [0, MARKET_MAX_STOCK]) {
          for (const type of ["buy", "sell"] as const) {
            const quote = getGoodPrice(
              port.id,
              good.id,
              type,
              true,
              stock,
            );
            expect(quote).toBeGreaterThanOrEqual(1);
            if (type === "buy") {
              expect(quote).toBeLessThanOrEqual(2_000 * MARKET_MAX_PRICE_SHARE + 300);
            }
          }
        }
      }
    }
  });

  it("updates market stock on arrival only for whole sailing days crossed", () => {
    const starting = {
      ...createNewGame("Maya"),
      selectedTown: "sylhet" as const,
      sailingDay: 0.75,
      marketStock: {
        ...createNewGame("Maya").marketStock,
        dhaka: {
          ...createNewGame("Maya").marketStock.dhaka,
          rice: 10,
        },
      },
    };
    const durationDays = getRouteTravelTime(
      getTownRoute("dhaka", "sylhet")!,
    ).durationDays;
    const expectedTicks = Math.floor(starting.sailingDay + durationDays) -
      Math.floor(starting.sailingDay);
    const isolatedFromNpcTrades = { ...starting, npcMerchants: [] };
    const voyage = startVoyage(isolatedFromNpcTrades, 1_000);
    expect(voyage.marketStock.dhaka.rice).toBe(10);

    const arrival = arriveAtDestination(voyage);
    expect(arrival.marketStock).toEqual(advanceMarketStock(voyage.marketStock, expectedTicks));
    expect(arrival.marketStock.dhaka.rice).toBeGreaterThan(10);
    expect(arrival.sailingDay).toBe(starting.sailingDay + durationDays);
  });

  it("expires the existing Chittagong salt event when sailing crosses day 36", () => {
    const active = {
      ...createNewGame("Maya"),
      selectedTown: "sylhet" as const,
      sailingDay: 35.5,
    };
    expect(isHistoricalRouteAlertActive(active)).toBe(true);
    expect(
      getGoodPrice("chittagong", "salt", "buy", true),
    ).toBe(getGoodPrice("chittagong", "salt", "buy", false) + 300);

    const arrived = arriveAtDestination(startVoyage(active, 1_000));
    expect(arrived.sailingDay).toBeGreaterThanOrEqual(36);
    expect(isHistoricalRouteAlertActive(arrived)).toBe(false);
    expect(
      getGoodPrice(
        "chittagong",
        "salt",
        "buy",
        isHistoricalRouteAlertActive(arrived),
        arrived.marketStock.chittagong.salt,
      ),
    ).toBe(
      getGoodPrice(
        "chittagong",
        "salt",
        "buy",
        false,
        arrived.marketStock.chittagong.salt,
      ),
    );
  });

  it("prices scarcity above abundance using each port's supply and demand", () => {
    const scarceSilk = getGoodPrice("tanda", "silk", "buy");
    const abundantSilk = getGoodPrice("kasimbazar", "silk", "buy");
    expect(getMarketSupply("tanda", "silk")).toBeLessThan(
      getMarketSupply("kasimbazar", "silk"),
    );
    expect(scarceSilk).toBeGreaterThan(abundantSilk);

    const abundantRice = getGoodPrice("jessore", "rice", "buy");
    const demandedRice = getGoodPrice("dhaka", "rice", "buy");
    expect(getMarketSupply("jessore", "rice")).toBeGreaterThan(
      getMarketSupply("dhaka", "rice"),
    );
    expect(getMarketDemand("dhaka", "rice")).toBeGreaterThan(
      getMarketDemand("jessore", "rice"),
    );
    expect(abundantRice).toBeLessThan(demandedRice);
  });

  it("stops a purchase when the cargo hold is full", () => {
    const game = {
      ...createNewGame("Maya"),
      cargo: {
        rice: 12,
        salt: 0,
        muslin: 0,
        silk: 0,
        sugar: 0,
        saltpetre: 0,
        opium: 0,
        lac: 0,
      },
    };
    expect(buyGood(game, "muslin").error).toBe("space");
    expect(buyGood(game, "muslin").state.cargo.muslin).toBe(0);
  });

  it("raises purchase prices as a stall stock falls and lowers sale quotes as stock fills", () => {
    let market = createNewGame("Maya");
    for (let purchase = 0; purchase < 5; purchase += 1) {
      market = buyGood(market, "rice").state;
    }

    expect(market.marketStock.dhaka.rice).toBe(55);
    expect(getGoodPrice("dhaka", "rice", "buy", false, 55)).toBe(485);

    const seller = {
      ...createNewGame("Maya"),
      cargo: {
        rice: 0,
        salt: 5,
        muslin: 0,
        silk: 0,
        sugar: 0,
        saltpetre: 0,
        opium: 0,
        lac: 0,
      },
    };
    let afterSales = seller;
    for (let sale = 0; sale < 5; sale += 1) {
      afterSales = sellGood(afterSales, "salt").state;
    }

    expect(afterSales.marketStock.dhaka.salt).toBe(65);
    expect(getGoodPrice("dhaka", "salt", "sell", false, 65)).toBe(565);
    expect(buyGood({ ...market, marketStock: { ...market.marketStock, dhaka: { ...market.marketStock.dhaka, rice: 0 } } }, "rice").error).toBe("out-of-stock");
  });

  it("keeps a voyage's saved path aligned with its navigable river route", () => {
    const game = {
      ...createNewGame("Maya"),
      selectedTown: "kasimbazar" as const,
    };
    const voyage = startVoyage(game, 1000);
    expect(voyage.voyage?.route.origin).toBe("dhaka");
    expect(voyage.voyage?.route.destination).toBe("kasimbazar");
    expect(voyage.voyage?.route.points[0]).toEqual(PORT_QUAYS.dhaka);
    expect(voyage.voyage?.route.points.at(-1)).toEqual(PORT_QUAYS.kasimbazar);
  });

  it("does not begin a voyage when active event conditions close every river path", () => {
    const game = {
      ...createNewGame("Maya"),
      selectedTown: "kasimbazar" as const,
      navigationConditions: {
        eventBlockages: RIVER_EDGES.filter((edge) => edge.to === "kasimbazar" || edge.from === "kasimbazar").map((edge) => edge.id),
      },
    };
    const result = startVoyage(game, 1000);
    expect(result.voyage).toBeNull();
    expect(result.lastMessage).toContain("river path is closed");
  });

  it("factors attack, defence, cost and cargo space into dock upgrades", () => {
    const game = createNewGame("Maya");
    const cannon = buyUpgrade(game, "cannon").state;
    expect(cannon.coins).toBe(3_250);
    expect(getShipAttack(cannon)).toBe(3);

    const hull = buyUpgrade(cannon, "hull").state;
    expect(hull.coins).toBe(1_500);
    expect(getShipDefence(hull)).toBe(2);
    expect(hull.shipHull).toBe(10);

    const hold = buyUpgrade(createNewGame("Maya"), "hold").state;
    expect(getCargoCapacity(hold)).toBe(18);
  });

  it("enforces upgrade prices, affordability, and maximum levels", () => {
    const poor = { ...createNewGame("Maya"), coins: 1700 };
    expect(buyUpgrade(poor, "cannon").error).toBe("coins");
    expect(buyUpgrade(poor, "cannon").state).toEqual(poor);

    let ship = { ...createNewGame("Maya"), coins: 50_000 };
    for (let level = 0; level < 3; level += 1) {
      const result = buyUpgrade(ship, "cannon");
      expect(result.error).toBeUndefined();
      expect(result.state.coins).toBe(ship.coins - 1_750 * (level + 1));
      ship = result.state;
    }
    expect(buyUpgrade(ship, "cannon").error).toBe("max-level");

    ship = { ...createNewGame("Maya"), coins: 50_000 };
    for (let level = 0; level < 3; level += 1) {
      ship = buyUpgrade(ship, "hold").state;
    }
    expect(getCargoCapacity(ship)).toBe(30);
    expect(buyUpgrade(ship, "hold").error).toBe("max-level");
  });

  it("resolves encounters using the actual ship attack and defence", () => {
    const unupgraded = createNewGame("Maya");
    const unupgradedFight = resolveRiverEncounter({
      ...unupgraded,
      encounterPending: true,
    });

    expect(unupgradedFight.result.hullDamage).toBe(2);
    expect(unupgradedFight.state.shipHull).toBe(6);

    const armed = buyUpgrade(unupgraded, "cannon").state;
    const armedFight = resolveRiverEncounter({
      ...armed,
      encounterPending: true,
    });
    expect(armedFight.result.enemyDefeated).toBe(true);
    expect(armedFight.state.shipHull).toBe(8);

    const protectedShip = buyUpgrade(unupgraded, "hull").state;
    expect(
      resolveRiverEncounter({
        ...protectedShip,
        encounterPending: true,
      }).result.hullDamage,
    ).toBe(1);
  });

  it("repairs battle damage at the dock with a clear coins cost", () => {
    const battered = {
      ...createNewGame("Maya"),
      shipHull: 6,
    };
    const repair = repairShip(battered);

    expect(repair.error).toBeUndefined();
    expect(repair.state.shipHull).toBe(8);
    expect(repair.state.coins).toBe(4_800);
    expect(repairShip(repair.state).error).toBe("full-hull");
    expect(repairShip({ ...battered, coins: 50 }).error).toBe("coins");
    expect(repairShip({ ...battered, coins: 150 }).state).toMatchObject({ coins: 50, shipHull: 7 });
    expect(repairShip({ ...battered, coins: 200 }).state.coins).toBe(0);
  });

  it("prevents repairs and upgrades while a voyage or encounter is active", () => {
    const state = {
      ...createNewGame("Maya"),
      selectedTown: "sylhet" as const,
      shipHull: 6,
      coins: 25_000,
    };
    const underway = startVoyage(state, 1_000);
    expect(underway.voyage).not.toBeNull();
    expect(repairShip(underway)).toMatchObject({
      state: underway,
      error: "unavailable",
    });
    expect(buyUpgrade(underway, "hold")).toMatchObject({
      state: underway,
      error: "unavailable",
    });

    const encounter = { ...state, encounterPending: true };
    expect(repairShip(encounter).error).toBe("unavailable");
    expect(buyUpgrade(encounter, "hold").error).toBe("unavailable");
  });

  it("purchases ships only at major shipyards with a bounded fleet and clear cost", () => {
    const poor = {
      ...createNewGame("Maya"),
      coins: ADDITIONAL_SHIP_PRICE - 1,
      highestCoins: ADDITIONAL_SHIP_PRICE - 1,
    };
    expect(buyPlayerShip(poor).error).toBe("coins");

    const remotePort = {
      ...poor,
      coins: ADDITIONAL_SHIP_PRICE,
      currentTown: "patna" as const,
      selectedTown: "patna" as const,
    };
    expect(buyPlayerShip(remotePort).error).toBe("not-shipyard");

    const ready = {
      ...createNewGame("Maya"),
      coins: ADDITIONAL_SHIP_PRICE * 2,
      highestCoins: ADDITIONAL_SHIP_PRICE * 2,
    };
    const purchased = buyPlayerShip(ready);
    expect(purchased.error).toBeUndefined();
    expect(purchased.state.coins).toBe(ADDITIONAL_SHIP_PRICE);
    expect(purchased.state.fleet).toHaveLength(2);
    expect(purchased.state.fleet[1]).toMatchObject({
      id: "player-ship-2",
      name: "River Trader II",
      currentPort: "dhaka",
      shipHull: 8,
      cargoCapacity: 12,
    });
    expect(buyPlayerShip(purchased.state).state.fleet).toHaveLength(3);
    expect(buyPlayerShip(buyPlayerShip(purchased.state).state).error)
      .toBe("fleet-full");
    expect(MAX_PLAYER_SHIPS).toBe(3);
    expect(SHIPYARD_PORTS).toContain("dhaka");
  });

  it("keeps cargo, upgrades, repairs, and trade attached to the selected ship", () => {
    const purchased = buyPlayerShip({
      ...createNewGame("Maya"),
      coins: ADDITIONAL_SHIP_PRICE + 5000,
      highestCoins: ADDITIONAL_SHIP_PRICE + 5000,
    }).state;
    const selected = selectPlayerShip(purchased, "player-ship-2").state;
    const traded = buyGood(selected, "salt").state;
    const upgraded = buyUpgrade(traded, "cannon").state;
    const repaired = repairShip({ ...upgraded, shipHull: 6 }).state;
    const starter = repaired.fleet.find((ship) => ship.id === "player-ship-1")!;
    const second = repaired.fleet.find((ship) => ship.id === "player-ship-2")!;

    expect(second.cargo.salt).toBe(1);
    expect(second.upgrades.cannon).toBe(1);
    expect(second.shipHull).toBe(8);
    expect(starter.cargo).toEqual(createNewGame("Maya").cargo);
    expect(starter.upgrades.cannon).toBe(0);
    expect(starter.shipHull).toBe(8);

    const switchedBack = selectPlayerShip(repaired, "player-ship-1").state;
    expect(switchedBack.cargo).toEqual(starter.cargo);
    expect(switchedBack.upgrades.cannon).toBe(0);
    const switchedAgain = selectPlayerShip(switchedBack, "player-ship-2").state;
    expect(switchedAgain.cargo.salt).toBe(1);
    expect(switchedAgain.upgrades.cannon).toBe(1);
    expect(sellGood(switchedAgain, "salt").state.fleet[1].cargo.salt).toBe(0);
  });

  it("locks selection and purchases during a voyage and keeps ships at separate ports", () => {
    const purchased = buyPlayerShip({
      ...createNewGame("Maya"),
      coins: ADDITIONAL_SHIP_PRICE,
      highestCoins: ADDITIONAL_SHIP_PRICE,
    }).state;
    const selected = selectPlayerShip(purchased, "player-ship-2").state;
    const sailing = startVoyage(
      { ...selected, selectedTown: "sonargaon" },
      1_000,
    );

    expect(sailing.voyage?.shipId).toBe("player-ship-2");
    expect(selectPlayerShip(sailing, "player-ship-1").error).toBe("unavailable");
    expect(buyPlayerShip(sailing).error).toBe("unavailable");

    const arrived = arriveAtDestination({
      ...sailing,
      voyage: { ...sailing.voyage!, elapsedMs: sailing.voyage!.durationMs },
    });
    expect(arrived.fleet.find((ship) => ship.id === "player-ship-2")?.currentPort)
      .toBe("sonargaon");
    expect(arrived.fleet.find((ship) => ship.id === "player-ship-1")?.currentPort)
      .toBe("dhaka");
    expect(selectPlayerShip(arrived, "player-ship-1").error).toBe("not-here");
  });

  it("marks the historically inspired Chittagong route, its delay, and price effect", () => {
    const game = {
      ...createNewGame("Maya"),
      selectedTown: "chittagong" as const,
    };
    const travel = startVoyage(game, 1000);
    expect(travel.voyage?.routeAlert).toBe(true);
    expect(travel.voyage?.durationDays).toBeGreaterThan(0);
    expect(
      travel.voyage!.arrivalAt - travel.voyage!.startedAt,
    ).toBeLessThanOrEqual(MAX_NORMAL_VOYAGE_DURATION_MS);
    expect(travel.voyage?.durationDays).toBe(
      (travel.voyage!.arrivalAt - travel.voyage!.startedAt) / 60_000,
    );
    expect(getGoodPrice("chittagong", "salt", "buy", true)).toBe(990);
    expect(getGoodPrice("chittagong", "salt", "sell", true)).toBe(860);

    const alertOver = { ...game, sailingDay: 36 };
    expect(isHistoricalRouteAlertActive(alertOver)).toBe(false);
    expect(startVoyage(alertOver, 1000).voyage?.routeAlert).toBe(false);
  });

  it("arrives in Chittagong with the encounter ready to resolve", () => {
    const selected = {
      ...createNewGame("Maya"),
      selectedTown: "chittagong" as const,
      sailingSpeed: 4 as const,
    };
    const voyage = startVoyage(selected, 1000);
    const arrival = arriveAtDestination(voyage);

    expect(arrival.currentTown).toBe("chittagong");
    expect(arrival.encounterPending).toBe(true);
    expect(arrival.sailingSpeed).toBe(1);
    expect(resolveRiverEncounter(arrival).state.sailingSpeed).toBe(1);
    expect(arriveAtDestination(arrival).encounterPending).toBe(true);
    expect(
      changeVoyageSpeed(arrival, 4, 2000).sailingSpeed,
    ).toBe(1);
  });

  it("triggers the Chittagong introduction only on the first arrival", () => {
    const firstVoyage = startVoyage(
      {
        ...createNewGame("Maya"),
        selectedTown: "chittagong",
      },
      1_000,
    );
    const firstArrival = arriveAtDestination(firstVoyage);
    expect(firstArrival.encounterPending).toBe(true);
    expect(firstArrival.chittagongIntroductionSeen).toBe(true);

    const resolved = resolveRiverEncounter(firstArrival).state;
    const outwardVoyage = startVoyage(
      { ...resolved, selectedTown: "dhaka" },
      2_000,
    );
    const away = arriveAtDestination(outwardVoyage);
    const returnVoyage = startVoyage(
      { ...away, selectedTown: "chittagong" },
      3_000,
    );
    const returnArrival = arriveAtDestination(returnVoyage);

    expect(returnArrival.currentTown).toBe("chittagong");
    expect(returnArrival.chittagongIntroductionSeen).toBe(true);
    expect(returnArrival.encounterPending).toBe(false);
  });

  it("configures automated routes only for visited connected ports and non-selected ships", () => {
    const purchased = buyPlayerShip({
      ...createNewGame("Maya"),
      coins: 150_000,
      visitedTowns: ["dhaka", "sonargaon"],
    }).state;
    const shipId = purchased.fleet[1].id;
    const rules = [{ good: "lac" as const, buyAtOrigin: true, sellAtDestination: true }];
    const configured = configureAutomatedTradeRoute(
      purchased,
      shipId,
      "sonargaon",
      rules,
      25_000,
    );

    expect(configured.error).toBeUndefined();
    expect(configured.state.coins).toBe(150_000 - ADDITIONAL_SHIP_PRICE - 25_000);
    expect(configured.state.fleet[1].automatedRoute).toMatchObject({
      origin: "dhaka",
      destination: "sonargaon",
      capital: 25_000,
      status: "running",
      phase: "docked",
    });
    expect(
      configureAutomatedTradeRoute(purchased, purchased.selectedShipId, "sonargaon", rules, 0).error,
    ).toBe("active-ship");
    expect(
      configureAutomatedTradeRoute(purchased, shipId, "chittagong", rules, 0).error,
    ).toBe("port-not-visited");
    expect(
      configureAutomatedTradeRoute(purchased, shipId, "sonargaon", [], 0).error,
    ).toBe("invalid-rules");
    expect(selectPlayerShip(configured.state, shipId).error).toBe("automated");
    expect(
      configureAutomatedTradeRoute(
        { ...purchased, coins: 5000 },
        shipId,
        "sonargaon",
        rules,
        25_000,
      ).error,
    ).toBe("coins");

    const closedRouteState = {
      ...purchased,
      visitedTowns: ["dhaka", "kasimbazar"] as TownId[],
      navigationConditions: {
        eventBlockages: RIVER_EDGES.filter((edge) => edge.to === "kasimbazar" || edge.from === "kasimbazar").map((edge) => edge.id),
      },
    };
    expect(
      configureAutomatedTradeRoute(
        closedRouteState,
        shipId,
        "kasimbazar",
        rules,
        0,
      ).error,
    ).toBe("no-route");
    const playerVoyage = startVoyage(
      { ...purchased, selectedTown: "sonargaon" },
      1_000,
    );
    expect(
      configureAutomatedTradeRoute(
        playerVoyage,
        shipId,
        "sonargaon",
        rules,
        0,
      ).error,
    ).toBeUndefined();
  });

  it("trades into the shared market, travels by sailing-day checkpoints, and stays deterministic", () => {
    const purchased = buyPlayerShip({
      ...createNewGame("Maya"),
      coins: 150_000,
      visitedTowns: ["dhaka", "sonargaon"],
    }).state;
    const configured = configureAutomatedTradeRoute(
      purchased,
      purchased.fleet[1].id,
      "sonargaon",
      [{ good: "lac", buyAtOrigin: true, sellAtDestination: true }],
      25_000,
    ).state;
    const withoutAutomation = {
      ...configured,
      fleet: configured.fleet.map((ship) =>
        ship.id === configured.fleet[1].id
          ? { ...ship, automatedRoute: null }
          : ship,
      ),
    };

    const firstTick = advanceWorld(configured, 1);
    const baselineTick = advanceWorld(withoutAutomation, 1);
    const tradingShip = firstTick.fleet[1];
    expect(tradingShip.cargo.lac).toBe(1);
    const purchasePrice = getGoodPrice(
      "dhaka",
      "lac",
      "buy",
      false,
      configured.marketStock.dhaka.lac,
    );
    expect(tradingShip.automatedRoute?.capital).toBe(25_000 - purchasePrice);
    expect(firstTick.marketStock.dhaka.lac).toBe(
      baselineTick.marketStock.dhaka.lac - 1,
    );
    expect(tradingShip.automatedRoute?.phase).toBe("traveling");
    expect(tradingShip.currentPort).toBe("dhaka");
    expect(tradingShip.automatedRoute?.travelDaysRemaining).toBeGreaterThan(0);

    const travelDays = tradingShip.automatedRoute!.travelDaysTotal;
    const arrivalDay = 1 + travelDays;
    const arrived = advanceWorld(firstTick, arrivalDay);
    expect(arrived.fleet[1].currentPort).toBe("sonargaon");
    expect(arrived.fleet[1].automatedRoute?.phase).toBe("docked");
    const destinationBeforeSale = arrived.marketStock.sonargaon.lac;
    const sold = advanceWorld(arrived, arrivalDay + 1);
    expect(sold.fleet[1].cargo.lac).toBe(0);
    expect(sold.marketStock.sonargaon.lac).toBe(destinationBeforeSale + 1);
    expect(sold.fleet[1].automatedRoute?.capital).toBeGreaterThan(
      arrived.fleet[1].automatedRoute!.capital,
    );

    const jumped = advanceWorld(configured, 5);
    let stepped = configured;
    for (let day = 1; day <= 5; day += 1) stepped = advanceWorld(stepped, day);
    expect(jumped.fleet).toEqual(stepped.fleet);
    expect(jumped.marketStock).toEqual(stepped.marketStock);
  });

  it("pauses, resumes, edits, and cancels docked routes without bypassing travel", () => {
    const purchased = buyPlayerShip({
      ...createNewGame("Maya"),
      coins: 150_000,
      visitedTowns: ["dhaka", "sonargaon"],
    }).state;
    const shipId = purchased.fleet[1].id;
    const configured = configureAutomatedTradeRoute(
      purchased,
      shipId,
      "sonargaon",
      [{ good: "lac", buyAtOrigin: true, sellAtDestination: true }],
      400,
    ).state;
    const paused = setAutomatedTradeRouteStatus(configured, shipId, "paused").state;
    const held = advanceWorld(paused, 3);
    expect(held.fleet[1].currentPort).toBe("dhaka");
    expect(held.fleet[1].cargo.lac).toBe(0);
    expect(held.fleet[1].automatedRoute?.status).toBe("paused");

    const resumed = setAutomatedTradeRouteStatus(held, shipId, "running").state;
    const traveling = advanceWorld(resumed, 4);
    expect(traveling.fleet[1].automatedRoute?.phase).toBe("traveling");
    expect(setAutomatedTradeRouteStatus(traveling, shipId, "paused").error).toBe("not-docked");
    expect(cancelAutomatedTradeRoute(traveling, shipId).error).toBe("not-docked");

    const playerVoyage = startVoyage(
      { ...paused, selectedTown: "sonargaon" },
      1_000,
    );
    expect(
      setAutomatedTradeRouteStatus(playerVoyage, shipId, "running").error,
    ).toBeUndefined();
    expect(cancelAutomatedTradeRoute(playerVoyage, shipId).error).toBeUndefined();

    const edited = configureAutomatedTradeRoute(
      resumed,
      shipId,
      "sonargaon",
      [{ good: "rice", buyAtOrigin: true, sellAtDestination: true }],
      0,
    );
    expect(edited.error).toBeUndefined();
    expect(edited.state.fleet[1].automatedRoute?.rules[0].good).toBe("rice");
    expect(edited.state.fleet[1].automatedRoute?.capital).toBe(400);

    const cancelled = cancelAutomatedTradeRoute(paused, shipId);
    expect(cancelled.error).toBeUndefined();
    expect(cancelled.state.coins).toBe(purchased.coins);
    expect(cancelled.state.fleet[1].automatedRoute).toBeNull();

    const pausedEdit = configureAutomatedTradeRoute(
      paused,
      shipId,
      "sonargaon",
      [{ good: "rice", buyAtOrigin: true, sellAtDestination: true }],
      0,
    );
    expect(pausedEdit.state.fleet[1].automatedRoute?.status).toBe("paused");
  });

  it("changes a docked automated ship's route while the player's ship is sailing", () => {
    const purchased = buyPlayerShip({
      ...createNewGame("Maya"),
      coins: 150_000,
      highestCoins: 150_000,
      visitedTowns: ["dhaka", "sonargaon"],
    }).state;
    const shipId = purchased.fleet[1].id;
    const sailing = startVoyage({ ...purchased, selectedTown: "sonargaon" }, 1_000);
    expect(sailing.voyage).not.toBeNull();

    const assigned = configureAutomatedTradeRoute(
      sailing,
      shipId,
      "sonargaon",
      [{ good: "rice", buyAtOrigin: true, sellAtDestination: true }],
      400,
    );
    expect(assigned.error).toBeUndefined();
    expect(assigned.state.coins).toBe(sailing.coins - 400);
    expect(assigned.state.fleet[1].automatedRoute?.capital).toBe(400);

    const edited = configureAutomatedTradeRoute(
      assigned.state,
      shipId,
      "sonargaon",
      [{ good: "lac", buyAtOrigin: true, sellAtDestination: true }],
      0,
    );
    expect(edited.error).toBeUndefined();
    expect(edited.state.fleet[1].automatedRoute?.rules[0].good).toBe("lac");
    expect(edited.state.fleet[1].automatedRoute?.capital).toBe(400);
    expect(edited.state.coins).toBe(assigned.state.coins);

    const paused = setAutomatedTradeRouteStatus(edited.state, shipId, "paused");
    expect(paused.error).toBeUndefined();
    expect(paused.state.fleet[1].automatedRoute?.status).toBe("paused");
    const resumed = setAutomatedTradeRouteStatus(paused.state, shipId, "running");
    expect(resumed.error).toBeUndefined();
    expect(resumed.state.fleet[1].automatedRoute?.status).toBe("running");

    const cancelled = cancelAutomatedTradeRoute(resumed.state, shipId);
    expect(cancelled.error).toBeUndefined();
    expect(cancelled.state.coins).toBe(sailing.coins);
    expect(cancelled.state.fleet[1].automatedRoute).toBeNull();

    for (const changed of [assigned, edited, paused, resumed, cancelled]) {
      expect(changed.state.voyage).toEqual(sailing.voyage);
      expect(changed.state.selectedShipId).toBe(sailing.selectedShipId);
    }

    const arrived = arriveAtDestination(cancelled.state);
    expect(arrived.currentTown).toBe("sonargaon");
    expect(arrived.fleet[1].currentPort).toBe("dhaka");
  });

  it("keeps the coins peak and wealth milestone current when a route returns capital", () => {
    const purchased = buyPlayerShip({
      ...createNewGame("Maya"),
      coins: 50_000,
      highestCoins: 50_000,
      visitedTowns: ["dhaka", "sonargaon"],
    }).state;
    const shipId = purchased.fleet[1].id;
    const assigned = configureAutomatedTradeRoute(
      purchased,
      shipId,
      "sonargaon",
      [{ good: "rice", buyAtOrigin: true, sellAtDestination: true }],
      5_000,
    ).state;
    const withBalances = (coins: number, highestCoins: number, capital: number) => ({
      ...assigned,
      coins,
      highestCoins,
      completedMilestones: [],
      fleet: assigned.fleet.map((ship) =>
        ship.id === shipId
          ? { ...ship, automatedRoute: { ...ship.automatedRoute!, capital } }
          : ship,
      ),
    });

    const aboveMilestone = cancelAutomatedTradeRoute(
      withBalances(5_000, 10_000, 9_000),
      shipId,
    ).state;
    expect(aboveMilestone.coins).toBe(14_000);
    expect(aboveMilestone.highestCoins).toBe(14_000);
    expect(aboveMilestone.completedMilestones).toContain("prosperous_merchant");

    const belowMilestone = cancelAutomatedTradeRoute(
      withBalances(5_000, 6_000, 2_500),
      shipId,
    ).state;
    expect(belowMilestone.coins).toBe(7500);
    expect(belowMilestone.highestCoins).toBe(7500);
    expect(belowMilestone.completedMilestones).not.toContain("prosperous_merchant");

    const belowPeak = cancelAutomatedTradeRoute(
      withBalances(5_000, 10_000, 2_500),
      shipId,
    ).state;
    expect(belowPeak.coins).toBe(7500);
    expect(belowPeak.highestCoins).toBe(10_000);
    expect(belowPeak.completedMilestones).not.toContain("prosperous_merchant");
  });

  it("still blocks route changes for encounters, the selected ship, and ships underway", () => {
    const purchased = buyPlayerShip({
      ...createNewGame("Maya"),
      coins: 150_000,
      highestCoins: 150_000,
      visitedTowns: ["dhaka", "sonargaon"],
    }).state;
    const shipId = purchased.fleet[1].id;
    const rules = [{ good: "lac" as const, buyAtOrigin: true, sellAtDestination: true }];
    const assigned = configureAutomatedTradeRoute(
      purchased,
      shipId,
      "sonargaon",
      rules,
      20_000,
    ).state;

    const inEncounter = { ...assigned, encounterPending: true };
    expect(configureAutomatedTradeRoute(inEncounter, shipId, "sonargaon", rules, 0).error)
      .toBe("unavailable");
    expect(setAutomatedTradeRouteStatus(inEncounter, shipId, "paused").error)
      .toBe("unavailable");
    expect(cancelAutomatedTradeRoute(inEncounter, shipId).error).toBe("unavailable");

    const sailing = startVoyage({ ...assigned, selectedTown: "sonargaon" }, 1_000);
    expect(
      configureAutomatedTradeRoute(
        sailing,
        sailing.selectedShipId,
        "sonargaon",
        rules,
        5_000,
      ).error,
    ).toBe("active-ship");

    const underway = advanceWorld(sailing, 1);
    expect(underway.voyage).not.toBeNull();
    expect(underway.fleet[1].automatedRoute?.phase).toBe("traveling");
    expect(configureAutomatedTradeRoute(underway, shipId, "sonargaon", rules, 0).error)
      .toBe("not-docked");
    expect(setAutomatedTradeRouteStatus(underway, shipId, "paused").error)
      .toBe("not-docked");
    expect(cancelAutomatedTradeRoute(underway, shipId).error).toBe("not-docked");
  });

  it("respects market stock, cargo capacity, and the route capital ceiling", () => {
    const purchased = buyPlayerShip({
      ...createNewGame("Maya"),
      coins: 150_000,
      visitedTowns: ["dhaka", "sonargaon"],
    }).state;
    const shipId = purchased.fleet[1].id;
    const configured = configureAutomatedTradeRoute(
      purchased,
      shipId,
      "sonargaon",
      [{ good: "lac", buyAtOrigin: true, sellAtDestination: true }],
      10,
    ).state;
    const ship = configured.fleet[1];
    const fullHold = {
      ...configured,
      fleet: configured.fleet.map((entry) =>
        entry.id === shipId
          ? {
              ...entry,
              cargo: { ...entry.cargo, rice: entry.cargoCapacity },
            }
          : entry,
      ),
    };
    const noPurchase = advanceWorld(fullHold, 1);
    expect(noPurchase.fleet[1].cargo.lac).toBe(ship.cargo.lac);
    expect(noPurchase.marketStock.dhaka.lac).toBe(configured.marketStock.dhaka.lac);

    const noStock = {
      ...configured,
      marketStock: {
        ...configured.marketStock,
        dhaka: { ...configured.marketStock.dhaka, lac: 0 },
      },
    };
    expect(advanceWorld(noStock, 1).fleet[1].cargo.lac).toBe(0);

    const fractional = advanceWorld(configured, 0.99);
    expect(fractional.fleet[1]).toEqual(configured.fleet[1]);
    expect(fractional.marketStock).toEqual(configured.marketStock);

    const atDestination = {
      ...configured,
      marketStock: {
        ...configured.marketStock,
        sonargaon: { ...configured.marketStock.sonargaon, lac: 0 },
      },
      fleet: configured.fleet.map((entry) =>
        entry.id === shipId
          ? {
              ...entry,
              currentPort: "sonargaon" as const,
              cargo: { ...entry.cargo, lac: 1 },
              automatedRoute: {
                ...entry.automatedRoute!,
                capital: MAX_AUTOMATED_ROUTE_CAPITAL,
              },
            }
          : entry,
      ),
    };
    const noSale = advanceWorld(atDestination, 1);
    expect(noSale.fleet[1].cargo.lac).toBe(1);
    expect(noSale.marketStock.sonargaon.lac).toBe(
      advanceMarketStock(atDestination.marketStock, 1).sonargaon.lac,
    );
    expect(noSale.fleet[1].automatedRoute?.capital).toBe(
      MAX_AUTOMATED_ROUTE_CAPITAL,
    );

    const fullMarket = {
      ...configured,
      npcMerchants: [],
      marketStock: {
        ...configured.marketStock,
        sonargaon: {
          ...configured.marketStock.sonargaon,
          lac: MARKET_MAX_STOCK,
        },
      },
      fleet: configured.fleet.map((entry) =>
        entry.id === shipId
          ? {
              ...entry,
              currentPort: "sonargaon" as const,
              cargo: { ...entry.cargo, lac: 1 },
            }
          : entry,
      ),
    };
    // Stalls use up a surplus before ships sell, so even a full stall has room by then.
    const marketHeld = advanceWorld(fullMarket, 1);
    expect(marketHeld.marketStock.sonargaon.lac).toBeLessThanOrEqual(MARKET_MAX_STOCK);
    expect(marketHeld.marketStock.sonargaon.lac).toBeLessThan(MARKET_MAX_STOCK);
  });
});
