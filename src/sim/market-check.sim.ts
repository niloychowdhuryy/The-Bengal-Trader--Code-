// `SIM_MARKET=1 npm run sim` runs the market check and writes sim-reports/market-check.json.
// It takes several minutes, so normal simulation runs skip it.
import { mkdirSync, writeFileSync } from "node:fs";
import { test } from "vitest";
import { buildMarketCheck } from "./market-check";

test.runIf(process.env.SIM_MARKET === "1")("market check", () => {
  mkdirSync("sim-reports", { recursive: true });
  writeFileSync("sim-reports/market-check.json", `${JSON.stringify(buildMarketCheck(), null, 1)}\n`);
}, 590_000);
