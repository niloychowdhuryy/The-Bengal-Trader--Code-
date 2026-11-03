import { describe, expect, it } from "vitest";
import {
  LEADERBOARD_INTERVAL_DAYS,
  PLAYER_ENTRY_ID,
  createLeaderboardSnapshot,
  getNextCountDay,
  getPlayerNetWorth,
  getPlayerStanding,
  getVisibleEntries,
  refreshLeaderboards,
  type LeaderboardEntry,
} from "./leaderboard";
import {
  GOODS,
  MARKET_PORTS,
  advanceWorld,
  buyGood,
  createNewGame,
  getMerchantWorth,
  syncSelectedShip,
  type GameState,
  type GoodId,
} from "./model";
import { isValidGameState, migrateLegacySave, validateSave } from "./save-format";

const NO_GOODS = Object.fromEntries(GOODS.map((good) => [good.id, 0])) as Record<GoodId, number>;

/** A game with nothing on board, so each test can count exactly what it adds. */
function empty(): GameState {
  return syncSelectedShip({
    ...createNewGame("Maya", 8),
    coins: 0,
    cargo: { ...NO_GOODS },
    averagePurchasePrice: { ...NO_GOODS },
  });
}

function playedUntil(day: number, seed = 8): GameState {
  let state = createNewGame("Maya", seed);
  for (let next = 1; next <= day; next += 1) {
    state = advanceWorld({ ...state, sailingDay: next }, next);
  }
  return state;
}

const SHIP_VALUE = 25_000 * 0.6;

describe("net worth", () => {
  it("counts only the ship in an empty game", () => {
    expect(getPlayerNetWorth(empty())).toBe(SHIP_VALUE);
  });

  it("counts Coins in full, and goods at 80% of their reference value", () => {
    expect(getPlayerNetWorth({ ...empty(), coins: 1_000 })).toBe(SHIP_VALUE + 1_000);
    expect(getPlayerNetWorth({ ...empty(), cargo: { ...NO_GOODS, rice: 2 } })).toBe(
      SHIP_VALUE + 2 * 400 * 0.8,
    );
  });

  it("counts upgrades at 60% of what every level cost", () => {
    const game = empty();
    expect(
      getPlayerNetWorth({ ...game, upgrades: { ...game.upgrades, hold: 2 } }),
    ).toBe(SHIP_VALUE + (1_250 + 2_500) * 0.6);
  });

  it("counts property at 70% of cost, and stored goods at 80%", () => {
    const game = empty();
    expect(getPlayerNetWorth({ ...game, ownedWarehouses: ["dhaka"] })).toBe(SHIP_VALUE + 7_500 * 0.7);
    expect(getPlayerNetWorth({ ...game, ownedFarms: ["dhaka"] })).toBe(SHIP_VALUE + 10_000 * 0.7);
    expect(getPlayerNetWorth({ ...game, residenceTown: "dhaka" })).toBe(SHIP_VALUE + 12_500 * 0.7);
    expect(
      getPlayerNetWorth({
        ...game,
        warehouseStock: { ...game.warehouseStock, dhaka: { ...NO_GOODS, salt: 1 } },
      }),
    ).toBe(SHIP_VALUE + 600 * 0.8);
    expect(
      getPlayerNetWorth({ ...game, farmOutput: { ...game.farmOutput, dhaka: 3 } }),
    ).toBe(SHIP_VALUE + 3 * 400 * 0.8);
  });

  it("subtracts debt in full, even below zero", () => {
    const game = empty();
    expect(getPlayerNetWorth({ ...game, coins: 100, debtOwed: 1_500, rescuesTaken: 1 })).toBe(
      SHIP_VALUE + 100 - 1_500,
    );
    expect(getPlayerNetWorth({ ...game, debtOwed: 20_000, rescuesTaken: 1 })).toBe(SHIP_VALUE - 20_000);
  });

  it("counts a route's Coins and its cargo once each", () => {
    const game = empty();
    const route = {
      origin: "dhaka" as const,
      destination: "sonargaon" as const,
      rules: [],
      status: "running" as const,
      phase: "docked" as const,
      direction: "outbound" as const,
      destinationPort: "sonargaon" as const,
      travelDaysRemaining: 0,
      travelDaysTotal: 0,
      capital: 2_000,
    };
    const second = {
      ...game.fleet[0],
      id: "player-ship-2",
      automatedRoute: route,
      cargo: { ...NO_GOODS, rice: 1 },
    };
    expect(getPlayerNetWorth({ ...game, fleet: [game.fleet[0], second] })).toBe(
      2 * SHIP_VALUE + 2_000 + 400 * 0.8,
    );
  });

  it("doesn't count the active ship's cargo twice", () => {
    const game = { ...empty(), coins: 5_000 };
    const { state } = buyGood(game, "rice", 1);
    expect(state.fleet[0].cargo.rice).toBe(1);
    expect(state.cargo.rice).toBe(1);
    expect(getPlayerNetWorth(state)).toBe(SHIP_VALUE + state.coins + 400 * 0.8);
  });
});

