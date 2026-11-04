// Catches a mistyped value before it reaches players. Run by config.test.ts.
import * as economy from "./economy";
import * as market from "./market";
import * as merchants from "./merchants";
import * as ships from "./ships";
import * as specialties from "./specialties";
import * as towns from "./towns";
import * as travel from "./travel";

const current = { economy, market, merchants, ships, specialties, towns, travel };

/** Values as their general type, so a different number can be checked. */
type Adjustable<T> = {
  [K in keyof T]: T[K] extends number ? number : T[K] extends string ? string : T[K];
};

export interface GameConfig {
  economy: Adjustable<Pick<
    typeof economy,
    "DELIVERY_REWARD_SHARE" | "FARM_GOOD_ID" | "FARM_PRICE" | "ROUTE_MINIMUM_MARGIN" | "RESCUE_FEE_SHARE" | "WORTH_GOODS_SHARE" | "WORTH_PROPERTY_SHARE" | "WORTH_SHIP_SHARE"
  >>;
  market: Adjustable<Pick<
    typeof market,
    | "MARKET_DAILY_FLOW_BY_TIER"
    | "MARKET_MAX_PRICE_SHARE"
    | "MARKET_MAX_STOCK"
    | "MARKET_MIN_PRICE_SHARE"
    | "MARKET_PRICE_STEP"
    | "MARKET_PRICE_WEIGHT"
    | "MARKET_RECOVERY_BY_TIER"
    | "MARKET_SELL_SPREAD"
    | "MARKET_STOCK_CUSHION"
    | "MARKET_SUPPLY_TIER_STOCK"
    | "MARKET_TARGET_STOCK"
  >>;
  merchants: Adjustable<Pick<typeof merchants, "STALL_CEILING_SHARE" | "STALL_FLOOR_SHARE" | "STANDING_NAMES" | "STANDING_WORTH" | "TEMPERAMENTS">>;
  ships: Pick<typeof ships, "DAILY_RUNNING_COST" | "SHIPYARD_PORTS" | "UPGRADES" | "VESSEL_CLASSES">;
  specialties: Pick<typeof specialties, "TOWN_SPECIALTY_SETTINGS">;
  towns: Pick<typeof towns, "MARKET_BASE_PRICES" | "PORT_ECONOMIES">;
  travel: Adjustable<Pick<typeof travel, "IN_GAME_DAY_DURATION_MS" | "MAX_NORMAL_VOYAGE_DURATION_MS" | "SAILING_SPEEDS">>;
}

