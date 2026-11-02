import type { GoodId, MarketPortId } from "./model";

export const ECONOMIC_IDENTITY_ROLES = [
  "local-production-collection",
  "hinterland-source",
  "aggregation-through-trade",
  "import-dependency",
  "no-established-local-role",
] as const;

export type EconomicIdentityRole =
  (typeof ECONOMIC_IDENTITY_ROLES)[number];

export const ECONOMIC_IDENTITY_BASES = [
  "documented-context",
  "gameplay-assumption",
  "not-established",
] as const;

export type EconomicIdentityBasis =
  (typeof ECONOMIC_IDENTITY_BASES)[number];

export const ECONOMIC_IDENTITY_CONFIDENCE = [
  "high",
  "medium",
  "low",
] as const;

export type EconomicIdentityConfidence =
  (typeof ECONOMIC_IDENTITY_CONFIDENCE)[number];

export interface GoodEconomicIdentity {
  role: EconomicIdentityRole;
  basis: EconomicIdentityBasis;
  confidence: EconomicIdentityConfidence;
  note: string;
  sources: readonly string[];
}

export interface CityEconomicIdentity {
  summary: string;
  summaryBasis: EconomicIdentityBasis;
  summaryConfidence: EconomicIdentityConfidence;
  summarySources: readonly string[];
  goods: Record<GoodId, GoodEconomicIdentity>;
}

const documented = (
  role: EconomicIdentityRole,
  note: string,
  sources: readonly string[],
  confidence: EconomicIdentityConfidence = "high",
): GoodEconomicIdentity => ({
  role,
  basis: "documented-context",
  confidence,
  note,
  sources,
});

const assumed = (
  role: EconomicIdentityRole,
  note: string,
  sources: readonly string[] = [],
  confidence: EconomicIdentityConfidence = "low",
): GoodEconomicIdentity => ({
  role,
  basis: "gameplay-assumption",
  confidence,
  note,
  sources,
});

const notEstablished = (): GoodEconomicIdentity => ({
  role: "no-established-local-role",
  basis: "not-established",
  confidence: "low",
  note:
    "The current research does not establish a port-specific role; this does not mean the good was absent.",
  sources: [],
});

export const CITY_ECONOMIC_IDENTITIES: Record<
  MarketPortId,
  CityEconomicIdentity
