import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TOWNS } from "../../game/model";
import VesselArt from "../map-art/VesselArt";
import { CITY_BUILDINGS, getCityProfile } from "./city-layout";

describe("town scenes", () => {
  it.each(TOWNS.map((town) => town.name))(
    "keeps every building of %s inside the portrait frame",
    (name) => {
      const { layout } = getCityProfile(name);
      expect(layout.map((spot) => spot.id).sort()).toEqual(
        CITY_BUILDINGS.map((building) => building.id).sort(),
      );
      for (const spot of layout) {
        expect(spot.x).toBeGreaterThanOrEqual(490);
        expect(spot.x).toBeLessThanOrEqual(1110);
        expect(spot.y).toBeGreaterThanOrEqual(220);
        expect(spot.y).toBeLessThanOrEqual(800);
      }
    },
  );

  it("gives each port a named profile rather than the fallback", () => {
    const seeds = new Set(TOWNS.map((town) => getCityProfile(town.name).seed));
    expect(seeds.size).toBe(TOWNS.length);
  });
});

describe("vessel art", () => {
  it("draws a different boat for each class", () => {
    const drawings = (["river-boat", "bora", "patello"] as const).map(
      (vesselClass) =>
        render(<svg><VesselArt vesselClass={vesselClass} /></svg>).container.innerHTML,
    );
    expect(new Set(drawings).size).toBe(3);
  });
});
