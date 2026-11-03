import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { GOODS, createNewGame, syncSelectedShip, type GameState, type GoodId } from "./game/model";
import { loadGame, saveGame } from "./game/storage";

const NO_GOODS = Object.fromEntries(GOODS.map((good) => [good.id, 0])) as Record<GoodId, number>;

function resetDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("bengal-trader");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function broke(change: Partial<GameState>): GameState {
  return syncSelectedShip({
    ...createNewGame("Maya", 8),
    cargo: { ...NO_GOODS },
    averagePurchasePrice: { ...NO_GOODS },
    ...change,
  });
}

async function openDocks(game: GameState) {
  await saveGame(game);
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Show port details" }));
  fireEvent.click(screen.getAllByRole("button", { name: /^Dhaka/ })[0]);
  fireEvent.click(await screen.findByRole("button", { name: "Enter city" }));
  fireEvent.click(await screen.findByRole("button", { name: "Docks" }));
  return within(await screen.findByRole("region", { name: "Shipyard and dock" }));
}

describe("recovering from a dead end on screen", () => {
  beforeEach(resetDatabase);
  afterEach(cleanup);

  it("warns on the map, offers the advance at the docks, and records the debt", async () => {
    await saveGame(broke({ shipHull: 0, coins: 0 }));
    render(<App />);
    expect(await screen.findByText(/no way left to raise money/)).toBeInTheDocument();
    cleanup();

    const docks = await openDocks(broke({ shipHull: 0, coins: 0 }));
    expect(docks.getByText("Moneylender's advance")).toBeInTheDocument();
    fireEvent.click(docks.getByRole("button", { name: /Accept · owe 1,500c/ }));

    expect(await docks.findByText("You owe 1,500 Coins")).toBeInTheDocument();
    expect(docks.queryByText("Moneylender's advance")).not.toBeInTheDocument();
    await waitFor(async () =>
      expect(await loadGame()).toMatchObject({ debtOwed: 1_500, coins: 1_000, shipHull: 2 }),
    );
  });

  it("offers a part repair instead when the purse can pay for some of it", async () => {
    const docks = await openDocks(broke({ shipHull: 0, coins: 300 }));
    expect(docks.queryByText("Moneylender's advance")).not.toBeInTheDocument();
    fireEvent.click(docks.getByRole("button", { name: "Repair 3 hull for 300 Coins" }));
    await waitFor(async () =>
      expect(await loadGame()).toMatchObject({ shipHull: 3, coins: 0, debtOwed: 0 }),
    );
  });

  it("points to the cargo, not the moneylender, when there's cargo to sell", async () => {
    const docks = await openDocks(broke({ shipHull: 0, coins: 0, cargo: { ...NO_GOODS, rice: 1 } }));
    expect(docks.queryByText("Moneylender's advance")).not.toBeInTheDocument();
    expect(docks.getByText(/sell your cargo/)).toBeInTheDocument();
  });

  describe("repaying", () => {
    const owing = (change: Partial<GameState>) => broke({ rescuesTaken: 1, debtOwed: 1_500, ...change });

    it("warns before emptying the purse, and changes nothing until confirmed", async () => {
      const docks = await openDocks(owing({ shipHull: 5, coins: 1_000 }));
      fireEvent.click(docks.getByRole("button", { name: "Pay 1,000c" }));
      const warning = docks.getByRole("alert");
      expect(warning).toHaveTextContent("This would leave 0 Coins in your purse, and you'd still owe 500.");
      expect(warning).toHaveTextContent("A visit contract would be your only income.");

      fireEvent.click(docks.getByRole("button", { name: "Keep my Coins" }));
      expect(docks.queryByRole("alert")).not.toBeInTheDocument();
      expect(await loadGame()).toMatchObject({ coins: 1_000, debtOwed: 1_500 });

      fireEvent.click(docks.getByRole("button", { name: "Pay 1,000c" }));
      fireEvent.click(docks.getByRole("button", { name: "Repay anyway" }));
      expect(await docks.findByText("You owe 500 Coins")).toBeInTheDocument();
      await waitFor(async () =>
        expect(await loadGame()).toMatchObject({ coins: 0, debtOwed: 500 }),
      );
    });

    it("says when the player would have to borrow again", async () => {
      const docks = await openDocks(owing({ shipHull: 0, coins: 90 }));
      fireEvent.click(docks.getByRole("button", { name: "Pay 90c" }));
      expect(docks.getByRole("alert")).toHaveTextContent("You'd have to borrow again");
    });

    it("doesn't ask when the player can still carry on", async () => {
      const wealthy = await openDocks(owing({ shipHull: 5, coins: 5_000 }));
      fireEvent.click(wealthy.getByRole("button", { name: "Repay · 1,500c" }));
      await waitFor(async () =>
        expect(await loadGame()).toMatchObject({ coins: 3_500, debtOwed: 0 }),
      );
      expect(wealthy.queryByRole("alert")).not.toBeInTheDocument();
      cleanup();

      const withCargo = await openDocks(
        owing({ shipHull: 5, coins: 1_000, cargo: { ...NO_GOODS, rice: 1 }, averagePurchasePrice: { ...NO_GOODS, rice: 400 } }),
      );
      fireEvent.click(withCargo.getByRole("button", { name: "Pay 1,000c" }));
      expect(withCargo.queryByRole("alert")).not.toBeInTheDocument();
      await waitFor(async () =>
        expect(await loadGame()).toMatchObject({ coins: 0, debtOwed: 500 }),
      );
    });
  });

  it("shows nothing about any of this to a merchant in good health", async () => {
    await saveGame(createNewGame("Maya", 8));
    render(<App />);
    await screen.findByRole("button", { name: "Show port details" });
    expect(screen.queryByText(/moneylender/)).not.toBeInTheDocument();
  });
});
