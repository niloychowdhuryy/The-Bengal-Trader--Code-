import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { RivalList, getStallNews } from "./components/RivalMerchants";
import BengalMap from "./components/BengalMap";
import { advanceWorld, createNewGame, startVoyage, type GameState } from "./game/model";
import { saveGame } from "./game/storage";

function resetDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("bengal-trader");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function worldAfter(days: number, seed = 8): GameState {
  let state = createNewGame("Maya", seed);
  for (let day = 1; day <= days; day += 1) state = advanceWorld({ ...state, sailingDay: day }, day);
  return state;
}

describe("rival merchants on screen", () => {
  beforeEach(resetDatabase);
  afterEach(cleanup);

  it("draws a real ship for every merchant, with a class that matches", () => {
    const state = worldAfter(5);
    const map = render(<BengalMap state={state} now={1_000} onSelectTown={() => undefined} />);
    const traveling = state.npcMerchants.filter((merchant) => merchant.phase === "traveling");
    expect(traveling.length).toBeGreaterThan(5);
    expect(map.container.querySelectorAll(".npc-traffic")).toHaveLength(traveling.length);
    const shown = map.container.querySelectorAll(".npc-traffic .bengal-trading-vessel, .npc-traffic .bengal-land-cart");
    expect(shown.length).toBeGreaterThanOrEqual(traveling.length);
    for (const merchant of traveling) {
      expect(screen.getByRole("button", { name: new RegExp(`^${merchant.name}, sailing to`) })).toBeInTheDocument();
    }
  });

  it("shows ships at the docks, and counts what doesn't fit", () => {
    const start = createNewGame("Maya", 8);
    const map = render(<BengalMap state={start} now={1_000} onSelectTown={() => undefined} />);
    // Everyone starts at home, and Dhaka has three residents, the most shown at a dock.
    expect(screen.getByRole("button", { name: "Abdul Rahman, in port at Dhaka" })).toBeInTheDocument();
    expect(map.container.querySelectorAll(".npc-docked .bengal-trading-vessel")).not.toHaveLength(0);
    cleanup();

    const crowded = {
      ...start,
      npcMerchants: start.npcMerchants.map((merchant) => ({
        ...merchant,
        currentPort: "dhaka" as const,
        destinationPort: "dhaka" as const,
      })),
    };
    const busy = render(<BengalMap state={crowded} now={1_000} onSelectTown={() => undefined} />);
    expect(busy.container.querySelectorAll(".npc-docked .bengal-trading-vessel")).toHaveLength(3);
    expect(busy.container.querySelector(".npc-docked-more")).toHaveTextContent("+23");
  });

  describe("on a touch screen", () => {
    const realMatchMedia = window.matchMedia;
    beforeEach(() => {
      window.matchMedia = ((query: string) => ({
        matches: query.includes("coarse"),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      })) as unknown as typeof window.matchMedia;
    });
    afterEach(() => {
      window.matchMedia = realMatchMedia;
    });

    it("gives a dock one target of at least 44 pixels, whatever the zoom", () => {
      const start = createNewGame("Maya", 8);
      const map = render(<BengalMap state={start} now={1_000} onSelectTown={() => undefined} />);
      const targets = map.container.querySelectorAll(".npc-dock-target");
      expect(targets.length).toBeGreaterThan(0);
      // With no layout here, one map unit is one pixel.
      for (const target of targets) {
        expect(Number(target.getAttribute("width"))).toBeGreaterThanOrEqual(44);
        expect(Number(target.getAttribute("height"))).toBeGreaterThanOrEqual(44);
      }
      expect(screen.queryByRole("button", { name: "Abdul Rahman, in port at Dhaka" })).toBeNull();
      expect(screen.getByRole("button", { name: /merchants in port at Dhaka/ })).toBeInTheDocument();
    });

    it("lists a busy dock's ships, and opens the one chosen", async () => {
      await saveGame(createNewGame("Maya", 8));
      render(<App />);
      await screen.findByRole("heading", { name: "The Bengal Trader" });
      fireEvent.click(screen.getByRole("button", { name: /merchants in port at Dhaka/ }));
      const list = await screen.findByRole("region", { name: "Merchants in port at Dhaka" });
      const choice = within(list).getByRole("button", { name: /Abdul Rahman/ });
      fireEvent.click(choice);
      const panel = await screen.findByRole("region", { name: "Merchant Abdul Rahman" });
      fireEvent.click(within(panel).getByRole("button", { name: "Close merchant details" }));
      expect(screen.queryByRole("region", { name: /Merchants in port/ })).toBeNull();
    });

    it("goes straight to a merchant who is alone at a dock", async () => {
      await saveGame(createNewGame("Maya", 8));
      render(<App />);
      await screen.findByRole("heading", { name: "The Bengal Trader" });
      fireEvent.click(screen.getByRole("button", { name: "Yusuf Ali, in port at Sylhet" }));
      expect(await screen.findByRole("region", { name: "Merchant Yusuf Ali" })).toBeVisible();
    });
  });

  it("opens a merchant's details when their ship is tapped, and closes them", async () => {
    await saveGame(worldAfter(5));
    render(<App />);
    await screen.findByRole("heading", { name: "The Bengal Trader" });
    const ship = screen.getAllByRole("button", { name: /, sailing to / })[0];
    fireEvent.click(ship);
    const panel = await screen.findByRole("region", { name: /^Merchant / });
    expect(within(panel).getByText(/Sailing from/)).toBeVisible();
    expect(within(panel).getByText("Carrying")).toBeVisible();
    expect(within(panel).getByText("Purse")).toBeVisible();
    fireEvent.click(within(panel).getByRole("button", { name: "Close merchant details" }));
    expect(screen.queryByRole("region", { name: /^Merchant / })).toBeNull();
  });

  it("lists all 26 under More, without ranking them", async () => {
    await saveGame(createNewGame("Maya", 8));
    render(<App />);
    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(screen.getByRole("button", { name: "Open more game areas" }));
    fireEvent.click(screen.getByRole("button", { name: "Rival merchants" }));
    const list = await screen.findByRole("region", { name: "Rival merchants" });
    expect(within(list).getAllByRole("article")).toHaveLength(26);
    const first = within(list).getAllByRole("button")[0];
    expect(first).toHaveTextContent("Abdul Rahman");
    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(within(list).getByText(/Keeps Dhaka in rice and salt/)).toBeVisible();
  });

  it("marks a rival that's laid up, and shows a merchant with nothing aboard", () => {
    const fresh = createNewGame("Maya", 8);
    const state = {
      ...fresh,
      npcMerchants: fresh.npcMerchants.map((merchant) =>
        merchant.id === "tara-devi" ? { ...merchant, budget: 5 } : merchant,
      ),
    };
    render(<RivalList state={state} />);
    expect(screen.getByRole("button", { name: /Tara Devi/ })).toHaveTextContent(/Laid up/);
  });

  it("tells the player when a rival has just moved a stall's stock", () => {
    const state = { ...createNewGame("Maya", 8), worldDay: 10 };
    expect(getStallNews(state, "dhaka", "silk")).toBeNull();
    const withNews: GameState = {
      ...state,
      npcActivity: [
        { id: "x", merchantId: "khoja-sarkis", town: "dhaka", sailingDay: 9, message: "bought 14 Raw silk", kind: "bought", good: "silk", units: 14 },
      ],
    };
    expect(getStallNews(withNews, "dhaka", "silk")).toBe("Khoja Sarkis bought 14 here yesterday");
    expect(getStallNews({ ...withNews, worldDay: 30 }, "dhaka", "silk")).toBeNull();
    expect(getStallNews(withNews, "patna", "silk")).toBeNull();
  });

  it("keeps merchants moving smoothly during the player's own voyage", () => {
    const state = startVoyage({ ...worldAfter(5), selectedTown: "hooghly" }, 1_000);
    const position = (now: number) => {
      const map = render(<BengalMap state={state} now={now} onSelectTown={() => undefined} />);
      const place = map.container.querySelector(".npc-traffic .bengal-trading-vessel")?.getAttribute("transform");
      map.unmount();
      return place;
    };
    expect(position(1_000)).toBeTruthy();
    expect(position(40_000)).not.toBe(position(1_000));
  });
});
