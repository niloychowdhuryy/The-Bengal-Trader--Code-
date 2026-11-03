import { describe, expect, it } from "vitest";
import { applyCommand, type RecordedCommand } from "../game/commands";
import { MARKET_MAX_STOCK, MARKET_PORTS, GOODS, createNewGame, type GameState } from "../game/model";
import { replayCommands } from "../game/replay";
import { isValidGameState, validateSave } from "../game/save-format";
import savedGame from "../game/__fixtures__/save-v20.json";
import { buildBaseline } from "./baseline";
import { createSim, sail } from "./driver";
import {
  demonstrateSamePortLoop,
  findSamePortLoops,
  measureBreakInvariance,
  measureLoopAtLowStock,
  measureNpcWorld,
  measureRecovery,
} from "./experiments";
import { estimateNetWorth } from "./metrics";
import {
  ALL_COMMAND_TYPES,
  commandTypesUsed,
  playRecordedGame,
  readMoney,
  type MoneyStep,
} from "./recorded-game";
import { STRATEGIES, replayMatches, runStrategy } from "./runner";
import frozenBaseline from "./__fixtures__/economy-baseline-v20.json";
import recorded from "./__fixtures__/recorded-game-v20.json";

type Loose = Record<string, any>;

// Pricing changes in the next save version, and these comparisons no longer apply from then.
const rulesAreCoinsOnly = createNewGame("Simulated").version === 21;

describe("simulation driver", () => {
  it("plays through real commands, so a run can be rebuilt from its log", () => {
    const sim = createSim(createNewGame("Simulated"));
    expect(sail(sim, "hooghly")).toBe(true);
    expect(sim.log.map((entry) => entry.command.type)).toEqual([
      "selectDestination",
      "startVoyage",
      "arrive",
    ]);
    expect(replayMatches(sim)).toBe(true);
  });

  it("values a new game the same way every time", () => {
    expect(estimateNetWorth(createNewGame("A"))).toBe(estimateNetWorth(createNewGame("B")));
  });
});