describe("influence", () => {
  it("scores the player and every merchant by the same rule: reputation alone", () => {
    const game = createNewGame("Maya", 8);
    const full = Object.fromEntries(MARKET_PORTS.map((port) => [port.id, 100])) as GameState["localStanding"];
    const { influence } = createLeaderboardSnapshot({ ...game, reputation: 7, localStanding: full });
    expect(influence.find((entry) => entry.id === PLAYER_ENTRY_ID)?.value).toBe(7);
    for (const merchant of game.npcMerchants) {
      expect(influence.find((entry) => entry.id === merchant.id)?.value).toBe(merchant.reputation);
    }
  });

  it("ignores local standing, without changing it", () => {
    const game = { ...empty(), reputation: 7 };
    const standing = { ...game.localStanding, dhaka: 100, hooghly: 15 };
    const counted = createLeaderboardSnapshot({ ...game, localStanding: standing });
    expect(counted.influence).toEqual(createLeaderboardSnapshot(game).influence);
    const advanced = advanceWorld({ ...game, localStanding: standing, sailingDay: 5 }, 5);
    expect(advanced.localStanding).toEqual(standing);
  });

  it("ranks an equal reputation level with a merchant, not above them", () => {
    const game = createNewGame("Maya", 8);
    const rival = game.npcMerchants[0];
    const { influence } = createLeaderboardSnapshot({ ...game, reputation: rival.reputation });
    const player = influence.find((entry) => entry.id === PLAYER_ENTRY_ID)!;
    expect(player.value).toBe(influence.find((entry) => entry.id === rival.id)?.value);
  });
});

describe("the rankings", () => {
  it("rank the player and all 26 merchants, from the top down", () => {
    const { wealth, influence } = createNewGame("Maya", 8).leaderboards;
    for (const entries of [wealth, influence]) {
      expect(entries).toHaveLength(27);
      expect(new Set(entries.map((entry) => entry.id)).size).toBe(27);
      expect(entries.map((entry) => entry.rank)).toEqual(entries.map((_, index) => index + 1));
      expect([...entries].sort((a, b) => b.value - a.value).map((entry) => entry.value))
        .toEqual(entries.map((entry) => entry.value));
    }
  });

  it("start with real values and no movement", () => {
    const game = createNewGame("Maya", 8);
    expect(game.leaderboards.day).toBe(0);
    expect(game.leaderboards.wealth.every((entry) => entry.previousRank === null)).toBe(true);
    expect(game.leaderboards.wealth.find((entry) => entry.id === PLAYER_ENTRY_ID)?.value)
      .toBe(getPlayerNetWorth(game));
    expect(isValidGameState(game)).toBe(true);
  });

  it("use each merchant's own worth", () => {
    const game = playedUntil(25);
    for (const merchant of game.npcMerchants) {
      expect(game.leaderboards.wealth.find((entry) => entry.id === merchant.id)?.value)
        .toBe(getMerchantWorth(merchant));
    }
  });

  it("keep a tie in the order it already had", () => {
    const game = createNewGame("Maya", 8);
    const level = {
      ...game,
      npcMerchants: game.npcMerchants.map((merchant) => ({ ...merchant, reputation: 5 })),
      reputation: 5,
    };
    const first = createLeaderboardSnapshot(level);
    const second = createLeaderboardSnapshot(level, first);
    expect(second.influence.map((entry) => entry.id)).toEqual(first.influence.map((entry) => entry.id));
    expect(second.influence.every((entry) => entry.previousRank === entry.rank)).toBe(true);
  });
});

