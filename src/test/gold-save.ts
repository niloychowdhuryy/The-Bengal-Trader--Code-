const COINS_PER_GOLD = 50;

function toGold(amounts: unknown): unknown {
  return amounts && typeof amounts === "object"
    ? Object.fromEntries(
        Object.entries(amounts).map(([key, amount]) => [key, Number(amount) / COINS_PER_GOLD]),
      )
    : amounts;
}

type Loose = Record<string, any>;

/**
 * A game as a save from before Coins, for testing older saves. Spreading a game and changing
 * its version isn't enough: older saves count in gold under the old field names. Fields an
 * older version didn't have can be left out.
 */
export function asGoldSave(state: Loose, version: number): Loose {
  const { coins, highestCoins, ...rest } = state;
  const old: Loose = { ...rest, version, gold: coins / COINS_PER_GOLD };
  if (highestCoins !== undefined) old.highestGold = highestCoins / COINS_PER_GOLD;
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
        capital: ship.automatedRoute.capital / COINS_PER_GOLD,
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
      budget: merchant.budget / COINS_PER_GOLD,
      cargoCost: toGold(merchant.cargoCost),
    }));
  }
  return old;
}