describe("scripted players", () => {
  for (const definition of STRATEGIES) {
    it(`${definition.id}: asks for nothing refused, and replays exactly`, () => {
      const { result, sim } = runStrategy(definition, { days: [30] });
      expect(result.refused).toEqual([]);
      expect(result.snapshots[0].sailingDay).toBeGreaterThanOrEqual(30);
      expect(isValidGameState(sim.state)).toBe(true);
      expect(replayMatches(sim)).toBe(true);
    });
  }

  it("gives the same result for the same seed, and can differ for another", () => {
    const manual = STRATEGIES.find((entry) => entry.id === "manual")!;
    const first = runStrategy(manual, { seed: 3, days: [30] }).result;
    const again = runStrategy(manual, { seed: 3, days: [30] }).result;
    const other = runStrategy(manual, { seed: 4, days: [30] }).result;
    expect(again).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it("keeps every stall within its limits after a long run", () => {
    const { sim } = runStrategy(STRATEGIES.find((entry) => entry.id === "farming")!, { days: [90] });
    for (const port of MARKET_PORTS) {
      for (const good of GOODS) {
        const stock = sim.state.marketStock[port.id][good.id];
        expect(stock).toBeGreaterThanOrEqual(0);
        expect(stock).toBeLessThanOrEqual(MARKET_MAX_STOCK);
      }
    }
  });
});

// These describe today's rules on purpose. When a stage fixes one, its test should change
// to require the fix, not disappear.
describe("known problems in the current economy", () => {
  it("still lets buying and reselling at one port earn money at low stock", () => {
    expect(findSamePortLoops().length).toBeGreaterThan(0);
    const opium = measureLoopAtLowStock("dhaka", "opium");
    expect(opium.at(-1)!.coinsPer100Loops).toBeGreaterThan(0);
  });

  it("reaches that loop from a new game with normal commands, in no game time", () => {
    const demo = demonstrateSamePortLoop(50)!;
    expect(demo.coinsGained).toBeGreaterThan(0);
    expect(demo.inGameDaysUsed).toBe(0);
    expect(demo.commandsRejected).toBe(0);
  });

  it("recovers stock by one unit a day, whatever the gap", () => {
    const [emptied, halfEmptied] = measureRecovery();
    expect(emptied.daysToFull).toBe(emptied.targetStock - emptied.startStock);
    expect(halfEmptied.daysToFull).toBe(halfEmptied.targetStock - halfEmptied.startStock);
  });

  it("leaves NPC merchants stalled, and never docked with cargo to trade", () => {
    const world = measureNpcWorld();
    expect(world.stalledAtEnd).toBeGreaterThan(0);
    expect(world.merchants.every((merchant) => merchant.daysDockedWithCargo === 0)).toBe(true);
  });
});

describe("rules the economy must keep", () => {
  it("counts no time while the game is closed", () => {
    expect(measureBreakInvariance()).toBe(true);
  });
});

// Coins changed the money and nothing else, so until the rules next change, a game given
// the old starting amount must play exactly as the frozen record did, at 50×.
describe.runIf(rulesAreCoinsOnly)("frozen baseline at 50×", () => {
  const frozen = frozenBaseline as Loose;
  const current = buildBaseline({
    ...createNewGame("Simulated"),
    coins: 4_500,
    highestCoins: 4_500,
  }) as Loose;

  // Old results were rounded in gold, so amounts built from them can differ by that rounding.
  const within = (actual: number, expected: number, tolerance: number) =>
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);

  it("plays every strategy the same, with every purse exactly ×50", () => {
    expect(current.strategies.map((entry: Loose) => entry.id)).toEqual(
      frozen.strategies.map((entry: Loose) => entry.id),
    );
    current.strategies.forEach((strategy: Loose, index: number) => {
      const old = frozen.strategies[index];
      expect(strategy.firstDay, strategy.id).toEqual(old.firstDay);
      expect(strategy.refusedCommands, strategy.id).toBe(0);
      expect(strategy.allRunsReplayExactly, strategy.id).toBe(true);
      expect(strategy.farmUnitsCollected, strategy.id).toBe(old.farmUnitsCollected);
      expect(strategy.commands, strategy.id).toBe(old.commands);
      strategy.days.forEach((day: Loose, dayIndex: number) => {
        const before = old.days[dayIndex];
        expect(day.coins, strategy.id).toEqual({
          min: before.gold.min * 50,
          median: before.gold.median * 50,
          max: before.gold.max * 50,
        });
        within(day.netWorth.median, before.netWorth.median * 50, 25);
        for (const field of [
          "voyages",
          "realMinutes",
          "reputation",
          "standing",
          "portsVisited",
          "milestones",
          "contractsDone",
          "fleet",
          "priceIndex",
          "meanStockGap",
          "stallsNearEmpty",
          "stallsNearFull",
          "stallsAtStart",
        ]) {
          expect(day[field], `${strategy.id} ${field}`).toBe(before[field]);
        }
      });
    });
  });

  it("leaves routes, recovery, investments, contracts and NPCs the same", () => {
    expect(current.recovery).toEqual(frozen.recovery);
    current.firstTrips.forEach((trip: Loose, index: number) => {
      const old = frozen.firstTrips[index];
      expect(trip.best.profit).toBe(old.best.profit * 50);
      expect([trip.routes, trip.profitableRoutes, trip.best.from, trip.best.to, trip.best.good]).toEqual(
        [old.routes, old.profitableRoutes, old.best.from, old.best.to, old.best.good],
      );
    });
    expect(current.sustainedRoutes.best.map((route: Loose) => [route.first, route.second])).toEqual(
      frozen.sustainedRoutes.best.map((route: Loose) => [route.first, route.second]),
    );
    current.investments.routeShips.forEach((ship: Loose, index: number) => {
      const old = frozen.investments.routeShips[index];
      expect(ship.price).toBe(old.price * 50);
      expect(ship.capitalEnd).toBe(old.capitalEnd * 50);
      expect(ship.paybackDays).toBe(old.paybackDays);
    });
    expect(current.investments.farm.paybackDays).toBe(frozen.investments.farm.paybackDays);
    current.contracts.forEach((contract: Loose, index: number) => {
      const old = frozen.contracts[index];
      expect(contract.averageReward).toBe(old.averageReward * 50);
      expect(contract.worthDoing).toBe(old.worthDoing);
    });
    expect(current.npcWorld.stalledAtEnd).toBe(frozen.npcWorld.stalledAtEnd);
    expect(current.npcWorld.unitsMovedPerDay).toBe(frozen.npcWorld.unitsMovedPerDay);
    current.npcWorld.merchants.forEach((merchant: Loose, index: number) => {
      const old = frozen.npcWorld.merchants[index];
      expect(merchant.trips).toBe(old.trips);
      expect(merchant.lastTradeDay).toBe(old.lastTradeDay);
      expect(merchant.purseAt[200]).toBe(old.purseAt[200] * 50);
      expect(merchant.estimatedIncomeLostToCap).toBe(old.estimatedIncomeLostToCap * 50);
    });
  });

  it("leaves the known exploit as it was, at 50×", () => {
    const loop = current.exploits.samePortLoop;
    const old = frozen.exploits.samePortLoop;
    expect(loop.stallsExposed).toBe(old.stallsExposed);
    expect(loop.stallsExposedWithinOneHold).toBe(old.stallsExposedWithinOneHold);
    expect(loop.demonstration.coinsGained).toBe(old.demonstration.goldGained * 50);
    expect(loop.demonstration.dayStarted).toBe(old.demonstration.dayStarted);
    expect(loop.demonstration.unitsBought).toBe(old.demonstration.unitsBought);
  });
});

describe.runIf(rulesAreCoinsOnly)("recorded game under Coins", () => {
  const commands = (recorded.commands as unknown as RecordedCommand[]).map((entry) =>
    entry.command.type === "configureRoute"
      ? { ...entry, command: { ...entry.command, initialCapital: entry.command.initialCapital * 50 } }
      : entry,
  );
  const base = validateSave(recorded.base, recorded.startAt);

  function replayed(): { state: GameState; steps: MoneyStep[] } {
    let state = base;
    const steps = [readMoney(state, 0)];
    for (const entry of commands) {
      const result = applyCommand(state, entry.command, entry.at);
      expect(result.status, `command ${entry.seq}: ${result.error}`).toBe("applied");
      state = result.state;
      steps.push(readMoney(state, entry.seq));
    }
    return { state, steps };
  }

  it("still uses every kind of command", () => {
    expect(commands).toHaveLength(93);
    const used = commandTypesUsed(commands);
    for (const type of Object.keys(ALL_COMMAND_TYPES)) {
      expect(used, type).toContain(type);
    }
  });

  it("has every amount of money exactly ×50 after every one of the 93 commands", () => {
    const { steps } = replayed();
    const frozenSteps = recorded.steps as unknown as Loose[];
    expect(steps).toHaveLength(94);
    steps.forEach((step, index) => {
      const old = frozenSteps[index];
      const label = `after command ${step.seq}`;
      expect(step.coins, label).toBe(old.gold * 50);
      expect(step.highestCoins, label).toBe(old.highestGold * 50);
      expect(step.routeCapital, label).toBe(old.routeCapital * 50);
      expect(step.npcPurses, label).toBe(old.npcPurses * 50);
      expect(step.contractRewards, label).toBe(old.contractRewards * 50);
      expect(step.contractProfitProgress, label).toBe(old.contractProfitProgress * 50);
      // Averages divide, so these can differ by a rounding error far below one Coin.
      expect(step.cargoCostBasis, label).toBeCloseTo(old.cargoCostBasis * 50, 6);
      expect(step.warehouseCostBasis, label).toBeCloseTo(old.warehouseCostBasis * 50, 6);
      expect(step.sailingDay, label).toBe(old.sailingDay);
      expect(step.reputation, label).toBe(old.reputation);
      expect(step.cargoUnits, label).toBe(old.cargoUnits);
    });
  });

  it("is the game the script still plays", () => {
    const sim = playRecordedGame();
    expect(sim.refused).toEqual([]);
    expect(JSON.parse(JSON.stringify(sim.log))).toEqual(commands);
  });

  it("ends the same whether played in Coins or played in gold and then converted", () => {
    const { state } = replayed();
    const converted = validateSave(savedGame, recorded.endAt);
    expect(state.coins).toBe(converted.coins);
    expect(state.highestCoins).toBe(converted.highestCoins);
    expect(state.marketStock).toEqual(converted.marketStock);
    expect(state.missions).toEqual(converted.missions);
    expect(state.lastMessage).toBe(converted.lastMessage);
    state.fleet.forEach((ship, index) => {
      const other = converted.fleet[index];
      expect(ship.automatedRoute?.capital).toBe(other.automatedRoute?.capital);
      expect(ship.automationLog).toEqual(other.automationLog);
      expect(ship.cargo).toEqual(other.cargo);
      for (const { id } of GOODS) {
        expect(ship.averagePurchasePrice[id]).toBeCloseTo(other.averagePurchasePrice[id], 6);
      }
    });
    state.npcMerchants.forEach((merchant, index) => {
      expect(merchant.budget).toBe(converted.npcMerchants[index].budget);
    });
    expect(isValidGameState(state)).toBe(true);
  });

  it("replays as a batch", () => {
    const result = replayCommands(
      { state: base, lastSeq: 0, lastAt: recorded.startAt },
      commands,
      { receivedAt: recorded.endAt },
    );
    expect(result.status).toBe("accepted");
    if (result.status === "accepted") {
      expect(JSON.stringify(result.state)).toBe(JSON.stringify(replayed().state));
    }
  });
});
