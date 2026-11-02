export type CityBuildingId =
  | "docks"
  | "market"
  | "warehouse"
  | "town"
  | "mosque"
  | "home"
  | "workshop"
  | "farm";

export interface CityBuildingDefinition {
  id: CityBuildingId;
  name: string;
  detail: string;
}

export interface CityBuildingPlacement {
  id: CityBuildingId;
  x: number;
  y: number;
  scale: number;
}

export type CitySetting = "delta" | "coast" | "upland" | "plains";

export interface CityProfile {
  setting: CitySetting;
  layout: CityBuildingPlacement[];
  seed: number;
}

export const CITY_BUILDINGS: CityBuildingDefinition[] = [
  { id: "mosque", name: "Mosque", detail: "A place for the local community." },
  { id: "town", name: "Town centre", detail: "Local property and standing." },
  { id: "market", name: "Market", detail: "Buy and sell goods from this port." },
  { id: "warehouse", name: "Warehouse", detail: "Your cargo travels with your ship." },
  { id: "workshop", name: "Workshop", detail: "Town businesses are planned for a later stage." },
  { id: "home", name: "Home", detail: "Establish your residence in this port." },
  { id: "farm", name: "Farm", detail: "Grow Rice during your active voyages." },
  { id: "docks", name: "Docks", detail: "Repair and improve your ship." },
];

// All scenes share a 1600 × 1000 plate. Buildings stay inside x 490–1110 so they
// remain on screen in portrait; the wider plate adds scenery on desktop.
type Row = [CityBuildingId, number, number, number?];

function layout(rows: Row[]): CityBuildingPlacement[] {
  return rows.map(([id, x, y, scale = 1.14]) => ({ id, x, y, scale }));
}

const CAPITAL = layout([
  ["mosque", 610, 250, 1.16], ["town", 960, 262, 1.16],
  ["warehouse", 520, 450], ["market", 800, 430, 1.26], ["workshop", 1080, 460],
  ["home", 620, 650], ["farm", 1000, 650],
  ["docks", 800, 765, 1.22],
]);
const RIVER_TOWN = layout([
  ["town", 810, 262, 1.16], ["mosque", 1050, 330], ["farm", 540, 290],
  ["market", 620, 480, 1.22], ["warehouse", 1010, 520],
  ["home", 810, 620], ["workshop", 520, 665],
  ["docks", 1000, 760, 1.18],
]);
const BAZAAR_TOWN = layout([
  ["mosque", 980, 250], ["home", 620, 250],
  ["market", 840, 410, 1.28], ["workshop", 520, 430], ["farm", 1080, 440],
  ["town", 660, 610, 1.16], ["warehouse", 1000, 640],
  ["docks", 700, 775, 1.2],
]);
const QUAY_TOWN = layout([
  ["farm", 1060, 260], ["town", 730, 262, 1.16],
  ["mosque", 520, 400], ["home", 960, 430],
  ["warehouse", 720, 480, 1.2], ["workshop", 1090, 620],
  ["market", 520, 640, 1.2],
  ["docks", 820, 770, 1.22],
]);

const PROFILES: Record<string, CityProfile> = {
  Dhaka: { setting: "delta", layout: CAPITAL, seed: 3 },
  Sonargaon: { setting: "delta", layout: BAZAAR_TOWN, seed: 11 },
  Kasimbazar: { setting: "delta", layout: RIVER_TOWN, seed: 17 },
  Chittagong: { setting: "coast", layout: QUAY_TOWN, seed: 23 },
  Sylhet: { setting: "upland", layout: RIVER_TOWN, seed: 29 },
  Hooghly: { setting: "delta", layout: QUAY_TOWN, seed: 31 },
  Satgaon: { setting: "delta", layout: BAZAAR_TOWN, seed: 37 },
  Rajmahal: { setting: "upland", layout: BAZAAR_TOWN, seed: 41 },
  Tanda: { setting: "plains", layout: RIVER_TOWN, seed: 43 },
  Malda: { setting: "plains", layout: QUAY_TOWN, seed: 47 },
  Balasore: { setting: "coast", layout: BAZAAR_TOWN, seed: 53 },
  Jessore: { setting: "delta", layout: RIVER_TOWN, seed: 59 },
  Sandwip: { setting: "coast", layout: RIVER_TOWN, seed: 61 },
  "Bakla-Chandradwip": { setting: "coast", layout: QUAY_TOWN, seed: 67 },
  Patna: { setting: "plains", layout: CAPITAL, seed: 71 },
};

const FALLBACK_PROFILE: CityProfile = { setting: "delta", layout: RIVER_TOWN, seed: 7 };

export function getCityProfile(townName: string): CityProfile {
  return PROFILES[townName] ?? FALLBACK_PROFILE;
}

export function getCityBuilding(id: CityBuildingId): CityBuildingDefinition {
  const building = CITY_BUILDINGS.find((candidate) => candidate.id === id);
  if (!building) throw new Error(`Unknown city building: ${id}`);
  return building;
}
