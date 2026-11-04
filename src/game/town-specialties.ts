// Holds no town data: which goods a town is known for comes from its market profile, and whether
// that rests on evidence comes from the identity records. config/specialties.ts sets the rules.
import { CITY_ECONOMIC_IDENTITIES, ECONOMIC_IDENTITY_CONFIDENCE } from "./city-economic-identities";
import { TOWN_SPECIALTY_SETTINGS } from "./config/specialties";
import {
  GOODS,
  getMarketSupply,
  type GameState,
  type GoodId,
  type MarketPortId,
} from "./model";

export interface TownSpecialty {
  good: GoodId;
  name: string;
  /** False when the records don't support this specialty as more than a gameplay assumption. */
  supported: boolean;
}

export function isTownSpecialtyDiscovered(
  state: Pick<GameState, "currentTown" | "visitedTowns">,
  town: MarketPortId,
): boolean {
  return (
    TOWN_SPECIALTY_SETTINGS.discovery === "always" ||
    town === state.currentTown ||
    state.visitedTowns.includes(town)
  );
}

export function getTownSpecialties(port: MarketPortId): TownSpecialty[] {
  const settings = TOWN_SPECIALTY_SETTINGS;
  const records = CITY_ECONOMIC_IDENTITIES[port].goods;
  const lowest = ECONOMIC_IDENTITY_CONFIDENCE.indexOf(settings.lowestSupportedConfidence);
  return GOODS.filter((good) => getMarketSupply(port, good.id) === settings.specialtySupplyTier).map((good) => ({
    good: good.id,
    name: good.name,
    supported:
      settings.supportedBases.includes(records[good.id].basis) &&
      ECONOMIC_IDENTITY_CONFIDENCE.indexOf(records[good.id].confidence) <= lowest,
  }));
}
