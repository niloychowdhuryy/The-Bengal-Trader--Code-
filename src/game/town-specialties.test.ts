import { describe, expect, it } from "vitest";
import { CITY_ECONOMIC_IDENTITIES } from "./city-economic-identities";
import { TOWN_SPECIALTY_SETTINGS } from "./config/specialties";
import { MARKET_PORTS, createNewGame, getMarketSupply } from "./model";
import { getTownSpecialties, isTownSpecialtyDiscovered } from "./town-specialties";

describe("town specialties", () => {
  it("lists every town's main goods, and only those", () => {
    for (const { id } of MARKET_PORTS) {
      const specialties = getTownSpecialties(id);
      expect(specialties.length, id).toBeGreaterThan(0);
      for (const { good } of specialties) expect(getMarketSupply(id, good)).toBe(3);
    }
  });

  it("marks anything the history records don't document as a game assumption", () => {
    const names = (port: "dhaka" | "kasimbazar" | "sonargaon" | "hooghly") => getTownSpecialties(port).map((entry) => entry.supported);
    expect(names("dhaka")).toEqual([true]);
    expect(names("kasimbazar")).toEqual([true]);
    expect(names("sonargaon")).toEqual([false]);
    expect(names("hooghly")).toEqual([false, false, false]);
    for (const { id } of MARKET_PORTS) {
      for (const specialty of getTownSpecialties(id)) {
        const record = CITY_ECONOMIC_IDENTITIES[id].goods[specialty.good];
        if (specialty.supported) expect(record.basis).toBe("documented-context");
      }
    }
  });

  it("stays hidden until the player has been there, and stays known afterwards", () => {
    const game = createNewGame("Maya");
    expect(isTownSpecialtyDiscovered(game, "dhaka")).toBe(true);
    expect(isTownSpecialtyDiscovered(game, "patna")).toBe(false);
    expect(isTownSpecialtyDiscovered({ ...game, visitedTowns: [...game.visitedTowns, "patna"] }, "patna")).toBe(true);
  });

  it("says nothing about prices or profit", () => {
    const wording = [TOWN_SPECIALTY_SETTINGS.heading, TOWN_SPECIALTY_SETTINGS.assumptionLabel, TOWN_SPECIALTY_SETTINGS.undiscoveredMessage].join(" ");
    expect(wording).not.toMatch(/price|cheap|profit|coin|sell|buy|traded/i);
  });
});
