import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import BengalMap from "./components/BengalMap";
import { createNewGame } from "./game/model";
import { saveGame, whenStorageIdle } from "./game/storage";
import fixture from "./game/__fixtures__/save-v19.json";

function mapRegion(): HTMLElement {
  return screen.getByRole("region", { name: "Illustrated map of Bengal and its river towns" });
}
const viewBox = () => document.querySelector(".bengal-map")!.getAttribute("viewBox");
const port = (name: RegExp) =>
  screen.getAllByRole("button", { name }).find((b) => b.classList.contains("town-marker"))!;

async function resetSave() {
  await whenStorageIdle();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase("bengal-trader");
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

function writeRaw(value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("bengal-trader", 2);
    open.onupgradeneeded = () => open.result.createObjectStore("save");
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

describe("leaving and returning to the map", () => {
  beforeEach(resetSave);
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  async function start() {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /begin your story/i }));
    await screen.findByRole("heading", { name: "The Bengal Trader" });
  }

  it("keeps the same map, camera and art through repeated visits to town", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    const zoomed = viewBox();
    const map = mapRegion();
    const art = map.querySelector("image");

    for (let visit = 0; visit < 3; visit += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Enter Dhaka city" }));
      expect(screen.getByRole("region", { name: "Dhaka town scene" })).toBeVisible();
      expect(screen.queryByRole("region", { name: /Illustrated map/ })).toBeNull();
      expect(map).not.toBeVisible();
      expect(document.querySelector(".city-scene")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Open map" }));
      expect(document.querySelector(".city-scene")).toBeNull();
      expect(mapRegion()).toBe(map);
      expect(map.querySelector("image")).toBe(art);
      expect(viewBox()).toBe(zoomed);
    }
  });

  it("keeps ports and routes working after returning", async () => {
    await start();
    fireEvent.click(screen.getByRole("button", { name: "Enter Dhaka city" }));
    fireEvent.click(screen.getByRole("button", { name: "Market" }));
    fireEvent.click(screen.getByRole("button", { name: "Open map" }));
    fireEvent.click(port(/^Sonargaon/));
    expect(screen.getByRole("button", { name: "Travel to Sonargaon" })).toBeEnabled();
    expect(document.querySelectorAll(".route-leg-land").length).toBe(1);
    expect(document.querySelectorAll(".route-leg-water").length).toBe(1);
    fireEvent.click(port(/^Hooghly/));
    expect(document.querySelectorAll(".route-leg-land").length).toBe(0);
  });

  it("keeps the journey on show after leaving the map while travelling", async () => {
    await start();
    fireEvent.click(port(/^Sonargaon/));
    fireEvent.click(screen.getByRole("button", { name: "Travel to Sonargaon" }));
    await screen.findByRole("group", { name: "Sailing speed" });
    const map = mapRegion();
    for (let visit = 0; visit < 3; visit += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Open fleet" }));
      fireEvent.click(screen.getByRole("button", { name: "Open map" }));
      expect(mapRegion()).toBe(map);
      expect(screen.getByRole("group", { name: "Sailing speed" })).toBeVisible();
      expect(document.querySelector(".vessel-under-sail")).toBeInTheDocument();
    }
  });

  it("works after a reload and with a version 19 save", async () => {
    await writeRaw(fixture);
    const first = render(<App />);
    await screen.findByRole("group", { name: "Sailing speed" });
    fireEvent.click(screen.getByRole("button", { name: "Open fleet" }));
    fireEvent.click(screen.getByRole("button", { name: "Open map" }));
    expect(screen.getByRole("group", { name: "Sailing speed" })).toBeVisible();
    await waitFor(async () => {
      await whenStorageIdle();
      expect(screen.getByText("Saved")).toBeVisible();
    });
    first.unmount();
    render(<App />);
    await screen.findByRole("group", { name: "Sailing speed" });
    expect(mapRegion()).toBeVisible();
    expect(document.querySelector(".route-leg-water")).toBeInTheDocument();
  });

  it("shows a working map from a plain saved game after reloading", async () => {
    await saveGame(createNewGame("Maya"));
    render(<App />);
    await screen.findByRole("heading", { name: "The Bengal Trader" });
    expect(mapRegion()).toBeVisible();
    expect(viewBox()).toBeTruthy();
    expect(port(/^Dhaka/)).toBeInTheDocument();
  });
});

describe("when the map art can't load", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("hides the broken image, explains, retries, and keeps ports usable", () => {
    vi.useFakeTimers();
    const select = vi.fn();
    render(<BengalMap state={createNewGame("Maya")} now={0} onSelectTown={select} />);
    const painted = () => document.querySelector('.map-plate-base image');
    fireEvent.error(painted()!);
    expect(painted()).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/couldn't load/);

    fireEvent.click(port(/^Patna/));
    expect(select).toHaveBeenCalledWith("patna");

    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(painted()).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("retries as soon as the connection returns", () => {
    vi.useFakeTimers();
    render(<BengalMap state={createNewGame("Maya")} now={0} onSelectTown={() => undefined} />);
    const painted = () => document.querySelector('.map-plate-base image');
    fireEvent.error(painted()!);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(painted()).toBeInTheDocument();
  });
});
