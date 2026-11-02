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
  variation: number;
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

export const DHAKA_CITY_LAYOUT: CityBuildingPlacement[] = [
  { id: "mosque", x: 300, y: 318, scale: 1, variation: 0 },
  { id: "town", x: 495, y: 277, scale: 1.03, variation: 1 },
  { id: "market", x: 650, y: 424, scale: 1.05, variation: 0 },
  { id: "warehouse", x: 325, y: 502, scale: 1.04, variation: 1 },
  { id: "workshop", x: 525, y: 563, scale: 0.96, variation: 0 },
  { id: "home", x: 650, y: 622, scale: 0.98, variation: 1 },
  { id: "farm", x: 300, y: 675, scale: 0.95, variation: 0 },
  { id: "docks", x: 465, y: 690, scale: 0.94, variation: 0 },
];

export const GENERIC_PORT_CITY_LAYOUT: CityBuildingPlacement[] = [
  { id: "town", x: 510, y: 278, scale: 1, variation: 0 },
  { id: "mosque", x: 290, y: 330, scale: 0.96, variation: 1 },
  { id: "market", x: 655, y: 435, scale: 1, variation: 1 },
  { id: "workshop", x: 505, y: 540, scale: 1, variation: 1 },
  { id: "warehouse", x: 325, y: 525, scale: 0.98, variation: 0 },
  { id: "home", x: 665, y: 628, scale: 1, variation: 0 },
  { id: "farm", x: 300, y: 675, scale: 0.94, variation: 1 },
  { id: "docks", x: 465, y: 690, scale: 0.94, variation: 0 },
];

export function getCityLayout(townName: string): CityBuildingPlacement[] {
  return townName === "Dhaka" ? DHAKA_CITY_LAYOUT : GENERIC_PORT_CITY_LAYOUT;
}

export function getCityBuilding(id: CityBuildingId): CityBuildingDefinition {
  const building = CITY_BUILDINGS.find((candidate) => candidate.id === id);
  if (!building) throw new Error(`Unknown city building: ${id}`);
  return building;
}
