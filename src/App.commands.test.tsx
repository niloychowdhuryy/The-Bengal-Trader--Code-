import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { replayCommands } from "./game/replay";
import { checkpointVoyageProgress, createNewGame, type GameState } from "./game/model";
import { loadGame, readCommandLog, saveGame, whenStorageIdle } from "./game/storage";

async function deleteDatabase(): Promise<void> {
  await whenStorageIdle();
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase("bengal-trader");
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

function mapPort(name: RegExp): HTMLElement {
  const marker = screen
    .getAllByRole("button", { name })
    .find((button) => button.classList.contains("town-marker"));
  if (!marker) throw new Error(`Map port not found: ${name}`);
  return marker;
}

// Waits for the debounced save, then checks the saved game can be rebuilt from its log.
async function expectLogMatchesSave(commandCount: number): Promise<GameState> {
  let rebuilt: GameState | null = null;
  await waitFor(async () => {
    const log = await readCommandLog();
    const saved = await loadGame();
    expect(log?.commands).toHaveLength(commandCount);
    const replay = replayCommands(
      { state: log!.base, lastSeq: log!.meta.baseSeq, lastAt: 0 },
      log!.commands,
      { receivedAt: Date.now() + 1_000 },
    );
    expect(replay.status).toBe("accepted");
    if (replay.status !== "accepted") return;
    expect(replay.lastSeq).toBe(log!.meta.nextSeq - 1);
    expect(replay.state.gold).toBe(saved!.gold);
    expect(replay.state.cargo).toEqual(saved!.cargo);
    expect(replay.state.upgrades).toEqual(saved!.upgrades);
    expect(replay.state.marketStock).toEqual(saved!.marketStock);
    expect(replay.state.fleet.map((ship) => ship.id)).toEqual(saved!.fleet.map((ship) => ship.id));
    expect(replay.state.selectedTown).toBe(saved!.selectedTown);
    expect(replay.state.ownedFarms).toEqual(saved!.ownedFarms);
    expect(replay.state.ownedWarehouses).toEqual(saved!.ownedWarehouses);
    rebuilt = replay.state;
  }, { timeout: 3_000 });
  return rebuilt!;
}

describe("playing through the interface", () => {
  beforeEach(deleteDatabase);
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("records a new game's actions so they replay to the same saved game", async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error("no network")));
    vi.stubGlobal("fetch", fetchSpy);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /begin your story/i }));
    await screen.findByRole("heading", { name: "The Bengal Trader" });

    fireEvent.click(screen.getByRole("button", { name: "Open Dhaka market" }));
    fireEvent.click(screen.getByRole("button", { name: "Buy Salt for 14 gold" }));
    fireEvent.click(screen.getByRole("button", { name: /Confirm buy/ }));
    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));
    fireEvent.click(mapPort(/^Sylhet/));

    const rebuilt = await expectLogMatchesSave(2);
    const log = await readCommandLog();
    expect(log?.meta.provenance).toBe("recorded");
    expect(log?.commands.map((entry) => entry.command.type)).toEqual(["buyGood", "selectDestination"]);
    expect(rebuilt.selectedTown).toBe("sylhet");
    // The whole time, the game never needed a connection.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("records nothing for a refused action", async () => {
    await saveGame({ ...createNewGame("Maya"), gold: 0, highestGold: 90 });
    render(<App />);
    await screen.findByRole("heading", { name: "The Bengal Trader" });
    await waitFor(async () => expect(await readCommandLog()).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Open ship dock" }));
    expect(screen.getByRole("button", { name: /Upgrade Stronger bow cannon/ })).toBeDisabled();
    const log = await readCommandLog();
    expect(log?.commands).toEqual([]);
  });

  it("keeps recording through a reload of an existing version 19 save", async () => {
    await saveGame({ ...createNewGame("Maya"), gold: 3_000, highestGold: 3_000 });
    const first = render(<App />);
    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(screen.getByRole("button", { name: "Open ship dock" }));
    fireEvent.click(screen.getByRole("button", { name: /Upgrade Roomier cargo hold/ }));
    await expectLogMatchesSave(1);
    first.unmount();

    render(<App />);
    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(screen.getByRole("button", { name: "Open ship dock" }));
    fireEvent.click(screen.getByRole("button", { name: /Upgrade Stronger bow cannon/ }));
    const rebuilt = await expectLogMatchesSave(2);
    const log = await readCommandLog();
    expect(log?.meta.provenance).toBe("imported");
    expect(log?.commands.map((entry) => entry.seq)).toEqual([1, 2]);
    expect(rebuilt.upgrades).toMatchObject({ hold: 1, cannon: 1 });
  });

  it("records voyages, speed changes and a reload at sea without counting closed time", async () => {
    let clock = 1_800_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /begin your story/i }));
    fireEvent.click(mapPort(/^Jessore/));
    fireEvent.click(screen.getByRole("button", { name: "Travel to Jessore" }));
    await screen.findByRole("group", { name: "Sailing speed" });
    clock += 1_000;
    fireEvent.click(screen.getByRole("button", { name: "2× Fast" }));
    await waitFor(async () => {
      const log = await readCommandLog();
      expect(log?.commands.map((entry) => entry.command.type)).toEqual([
        "selectDestination", "startVoyage", "changeVoyageSpeed",
      ]);
    });
    cleanup();

    clock += 86_400_000;
    render(<App />);
    await screen.findByRole("group", { name: "Sailing speed" });
    await waitFor(async () => {
      const log = await readCommandLog();
      expect(log?.commands.at(-1)?.command.type).toBe("resumeVoyage");
    });

    const log = await readCommandLog();
    const saved = await loadGame();
    const replay = replayCommands(
      { state: log!.base, lastSeq: 0, lastAt: 0 },
      log!.commands,
      { receivedAt: clock },
    );
    expect(replay.status).toBe("accepted");
    if (replay.status !== "accepted") return;
    // A day away added nothing: the voyage is where it was.
    expect(checkpointVoyageProgress(replay.state, clock).voyage?.elapsedMs)
      .toBeCloseTo(checkpointVoyageProgress(saved!, clock).voyage?.elapsedMs ?? -1);
    expect(replay.state.voyage?.elapsedMs).toBeLessThan(5_000);
  });
});
