// `npm run sim` measures the benchmarks and writes sim-reports/ (not committed).
// `npm run sim:freeze` also records them, in a fixture and in ECONOMY_BENCHMARKS.md.
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "vitest";
import { createNewGame } from "../game/model";
import type { Baseline } from "./baseline";
import { buildBenchmarks, renderBenchmarks, type BenchmarkRecord } from "./benchmarks";
import approved from "./__fixtures__/economy-baseline-v25.json";
import frozen from "./__fixtures__/economy-benchmark-v25.json";

const BENCHMARK_VERSION = 28;
const before = frozen as unknown as BenchmarkRecord;

test("economy benchmarks", () => {
  const record = buildBenchmarks(approved as unknown as Baseline);
  const json = `${JSON.stringify(record, null, 1)}\n`;
  mkdirSync("sim-reports", { recursive: true });
  writeFileSync("sim-reports/benchmarks.json", json);
  writeFileSync("sim-reports/benchmarks.md", renderBenchmarks(record, before));

  if (process.env.SIM_FREEZE !== "1") return;
  expect(createNewGame("Simulated").version).toBe(BENCHMARK_VERSION);
  writeFileSync(`src/sim/__fixtures__/economy-benchmark-v${BENCHMARK_VERSION}.json`, json);
  writeFileSync("ECONOMY_BENCHMARKS.md", renderBenchmarks(record, before));
});
