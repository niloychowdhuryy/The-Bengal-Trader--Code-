import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { SaveBackupPanel } from "./components/SaveBackupPanel";
import { createNewGame } from "./game/model";
import { loadGame, readRawSave, readSaveBackup } from "./game/storage";
import saveV20 from "./game/__fixtures__/save-v20.json";

function resetDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("bengal-trader");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function writeRawSave(value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("bengal-trader", 2);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains("save")) open.result.createObjectStore("save");
    };
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const transaction = open.result.transaction("save", "readwrite");
      transaction.objectStore("save").put(value, "captain");
      transaction.oncomplete = () => {
        open.result.close();
        resolve();
      };
    };
  });
}

async function openBackups() {
  await screen.findByRole("heading", { name: "The Bengal Trader" });
  fireEvent.click(await screen.findByRole("button", { name: "Open more game areas" }));
  fireEvent.click(screen.getByRole("button", { name: "Save backups" }));
}

describe("keeping saves safe", () => {
  beforeEach(resetDatabase);
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("asks for a reload on a newer save, and offers nothing that could replace it", async () => {
    const newer = { ...createNewGame("Maya"), version: 29 };
    await writeRawSave(newer);
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your save is from a newer version of the game. Reload the page to update",
    );
    expect(screen.getByRole("button", { name: "Reload the game" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /fresh voyage/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /begin your story/i })).toBeNull();
    expect(await readRawSave()).toEqual(newer);
  });

  it("keeps a save that won't load, even if the player starts again", async () => {
    const broken = { ...saveV20, fleet: "not a fleet" };
    await writeRawSave(broken);
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("It has not been changed");
    expect(screen.getByRole("button", { name: "Download a copy of your save" })).toBeVisible();
    expect(await readRawSave()).toEqual(broken);

    fireEvent.click(screen.getByRole("button", { name: /fresh voyage.*kept as a backup/i }));
    fireEvent.click(await screen.findByRole("button", { name: /begin your story/i }));

    await waitFor(async () => expect((await loadGame())?.coins).toBe(5_000));
    await waitFor(async () =>
      expect((await readSaveBackup("save-backup:new-game"))?.save).toEqual(broken),
    );
  });

  it("converts an old save on load, showing its balance in Coins and its backup", async () => {
    await writeRawSave(saveV20);
    render(<App />);
    await openBackups();

    expect(screen.getByLabelText(`Coins ${(saveV20.gold * 50).toLocaleString("en-US")}; cargo 9 of 30`))
      .toBeInTheDocument();
    expect(await screen.findByText("Before a game update")).toBeVisible();
    expect(screen.getByText(/Recorded/)).toBeVisible();
  });

  it("shortens a large balance in the top bar, without overstating it", async () => {
    await writeRawSave({ ...createNewGame("Maya"), coins: 1_239_999, highestCoins: 1_239_999 });
    render(<App />);
    await screen.findByRole("heading", { name: "The Bengal Trader" });

    expect(await screen.findByLabelText(/^Coins 1,239,999;/)).toHaveTextContent("1.23M");
  });

  it("restores only after a second, clearly worded choice", async () => {
    await writeRawSave(saveV20);
    render(<App />);
    await screen.findByRole("heading", { name: "The Bengal Trader" });
    cleanup();

    const onRestored = vi.fn();
    render(<SaveBackupPanel onRestored={onRestored} />);
    fireEvent.click(await screen.findByRole("button", { name: "Restore" }));
    expect(onRestored).not.toHaveBeenCalled();
    expect(await readRawSave()).toMatchObject({ version: 28 });

    fireEvent.click(screen.getByRole("button", { name: "Keep my current game" }));
    expect(await readRawSave()).toMatchObject({ version: 28 });

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    fireEvent.click(screen.getByRole("button", { name: "Replace my current game with this" }));
    await waitFor(() => expect(onRestored).toHaveBeenCalledOnce());
    expect(await readRawSave()).toEqual(saveV20);
  });
});
