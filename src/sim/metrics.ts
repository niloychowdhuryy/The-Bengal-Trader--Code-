// Measurements taken from game state. The net worth here is the harness's own estimate,
// using the proposed formula, until the game has a shared valuation of its own.
import {
  FARM_PRICE,
  GOODS,
  MARKET_BASE_PRICES,
  MARKET_MAX_STOCK,
  MARKET_PORTS,
  RESIDENCE_PRICE,
  UPGRADES,
  VESSEL_CLASSES,
  WAREHOUSE_PRICE,
  createInitialMarketStock,
  getGoodPrice,
  type GameState,
  type GoodId,
  type NpcMerchant,
} from "../game/model";

const GOODS_SHARE = 0.8;
const SHIP_SHARE = 0.6;
const PROPERTY_SHARE = 0.7;
const STALL_NEAR_LIMIT = 6;

function goodsValue(goods: Record<GoodId, number>): number {
  return GOODS.reduce(
    (total, good) => total + goods[good.id] * MARKET_BASE_PRICES[good.id] * GOODS_SHARE,
    0,
  );
}

export function estimateNetWorth(state: GameState): number {
  let worth = state.coins;
  for (const ship of state.fleet) {
    worth += goodsValue(ship.cargo);
    worth += VESSEL_CLASSES[ship.vesselClass].price * SHIP_SHARE;
    worth += (ship.automatedRoute?.capital ?? 0);
    for (const upgrade of UPGRADES) {
      const level = ship.upgrades[upgrade.id];
      // Each level costs baseCost × its own number.
      worth += upgrade.baseCost * ((level * (level + 1)) / 2) * SHIP_SHARE;
    }
  }
  for (const port of MARKET_PORTS) {
    worth += goodsValue(state.warehouseStock[port.id]);
    worth += state.farmOutput[port.id] * MARKET_BASE_PRICES.rice * GOODS_SHARE;
  }
  worth += state.ownedWarehouses.length * WAREHOUSE_PRICE * PROPERTY_SHARE;
  worth += state.ownedFarms.length * FARM_PRICE * PROPERTY_SHARE;
  if (state.residenceTown) worth += RESIDENCE_PRICE * PROPERTY_SHARE;
  return Math.round(worth);
}

export function npcWorth(merchant: NpcMerchant): number {
  return Math.round(merchant.budget + goodsValue(merchant.cargo));
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
