import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { PLAYER_ENTRY_ID, createLeaderboardSnapshot } from "./game/leaderboard";
import { advanceWorld, createNewGame, formatCoins, type GameState } from "./game/model";
import { saveGame } from "./game/storage";

function resetDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("bengal-trader");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function openRankings(game: GameState) {
  await saveGame(game);
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Open more game areas" }));
  fireEvent.click(screen.getByRole("button", { name: "Merchant rankings" }));
  return within(await screen.findByRole("region", { name: "Merchant rankings" }));
}

describe("the merchant rankings screen", () => {
  beforeEach(resetDatabase);
  afterEach(cleanup);

  it("pins the player's rank and the gap to the merchant above", async () => {
    const game = createNewGame("Maya", 8);
    const entries = game.leaderboards.wealth;
    const index = entries.findIndex((entry) => entry.id === PLAYER_ENTRY_ID);
    const above = entries[index - 1];
    const name = game.npcMerchants.find((merchant) => merchant.id === above.id)!.name;
    const rankings = await openRankings(game);
    const summary = within(rankings.getByRole("region", { name: "Your standing" }));
    expect(summary.getByText(String(index + 1))).toBeInTheDocument();
    expect(
      summary.getByText(`${formatCoins(above.value - entries[index].value)} Coins behind ${name}, ranked ${above.rank}.`),
    ).toBeInTheDocument();
    expect(rankings.getByText("Wealthiest merchants")).toBeInTheDocument();
    expect(rankings.getByText("Counted on day 0. Next count on day 5. Movement shows from the next count.")).toBeInTheDocument();
  });

  it("switches to influence, with its own scores", async () => {
    const game = createNewGame("Maya", 8);
    const rankings = await openRankings(game);
    fireEvent.click(rankings.getByRole("tab", { name: "Influence" }));
    expect(rankings.getByText("Most influential merchants")).toBeInTheDocument();
    expect(within(rankings.getByRole("region", { name: "Your standing" })).getByText("0 influence")).toBeInTheDocument();
  });

  it("explains that influence is reputation alone, and leaves out the player's local standing", async () => {
    const game = { ...createNewGame("Maya", 8), localStanding: { ...createNewGame("Maya", 8).localStanding, dhaka: 40 } };
    const rankings = await openRankings({ ...game, leaderboards: createLeaderboardSnapshot(game) });
    fireEvent.click(rankings.getByRole("tab", { name: "Influence" }));
    expect(within(rankings.getByRole("region", { name: "Your standing" })).getByText("0 influence")).toBeInTheDocument();
    expect(rankings.getByText(/Personal reputation, the same for you and every rival/)).toBeInTheDocument();
  });

  it("shows real movement between counts", async () => {
    const start = createNewGame("Maya", 8);
    const risen = advanceWorld({ ...start, sailingDay: 5, coins: 9_000_000, highestCoins: 9_000_000 }, 5);
    const rankings = await openRankings(risen);
    expect(within(rankings.getByRole("region", { name: "Your standing" })).getByText("You lead these rankings.")).toBeInTheDocument();
    const leader = start.leaderboards.wealth[0];
    const down = risen.leaderboards.wealth.find((entry) => entry.id === leader.id)!;
    expect(rankings.getAllByLabelText(`Down ${down.rank - 1} place${down.rank === 2 ? "" : "s"} since the last count`).length).toBeGreaterThan(0);
    expect(rankings.getAllByLabelText(/^Up \d+ places? since the last count$/).length).toBeGreaterThan(0);
  });

  it("opens a rival's profile from their row", async () => {
    const game = createNewGame("Maya", 8);
    const leader = game.npcMerchants.find((merchant) => merchant.id === game.leaderboards.wealth[0].id)!;
    const rankings = await openRankings(game);
    const row = rankings.getByRole("button", { name: new RegExp(leader.name) });
    expect(row).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(rankings.getByText("Home port")).toBeInTheDocument();
    expect(rankings.getByText("Deals in")).toBeInTheDocument();
    expect(rankings.getByText(/for influence at the last count/)).toBeInTheDocument();
  });

  it("shows the leaders and neighbours first, then everyone on request", async () => {
    const game = createNewGame("Maya", 8);
    const rankings = await openRankings(game);
    const shown = rankings.getAllByRole("listitem").filter((row) => row.className.includes("rank-row"));
    expect(shown.length).toBeLessThan(27);
    expect(rankings.getByText("Maya")).toBeInTheDocument();
    fireEvent.click(rankings.getByRole("button", { name: "Show all 27 merchants" }));
    expect(rankings.getAllByRole("listitem").filter((row) => row.className.includes("rank-row"))).toHaveLength(27);
  });

  it("doesn't change until the next count, even when the world has", async () => {
    const game = createNewGame("Maya", 8);
    const stale = { ...game, coins: 9_000_000, highestCoins: 9_000_000 };
    expect(stale.leaderboards).toEqual(createLeaderboardSnapshot(game));
    const rankings = await openRankings(stale);
    expect(within(rankings.getByRole("region", { name: "Your standing" })).queryByText("You lead these rankings.")).toBeNull();
  });
});
