// Offline rankings of the player against the merchants. They only read game state, and are
// counted every few days on the world clock, so they can't change anyone's fortunes.
import {
  FARM_PRICE,
  MARKET_BASE_PRICES,
  MARKET_PORTS,
  RESIDENCE_PRICE,
  UPGRADES,
  VESSEL_CLASSES,
  WAREHOUSE_PRICE,
  type GameState,
} from "./model";
import {
  LEADERBOARD_INTERVAL_DAYS,
  WORTH_GOODS_SHARE,
  WORTH_PROPERTY_SHARE,
  WORTH_SHIP_SHARE,
} from "./config/economy";
import { getMerchantWorth, goodsAtReference } from "./npc";

export { LEADERBOARD_INTERVAL_DAYS };
export const PLAYER_ENTRY_ID = "player";

const TOP_ROWS = 5;
const ROWS_AROUND_PLAYER = 2;

export type LeaderboardId = "wealth" | "influence";

export interface LeaderboardEntry {
  id: string;
  value: number;
  rank: number;
  /** Where this merchant stood at the last count, or null at the first. */
  previousRank: number | null;
}

export interface LeaderboardSnapshot {
  day: number;
  wealth: LeaderboardEntry[];
  influence: LeaderboardEntry[];
}

/**
 * Everything the player owns, less what they owe. Route capital is only the Coins a route
 * holds: it falls when the route buys goods, and those goods count as cargo instead.
 */
export function getPlayerNetWorth(state: GameState): number {
  let worth = state.coins - state.debtOwed;
  for (const ship of state.fleet) {
    const selected = ship.id === state.selectedShipId;
    const upgrades = selected ? state.upgrades : ship.upgrades;
    worth += goodsAtReference(selected ? state.cargo : ship.cargo);
    worth += VESSEL_CLASSES[ship.vesselClass].price * WORTH_SHIP_SHARE;
    worth += ship.automatedRoute?.capital ?? 0;
    for (const upgrade of UPGRADES) {
      const level = upgrades[upgrade.id];
      // Each level costs baseCost × its own number.
      worth += upgrade.baseCost * ((level * (level + 1)) / 2) * WORTH_SHIP_SHARE;
    }
  }
  for (const port of MARKET_PORTS) {
    worth += goodsAtReference(state.warehouseStock[port.id]);
    worth += state.farmOutput[port.id] * MARKET_BASE_PRICES.rice * WORTH_GOODS_SHARE;
  }
  worth += state.ownedWarehouses.length * WAREHOUSE_PRICE * WORTH_PROPERTY_SHARE;
  worth += state.ownedFarms.length * FARM_PRICE * WORTH_PROPERTY_SHARE;
  if (state.residenceTown) worth += RESIDENCE_PRICE * WORTH_PROPERTY_SHARE;
  return Math.round(worth);
}

function rankEntries(
  scores: { id: string; value: number }[],
  previous: LeaderboardEntry[] | null,
): LeaderboardEntry[] {
  const previousRanks = new Map(previous?.map((entry) => [entry.id, entry.rank]));
  const lastPlace = scores.length + 1;
  // A tie keeps the older order, so nobody appears to move without anything changing.
  return [...scores]
    .sort(
      (a, b) =>
        b.value - a.value ||
        (previousRanks.get(a.id) ?? lastPlace) - (previousRanks.get(b.id) ?? lastPlace) ||
        (a.id < b.id ? -1 : 1),
    )
    .map((score, index) => ({
      ...score,
      rank: index + 1,
      previousRank: previousRanks.get(score.id) ?? null,
    }));
}

export function createLeaderboardSnapshot(
  state: GameState,
  previous: LeaderboardSnapshot | null = null,
): LeaderboardSnapshot {
  return {
    day: state.worldDay,
    wealth: rankEntries(
      [
        { id: PLAYER_ENTRY_ID, value: getPlayerNetWorth(state) },
        ...state.npcMerchants.map((merchant) => ({ id: merchant.id, value: getMerchantWorth(merchant) })),
      ],
      previous?.wealth ?? null,
    ),
    influence: rankEntries(
      [
        // Everyone is scored on reputation alone, because only the player has local standing.
        { id: PLAYER_ENTRY_ID, value: state.reputation },
        ...state.npcMerchants.map((merchant) => ({ id: merchant.id, value: merchant.reputation })),
      ],
      previous?.influence ?? null,
    ),
  };
}

/** Called once for each new world day. */
export function refreshLeaderboards(state: GameState): GameState {
  if (state.worldDay % LEADERBOARD_INTERVAL_DAYS !== 0) return state;
  return { ...state, leaderboards: createLeaderboardSnapshot(state, state.leaderboards) };
}

export function getNextCountDay(snapshot: LeaderboardSnapshot): number {
  return (
    (Math.floor(snapshot.day / LEADERBOARD_INTERVAL_DAYS) + 1) * LEADERBOARD_INTERVAL_DAYS
  );
}

/** Where the player stands, and how far it is to the merchant immediately above. */
export function getPlayerStanding(entries: LeaderboardEntry[]): {
  entry: LeaderboardEntry;
  above: LeaderboardEntry | null;
  gap: number;
} {
  const index = entries.findIndex((entry) => entry.id === PLAYER_ENTRY_ID);
  const entry = entries[index];
  const above = entries[index - 1] ?? null;
  return { entry, above, gap: above ? above.value - entry.value : 0 };
}

/** The leaders and the player's neighbours, with null wherever ranks are skipped. */
export function getVisibleEntries(entries: LeaderboardEntry[]): (LeaderboardEntry | null)[] {
  const playerIndex = entries.findIndex((entry) => entry.id === PLAYER_ENTRY_ID);
  const rows: (LeaderboardEntry | null)[] = [];
  entries.forEach((entry, index) => {
    if (index >= TOP_ROWS && Math.abs(index - playerIndex) > ROWS_AROUND_PLAYER) return;
    const last = rows.at(-1);
    if (index > 0 && (!last || last.rank !== entry.rank - 1)) rows.push(null);
    rows.push(entry);
  });
  if (playerIndex < entries.length - 1 && rows.at(-1)?.rank !== entries.length) rows.push(null);
  return rows;
}
