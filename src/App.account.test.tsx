import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { createNewGame } from "./game/model";
import { loadGame, saveGame, whenStorageIdle } from "./game/storage";
import type { AccountService, AccountStatus } from "./online/account";

let listener: (status: AccountStatus) => void = () => undefined;
const service: { [K in keyof AccountService]: ReturnType<typeof vi.fn> } = {
  subscribe: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  completeProfile: vi.fn(),
};
let configured = true;

vi.mock("./online/config", async (original) => ({
  ...(await original<typeof import("./online/config")>()),
  getOnlineConfig: () =>
    configured ? { url: "https://example.supabase.co", publishableKey: "sb_publishable_x" } : null,
}));
vi.mock("./online/account", async (original) => ({
  ...(await original<typeof import("./online/account")>()),
  createAccountService: () => service,
}));

async function openAccount(status: AccountStatus) {
  render(<App />);
  await screen.findByRole("heading", { name: "The Bengal Trader" });
  act(() => listener(status));
  fireEvent.click(screen.getByRole("button", { name: "Open more game areas" }));
  fireEvent.click(screen.getByRole("button", { name: "Account" }));
}

const signedIn = (profile: Extract<AccountStatus, { kind: "signed-in" }>["profile"]): AccountStatus => ({
  kind: "signed-in",
  email: "rani@example.com",
  profile,
});

describe("account screens", () => {
  beforeEach(async () => {
    configured = true;
    vi.clearAllMocks();
    service.subscribe.mockImplementation((next) => {
      listener = next;
      return () => undefined;
    });
    service.signIn.mockResolvedValue(undefined);
    service.signOut.mockResolvedValue(undefined);
    service.completeProfile.mockResolvedValue(null);
    await whenStorageIdle();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("bengal-trader");
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
    await saveGame({ ...createNewGame("Maya"), gold: 321, highestGold: 321 });
  });
  afterEach(cleanup);

  it("shows no login at all when online isn't configured, and still plays", async () => {
    configured = false;
    render(<App />);
    await screen.findByRole("heading", { name: "The Bengal Trader" });
    fireEvent.click(screen.getByRole("button", { name: "Open more game areas" }));
    expect(screen.queryByRole("button", { name: "Account" })).not.toBeInTheDocument();
    expect(service.subscribe).not.toHaveBeenCalled();
    expect(screen.getByText(/^Version local/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Report a problem" })).toHaveAttribute(
      "href",
      expect.stringContaining("github.com"),
    );
  });

  it("starts Google sign-in and says saves are still on this device", async () => {
    await openAccount({ kind: "signed-out" });
    expect(screen.getByText(/still saves only on this device/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Sign in with Google/ }));
    expect(service.signIn).toHaveBeenCalledOnce();
  });

  it("explains a failed sign-in and keeps the game playable", async () => {
    service.signIn.mockRejectedValue(new Error("offline"));
    await openAccount({ kind: "signed-out" });
    fireEvent.click(screen.getByRole("button", { name: /Sign in with Google/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/keep playing offline/);
    expect(screen.getByLabelText(/^Gold 321/)).toBeInTheDocument();
  });

  it("asks a new player for a name and age, and shows server refusals", async () => {
    await openAccount(signedIn({ displayName: null, ageConfirmed: false }));
    service.completeProfile.mockResolvedValueOnce("name-taken");
    fireEvent.change(screen.getByLabelText("Your merchant name"), { target: { value: "Rani" } });
    fireEvent.click(screen.getByLabelText("I am 13 or older"));
    fireEvent.click(screen.getByRole("button", { name: "Save merchant name" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/already uses that name/);
    expect(service.completeProfile).toHaveBeenCalledWith("Rani", true);
  });

  it("shows an existing merchant and lets them rename", async () => {
    await openAccount(signedIn({ displayName: "Rani", ageConfirmed: true }));
    expect(screen.getByRole("heading", { name: "Rani" })).toBeVisible();
    expect(screen.queryByLabelText("Your merchant name")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change merchant name" }));
    expect(screen.getByLabelText("Your merchant name")).toHaveValue("Rani");
    expect(screen.queryByLabelText("I am 13 or older")).not.toBeInTheDocument();
  });

  it("keeps working when the profile can't be reached", async () => {
    await openAccount(signedIn(null));
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText(/couldn't be reached/)).toBeVisible();
  });

  it("signing out leaves the game on this device untouched", async () => {
    await openAccount(signedIn({ displayName: "Rani", ageConfirmed: true }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(service.signOut).toHaveBeenCalledOnce());
    act(() => listener({ kind: "signed-out" }));
    expect(await screen.findByRole("button", { name: /Sign in with Google/ })).toBeVisible();
    expect((await loadGame())?.gold).toBe(321);
  });
});
