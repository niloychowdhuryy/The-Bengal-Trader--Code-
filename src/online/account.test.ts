import { afterEach, describe, expect, it, vi } from "vitest";
import { mapProfileError } from "./account";
import { getOnlineConfig, getProblemReportUrl } from "./config";

describe("online configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("stays offline when nothing is configured", () => {
    expect(getOnlineConfig()).toBeNull();
  });

  it("needs both public values", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    expect(getOnlineConfig()).toBeNull();
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
    expect(getOnlineConfig()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_x",
    });
  });

  it("refuses to run with a secret key in the browser", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_secret_x");
    expect(getOnlineConfig()).toBeNull();
  });

  it("puts the version in problem reports", () => {
    expect(decodeURIComponent(getProblemReportUrl())).toContain("Game version: local");
  });
});

describe("mapProfileError", () => {
  it.each([
    ["name-invalid", "name-invalid"],
    ["ERROR: name-taken", "name-taken"],
    ["age-required", "age-required"],
    ["permission denied", "unavailable"],
    ["Failed to fetch", "unavailable"],
  ])("reads %j", (message, expected) => {
    expect(mapProfileError(message)).toBe(expected);
  });
});