describe("the count every 5 days", () => {
  it("doesn't move between counts, whatever the player does", () => {
    const game = createNewGame("Maya", 8);
    const rich = advanceWorld({ ...game, coins: 9_000_000, highestCoins: 9_000_000 }, 4);
    expect(rich.leaderboards).toEqual(game.leaderboards);
    const counted = advanceWorld(rich, 5);
    expect(counted.leaderboards.day).toBe(5);
    expect(counted.leaderboards.wealth[0].id).toBe(PLAYER_ENTRY_ID);
  });

  it("counts at each boundary crossed, and nowhere else", () => {
    let state = createNewGame("Maya", 8);
    const days = new Set<number>();
    for (let day = 1; day <= 23; day += 1) {
      state = advanceWorld(state, day);
      days.add(state.leaderboards.day);
    }
    expect([...days]).toEqual([0, 5, 10, 15, 20]);
    expect(getNextCountDay(state.leaderboards)).toBe(25);
    expect(LEADERBOARD_INTERVAL_DAYS).toBe(5);
  });

  it("gets the same result across a long voyage as day by day", () => {
    const start = createNewGame("Maya", 8);
    let dayByDay = start;
    for (let day = 1; day <= 12; day += 1) dayByDay = advanceWorld(dayByDay, day);
    expect(advanceWorld(start, 12).leaderboards).toEqual(dayByDay.leaderboards);
  });

  it("records movement from the count before, and only that", () => {
    const start = createNewGame("Maya", 8);
    const before = start.leaderboards.wealth.find((entry) => entry.id === PLAYER_ENTRY_ID)!;
    const risen = advanceWorld({ ...start, coins: 9_000_000, highestCoins: 9_000_000 }, 5);
    const after = risen.leaderboards.wealth.find((entry) => entry.id === PLAYER_ENTRY_ID)!;
    expect(after.rank).toBe(1);
    expect(after.previousRank).toBe(before.rank);
    const leader = start.leaderboards.wealth[0];
    const pushedDown = risen.leaderboards.wealth.find((entry) => entry.id === leader.id)!;
    expect(pushedDown.previousRank).toBe(1);
    expect(pushedDown.rank).toBeGreaterThan(1);
    const next = advanceWorld(risen, 10);
    expect(next.leaderboards.wealth.find((entry) => entry.id === PLAYER_ENTRY_ID)?.previousRank).toBe(1);
  });

  it("lets debt pull the player down at the next count", () => {
    const start = advanceWorld({ ...createNewGame("Maya", 8), coins: 100_000, highestCoins: 100_000 }, 5);
    const owing = advanceWorld({ ...start, debtOwed: 100_000, rescuesTaken: 1 }, 10);
    const rank = (state: GameState) => state.leaderboards.wealth.find((entry) => entry.id === PLAYER_ENTRY_ID)!.rank;
    expect(rank(owing)).toBeGreaterThan(rank(start));
  });

  it("changes nothing but the rankings", () => {
    const state = { ...advanceWorld(createNewGame("Maya", 8), 4), worldDay: 5 };
    const counted = refreshLeaderboards(state);
    expect(counted.leaderboards.day).toBe(5);
    expect({ ...counted, leaderboards: state.leaderboards }).toEqual(state);
    expect(counted.npcMerchants).toBe(state.npcMerchants);
    expect(counted.npcMerchants).toHaveLength(26);
  });

  it("doesn't count while the game is closed, because nothing here reads the clock", () => {
    const game = createNewGame("Maya", 8);
    const reloaded = validateSave(JSON.parse(JSON.stringify(game)), Date.now() + 1_000 * 60 * 60 * 24 * 30);
    expect(reloaded.leaderboards).toEqual(game.leaderboards);
    expect(reloaded.worldDay).toBe(game.worldDay);
  });
});

