// Ships: what they cost, carry and take to run, and how they fare in a fight.
import type { TownId, UpgradeDefinition, VesselClass, VesselClassId } from "../model";

export const VESSEL_CLASSES: Record<VesselClassId, VesselClass> = {
  "river-boat": {
    id: "river-boat",
    name: "River boat",
    summary: "A steady all-rounder that can reach every port.",
    price: 25_000,
    baseHold: 12,
    holdPerUpgrade: 6,
    baseHull: 8,
    hullPerUpgrade: 3,
    repairCostPerHull: 100,
    travelFactor: 1,
    draft: 1.4,
    routeUnitsPerGood: 3,
    barredPorts: [],
  },
  bora: {
    id: "bora",
    name: "Bora",
    summary: "A light, quick boat with a small hold. Cheap to buy and repair.",
    price: 17_500,
    baseHold: 8,
    holdPerUpgrade: 3,
    baseHull: 6,
    hullPerUpgrade: 3,
    repairCostPerHull: 100,
    travelFactor: 0.8,
    draft: 1.2,
    routeUnitsPerGood: 3,
    barredPorts: [],
  },
  patello: {
    id: "patello",
    name: "Patello",
    summary: "A strong, slow bulk carrier. Too large for the narrowest channels.",
    price: 45_000,
    baseHold: 30,
    holdPerUpgrade: 6,
    baseHull: 14,
    hullPerUpgrade: 3,
    repairCostPerHull: 150,
    travelFactor: 1.25,
    draft: 1.5,
    routeUnitsPerGood: 12,
    barredPorts: ["sylhet", "balasore"],
  },
};
export const VESSEL_CLASS_IDS: VesselClassId[] = ["river-boat", "bora", "patello"];
export const ADDITIONAL_SHIP_PRICE = VESSEL_CLASSES["river-boat"].price;
export const MAX_PLAYER_SHIPS = 3;
export const SHIPYARD_PORTS: TownId[] = ["dhaka", "chittagong", "hooghly"];

// Crew and port dues for each day at sea, paid when leaving.
export const DAILY_RUNNING_COST: Record<VesselClassId, number> = {
  bora: 30,
  "river-boat": 45,
  patello: 90,
};

export const UPGRADES: UpgradeDefinition[] = [
  {
    id: "cannon",
    name: "Stronger bow cannon",
    detail: "Fire first and protect your cargo.",
    effect: "+1 attack",
    baseCost: 1_750,
    maxLevel: 3,
  },
  {
    id: "hull",
    name: "Reinforced hull",
    detail: "Take less damage in a close fight.",
    effect: "+1 defence",
    baseCost: 1_750,
    maxLevel: 2,
  },
  {
    id: "hold",
    name: "Roomier cargo hold",
    detail: "Bring more goods home.",
    effect: "+6 cargo space",
    baseCost: 1_250,
    maxLevel: 3,
  },
];

export const SHIP_BASE_ATTACK = 2;
export const SHIP_BASE_DEFENCE = 1;
/** The rival ship in an encounter. */
export const ENCOUNTER_ENEMY_HULL = 3;
export const ENCOUNTER_ENEMY_ATTACK = 3;
