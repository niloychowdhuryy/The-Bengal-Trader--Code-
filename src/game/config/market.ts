// How prices and stalls behave. Every value here changes game rules, so see "Changing game
// values" in ARCHITECTURE.md before editing.
import type { MarketTier } from "../model";

/** How far each step between a town's demand and supply tiers moves its price. */
export const MARKET_PRICE_WEIGHT = 0.15;

export const MARKET_TARGET_STOCK = 60;
export const MARKET_SUPPLY_TIER_STOCK = 12;
export const MARKET_MAX_STOCK = 120;
// Softens the stock curve, so a stall's price at its usual stock doesn't swing on one sale.
export const MARKET_STOCK_CUSHION = 30;
// Prices stay between these shares of a good's base price, before any event.
export const MARKET_MIN_PRICE_SHARE = 0.4;
export const MARKET_MAX_PRICE_SHARE = 2.5;
// Quotes move in whole steps of this many Coins.
export const MARKET_PRICE_STEP = 5;
export const MARKET_SELL_SPREAD = 0.12;
// The share of the gap to its usual stock that a stall closes each day, at least one unit.
// Producers restock faster and big buyers use up a surplus faster, which is what makes one
// town's shortage last longer than another's.
export const MARKET_RECOVERY_BY_TIER: Record<MarketTier, number> = { 1: 0.06, 2: 0.08, 3: 0.12 };
// Units a town makes or uses in an ordinary day. Everyday trade is absorbed by this flow, so
// small gaps close in days, while the shares above decide how long a real shortage lasts.
export const MARKET_DAILY_FLOW_BY_TIER: Record<MarketTier, number> = { 1: 1, 2: 2, 3: 3 };

/** Added to Chittagong's salt during the historical route alert. */
export const CHITTAGONG_ALERT_SALT_SURCHARGE = 300;
