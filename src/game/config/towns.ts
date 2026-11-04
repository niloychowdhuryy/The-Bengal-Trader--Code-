// What each town makes and wants, and what each good is worth. The evidence behind these
// choices is in city-economic-identities.ts. Unlisted goods are the middle tier, 2.
import type { GoodId, MarketPortId, PortEconomyProfile } from "../model";

export const PORT_ECONOMIES: Record<MarketPortId, PortEconomyProfile> = {
  dhaka: { supply: { muslin: 3, saltpetre: 1 }, demand: { rice: 3, lac: 3, saltpetre: 1 } },
  sonargaon: { supply: { muslin: 3, opium: 1 }, demand: { silk: 3 } },
  kasimbazar: { supply: { silk: 3, lac: 1, salt: 1 }, demand: { rice: 3, salt: 3, silk: 1 } },
  chittagong: { supply: { salt: 3, silk: 1 }, demand: { rice: 3, sugar: 3, salt: 1 } },
  sylhet: { supply: { lac: 3, muslin: 1 }, demand: { salt: 3, sugar: 3, lac: 1 } },
  hooghly: { supply: { saltpetre: 3, sugar: 3, opium: 3 }, demand: { muslin: 3, silk: 3 } },
  satgaon: { supply: { rice: 3, lac: 1, sugar: 1 }, demand: { muslin: 3, rice: 1 } },
  rajmahal: { supply: { lac: 3, silk: 1 }, demand: { muslin: 3 } },
  tanda: { supply: { sugar: 3, muslin: 1 }, demand: { rice: 3, lac: 3 } },
  malda: { supply: { silk: 3, lac: 1 }, demand: { salt: 3, silk: 1, saltpetre: 3 } },
  balasore: { supply: { salt: 3, lac: 1, silk: 1 }, demand: { muslin: 3, salt: 1 } },
  jessore: { supply: { sugar: 3, rice: 3, saltpetre: 1 }, demand: { salt: 3 } },
  sandwip: { supply: { salt: 3, muslin: 1 }, demand: { sugar: 3, salt: 1 } },
  "bakla-chandradwip": { supply: { rice: 3, lac: 1, opium: 1 }, demand: { sugar: 3, rice: 1 } },
  patna: { supply: { saltpetre: 3, opium: 3, salt: 1 }, demand: { muslin: 3, silk: 3, salt: 3, saltpetre: 1, opium: 1 } },
};

/** Reference prices, also used for contract rewards and net worth. */
export const MARKET_BASE_PRICES: Record<GoodId, number> = {
  rice: 400,
  salt: 600,
  muslin: 1_200,
  silk: 1_600,
  sugar: 700,
  saltpetre: 900,
  opium: 2_000,
  lac: 1_100,
};
