import { describe, expect, it } from "vitest";
import { applyCommand, type RecordedCommand } from "../game/commands";
import { MARKET_MAX_STOCK, MARKET_PORTS, GOODS, createNewGame } from "../game/model";
import { isValidGameState, validateSave } from "../game/save-format";
import savedGame from "../game/__fixtures__/save-v20.json";
import { measureStrategies } from "./baseline";
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
import { estimateNetWorth } from "./metrics";
import {
  ALL_COMMAND_TYPES,
  commandTypesUsed,
  playRecordedGame,
} from "./recorded-game";
import { STRATEGIES, replayMatches, runStrategy } from "./runner";
import currentBaseline from "./__fixtures__/economy-baseline-v24.json";
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
describe("problems still known", () => {
  it("lets farms out-earn trading by far", () => {
    const worth = (id: string) =>
      runStrategy(STRATEGIES.find((entry) => entry.id === id)!, { days: [200] }).result.snapshots[0].netWorth;
    expect(worth("farming")).toBeGreaterThan(worth("manual") * 2);
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

  it("still plays through under the current rules, every command accepted", () => {
    let state = base;
    for (const entry of commands) {
      const result = applyCommand(state, entry.command, entry.at);
      expect(result.status, `command ${entry.seq}: ${result.error}`).toBe("applied");
      state = result.state;
    }
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