> = {
  dhaka: {
    summary:
      "Mughal provincial capital and major textile centre, supplied by a broad river network.",
    summaryBasis: "documented-context",
    summaryConfidence: "high",
    summarySources: ["S3", "S9"],
    goods: {
      rice: assumed(
        "aggregation-through-trade",
        "Urban provisioning and river distribution are plausible; this is not a claim of city production.",
        ["S9"],
        "medium",
      ),
      salt: assumed(
        "import-dependency",
        "A large administrative market plausibly depends on coastal and interregional supply.",
        ["S7", "S9"],
      ),
      muslin: documented(
        "local-production-collection",
        "Dhaka and nearby settlements are documented centres for cotton cloth and muslin.",
        ["S3", "S9"],
      ),
      silk: notEstablished(),
      sugar: notEstablished(),
      saltpetre: notEstablished(),
      opium: notEstablished(),
      lac: notEstablished(),
    },
  },
  sonargaon: {
    summary:
      "Historic port and cloth centre; the smaller playable regional-market role is an abstraction after Dhaka's rise.",
    summaryBasis: "gameplay-assumption",
    summaryConfidence: "medium",
    summarySources: ["S10"],
    goods: {
      rice: assumed(
        "aggregation-through-trade",
        "A regional bazaar and provisioning role is plausible, but its late-century scale is unknown.",
        ["S10"],
      ),
      salt: assumed(
        "import-dependency",
        "Inland provisioning from a wider coastal supply shed is a gameplay assumption.",
        ["S7", "S10"],
      ),
      muslin: assumed(
        "local-production-collection",
        "Sonargaon's cloth reputation is documented, but its output and market scale around 1665 are uncertain.",
        ["S3", "S10"],
        "medium",
      ),
      silk: notEstablished(),
      sugar: notEstablished(),
      saltpetre: notEstablished(),
      opium: notEstablished(),
      lac: notEstablished(),
    },
  },
  kasimbazar: {
    summary:
      "A documented seventeenth-century commercial mart and silk-trading centre linked to western and eastern markets.",
    summaryBasis: "documented-context",
    summaryConfidence: "high",
    summarySources: ["S11", "S17"],
    goods: {
      rice: assumed(
        "import-dependency",
        "High urban demand may draw provisions from the surrounding region.",
        ["S11"],
      ),
      salt: assumed(
        "import-dependency",
        "A river-market provisioning need; local salt production is not established.",
        ["S7", "S11"],
      ),
      muslin: notEstablished(),
      silk: documented(
        "aggregation-through-trade",
        "Kasimbazar is documented as a seventeenth-century silk mart; that does not make the town the sole producer.",
        ["S4", "S11", "S17"],
      ),
      sugar: notEstablished(),
      saltpetre: notEstablished(),
      opium: notEstablished(),
      lac: notEstablished(),
    },
  },
  chittagong: {
    summary:
      "A coastal and overseas-facing port; the game's coastal-salt identity is regional and provisional.",
    summaryBasis: "documented-context",
    summaryConfidence: "medium",
    summarySources: ["S7", "S13", "S14"],
    goods: {
      rice: assumed(
        "import-dependency",
        "Port provisioning is plausible, but a city-specific 1660s rice balance is not established.",
        ["S13"],
      ),
      salt: assumed(
        "hinterland-source",
        "Represents a broad coastal salt-supply identity, not verified production at Chittagong itself.",
        ["S7", "S13"],
        "medium",
      ),
      muslin: assumed(
        "aggregation-through-trade",
        "Textiles could pass through a coastal trading port; the local market assignment is an inference.",
        ["S1", "S13"],
      ),
      silk: notEstablished(),
      sugar: assumed(
        "aggregation-through-trade",
        "Regional or overseas through-trade is plausible, but the local supply role is not documented.",
        ["S1", "S13"],
      ),
      saltpetre: notEstablished(),
      opium: notEstablished(),
      lac: notEstablished(),
    },
  },
  sylhet: {
    summary:
      "A northeastern river-market abstraction connected to upland and riverine hinterlands.",
    summaryBasis: "gameplay-assumption",
    summaryConfidence: "low",
    summarySources: ["S18"],
    goods: {
      rice: assumed(
        "hinterland-source",
        "Regional rice collection is a gameplay assumption, not a documented 1660s export profile.",
        ["S16", "S18"],
      ),
      salt: assumed(
        "import-dependency",
        "An inland market's need for coastal salt is a broad trade-network inference.",
        ["S7", "S18"],
      ),
      muslin: assumed(
        "import-dependency",
        "Textile supply from established weaving centres is a gameplay assumption.",
        ["S3", "S18"],
      ),
      silk: notEstablished(),
      sugar: notEstablished(),
      saltpetre: notEstablished(),
      opium: notEstablished(),
      lac: assumed(
        "hinterland-source",
        "Collection from a wooded hinterland is provisional; modern geography does not establish period output.",
        ["S18"],
      ),
    },
  },
  hooghly: {
    summary:
      "A seventeenth-century trading-factory and river-port hub; abundant goods represent aggregation and through-trade, not local production.",
    summaryBasis: "documented-context",
    summaryConfidence: "high",
    summarySources: ["S1", "S14"],
    goods: {
      rice: assumed(
        "aggregation-through-trade",
        "Provisioning stock represents goods collected through the market network, not proven local production.",
        ["S1", "S14"],
        "medium",
      ),
      salt: assumed(
        "import-dependency",
        "The profile's relative salt need is a market-design inference.",
        ["S7", "S14"],
      ),
      muslin: assumed(
        "aggregation-through-trade",
        "Textile exports and the port's trade-hub role support through-trade; local production is not asserted.",
        ["S1", "S14"],
        "medium",
      ),
      silk: assumed(
        "aggregation-through-trade",
        "Raw silk is part of Bengal's export trade; abundant Hooghly stock is an aggregation assumption.",
        ["S1", "S4", "S14"],
        "medium",
      ),
      sugar: assumed(
        "aggregation-through-trade",
        "The broad export basket supports trade-through, not local sugar production at Hooghly.",
        ["S1", "S14"],
      ),
      saltpetre: assumed(
        "aggregation-through-trade",
        "Regional saltpetre commerce supports an export-market role; Hooghly abundance is a gameplay assumption.",
        ["S1", "S5", "S14"],
        "medium",
      ),
      opium: assumed(
        "aggregation-through-trade",
        "Bengal opium exports are documented broadly; this port-specific market role is inferred.",
        ["S1", "S6", "S14"],
      ),
      lac: assumed(
        "aggregation-through-trade",
        "Regional lac trade may pass through the hub; no Hooghly-specific role is established.",
        ["S1"],
      ),
    },
  },
  satgaon: {
    summary:
      "A playable legacy/inland market abstraction, not a thriving late-seventeenth-century seaport.",
    summaryBasis: "gameplay-assumption",
    summaryConfidence: "medium",
    summarySources: ["S8"],
    goods: {
      rice: assumed(
        "aggregation-through-trade",
        "Rice appears in Satgaon's earlier export history; late-century activity here is a small legacy-market assumption.",
        ["S8"],
      ),
      salt: assumed(
        "import-dependency",
        "Inland salt access is a gameplay assumption for this legacy market.",
        ["S7", "S8"],
      ),
      muslin: notEstablished(),
      silk: notEstablished(),
      sugar: assumed(
        "aggregation-through-trade",
        "Sugar appears in earlier Satgaon export history; this does not establish substantial trade around 1665.",
        ["S8"],
      ),
      saltpetre: notEstablished(),
      opium: notEstablished(),
      lac: assumed(
        "aggregation-through-trade",
        "Lac appears in earlier export history; continued late-century trade is only a gameplay assumption.",
        ["S8"],
      ),
    },
  },
  rajmahal: {
    summary:
      "A Ganges transit and provisioning market; its former capital role had shifted back to Dhaka by 1660.",
    summaryBasis: "documented-context",
    summaryConfidence: "high",
    summarySources: ["S11", "S12"],
    goods: {
      rice: assumed(
        "hinterland-source",
        "Nearby provisioning supply is plausible but not documented as a town export surplus.",
        ["S12", "S16"],
      ),
      salt: assumed(
        "import-dependency",
        "A river-market need for coastal salt is a gameplay inference.",
        ["S7", "S12"],
      ),
      muslin: notEstablished(),
      silk: notEstablished(),
      sugar: notEstablished(),
      saltpetre: notEstablished(),
      opium: notEstablished(),
      lac: notEstablished(),
    },
  },
  tanda: {
    summary:
      "An inland regional-market abstraction; specific late-seventeenth-century commodity roles are not established.",
    summaryBasis: "gameplay-assumption",
    summaryConfidence: "low",
    summarySources: ["S15"],
    goods: {
      rice: notEstablished(),
      salt: assumed(
        "import-dependency",
        "An inland salt requirement is a regional gameplay assumption.",
        ["S7"],
      ),
      muslin: notEstablished(),
      silk: notEstablished(),
      sugar: notEstablished(),
      saltpetre: notEstablished(),
      opium: notEstablished(),
      lac: notEstablished(),
    },
  },
  malda: {
    summary:
      "A Gaur–Malda hinterland exchange-market abstraction; the destination's exact period trade role remains uncertain.",
    summaryBasis: "gameplay-assumption",
    summaryConfidence: "low",
    summarySources: ["S1", "S15"],
    goods: {
      rice: assumed(
        "hinterland-source",
        "Agricultural supply from the broader region is a gameplay assumption, not a town-level export fact.",
        ["S2", "S16"],
      ),
      salt: assumed(
        "import-dependency",
        "An inland market's salt need is inferred, not a documented Malda-specific trade record.",
        ["S7"],
      ),
      muslin: notEstablished(),
      silk: notEstablished(),
      sugar: assumed(
        "hinterland-source",
        "Agricultural and processing supply in the broader region is provisional.",
        ["S1", "S2"],
      ),
      saltpetre: notEstablished(),
      opium: notEstablished(),
      lac: notEstablished(),
    },
  },
  balasore: {
    summary:
      "An adjacent coastal Odisha exchange-market abstraction; its exact 1660s inventory is not established here.",
    summaryBasis: "gameplay-assumption",
    summaryConfidence: "low",
    summarySources: ["S14"],
    goods: {
      rice: assumed(
        "hinterland-source",
        "Coastal provisioning from the surrounding region is a gameplay assumption.",
        ["S14", "S16"],
      ),
      salt: notEstablished(),
      muslin: assumed(
        "aggregation-through-trade",
        "Bengal textiles could reach a coastal market through trade; no Balasore-specific volume is claimed.",
        ["S1", "S14"],
      ),
      silk: assumed(
        "aggregation-through-trade",
        "Through-traded silk is plausible for an exchange market but is not a documented local role.",
        ["S1", "S14"],
      ),
      sugar: notEstablished(),
      saltpetre: assumed(
        "aggregation-through-trade",
        "Specialist export cargo could pass through regional ports; the local assignment is provisional.",
        ["S1", "S5", "S14"],
      ),
      opium: notEstablished(),
      lac: notEstablished(),
    },
  },
  jessore: {
    summary:
      "A southwestern riverine collection-market abstraction with provisional agricultural supply roles.",
    summaryBasis: "gameplay-assumption",
    summaryConfidence: "low",
    summarySources: ["S2", "S16"],
    goods: {
      rice: assumed(
        "hinterland-source",
        "Rice surplus in the southwestern hinterland is a gameplay assumption, not a measured 1660s Jessore export.",
        ["S2", "S16"],
      ),
      salt: assumed(
        "import-dependency",
        "The need to bring coastal salt inland is a broad regional inference.",
        ["S7"],
      ),
      muslin: notEstablished(),
      silk: notEstablished(),
      sugar: assumed(
        "hinterland-source",
        "Sugarcane processing in this specific 1660s catchment is not established; supply is provisional.",
        ["S1"],
      ),
      saltpetre: notEstablished(),
      opium: notEstablished(),
      lac: notEstablished(),
    },
  },
  sandwip: {
    summary:
      "An island/coastal market abstraction; island-specific production and export claims remain unverified.",
    summaryBasis: "gameplay-assumption",
    summaryConfidence: "low",
    summarySources: ["S7", "S13"],
    goods: {
      rice: assumed(
        "import-dependency",
        "Island provisioning dependence is plausible but not established as a period-specific trade balance.",
        ["S16"],
      ),
      salt: assumed(
        "import-dependency",
        "The profile's salt scarcity is not evidence that Sandwip produced salt; local source status remains unverified.",
        ["S7"],
      ),
      muslin: assumed(
        "import-dependency",
        "Textile arrivals by coastal trade are a gameplay inference.",
        ["S1", "S13"],
      ),
      silk: notEstablished(),
      sugar: notEstablished(),
      saltpetre: notEstablished(),
      opium: notEstablished(),
      lac: notEstablished(),
    },
  },
  "bakla-chandradwip": {
    summary:
      "A lower-delta regional market abstraction, not a precisely identified single port or urban wharf.",
    summaryBasis: "gameplay-assumption",
    summaryConfidence: "low",
    summarySources: ["S2"],
    goods: {
      rice: assumed(
        "hinterland-source",
        "Lower-delta rice supply is provisional and does not establish a specific producing town.",
        ["S2", "S16"],
      ),
      salt: assumed(
        "import-dependency",
        "The lower-delta salt need is a gameplay assumption; no precise local production site is identified.",
        ["S7"],
      ),
      muslin: assumed(
        "aggregation-through-trade",
        "Textile supply through delta commerce is plausible but not locally documented for this regional label.",
        ["S1", "S2"],
      ),
      silk: notEstablished(),
      sugar: notEstablished(),
      saltpetre: notEstablished(),
      opium: notEstablished(),
      lac: notEstablished(),
    },
  },
  patna: {
    summary:
      "A Bihar/Ganges commercial gateway connected to wider regional saltpetre and opium supply chains.",
    summaryBasis: "documented-context",
    summaryConfidence: "medium",
    summarySources: ["S5", "S6", "S11"],
    goods: {
      rice: notEstablished(),
      salt: assumed(
        "import-dependency",
        "The modeled demand for coastal salt is a regional market inference.",
        ["S7", "S11"],
      ),
      muslin: assumed(
        "import-dependency",
        "Strong textile demand in this market is a gameplay assumption.",
        ["S1", "S11"],
      ),
      silk: assumed(
        "import-dependency",
        "A commercial buyer role for Bengal silk is plausible but not a quantified Patna demand record.",
        ["S4", "S11"],
      ),
      sugar: notEstablished(),
      saltpetre: assumed(
        "aggregation-through-trade",
        "Represents Patna's role in the wider Bihar supply corridor and trade network; it is not a claim that the city produced all stock.",
        ["S5", "S11"],
        "medium",
      ),
      opium: assumed(
        "aggregation-through-trade",
        "The wider Bihar trade is documented, but a Patna-specific 1660s role and volume remain uncertain.",
        ["S6", "S11"],
      ),
      lac: notEstablished(),
    },
  },
};

export function getCityEconomicIdentity(
  port: MarketPortId,
): CityEconomicIdentity {
  return CITY_ECONOMIC_IDENTITIES[port];
}
