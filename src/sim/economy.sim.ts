// `npm run sim` measures the economy as it is now and writes sim-reports/ (not committed).
// `npm run sim:freeze` also records the current baseline and the results in
// ECONOMY_BASELINE.md. The gold-era record, the recorded game and the v20 save are not
// written here: they stay as they were measured, so later rules are compared against them.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test } from "vitest";
import { createNewGame } from "../game/model";
import { buildBaseline } from "./baseline";
import { renderComparison } from "./comparison";
import { renderBaseline } from "./report";
import oldRecord from "./__fixtures__/economy-baseline-v20.json";

const BASELINE_VERSION = 22;
const RESULTS_START = "<!-- results:start -->";
const RESULTS_END = "<!-- results:end -->";

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

  const fresh = createNewGame("Simulated");
  const sameStart = buildBaseline({ ...fresh, coins: 4_500, highestCoins: 4_500 });
  writeJson(`src/sim/__fixtures__/economy-baseline-v${BASELINE_VERSION}.json`, baseline);

  // The gold-era record below the markers stays as it was measured.
  const report = readFileSync("ECONOMY_BASELINE.md", "utf8");
  const start = report.indexOf(RESULTS_START);
  const end = report.indexOf(RESULTS_END);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  writeFileSync(
    "ECONOMY_BASELINE.md",
    `${report.slice(0, start + RESULTS_START.length)}\n\n${renderComparison(oldRecord, sameStart, baseline)}\n${report.slice(end)}`,
  );
});
