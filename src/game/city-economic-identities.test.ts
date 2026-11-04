import { describe, expect, it } from "vitest";
import {
  ECONOMIC_IDENTITY_BASES,
  ECONOMIC_IDENTITY_CONFIDENCE,
  ECONOMIC_IDENTITY_ROLES,
  CITY_ECONOMIC_IDENTITIES,
} from "./city-economic-identities";
import {
  GOODS,
  MARKET_PORTS,
  PORT_ECONOMIES,
  createInitialMarketStock,
  getGoodPrice,
  getMarketDemand,
  getMarketSupply,
} from "./model";

const RESEARCH_SOURCES = new Set(
  Array.from({ length: 18 }, (_, index) => `S${index + 1}`),
);

describe("city economic identity data", () => {
  it("defines one explicit, valid identity for every city-good pair", () => {
    expect(Object.keys(CITY_ECONOMIC_IDENTITIES).sort()).toEqual(
      MARKET_PORTS.map((port) => port.id).sort(),
    );

    for (const port of MARKET_PORTS) {
      const city = CITY_ECONOMIC_IDENTITIES[port.id];
      expect(city.summary.trim()).not.toBe("");
      expect(ECONOMIC_IDENTITY_BASES).toContain(city.summaryBasis);
      expect(ECONOMIC_IDENTITY_CONFIDENCE).toContain(city.summaryConfidence);
      if (city.summaryBasis === "documented-context") {
        expect(city.summarySources.length).toBeGreaterThan(0);
      }
      for (const source of city.summarySources) {
        expect(RESEARCH_SOURCES.has(source)).toBe(true);
      }

      expect(Object.keys(city.goods).sort()).toEqual(
        GOODS.map((good) => good.id).sort(),
      );
      for (const good of GOODS) {
        const identity = city.goods[good.id];
        expect(ECONOMIC_IDENTITY_ROLES).toContain(identity.role);
        expect(ECONOMIC_IDENTITY_BASES).toContain(identity.basis);
        expect(ECONOMIC_IDENTITY_CONFIDENCE).toContain(identity.confidence);
        expect(identity.note.trim()).not.toBe("");
        for (const source of identity.sources) {
          expect(RESEARCH_SOURCES.has(source)).toBe(true);
        }
        if (identity.basis === "documented-context") {
          expect(identity.sources.length).toBeGreaterThan(0);
        }
        if (identity.basis === "not-established") {
          expect(identity.role).toBe("no-established-local-role");
          expect(identity.sources).toEqual([]);
        }
        if (identity.confidence === "low") {
          expect(identity.basis).not.toBe("documented-context");
        }
      }
    }

    expect(MARKET_PORTS).toHaveLength(15);
    expect(GOODS).toHaveLength(8);
  });

  it("labels uncertain source roles as gameplay assumptions, not documented production", () => {
    const uncertainAssignments = [
      ["chittagong", "salt"],
      ["sonargaon", "muslin"],
      ["sylhet", "rice"],
      ["sylhet", "lac"],
      ["tanda", "salt"],
      ["malda", "sugar"],
      ["balasore", "rice"],
      ["jessore", "rice"],
      ["sandwip", "salt"],
      ["bakla-chandradwip", "rice"],
    ] as const;

    for (const [port, good] of uncertainAssignments) {
      const identity = CITY_ECONOMIC_IDENTITIES[port].goods[good];
      expect(identity.basis).toBe("gameplay-assumption");
      expect(identity.confidence).not.toBe("high");
      if (identity.role === "local-production-collection") {
        expect(identity.basis).not.toBe("documented-context");
      }
    }

    const hooghly = CITY_ECONOMIC_IDENTITIES.hooghly;
    for (const good of GOODS) {
      if (PORT_ECONOMIES.hooghly.supply[good.id] !== 3) continue;
      expect(hooghly.goods[good.id].role).toBe("aggregation-through-trade");
    }
    expect(
      Object.values(hooghly.goods).some(
        (identity) => identity.role === "local-production-collection",
      ),
    ).toBe(false);

    for (const good of ["rice", "sugar", "lac"] as const) {
      expect(CITY_ECONOMIC_IDENTITIES.satgaon.goods[good].basis).toBe(
        "gameplay-assumption",
      );
      expect(CITY_ECONOMIC_IDENTITIES.satgaon.goods[good].role).toBe(
        "aggregation-through-trade",
      );
    }
    expect(CITY_ECONOMIC_IDENTITIES["bakla-chandradwip"].summaryBasis).toBe(
      "gameplay-assumption",
    );
  });

  it("keeps economic identities descriptive without changing existing stock or quotes", () => {
    const initialStock = createInitialMarketStock();
    expect(initialStock.dhaka.muslin).toBe(72);
    expect(initialStock.patna.saltpetre).toBe(72);
    expect(initialStock.sandwip.salt).toBe(72);

    expect(getMarketSupply("dhaka", "muslin")).toBe(3);
    expect(getMarketDemand("dhaka", "rice")).toBe(3);
    expect(
      getGoodPrice(
        "dhaka",
        "muslin",
        "buy",
        false,
        initialStock.dhaka.muslin,
      ),
    ).toBe(975);
    expect(
      getGoodPrice(
        "kasimbazar",
        "silk",
        "buy",
        false,
        initialStock.kasimbazar.silk,
      ),
    ).toBe(1185);
    expect(
      getGoodPrice(
        "patna",
        "saltpetre",
        "buy",
        false,
        initialStock.patna.saltpetre,
      ),
    ).toBe(665);
    expect(
      getGoodPrice(
        "hooghly",
        "saltpetre",
        "buy",
        false,
        initialStock.hooghly.saltpetre,
      ),
    ).toBe(730);
    expect(
      getGoodPrice("chittagong", "salt", "buy", true),
    ).toBe(805);
  });
});
