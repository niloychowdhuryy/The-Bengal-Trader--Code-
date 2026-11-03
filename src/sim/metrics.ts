// Measurements taken from game state. Net worth is the game's own valuation.
import { getPlayerNetWorth } from "../game/leaderboard";
import {
  GOODS,
  MARKET_MAX_STOCK,
  MARKET_PORTS,
  createInitialMarketStock,
  getGoodPrice,
  getMerchantWorth,
  type GameState,
} from "../game/model";

const STALL_NEAR_LIMIT = 6;

export const estimateNetWorth = getPlayerNetWorth;

export const npcWorth = getMerchantWorth;

/** How unevenly wealth is shared: 0 means everyone has the same, near 1 means one has it all. */
export function giniOf(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  if (total <= 0 || sorted.length === 0) return 0;
  const weighted = sorted.reduce((sum, value, index) => sum + (index + 1) * value, 0);
  return round((2 * weighted) / (sorted.length * total) - (sorted.length + 1) / sorted.length, 3);
}

export interface MarketSnapshot {
  /** Average of each stall's price against its starting price. 1 means unchanged. */
  priceIndex: number;
  /** Average distance of each stall's price from its starting price, as a share of it. */
  priceMovement: number;
  /** The most any one stall's price has moved from its start, as a share. */
  largestPriceMove: number;
  /** Stalls whose price is at least 5% from where it started. */
  stallsMoved: number;
  meanStockGap: number;
  stallsNearEmpty: number;
  stallsNearFull: number;
  stallsAtStart: number;
  stalls: number;
}

export function measureMarket(state: GameState): MarketSnapshot {
  const start = createInitialMarketStock();
  let priceRatio = 0;
  let movement = 0;
  let largestMove = 0;
  let moved = 0;
  let gap = 0;
  let nearEmpty = 0;
  let nearFull = 0;
  let atStart = 0;
  let stalls = 0;
  for (const port of MARKET_PORTS) {
    for (const good of GOODS) {
      const stock = state.marketStock[port.id][good.id];
      const startStock = start[port.id][good.id];
      const ratio =
        getGoodPrice(port.id, good.id, "buy", false, stock) /
        getGoodPrice(port.id, good.id, "buy", false, startStock);
      priceRatio += ratio;
      movement += Math.abs(ratio - 1);
      largestMove = Math.max(largestMove, Math.abs(ratio - 1));
      if (Math.abs(ratio - 1) >= 0.05) moved += 1;
      gap += Math.abs(stock - startStock);
      if (stock <= STALL_NEAR_LIMIT) nearEmpty += 1;
      if (stock >= MARKET_MAX_STOCK - STALL_NEAR_LIMIT) nearFull += 1;
      if (stock === startStock) atStart += 1;
      stalls += 1;
    }
  }
  return {
    priceIndex: round(priceRatio / stalls, 3),
    priceMovement: round(movement / stalls, 3),
    largestPriceMove: round(largestMove, 3),
    stallsMoved: moved,
    meanStockGap: round(gap / stalls, 3),
    stallsNearEmpty: nearEmpty,
    stallsNearFull: nearFull,
    stallsAtStart: atStart,
    stalls,
  };
}

export function round(value: number, places = 2): number {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** The value a fraction of the way down a list, from the best. 0.1 is the top tenth. */
export function fromTop(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => b - a);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}
