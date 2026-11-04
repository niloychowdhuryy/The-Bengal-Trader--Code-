import { describe, expect, it } from "vitest";
import { applyCommand, type RecordedCommand } from "../game/commands";
import { FARM_CROP_COST, MARKET_MAX_STOCK, MARKET_PORTS, GOODS, createNewGame } from "../game/model";
import { isValidGameState, validateSave } from "../game/save-format";
import savedGame from "../game/__fixtures__/save-v20.json";
import { measureStrategies } from "./baseline";
import { BENCHMARK_DAYS, BENCHMARKS } from "./benchmarks";
import { createSim, sail } from "./driver";
import {
  demonstrateSamePortLoop,
  findSamePortLoops,
  measureBreakInvariance,
  measureCheckpointInvariance,
  measureClosedLoops,
  measureLoopAtLowStock,
  measureNpcWorld,
  measureRecovery,
} from "./experiments";
import { purseChange } from "./ledger";
import { estimateNetWorth } from "./metrics";
import {
  ALL_COMMAND_TYPES,
  commandTypesUsed,
  playRecordedGame,
} from "./recorded-game";
import { STRATEGIES, replayMatches, runStrategy } from "./runner";
import currentBaseline from "./__fixtures__/economy-baseline-v28.json";
import benchmarkRecord from "./__fixtures__/economy-benchmark-v28.json";
import frozenBaseline from "./__fixtures__/economy-baseline-v20.json";
import recorded from "./__fixtures__/recorded-game-v20.json";

// The current record is replaced whenever the rules deliberately change.
const rulesMatchTheRecord = createNewGame("Simulated").version === currentBaseline.saveVersion;

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

