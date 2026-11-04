// What things cost and pay, outside the market itself.
import type { GoodId } from "../model";

export const STARTING_COINS = 5_000;
export const STARTING_CARGO: Partial<Record<GoodId, number>> = { rice: 2, muslin: 1 };

// ---- Property and household ----
export const WAREHOUSE_PRICE = 7_500;
export const WAREHOUSE_CAPACITY = 20;
export const RESIDENCE_PRICE = 12_500;
export const MARRIAGE_HOUSEHOLD_COST = 5_000;

// ---- Farms ----
export const FARM_PRICE = 20_000;
export const FARM_CROP_COST = 150;
export const FARM_OUTPUT_CAPACITY = 20;
export const FARM_DAILY_OUTPUT = 1;
export const FARM_GOOD_ID: GoodId = "rice";

// ---- Contracts ----
export const CONTRACT_REPEAT_DAYS = 40;
export const MAX_ACTIVE_CONTRACTS = 2;
/** Delivery rewards, as a share of what the goods are worth at their base price. */
export const DELIVERY_REWARD_SHARE = 1.3;
export const VISIT_REWARD = 500;
export const DELIVERY_QUANTITY = 2;
export const DELIVERY_DEADLINE_DAYS = 24;
export const VISIT_DEADLINE_DAYS = 30;
export const PROFIT_CONTRACT_TARGET = 1_250;
export const PROFIT_CONTRACT_REWARD = 1_100;
export const PROFIT_CONTRACT_DEADLINE_DAYS = 20;

// ---- Reputation and milestones ----
/** Earned from a contract's first success only. */
export const CONTRACT_REPUTATION = 2;
export const CONTRACT_LOCAL_STANDING = 5;
export const NEW_PORT_REPUTATION = 1;
export const PROFITABLE_TRADE_REPUTATION = 1;
export const PROSPEROUS_MERCHANT_COINS = 12_500;
export const MILESTONE_PORTS_VISITED = 5;
export const MILESTONE_PROFITABLE_MARKETS = 5;

// ---- Automated routes ----
/** A route only buys what clears this margin over the round trip. */
export const ROUTE_MINIMUM_MARGIN = 0.1;
export const MAX_AUTOMATED_ROUTE_CAPITAL = 250_000;

// ---- Rescue ----
// A last resort for a merchant with no way to carry on. It lends what's needed to move
// again, at a price, so a rescue always leaves the player worse off than before it.
export const RESCUE_PURSE = 1_000;
export const RESCUE_HULL = 2;
export const RESCUE_FEE_SHARE = 0.25;
export const RESCUE_REPUTATION_COST = 2;

// ---- Net worth ----
// How rankings value what a merchant or player owns, so both are measured the same way.
export const WORTH_GOODS_SHARE = 0.8;
export const WORTH_SHIP_SHARE = 0.6;
export const WORTH_PROPERTY_SHARE = 0.7;
export const LEADERBOARD_INTERVAL_DAYS = 5;
