// What each town makes and wants, and what each good is worth. The evidence behind these
// choices is in city-economic-identities.ts. Unlisted goods are the middle tier, 2.
import type { GoodId, MarketPortId, PortEconomyProfile } from "../model";

export const PORT_ECONOMIES: Record<MarketPortId, PortEconomyProfile> = {
  dhaka: {
    supply: { muslin: 3, rice: 2 },
    demand: { rice: 3, salt: 3, silk: 2, sugar: 2, saltpetre: 1, opium: 2 },
  },
  sonargaon: {
    supply: { muslin: 2, rice: 2 },
    demand: { salt: 3, rice: 2, sugar: 2, silk: 2 },
  },
  kasimbazar: {
    supply: { silk: 3, rice: 2 },
    demand: { rice: 3, salt: 3, muslin: 2, saltpetre: 2 },
  },
  chittagong: {
    supply: { salt: 2, rice: 2 },
    demand: { rice: 3, salt: 3, muslin: 2, sugar: 2, saltpetre: 2 },
  },
  sylhet: {
    supply: { rice: 2, lac: 2 },
    demand: { salt: 3, muslin: 3, sugar: 2 },
  },
  hooghly: {
    supply: { rice: 3, salt: 2, muslin: 3, silk: 3, sugar: 3, saltpetre: 3, opium: 3 },
    demand: { rice: 3, salt: 3, muslin: 3, silk: 3, sugar: 2, saltpetre: 3, opium: 2, lac: 2 },
  },
  satgaon: {
    supply: { rice: 1, sugar: 1, lac: 1 },
    demand: { salt: 3, muslin: 2, rice: 2, sugar: 2 },
  },
  rajmahal: {
    supply: { rice: 2, silk: 1, saltpetre: 1 },
    demand: { rice: 3, salt: 3, muslin: 2, sugar: 2 },
  },
  tanda: {
    supply: { rice: 1, sugar: 1, muslin: 1, silk: 1 },
    demand: { salt: 3, rice: 2, muslin: 2, silk: 2 },
  },
  malda: {
    supply: { rice: 2, sugar: 2, silk: 1, lac: 1 },
    demand: { salt: 3, muslin: 2, silk: 2, saltpetre: 2 },
  },
  balasore: {
    supply: { rice: 2, salt: 1 },
    demand: { rice: 2, muslin: 2, silk: 2, sugar: 2, saltpetre: 2 },
  },
  jessore: {
    supply: { rice: 3, sugar: 2 },
    demand: { salt: 3, muslin: 2, silk: 2 },
  },
  sandwip: {
    supply: { salt: 1, rice: 1 },
    demand: { rice: 3, salt: 3, muslin: 3, sugar: 2, silk: 2 },
  },
  "bakla-chandradwip": {
    supply: { rice: 3, salt: 1, lac: 1 },
    demand: { salt: 3, muslin: 3, sugar: 2, silk: 1, saltpetre: 1 },
  },
  patna: {
    supply: { rice: 2, saltpetre: 3, opium: 3 },
    demand: { saltpetre: 3, opium: 2, muslin: 3, silk: 3, salt: 3, sugar: 2 },
  },
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
