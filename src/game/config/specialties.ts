// How town specialties are chosen and worded. Which goods and what evidence are in towns.ts and
// city-economic-identities.ts.
import type {
  EconomicIdentityBasis,
  EconomicIdentityConfidence,
} from "../city-economic-identities";
import type { MarketTier } from "../model";

export const TOWN_SPECIALTY_SETTINGS: {
  specialtySupplyTier: MarketTier;
  supportedBases: readonly EconomicIdentityBasis[];
  lowestSupportedConfidence: EconomicIdentityConfidence;
  /** "visited" keeps a town's specialty hidden until the player has been there. */
  discovery: "visited" | "always";
  heading: string;
  assumptionLabel: string;
  undiscoveredMessage: string;
} = {
  specialtySupplyTier: 3,
  supportedBases: ["documented-context"],
  lowestSupportedConfidence: "medium",
  discovery: "visited",
  heading: "Known for",
  assumptionLabel: "(game assumption)",
  undiscoveredMessage: "Visit this port to learn what it is known for.",
};
