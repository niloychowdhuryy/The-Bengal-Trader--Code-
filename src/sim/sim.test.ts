import { describe, expect, it } from "vitest";
import { applyCommand, type RecordedCommand } from "../game/commands";
import { MARKET_MAX_STOCK, MARKET_PORTS, GOODS, createNewGame, type GameState } from "../game/model";
import { replayCommands } from "../game/replay";
import { isValidGameState } from "../game/save-format";
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

const rulesAreStillV20 = createNewGame("Simulated").version === 20;

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
    expect(opium.at(-1)!.goldPer100Loops).toBeGreaterThan(0);
  });

  it("reaches that loop from a new game with normal commands, in no game time", () => {
    const demo = demonstrateSamePortLoop(50)!;
    expect(demo.goldGained).toBeGreaterThan(0);
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

describe.runIf(rulesAreStillV20)("frozen baseline", () => {
  it("still matches the rules it was recorded from", () => {
    expect(JSON.parse(JSON.stringify(buildBaseline()))).toEqual(frozenBaseline);
  });
});

describe.runIf(rulesAreStillV20)("recorded game", () => {
  const commands = recorded.commands as unknown as RecordedCommand[];
  const base = recorded.base as unknown as GameState;

  it("uses every kind of command", () => {
    const used = commandTypesUsed(commands);
    for (const type of Object.keys(ALL_COMMAND_TYPES)) {
      expect(used, type).toContain(type);
    }
  });

  it("is the game the script plays", () => {
    const sim = playRecordedGame();
    expect(sim.refused).toEqual([]);
    expect(JSON.parse(JSON.stringify(sim.log))).toEqual(recorded.commands);
  });

  it("gives every recorded amount of money after every step", () => {
    let state = base;
    const steps: MoneyStep[] = [readMoney(state, 0)];
    for (const entry of commands) {
      const result = applyCommand(state, entry.command, entry.at);
      expect(result.status, `command ${entry.seq}`).toBe("applied");
      state = result.state;
      steps.push(readMoney(state, entry.seq));
    }
    expect(steps).toEqual(recorded.steps);
  });

  it("replays as a batch to the test save", () => {
    const result = replayCommands(
      { state: base, lastSeq: 0, lastAt: recorded.startAt },
      commands,
      { receivedAt: recorded.endAt },
    );
    expect(result.status).toBe("accepted");
    if (result.status === "accepted") {
      expect(JSON.parse(JSON.stringify(result.state))).toEqual(savedGame);
    }
  });
});