describe("benchmark players", () => {
  const added = BENCHMARKS.filter((entry) => !STRATEGIES.includes(entry));

  for (const definition of added) {
    it(`${definition.id}: asks for nothing refused, and replays exactly`, () => {
      const { result, sim } = runStrategy(definition, { days: [30] });
      expect(result.refused).toEqual([]);
      expect(isValidGameState(sim.state)).toBe(true);
      expect(replayMatches(sim)).toBe(true);
    });
  }

  it("keeps the casual and mixed benchmarks exactly as they were", () => {
    for (const id of ["manual", "mixed-active"]) {
      expect(BENCHMARKS.find((entry) => entry.id === id)).toBe(STRATEGIES.find((entry) => entry.id === id));
    }
  });

  it("accounts for every Coin in a player's purse", () => {
    for (const id of ["skilled-routes", "mixed-active", "contract-focused", "farm-circuit"]) {
      const { sim } = runStrategy(BENCHMARKS.find((entry) => entry.id === id)!, { days: [90] });
      expect(purseChange(sim.ledger)).toBeCloseTo(sim.state.coins - sim.base.coins, 2);
    }
  });

  it("splits a sale of farm rice from a sale of bought rice", () => {
    const { sim } = runStrategy(BENCHMARKS.find((entry) => entry.id === "farms-3")!, { days: [120] });
    expect(sim.ledger.farmRevenue).toBeGreaterThan(0);
    expect(sim.ledger.farmUnitsSold).toBeLessThanOrEqual(sim.farmUnitsCollected);
  });

  it("gets the same skilled result every time, and merchants vary it between seeds", () => {
    const skilled = BENCHMARKS.find((entry) => entry.id === "skilled")!;
    const first = runStrategy(skilled, { seed: 2, days: [30] }).result;
    expect(runStrategy(skilled, { seed: 2, days: [30] }).result).toEqual(first);
    expect(runStrategy(skilled, { seed: 3, days: [30] }).result.snapshots[0].npcTotalWorth)
      .not.toBe(first.snapshots[0].npcTotalWorth);
  });

  it.runIf(createNewGame("Simulated").version === benchmarkRecord.saveVersion)(
    "still matches the recorded benchmarks for the skilled player",
    () => {
      const recorded = benchmarkRecord.strategies.find((entry) => entry.id === "skilled")!;
      const worths = [1, 2, 3, 4, 5].map(
        (seed) =>
          runStrategy(BENCHMARKS.find((entry) => entry.id === "skilled")!, { seed, days: [30] }).result.snapshots[0].netWorth,
      );
      expect([...worths].sort((a, b) => a - b)[2]).toBe(recorded.days[0].netWorth.median);
      expect(BENCHMARK_DAYS).toEqual(recorded.days.map((day) => day.day));
    },
    30_000,
  );
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

// These described known problems in the gold economy. Each now requires its fix.
describe("problems the Coins economy has fixed", () => {
  it("no longer lets buying and reselling at one port earn money, at any stock", () => {
    expect(findSamePortLoops()).toEqual([]);
    expect(demonstrateSamePortLoop(50)).toBeNull();
    for (const { coinsPer100Loops } of measureLoopAtLowStock("dhaka", "opium")) {
      expect(coinsPer100Loops).toBeLessThan(0);
    }
  });

  it("recovers stock by a share of the gap, so big gaps close faster and none stay open", () => {
    const [emptied, halfEmptied] = measureRecovery();
    expect(emptied.daysToFull).toBeGreaterThan(halfEmptied.daysToFull);
    expect(emptied.daysToFull).toBeLessThan(emptied.targetStock - emptied.startStock);
    for (const stall of measureRecovery()) {
      expect(stall.daysToHalfway, stall.label).toBeGreaterThanOrEqual(5);
      expect(stall.daysToHalfway, stall.label).toBeLessThanOrEqual(12);
      expect(stall.daysToFull, stall.label).toBeLessThan(60);
    }
  });

  it("makes a long round trip of one good lose money without time to recover", () => {
    const check = measureClosedLoops();
    expect(check.cycles).toBeGreaterThan(1_000);
    expect(check.profitableCycles).toBe(0);
  });

  it("gives a repeated route less than a player who follows the market", () => {
    const worth = (id: string) =>
      runStrategy(STRATEGIES.find((entry) => entry.id === id)!, { days: [200] }).result.snapshots[0].netWorth;
    expect(worth("two-port-start")).toBeLessThan(worth("manual"));
  }, 30_000);
});

// Step 4 and later balancing change these. A test that fails here should become a fix.
describe("rebalanced systems, in play", () => {
  it("records every crop cost in the ledger, and no crop goes unpaid", () => {
    const { sim } = runStrategy(BENCHMARKS.find((entry) => entry.id === "farm-circuit")!, { days: [120] });
    expect(sim.farmUnitsCollected).toBeGreaterThan(0);
    expect(sim.ledger.cropCost).toBe(sim.farmUnitsCollected * FARM_CROP_COST);
    expect(purseChange(sim.ledger)).toBeCloseTo(sim.state.coins - sim.base.coins, 2);
    expect(replayMatches(sim)).toBe(true);
  }, 30_000);

  it("lets contracts repeat without reputation running away", () => {
    const { sim } = runStrategy(BENCHMARKS.find((entry) => entry.id === "contract-focused")!, { days: [200] });
    expect(sim.ledger.contractsCompleted).toBeGreaterThan(60);
    // Two reputation for each of the 60 offers at most, plus port and trade bonuses.
    expect(sim.state.reputation).toBeLessThanOrEqual(255);
    expect(isValidGameState(sim.state)).toBe(true);
    expect(replayMatches(sim)).toBe(true);
  }, 30_000);

  it("doesn't let visit contracts alone keep up with even a casual trader", () => {
    const worth = (id: string) =>
      runStrategy(BENCHMARKS.find((entry) => entry.id === id)!, { days: [200] }).result.snapshots[0].netWorth;
    expect(worth("visit-runner")).toBeLessThan(worth("manual"));
  }, 30_000);

  it("no longer lets six farms out-earn the casual trader by more than double", () => {
    const worth = (id: string) =>
      runStrategy(STRATEGIES.find((entry) => entry.id === id)!, { days: [200] }).result.snapshots[0].netWorth;
    expect(worth("farming")).toBeLessThan(worth("manual") * 2);
  }, 30_000);
});

describe("problems still known", () => {
  it("lets a skilled trader with farms pull well ahead", () => {
    const worth = (id: string) =>
      runStrategy(BENCHMARKS.find((entry) => entry.id === id)!, { days: [200] }).result.snapshots[0].netWorth;
    expect(worth("skilled-farms")).toBeGreaterThan(worth("skilled") * 1.3);
  }, 30_000);
});

describe("rules the economy must keep", () => {
  it("counts no time while the game is closed", () => {
    expect(measureBreakInvariance()).toBe(true);
  });

  it("gives the same world however often a voyage saves its progress", () => {
    expect(measureCheckpointInvariance()).toBe(true);
  });
});

// A full baseline takes about 20 seconds, so normal tests check samples of it. The whole
// record is rebuilt by `npm run sim:freeze`.
describe.runIf(rulesMatchTheRecord)("current baseline", () => {
  it("still matches the rules it was recorded from: merchants", () => {
    const world = JSON.parse(JSON.stringify(measureNpcWorld(1)));
    expect(world).toEqual(currentBaseline.npcWorld.first);
  });

  it("still matches the rules it was recorded from: a player", () => {
    const manual = STRATEGIES.filter((entry) => entry.id === "manual");
    const measured = JSON.parse(JSON.stringify(measureStrategies(manual)));
    expect(measured).toEqual((currentBaseline.strategies as { id: string }[]).filter((entry) => entry.id === "manual"));
  }, 30_000);
});

describe("the gold-era record", () => {
  it("stays as it was measured", () => {
    expect(frozenBaseline.saveVersion).toBe(20);
    expect(recorded.saveVersion).toBe(20);
    expect(savedGame.version).toBe(20);
  });
});

describe("recorded game", () => {
  const commands = (recorded.commands as unknown as RecordedCommand[]).map((entry) =>
    entry.command.type === "configureRoute"
      ? { ...entry, command: { ...entry.command, initialCapital: entry.command.initialCapital * 50 } }
      : entry,
  );
  const base = validateSave(recorded.base, recorded.startAt);

  it("uses every kind of command", () => {
    expect(commands).toHaveLength(93);
    const used = commandTypesUsed(commands);
    for (const type of Object.keys(ALL_COMMAND_TYPES)) {
      expect(used, type).toContain(type);
    }
  });

  it("still plays through under the current rules, with the one refusal route rules explain", () => {
    // The recording's Bora route carries only sugar, which no longer pays enough to make it
    // sail to Balasore. So it stays where a Patello can reach it, and needs no return order.
    const refused: string[] = [];
    let state = base;
    for (const entry of commands) {
      const result = applyCommand(state, entry.command, entry.at);
      if (result.status !== "applied") refused.push(`${entry.seq}:${entry.command.type}:${result.error}`);
      state = result.state;
    }
    expect(refused).toEqual(["67:orderShipReturn:not-needed"]);
    expect(isValidGameState(state)).toBe(true);
  });

  it("is still a game the script can play from a new start", () => {
    const sim = playRecordedGame();
    expect(sim.refused).toEqual([]);
    expect(replayMatches(sim)).toBe(true);
  });

  it("converts its old save and its base the same way", () => {
    expect(validateSave(savedGame, recorded.endAt).coins).toBe(savedGame.gold * 50);
    expect(base.coins).toBe(recorded.base.gold * 50);
  });
});
