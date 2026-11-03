// `npm run sim` measures the economy as it is now and writes sim-reports/ (not committed).
// `npm run sim:freeze` also records the baseline and test saves. It only works on the rules
// they describe, so it now refuses: the record stays as the gold economy it measured.
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "vitest";
import { applyCommand } from "../game/commands";
import { createNewGame } from "../game/model";
import { buildBaseline } from "./baseline";
import { playRecordedGame, readMoney } from "./recorded-game";
import { renderBaseline } from "./report";

const BASELINE_VERSION = 20;

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 1)}\n`);
}

test("economy report", () => {
  const baseline = buildBaseline();
  mkdirSync("sim-reports", { recursive: true });
  writeJson("sim-reports/latest.json", baseline);
  writeFileSync("sim-reports/latest.md", renderBaseline(baseline));

  if (process.env.SIM_FREEZE !== "1") return;
  expect(createNewGame("Simulated").version).toBe(BASELINE_VERSION);

  mkdirSync("src/sim/__fixtures__", { recursive: true });
  writeJson("src/sim/__fixtures__/economy-baseline-v20.json", baseline);
  writeFileSync("ECONOMY_BASELINE.md", renderBaseline(baseline, { findings: true }));

  const sim = playRecordedGame();
  let state = sim.base;
  const steps = [readMoney(state, 0)];
  // Each step comes from a real replay of the commands so far, not from the live run.
  for (const entry of sim.log) {
    state = applyCommand(state, entry.command, entry.at).state;
    steps.push(readMoney(state, entry.seq));
  }
  writeJson("src/sim/__fixtures__/recorded-game-v20.json", {
    note: "Commands from `base`, with every amount of money after each. Step 2 replays these under Coins and expects ×50. Scale the initialCapital of configureRoute commands too.",
    saveVersion: BASELINE_VERSION,
    startAt: sim.log[0].at,
    endAt: sim.at,
    base: sim.base,
    commands: sim.log,
    steps,
  });
  writeJson("src/game/__fixtures__/save-v20.json", sim.state);
});
