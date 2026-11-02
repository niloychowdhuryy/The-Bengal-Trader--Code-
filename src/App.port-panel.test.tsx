import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { clampCamera } from "./components/BengalMap";
import { buyPlayerShip, createNewGame, selectPlayerShip } from "./game/model";
import { saveGame, whenStorageIdle } from "./game/storage";

const port = (name: RegExp) =>
  screen.getAllByRole("button", { name }).find((b) => b.classList.contains("town-marker"))!;
const toggle = (name: string) => screen.getByRole("button", { name });

describe("port panel", () => {
  beforeEach(async () => {
    await whenStorageIdle();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("bengal-trader");
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  });
  afterEach(cleanup);

  async function start() {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /begin your story/i }));
    await screen.findByRole("heading", { name: "The Bengal Trader" });
  }

  it("starts compact but keeps the port's name, journey and action", async () => {
    await start();
    fireEvent.click(port(/^Sandwip/));
    expect(screen.getByRole("heading", { name: "Sandwip" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Travel to Sandwip" })).toBeEnabled();
    expect(document.querySelector(".port-panel-title p")?.textContent).toMatch(/by water/);
    expect(toggle("Show port details")).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelector(".port-context-copy")).toBeNull();
  });

  it("expands and collapses without losing the selected port or route", async () => {
    await start();
    fireEvent.click(port(/^Sonargaon/));
    fireEvent.click(toggle("Show port details"));
    expect(toggle("Hide port details")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Boat and cart route/)).toBeVisible();
    expect(screen.getByText(/By boat to the landing/)).toBeVisible();
    expect(screen.getByText(/docked here|At this port/)).toBeVisible();
    fireEvent.click(toggle("Hide port details"));
    expect(document.querySelector(".port-context-copy")).toBeNull();
    expect(screen.getByRole("heading", { name: "Sonargaon" })).toBeVisible();
    expect(document.querySelectorAll(".route-leg-land").length).toBe(1);
    expect(screen.getByRole("button", { name: "Travel to Sonargaon" })).toBeEnabled();
  });

  it("keeps the panel open while choosing other ports, including southern ones", async () => {
    await start();
    fireEvent.click(toggle("Show port details"));
    for (const name of ["Balasore", "Sandwip", "Chittagong"]) {
      fireEvent.click(port(new RegExp(`^${name}`)));
      expect(screen.getByRole("heading", { name })).toBeVisible();
      expect(toggle("Hide port details")).toBeVisible();
      expect(screen.getByRole("button", { name: `Travel to ${name}` })).toBeEnabled();
    }
  });

  it("still travels from a compact or an expanded panel", async () => {
    await start();
    fireEvent.click(port(/^Sandwip/));
    fireEvent.click(toggle("Show port details"));
    fireEvent.click(toggle("Hide port details"));
    fireEvent.click(screen.getByRole("button", { name: "Travel to Sandwip" }));
    expect(await screen.findByRole("group", { name: "Sailing speed" })).toBeVisible();
  });

  it("says why a port can't be reached, even when compact", async () => {
    await saveGame(
      selectPlayerShip(
        buyPlayerShip({ ...createNewGame("Maya"), gold: 2_000, highestGold: 2_000 }, "patello").state,
        "player-ship-2",
      ).state,
    );
    render(<App />);
    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(port(/^Balasore/));
    expect(document.querySelector(".port-panel-title p")?.textContent).toBe("Too large for this ship");
    expect(screen.getByRole("button", { name: "Too large for this ship" })).toBeDisabled();
    fireEvent.click(toggle("Show port details"));
    expect(screen.getByText(/too large for the narrow channels to Balasore/)).toBeVisible();
  });

  it("shows the current port's action", async () => {
    await start();
    fireEvent.click(port(/^Dhaka/));
    expect(document.querySelector(".port-panel-title p")?.textContent).toBe("Your ship is here");
    expect(screen.getByRole("button", { name: "Enter city" })).toBeEnabled();
  });
});

describe("map view limits", () => {
  const view = { x: 0, y: 10_000, zoom: 1 };
  it("stops at the painting's south edge with no panel", () => {
    expect(clampCamera(view, 2).y).toBeCloseTo(768 - 1365 / 2);
  });
  it("may move past it by the room a panel takes up", () => {
    expect(clampCamera(view, 2, 200).y).toBeCloseTo(768 - 1365 / 2 + 200);
  });
  it("never moves above the north edge", () => {
    expect(clampCamera({ ...view, y: -500 }, 2, 200).y).toBe(0);
  });
});
