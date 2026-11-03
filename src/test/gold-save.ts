const COINS_PER_GOLD = 50;

function toGold(amounts: unknown): unknown {
  return amounts && typeof amounts === "object"
    ? Object.fromEntries(
        Object.entries(amounts).map(([key, amount]) => [key, Number(amount) / COINS_PER_GOLD]),
      )
    : amounts;
}

type Loose = Record<string, any>;

// Today's prices aren't always a whole number of gold, and old saves only held whole gold.
function wholeGold(coins: number): number {
  return Math.round(coins / COINS_PER_GOLD);
}

/**
 * A game as a version 21 save, before stalls held three times the stock. Stock that isn't a
 * multiple of three rounds, as no real old save could hold it.
 */
export function asVersion21(state: Loose, version = 21): Loose {
  const { worldDay, ...rest } = state;
  const old: Loose = { ...rest, version };
  if (worldDay !== undefined) old.npcSimulationDay = worldDay;
  if (state.marketStock) {
    old.marketStock = Object.fromEntries(
      Object.entries(state.marketStock as Record<string, Record<string, number>>).map(
        ([port, stalls]) => [
          port,
          Object.fromEntries(
            Object.entries(stalls).map(([good, stock]) => [good, Math.round(Number(stock) / 3)]),
          ),
        ],
      ),
    );
  }
  return old;
}

/**
 * A game as a save from before Coins, for testing older saves. Spreading a game and changing
 * its version isn't enough: older saves count in gold under the old field names. Fields an
 * older version didn't have can be left out.
 */
export function asGoldSave(state: Loose, version: number): Loose {
  const { coins, highestCoins, ...rest } = asVersion21(state, version);
  const old: Loose = { ...rest, gold: wholeGold(coins) };
  if (highestCoins !== undefined) old.highestGold = wholeGold(highestCoins);
  if (state.averagePurchasePrice) old.averagePurchasePrice = toGold(state.averagePurchasePrice);
  if (state.warehouseAveragePurchasePrice) {
    old.warehouseAveragePurchasePrice = Object.fromEntries(
      Object.entries(state.warehouseAveragePurchasePrice).map(([port, prices]) => [port, toGold(prices)]),
    );
  }
  if (state.fleet) {
    old.fleet = state.fleet.map((ship: Loose) => ({
      ...ship,
      averagePurchasePrice: toGold(ship.averagePurchasePrice),
      automatedRoute: ship.automatedRoute && {
        ...ship.automatedRoute,
        capital: wholeGold(ship.automatedRoute.capital),
      },
    }));
  }
  if (state.missions) {
    old.missions = state.missions.map(({ rewardCoins, ...mission }: Loose) => ({
      ...mission,
      rewardGold: rewardCoins / COINS_PER_GOLD,
      targetProfit: mission.targetProfit / COINS_PER_GOLD,
      progress:
        mission.type === "profitable_trade" ? mission.progress / COINS_PER_GOLD : mission.progress,
    }));
  }
  if (state.npcMerchants) {
    old.npcMerchants = state.npcMerchants.map((merchant: Loose) => ({
      ...merchant,
      budget: wholeGold(merchant.budget),
      cargoCost: toGold(merchant.cargoCost),
    }));
  }
  return old;
}