function isShare(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/** Everything wrong with these values, in words. Empty means they're fine. */
export function findConfigProblems(config: GameConfig = current): string[] {
  const problems: string[] = [];
  const check = (ok: boolean, problem: string) => {
    if (!ok) problems.push(problem);
  };
  const { economy, market, merchants, ships, specialties, towns, travel } = config;

  const widestGap = 2; // Demand tier 1 against supply tier 3.
  check(
    isPositive(market.MARKET_PRICE_WEIGHT) && 1 - widestGap * market.MARKET_PRICE_WEIGHT > 0,
    "MARKET_PRICE_WEIGHT must leave every town's price above zero.",
  );
  const lowestUsual = market.MARKET_TARGET_STOCK - market.MARKET_SUPPLY_TIER_STOCK;
  const highestUsual = market.MARKET_TARGET_STOCK + market.MARKET_SUPPLY_TIER_STOCK;
  check(lowestUsual > 0 && highestUsual <= market.MARKET_MAX_STOCK, "Usual stock must stay between 0 and MARKET_MAX_STOCK.");
  check(isPositive(market.MARKET_STOCK_CUSHION), "MARKET_STOCK_CUSHION must be above zero.");
  check(
    isPositive(market.MARKET_MIN_PRICE_SHARE) && market.MARKET_MIN_PRICE_SHARE < 1 && market.MARKET_MAX_PRICE_SHARE > 1,
    "Price limits must sit either side of the base price.",
  );
  check(Number.isInteger(market.MARKET_PRICE_STEP) && market.MARKET_PRICE_STEP > 0, "MARKET_PRICE_STEP must be a whole number above zero.");
  check(isShare(market.MARKET_SELL_SPREAD), "MARKET_SELL_SPREAD must be a share between 0 and 1.");
  for (const tier of [1, 2, 3] as const) {
    check(isShare(market.MARKET_RECOVERY_BY_TIER[tier]), `Recovery for tier ${tier} must be a share between 0 and 1.`);
    check(
      Number.isInteger(market.MARKET_DAILY_FLOW_BY_TIER[tier]) && market.MARKET_DAILY_FLOW_BY_TIER[tier] >= 1,
      `Daily flow for tier ${tier} must be a whole number of at least 1, or a stall could never recover.`,
    );
  }

  const goods = Object.keys(towns.MARKET_BASE_PRICES);
  const ports = Object.keys(towns.PORT_ECONOMIES);
  for (const good of goods) {
    const price = towns.MARKET_BASE_PRICES[good as keyof typeof towns.MARKET_BASE_PRICES];
    check(isPositive(price) && price % market.MARKET_PRICE_STEP === 0, `The base price of ${good} must be a positive multiple of the price step.`);
  }
  for (const port of ports) {
    const profile = towns.PORT_ECONOMIES[port as keyof typeof towns.PORT_ECONOMIES];
    for (const [side, tiers] of Object.entries(profile)) {
      for (const [good, tier] of Object.entries(tiers)) {
        check(goods.includes(good), `${port} lists ${side} of ${good}, which isn't a good.`);
        check(tier === 1 || tier === 2 || tier === 3, `${port}'s ${side} of ${good} must be tier 1, 2 or 3.`);
      }
    }
  }

  check(goods.includes(economy.FARM_GOOD_ID), "FARM_GOOD_ID must be a good.");
  check(isPositive(economy.FARM_PRICE), "FARM_PRICE must be above zero.");
  check(isPositive(economy.DELIVERY_REWARD_SHARE), "DELIVERY_REWARD_SHARE must be above zero.");
  check(economy.ROUTE_MINIMUM_MARGIN >= 0, "ROUTE_MINIMUM_MARGIN can't be negative.");
  check(economy.RESCUE_FEE_SHARE > 0, "RESCUE_FEE_SHARE must be above zero, so a rescue always costs something.");
  for (const share of [economy.WORTH_GOODS_SHARE, economy.WORTH_SHIP_SHARE, economy.WORTH_PROPERTY_SHARE]) {
    check(isShare(share), "Net worth shares must be between 0 and 1.");
  }

  for (const vessel of Object.values(ships.VESSEL_CLASSES)) {
    check(
      [vessel.price, vessel.baseHold, vessel.baseHull, vessel.repairCostPerHull, vessel.travelFactor, vessel.routeUnitsPerGood].every(isPositive),
      `${vessel.name} needs a positive price, hold, hull, repair cost, travel factor and route load.`,
    );
    check(isPositive(ships.DAILY_RUNNING_COST[vessel.id]), `${vessel.name} needs a daily running cost.`);
    check(vessel.barredPorts.every((port) => ports.includes(port)), `${vessel.name} is barred from a port that doesn't exist.`);
  }
  check(ships.SHIPYARD_PORTS.every((port) => ports.includes(port)), "Every shipyard must be at a real port.");
  for (const upgrade of ships.UPGRADES) {
    check(isPositive(upgrade.baseCost) && upgrade.maxLevel >= 1, `${upgrade.name} needs a positive cost and level.`);
  }

  check(isPositive(travel.IN_GAME_DAY_DURATION_MS), "IN_GAME_DAY_DURATION_MS must be above zero.");
  check(isPositive(travel.MAX_NORMAL_VOYAGE_DURATION_MS), "MAX_NORMAL_VOYAGE_DURATION_MS must be above zero.");
  check((travel.SAILING_SPEEDS as readonly number[]).includes(1), "SAILING_SPEEDS must include normal speed, 1.");

  check(merchants.STALL_FLOOR_SHARE < 1 && merchants.STALL_CEILING_SHARE > 1, "Merchants' stall limits must sit either side of usual stock.");
  check(merchants.STANDING_NAMES.length === merchants.STANDING_WORTH.length + 1, "Each standing after the first needs a worth.");
  check(
    merchants.STANDING_WORTH.every((worth, index, all) => index === 0 || worth > all[index - 1]),
    "STANDING_WORTH must rise.",
  );
  for (const [name, rules] of Object.entries(merchants.TEMPERAMENTS)) {
    check(
      [rules.minMargin, rules.loadMargin, rules.reserve, rules.riskPerDay, rules.priceError].every(isShare),
      `The ${name} temperament's margins and shares must be between 0 and 1.`,
    );
    check(rules.loadMargin <= rules.minMargin, `The ${name} temperament's loadMargin can't exceed its minMargin.`);
  }

  const settings = specialties.TOWN_SPECIALTY_SETTINGS;
  check(settings.supportedBases.length > 0, "At least one kind of evidence must count as supported.");
  check(Boolean(settings.heading && settings.assumptionLabel && settings.undiscoveredMessage), "Town specialty wording can't be empty.");

  return problems;
}
