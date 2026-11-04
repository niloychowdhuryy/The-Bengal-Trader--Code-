import { describe, expect, it } from "vitest";
import { findConfigProblems, type GameConfig } from "./validate";
import * as economy from "./economy";
import * as market from "./market";
import * as merchants from "./merchants";
import * as ships from "./ships";
import * as specialties from "./specialties";
import * as towns from "./towns";
import * as travel from "./travel";

const good: GameConfig = { economy, market, merchants, ships, specialties, towns, travel };
const configSources = import.meta.glob(["./*.ts", "!./*.test.ts"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const ruleSources = import.meta.glob(
  ["../model.ts", "../npc.ts", "../commands.ts", "../replay.ts", "../save-format.ts", "../leaderboard.ts", "../navigation.ts", "../travel-time.ts"],
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

describe("game configuration", () => {
  it("has nothing out of range", () => {
    expect(findConfigProblems()).toEqual([]);
  });

  it("reports values that would break the game", () => {
    const withMarket = (values: Partial<GameConfig["market"]>) =>
      findConfigProblems({ ...good, market: { ...market, ...values } });
    expect(withMarket({ MARKET_PRICE_WEIGHT: 0.5 }).join()).toContain("MARKET_PRICE_WEIGHT");
    expect(withMarket({ MARKET_MAX_STOCK: 50 }).join()).toContain("Usual stock");
    expect(withMarket({ MARKET_RECOVERY_BY_TIER: { 1: 0.06, 2: 1.5, 3: 0.12 } }).join()).toContain("tier 2");
    expect(withMarket({ MARKET_DAILY_FLOW_BY_TIER: { 1: 0, 2: 2, 3: 3 } }).join()).toContain("never recover");
    expect(
      findConfigProblems({ ...good, towns: { ...towns, MARKET_BASE_PRICES: { ...towns.MARKET_BASE_PRICES, rice: 402 } } }).join(),
    ).toContain("rice");
    expect(
      findConfigProblems({
        ...good,
        towns: {
          ...towns,
          PORT_ECONOMIES: { ...towns.PORT_ECONOMIES, dhaka: { supply: { rice: 4 as 3 }, demand: {} } },
        },
      }).join(),
    ).toContain("dhaka's supply of rice");
    expect(
      findConfigProblems({ ...good, merchants: { ...merchants, STANDING_WORTH: [25_000, 12_000, 60_000, 150_000] } }).join(),
    ).toContain("STANDING_WORTH");
  });

  it("imports nothing at run time from game rules, so it can't create a circular import", () => {
    for (const [file, source] of Object.entries(configSources)) {
      if (file.endsWith("validate.ts")) continue;
      expect(source.match(/^import (?!type )/gm), file).toBeNull();
    }
  });

  it("keeps display switches out of game rules, so saved games still replay", () => {
    for (const [file, source] of Object.entries(ruleSources)) {
      expect(source.includes("config/features"), file).toBe(false);
    }
  });
});
