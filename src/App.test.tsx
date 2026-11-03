import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import BengalMap from "./components/BengalMap";
import {
  arriveAtDestination,
  buyFarm,
  buyPlayerShip,
  configureAutomatedTradeRoute,
  createNewGame,
  FARM_OUTPUT_CAPACITY,
  FARM_PRICE,
  MARRIAGE_HOUSEHOLD_COST,
  getTownRoute,
  GOODS,
  selectPlayerShip,
  startVoyage,
  TOWNS,
} from "./game/model";
import { formatTravelDuration, getRouteTravelTime } from "./game/travel-time";
import { saveGame, whenStorageIdle } from "./game/storage";

function getMapPort(name: RegExp): HTMLElement {
  const marker = screen
    .getAllByRole("button", { name })
    .find((button) => button.classList.contains("town-marker"));
  if (!marker) throw new Error(`Map port not found: ${name}`);
  return marker;
}

describe("first game screen", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    await whenStorageIdle();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("bengal-trader");
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
  });

  it("starts a new story and completes a market trade at Dhaka", async () => {
    render(<App />);

    await screen.findByRole("button", { name: /begin your story/i });
    fireEvent.change(screen.getByLabelText("Captain's name"), {
      target: { value: "Maya" },
    });
    fireEvent.click(screen.getByRole("button", { name: /begin your story/i }));

    expect(await screen.findByRole("heading", { name: "The Bengal Trader" })).toBeVisible();
    expect(screen.getByText("Dhaka · Maya's Boat")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Open Dhaka market" }));
    expect(screen.getByRole("heading", { name: "Market at Dhaka" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Buy Salt for 690 Coins" }));
    expect(screen.getByRole("group", { name: "Salt buy confirmation" })).toHaveTextContent(
      "Buy 1 Salt for 690c?",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm buy · 690c" }),
    );
    expect(screen.getByLabelText("Coins 4,310; cargo 4 of 12")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sell Salt for 605 Coins" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm sell · 605c" }),
    );
    await waitFor(() => {
      expect(screen.getByLabelText("Coins 4,915; cargo 3 of 12")).toBeInTheDocument();
    });
  });

  it("shows all eight goods with local prices, stock, inventory, and trade actions", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /begin your story/i }));
    fireEvent.click(screen.getByRole("button", { name: "Open Dhaka market" }));

    expect(screen.getByRole("region", { name: "Market at Dhaka" })).toBeVisible();
    for (const good of GOODS) {
      expect(screen.getByRole("heading", { name: good.name })).toBeVisible();
      expect(screen.getByRole("button", { name: new RegExp(`^Buy ${good.name} for`) })).toBeVisible();
      expect(screen.getByRole("button", { name: new RegExp(`^Sell ${good.name} for`) })).toBeVisible();
      expect(screen.getByLabelText(`Quantity of ${good.name}`)).toHaveValue(1);
    }

    expect(screen.getAllByText(/Avg cost .*Sell est\./)).not.toHaveLength(0);
    expect(document.querySelector(".context-drawer-market")).toBeInTheDocument();
  });

  it("shows a port merchant panel with optional inspection, trade, and leave actions", async () => {
    const original = createNewGame("Maya");
    const firstMerchant = original.npcMerchants[0];
    const game = {
      ...original,
      npcMerchants: [
        {
          ...firstMerchant,
          cargo: { ...firstMerchant.cargo, rice: 1 },
          cargoCost: { ...firstMerchant.cargoCost, rice: 4 },
        },
        ...original.npcMerchants.slice(1),
      ],
    };
    await saveGame(game);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Show port details" }));
    expect(await screen.findByText("At this port: Mariam Banu.")).toBeVisible();
    fireEvent.click(getMapPort(/^Dhaka/));
    fireEvent.click(screen.getByRole("button", { name: "Enter city" }));
    fireEvent.click(screen.getByRole("button", { name: "Town centre" }));

    expect(await screen.findByRole("region", { name: "Merchant traffic in Dhaka" }))
      .toHaveTextContent("Abdul Rahman");
    fireEvent.click(screen.getByRole("button", { name: "Inspect" }));
    expect(screen.getByText(/Specialises in Rice, Salt, Bengal cotton textiles/)).toBeVisible();
    expect(screen.getByText(/Capital: 5,000 Coins · Goods carried: Rice × 1/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Buy 1 Rice ·/ }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Bought 1 Rice from Abdul Rahman",
    );
    expect(screen.getByRole("button", { name: "Leave" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(screen.queryByRole("button", { name: "Leave" })).not.toBeInTheDocument();
  });

  it("makes reputation and optional milestone progress easy to open", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /begin your story/i }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Open reputation and milestones; 0 reputation",
      }),
    );

    expect(screen.getByRole("heading", { name: "Reputation & goals" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Reputation and milestones" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "0 reputation" })).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "River explorer progress" }))
      .toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByText(/every port and good stays available/i)).toBeVisible();
  });

  it("buys a warehouse in the current city and transfers cargo locally", async () => {
    await saveGame({
      ...createNewGame("Maya"),
      coins: 10_000,
      highestCoins: 10_000,
    });
    render(<App />);

    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(getMapPort(/^Dhaka/));
    fireEvent.click(screen.getByRole("button", { name: "Enter city" }));
    fireEvent.click(screen.getByRole("button", { name: "Warehouse" }));

    expect(screen.getByText(/Purchase one for 7,500 Coins to add 20 local storage spaces/))
      .toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Buy warehouse · 7,500 Coins" }));
    expect(await screen.findByText(/Owned here · 0\/20 storage spaces used/)).toBeVisible();
    expect(screen.getByLabelText("Coins 2,500; cargo 3 of 12")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Store one Rice" }));
    expect(await screen.findByText(/Owned here · 1\/20 storage spaces used/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Store one Rice" }).parentElement)
      .toHaveTextContent("Ship 1 · Stored 1");
    fireEvent.click(screen.getByRole("button", { name: "Retrieve one Rice" }));
    expect(await screen.findByText(/Owned here · 0\/20 storage spaces used/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Retrieve one Rice" }).parentElement)
      .toHaveTextContent("Ship 2 · Stored 0");
    expect(screen.queryByRole("button", { name: "Buy warehouse · 7,500 Coins" }))
      .not.toBeInTheDocument();
  });

  it("shows town-centre standing, local property, and useful next actions", async () => {
    await saveGame({
      ...createNewGame("Maya"),
      coins: 15_000,
      highestCoins: 15_000,
      reputation: 4,
      ownedWarehouses: ["dhaka"],
      residenceTown: "patna",
    });
    render(<App />);

    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(getMapPort(/^Dhaka/));
    fireEvent.click(screen.getByRole("button", { name: "Enter city" }));
    fireEvent.click(screen.getByRole("button", { name: "Town centre" }));

    expect(screen.getByRole("heading", { name: "Town centre" })).toBeVisible();
    expect(screen.getByText("Visited port")).toBeVisible();
    expect(screen.getByText(/4 global reputation · 0\/100 local standing/))
      .toBeVisible();
    expect(screen.getByRole("list", { name: "Property in Dhaka" })).toHaveTextContent(
      "Warehouse",
    );
    expect(screen.getByText("Your residence is in Patna.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /View residence options/ }));
    expect(screen.getByText(/Your one residence is in Patna/)).toBeVisible();
  });

  it("opens each city's mission board and accepts a limited contract", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /begin your story/i }));
    fireEvent.click(screen.getByRole("button", { name: "Open more game areas" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Dhaka mission board" }));

    expect(screen.getByRole("region", { name: "Mission board" })).toBeVisible();
    expect(screen.getByText("Deliver 2 Bengal cotton textiles to Kasimbazar."))
      .toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "Accept contract" })[0]);
    expect(await screen.findByText(/Contract accepted/)).toBeVisible();
    expect(screen.getByText("0/2 delivered · due by sailing day 24.0")).toBeVisible();
    expect(screen.getByText(/Global reputation/)).toBeVisible();
    expect(screen.getByRole("region", { name: "Mission board" }))
      .toHaveTextContent(/Local standing/);
  });

  it("enforces residence affordability and establishes the residence once", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /begin your story/i }));
    fireEvent.click(getMapPort(/^Dhaka/));
    fireEvent.click(screen.getByRole("button", { name: "Enter city" }));
    fireEvent.click(screen.getByRole("button", { name: "Home" }));

    const unaffordableButton = screen.getByRole("button", {
      name: "Residence · 12,500 Coins (need 7,500 more)",
    });
    expect(unaffordableButton).toBeDisabled();

    cleanup();
    await saveGame({
      ...createNewGame("Maya"),
      coins: 15_000,
      highestCoins: 15_000,
    });
    render(<App />);
    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(getMapPort(/^Dhaka/));
    fireEvent.click(screen.getByRole("button", { name: "Enter city" }));
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Establish residence · 12,500 Coins" }),
    );

    expect(await screen.findByText(/Your residence is established in this port/))
      .toBeVisible();
    expect(screen.getByLabelText("Coins 2,500; cargo 3 of 12")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Establish residence/ }))
      .not.toBeInTheDocument();
  });

  it("buys a farm locally and shows its output rate and storage", async () => {
    await saveGame({
      ...createNewGame("Maya"),
      coins: FARM_PRICE + 5000,
      highestCoins: FARM_PRICE + 5000,
    });
    render(<App />);

    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(getMapPort(/^Dhaka/));
    fireEvent.click(screen.getByRole("button", { name: "Enter city" }));
    fireEvent.click(screen.getByRole("button", { name: "Farm" }));
    expect(screen.getByText(/produces 1 Rice per full in-game sailing day/i)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Buy farm · 10,000 Coins" }));

    expect(await screen.findByText(/Owned here · 0\/20 Rice in local farm storage/))
      .toBeVisible();
    expect(screen.getByText(/Next Rice in 1.0 in-game sailing days/)).toBeVisible();
    expect(screen.getByLabelText("Coins 5,000; cargo 3 of 12")).toBeInTheDocument();
  });

  it("collects farm output into the ship and reports remaining local storage", async () => {
    const purchased = buyFarm({
      ...createNewGame("Maya"),
      coins: FARM_PRICE + 5000,
      highestCoins: FARM_PRICE + 5000,
    }).state;
    await saveGame({
      ...purchased,
      farmOutput: { ...purchased.farmOutput, dhaka: FARM_OUTPUT_CAPACITY },
    });
    render(<App />);

    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(getMapPort(/^Dhaka/));
    fireEvent.click(screen.getByRole("button", { name: "Enter city" }));
    fireEvent.click(screen.getByRole("button", { name: "Farm" }));
    expect(screen.getByText(/20\/20 Rice in local farm storage/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Collect up to 9 Rice" }));

    expect(await screen.findByText(/11\/20 Rice in local farm storage/)).toBeVisible();
    expect(screen.getByLabelText("Coins 5,000; cargo 12 of 12")).toBeInTheDocument();
    expect(screen.queryByText(/Storage is full/)).not.toBeInTheDocument();
  });

  it("requires residence and the household cost, then shows saved spouse status", async () => {
    await saveGame({
      ...createNewGame("Maya"),
      residenceTown: "dhaka",
      coins: MARRIAGE_HOUSEHOLD_COST - 1,
      highestCoins: 10_000,
    });
    render(<App />);

    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(getMapPort(/^Dhaka/));
    fireEvent.click(screen.getByRole("button", { name: "Enter city" }));
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(screen.getByRole("button", {
      name: /Establish household · 5,000 Coins \(need 1 more\)/,
    })).toBeDisabled();

    cleanup();
    await saveGame({
      ...createNewGame("Maya"),
      residenceTown: "dhaka",
      coins: MARRIAGE_HOUSEHOLD_COST,
      highestCoins: MARRIAGE_HOUSEHOLD_COST,
    });
    render(<App />);
    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(getMapPort(/^Dhaka/));
    fireEvent.click(screen.getByRole("button", { name: "Enter city" }));
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    fireEvent.click(screen.getByRole("button", { name: "Establish marriage · 5,000 Coins" }));

    expect(await screen.findByText("Your household is established here.")).toBeVisible();
    expect(screen.getByLabelText("Coins 0; cargo 3 of 12")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Establish marriage/ }))
      .not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open more game areas" }));
    fireEvent.click(screen.getByRole("button", { name: "Household" }));
    expect(screen.getByRole("region", { name: "Household" })).toHaveTextContent(
      /ResidenceDhakaSpouseMarried · sailing day 0\.0Children0/,
    );
    expect(screen.getByText(/Marriage and household costs are gameplay abstractions/))
      .toBeVisible();
  });

  it("shows meaningful shipyard upgrades that change actual combat stats", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /begin your story/i }));
    fireEvent.click(screen.getByRole("button", { name: "Open ship dock" }));

    expect(screen.getByRole("heading", { name: "Shipyard repairs & upgrades" })).toBeVisible();
    expect(screen.getByText("Attack 2 → 3")).toBeVisible();
    expect(screen.getAllByText(/Next fit · 1,750 Coins/)).toHaveLength(2);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Upgrade Stronger bow cannon for 1,750 Coins",
      }),
    );

    expect(screen.getByText("Attack").parentElement).toHaveTextContent("3");
    expect(screen.getByText("Attack 3 → 4")).toBeVisible();
    expect(screen.getByLabelText("Coins 3,250; cargo 3 of 12")).toBeInTheDocument();
  });

  it("repairs a damaged ship for the displayed cost at a port shipyard", async () => {
    await saveGame({
      ...createNewGame("Maya"),
      shipHull: 6,
    });
    render(<App />);

    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(screen.getByRole("button", { name: "Open ship dock" }));

    expect(screen.getByText("Hull 6/8")).toBeVisible();
    expect(screen.getByText("Restore 2 hull · 200 Coins total (100 per hull)."))
      .toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Repair ship for 200 Coins" }));
    expect(await screen.findByText("Hull 8/8")).toBeVisible();
    expect(screen.getByRole("button", { name: "Ship fully repaired" }))
      .toBeDisabled();
    expect(screen.getByLabelText("Coins 4,800; cargo 3 of 12")).toBeInTheDocument();
  });

  it("buys an additional ship at the shipyard and switches the managed vessel", async () => {
    await saveGame({
      ...createNewGame("Maya"),
      coins: 35_000,
      highestCoins: 35_000,
    });
    render(<App />);

    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(screen.getByRole("button", { name: "Open ship dock" }));
    expect(screen.getByRole("heading", { name: "River boat" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Buy River boat for 25,000 Coins" }));
    expect(screen.getByRole("group", { name: "Buy ship confirmation" }))
      .toHaveTextContent(/Buy an empty River boat for 25,000 Coins/);
    fireEvent.click(screen.getByRole("button", { name: "Confirm · 25,000c" }));
    expect(await screen.findByText("River Trader II has been purchased at Dhaka."))
      .toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Open fleet" }));
    expect(screen.getByRole("heading", { name: "2 ships" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Maya's Boat" })).toBeVisible();
    expect(screen.getByText("River Trader II")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Manage this ship" }));

    expect(screen.getByLabelText("River Trader II cargo")).toHaveTextContent(
      /Rice 0.*Salt 0.*Raw silk 0/,
    );
    expect(screen.getAllByText("Managing")).toHaveLength(1);
    expect(screen.getByLabelText("Coins 10,000; cargo 0 of 12")).toBeInTheDocument();
  });

  it("shows a mobile-friendly automated route editor and starts a visited-port route", async () => {
    const purchased = buyPlayerShip({
      ...createNewGame("Maya"),
      coins: 100_000,
      highestCoins: 100_000,
      visitedTowns: ["dhaka", "sonargaon"],
    }).state;
    await saveGame(purchased);
    render(<App />);

    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(screen.getByRole("button", { name: "Open fleet" }));
    expect(await screen.findByRole("heading", { name: "2 ships" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Set up route" }));
    expect(screen.getByRole("heading", { name: "Set up an automated route" }))
      .toBeVisible();
    expect(screen.getByLabelText("Other visited port")).toBeVisible();
    expect(screen.getByLabelText("Starting trade capital (max 250,000)"))
      .toHaveValue(25_000);
    expect(screen.getByText(/Route progress advances only while your voyage is active/))
      .toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Start route" }));
    expect(await screen.findByText(/will trade between Dhaka and Sonargaon/))
      .toBeVisible();
    expect(screen.getByText(/Running · docked/)).toBeVisible();
    expect(screen.getByText(/Rules: Rice/)).toBeVisible();
  });

  it("shows the three classes at the shipyard and states the Patello's limit before buying", async () => {
    await saveGame({ ...createNewGame("Maya"), coins: 47_500, highestCoins: 47_500 });
    render(<App />);

    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(screen.getByRole("button", { name: "Open ship dock" }));
    for (const name of ["River boat", "Bora", "Patello"]) {
      expect(screen.getByRole("heading", { name })).toBeVisible();
    }
    expect(screen.getByText(/stats, prices, shipyards and port limits are game rules/))
      .toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Buy Patello for 45,000 Coins" }));
    expect(screen.getByRole("group", { name: "Buy ship confirmation" }))
      .toHaveTextContent(/45,000 Coins\? It cannot reach Sylhet or Balasore/);
    fireEvent.click(screen.getByRole("button", { name: "Confirm · 45,000c" }));
    expect(await screen.findByText("Patello II has been purchased at Dhaka.")).toBeVisible();
  });

  it("explains blocked and longer routes on a selected Patello", async () => {
    const patello = selectPlayerShip(
      buyPlayerShip(
        { ...createNewGame("Maya"), coins: 100_000, highestCoins: 100_000 },
        "patello",
      ).state,
      "player-ship-2",
    ).state;
    await saveGame(patello);
    render(<App />);

    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(getMapPort(/^Sylhet/));
    const blocked = screen.getByRole("button", { name: /Too large for this ship/ });
    expect(blocked).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Show port details" }));
    expect(
      screen.getByText(/Your Patello is too large for the narrow channels to Sylhet/),
    ).toBeVisible();
    expect(screen.queryByText("No open river path")).toBeNull();

    cleanup();
    await saveGame(patello);
    render(<App />);
    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(getMapPort(/^Malda/));
    expect(screen.getByText(/longer route/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Show port details" }));
    expect(screen.getByText(/Longer route: the direct channel is too narrow/)).toBeVisible();
    expect(screen.getByRole("button", { name: /Travel to Malda/ })).toBeEnabled();
  });

  it("leaves unreachable ports out of Patello route setup", async () => {
    const purchased = buyPlayerShip(
      {
        ...createNewGame("Maya"),
        coins: 100_000,
        highestCoins: 100_000,
        visitedTowns: ["dhaka", "sonargaon", "sylhet"],
      },
      "patello",
    ).state;
    await saveGame(purchased);
    render(<App />);

    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(screen.getByRole("button", { name: "Open fleet" }));
    fireEvent.click(await screen.findByRole("button", { name: "Set up route" }));
    const ports = screen.getByLabelText("Other visited port");
    expect(ports).toHaveTextContent("Sonargaon");
    expect(ports).not.toHaveTextContent("Sylhet");
    expect(screen.getByText(/Not offered, because this Patello cannot reach them/))
      .toHaveTextContent("Sylhet");
    expect(screen.getByText(/trades up to 4 units per selected good/)).toBeVisible();
  });

  it("offers a return order for a ship the selected ship cannot reach", async () => {
    const patello = selectPlayerShip(
      buyPlayerShip(
        { ...createNewGame("Maya"), coins: 100_000, highestCoins: 100_000 },
        "patello",
      ).state,
      "player-ship-2",
    ).state;
    await saveGame({
      ...patello,
      fleet: patello.fleet.map((ship) =>
        ship.id === "player-ship-1" ? { ...ship, currentPort: "sylhet" as const } : ship,
      ),
    });
    render(<App />);

    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(screen.getByRole("button", { name: "Open fleet" }));
    expect(await screen.findByText(/cannot reach this ship at Sylhet/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Return to Dhaka/ }));
    expect((await screen.findAllByText(/Returning to Dhaka/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Return to Dhaka/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Set up route" })).toBeNull();
  });

  it("manages a docked automated ship's route from Fleet while the player's ship is sailing", async () => {
    const purchased = buyPlayerShip({
      ...createNewGame("Maya"),
      coins: 100_000,
      highestCoins: 100_000,
      visitedTowns: ["dhaka", "sonargaon"],
    }).state;
    const assigned = configureAutomatedTradeRoute(
      purchased,
      purchased.fleet[1].id,
      "sonargaon",
      [{ good: "rice", buyAtOrigin: true, sellAtDestination: true }],
      15_000,
    ).state;
    await saveGame(
      startVoyage({ ...assigned, selectedTown: "sonargaon" }, Date.now()),
    );
    render(<App />);

    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(screen.getByRole("button", { name: "Open fleet" }));
    expect(await screen.findByRole("heading", { name: "2 ships" })).toBeVisible();
    expect(screen.getByText(/sailing to Sonargaon/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(await screen.findByRole("button", { name: "Resume" })).toBeVisible();
    expect(screen.getByText("Paused")).toBeVisible();
    expect(screen.getByText(/sailing to Sonargaon/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save route" }));
    expect(await screen.findByText(/will trade between Dhaka and Sonargaon/))
      .toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Cancel route" }));
    expect(await screen.findByText("No automated route")).toBeVisible();
    expect(screen.getByText(/15,000 Coins returned to your purse/)).toBeVisible();
    expect(screen.getByText(/sailing to Sonargaon/)).toBeVisible();
  });

  it("opens a port's city and interactive market directly from the illustrated scene", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /begin your story/i }));
    fireEvent.click(getMapPort(/^Dhaka/));
    fireEvent.click(screen.getByRole("button", { name: "Enter city" }));

    expect(screen.getByRole("region", { name: "Dhaka town scene" })).toBeVisible();
    expect(screen.getByRole("group", { name: /illustrated riverside town of Dhaka/i })).toBeVisible();
    expect(screen.getByRole("button", { name: "Mosque" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Town centre" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Warehouse" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Mosque" }));
    expect(screen.getByRole("heading", { name: "Mosque" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close building details" }));
    expect(screen.getByRole("region", { name: "Dhaka town scene" })).toBeVisible();

    const marketBuilding = screen.getByRole("button", { name: "Market" });
    fireEvent.pointerDown(marketBuilding, {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
    });
    fireEvent.pointerUp(marketBuilding, {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
    });
    fireEvent.click(marketBuilding);
    expect(screen.getByRole("heading", { name: "Market at Dhaka" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Dhaka town scene" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Close panel" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));
    expect(screen.getByRole("region", { name: "Dhaka town scene" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Docks" }));
    expect(screen.getByRole("heading", { name: "Shipyard repairs & upgrades" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Dhaka town scene" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));

    fireEvent.click(screen.getByRole("button", { name: "Open map" }));
    expect(screen.getByRole("region", { name: "Illustrated map of Bengal and its river towns" })).toBeVisible();
  });

  it("shows a routed travel choice when a different port is selected", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /begin your story/i }));
    fireEvent.click(getMapPort(/^Sylhet/));

    fireEvent.click(screen.getByRole("button", { name: "Show port details" }));
    expect(screen.getByText(/Direct waterway route/)).toBeVisible();
    const route = getTownRoute("dhaka", "sylhet");
    expect(route).not.toBeNull();
    if (!route) return;
    expect(
      screen.getByText(
        new RegExp(
          `${formatTravelDuration(getRouteTravelTime(route).durationMs)} · ${getRouteTravelTime(route).durationDays.toFixed(1)} in-game days`,
        ),
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Travel to Sylhet" }));
    expect(await screen.findByRole("heading", { name: "To Sylhet" })).toBeVisible();
    expect(
      screen.getByText(
        new RegExp(
          `Sylhet · ${getRouteTravelTime(route).durationDays.toFixed(1)} in-game days`,
        ),
      ),
    ).toBeVisible();
  });

  it("pauses a live voyage when the page is hidden and resumes without closed time", async () => {
    let clock = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const originalVisibilityState = Object.getOwnPropertyDescriptor(
      document,
      "visibilityState",
    );
    render(<App />);

    try {
      fireEvent.click(await screen.findByRole("button", { name: /begin your story/i }));
      fireEvent.click(getMapPort(/^Sylhet/));
      fireEvent.click(screen.getByRole("button", { name: "Travel to Sylhet" }));
      await screen.findByRole("heading", { name: "To Sylhet" });
      const progress = screen.getByRole("progressbar", { name: "Voyage progress" });

      clock += 10_000;
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      fireEvent(document, new Event("visibilitychange"));
      const pausedProgress = progress.getAttribute("aria-valuenow");

      clock += 86_400_000;
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      fireEvent(document, new Event("visibilitychange"));

      expect(progress.getAttribute("aria-valuenow")).toBe(pausedProgress);
    } finally {
      if (originalVisibilityState) {
        Object.defineProperty(
          document,
          "visibilityState",
          originalVisibilityState,
        );
      } else {
        Reflect.deleteProperty(document, "visibilityState");
      }
    }
  });

  it("shows the supplied artwork and lets the player select an added map destination", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /begin your story/i }));
    for (const town of TOWNS) {
      expect(getMapPort(new RegExp(`^${town.name}`))).toBeInTheDocument();
    }
    const artwork = screen
      .getByRole("region", {
        name: "Illustrated map of Bengal and its river towns",
      })
      .querySelector('image[href="/images/bengal-world-map.webp"]');
    expect(artwork).toBeInTheDocument();
    expect(artwork).toHaveAttribute("width", "1365");
    expect(artwork).toHaveAttribute("height", "768");
    expect(artwork).toHaveAttribute("preserveAspectRatio", "xMidYMid meet");

    fireEvent.click(getMapPort(/^Patna/));
    expect(screen.getByRole("button", { name: "Travel to Patna" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Travel to Patna" }));
    expect(await screen.findByRole("heading", { name: "To Patna" })).toBeVisible();
  });

  it("offers a clear sailing speed selector and changes the active speed", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /begin your story/i }));
    const dockedVessel = document.querySelector(".bengal-trading-vessel");
    expect(dockedVessel?.querySelector(":scope > g")).toHaveAttribute(
      "transform",
      "scale(0.45)",
    );
    expect(dockedVessel?.querySelector(".vessel-under-sail")).not.toBeInTheDocument();
    fireEvent.click(getMapPort(/^Sylhet/));
    fireEvent.click(screen.getByRole("button", { name: "Travel to Sylhet" }));

    expect(await screen.findByRole("group", { name: "Sailing speed" })).toBeVisible();
    expect(document.querySelector(".vessel-under-sail")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1× Normal" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "2× Fast" }));
    expect(screen.getByRole("button", { name: "2× Fast" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "4× Very fast" }));
    expect(screen.getByRole("button", { name: "4× Very fast" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("zooms the illustrated map without changing game state or port selection", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /begin your story/i }));

    const map = screen.getByRole("group", { name: /Bengal river-trading map/i });
    const visibleWidth = () => Number(map.getAttribute("viewBox")?.split(" ")[2]);
    const startingWidth = visibleWidth();

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(visibleWidth()).toBeLessThan(startingWidth);
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(visibleWidth()).toBeCloseTo(startingWidth);

    fireEvent.click(getMapPort(/^Chittagong/));
    fireEvent.click(screen.getByRole("button", { name: "Show port details" }));
    expect(screen.getByText(/Direct waterway route/)).toBeVisible();
    expect(screen.getByLabelText("Coins 5,000; cargo 3 of 12")).toBeInTheDocument();
  });

  it("moves the vessel only during a voyage and leaves it still after arrival", () => {
    const startedAt = 1_000;
    const sailingState = startVoyage(
      { ...createNewGame("Maya"), selectedTown: "hooghly" },
      startedAt,
    );
    const voyage = sailingState.voyage;
    expect(voyage).not.toBeNull();
    if (!voyage) return;

    const map = render(
      <BengalMap
        state={sailingState}
        now={startedAt}
        onSelectTown={() => undefined}
      />,
    );
    const vessel = map.container.querySelector(".bengal-trading-vessel");
    expect(vessel?.querySelector(":scope > g")).toHaveAttribute(
      "transform",
      "scale(0.45)",
    );
    expect(vessel?.querySelector(".vessel-under-sail")).toBeInTheDocument();
    const startingPosition = vessel?.getAttribute("transform");

    map.rerender(
      <BengalMap
        state={sailingState}
        now={startedAt + voyage.durationMs / 2}
        onSelectTown={() => undefined}
      />,
    );
    expect(vessel?.getAttribute("transform")).not.toBe(startingPosition);

    const arrivedState = arriveAtDestination(sailingState);
    map.rerender(
      <BengalMap
        state={arrivedState}
        now={voyage.arrivalAt}
        onSelectTown={() => undefined}
      />,
    );
    const dockedPosition = vessel?.getAttribute("transform");
    expect(vessel?.querySelector(".vessel-under-sail")).not.toBeInTheDocument();
    map.rerender(
      <BengalMap
        state={arrivedState}
        now={voyage.arrivalAt + 10_000}
        onSelectTown={() => undefined}
      />,
    );
    expect(vessel?.getAttribute("transform")).toBe(dockedPosition);
  });
});