describe("the player's place", () => {
  const board = (playerRank: number): LeaderboardEntry[] =>
    Array.from({ length: 27 }, (_, index) => ({
      id: index + 1 === playerRank ? PLAYER_ENTRY_ID : `merchant-${index + 1}`,
      value: 1_000 - index * 10,
      rank: index + 1,
      previousRank: null,
    }));
  const ranks = (rows: (LeaderboardEntry | null)[]) => rows.map((row) => row?.rank ?? "gap");

  it("reports the gap to the merchant immediately above", () => {
    const { entry, above, gap } = getPlayerStanding(board(9));
    expect(entry.rank).toBe(9);
    expect(above?.rank).toBe(8);
    expect(gap).toBe(10);
  });

  it("has nobody to chase from first place", () => {
    expect(getPlayerStanding(board(1))).toMatchObject({ above: null, gap: 0 });
  });

  it("always shows the leaders and the player's neighbours", () => {
    expect(ranks(getVisibleEntries(board(15)))).toEqual([1, 2, 3, 4, 5, "gap", 13, 14, 15, 16, 17, "gap"]);
    expect(ranks(getVisibleEntries(board(27)))).toEqual([1, 2, 3, 4, 5, "gap", 25, 26, 27]);
    expect(ranks(getVisibleEntries(board(2)))).toEqual([1, 2, 3, 4, 5, "gap"]);
    expect(ranks(getVisibleEntries(board(7)))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, "gap"]);
  });
});

describe("saves", () => {
  it("gives an older save a first count from its real state, with no movement", () => {
    const { leaderboards: _boards, ...old } = playedUntil(12);
    const migrated = validateSave(migrateLegacySave({ ...old, version: 24, debtOwed: 1_000, rescuesTaken: 1 }));
    expect(migrated.version).toBe(25);
    expect(migrated.leaderboards.day).toBe(12);
    expect(migrated.leaderboards.wealth.every((entry) => entry.previousRank === null)).toBe(true);
    expect(migrated.leaderboards.wealth.find((entry) => entry.id === PLAYER_ENTRY_ID)?.value)
      .toBe(getPlayerNetWorth(migrated));
    expect(migrated.debtOwed).toBe(1_000);
    expect(getNextCountDay(migrated.leaderboards)).toBe(15);
  });

  it("keeps the rankings exactly across a reload", () => {
    const game = playedUntil(12);
    expect(validateSave(JSON.parse(JSON.stringify(game))).leaderboards).toEqual(game.leaderboards);
  });

  it.each([
    ["missing", { leaderboards: undefined }],
    ["from the future", (game: GameState) => ({ leaderboards: { ...game.leaderboards, day: game.worldDay + 1 } })],
    ["out of order", (game: GameState) => ({ leaderboards: { ...game.leaderboards, wealth: [...game.leaderboards.wealth].reverse() } })],
    ["short of a merchant", (game: GameState) => ({ leaderboards: { ...game.leaderboards, influence: game.leaderboards.influence.slice(1) } })],
    ["naming a stranger", (game: GameState) => ({
      leaderboards: {
        ...game.leaderboards,
        wealth: game.leaderboards.wealth.map((entry, index) => (index === 0 ? { ...entry, id: "stranger" } : entry)),
      },
    })],
  ])("refuses rankings that are %s", (_label, change) => {
    const game = createNewGame("Maya", 8);
    const patch = typeof change === "function" ? change(game) : change;
    expect(() => validateSave({ ...game, ...patch })).toThrow();
  });
});
