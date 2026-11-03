import { describe, expect, it } from "vitest";
import { GOODS, type GoodId } from "./model";
import { validateSave } from "./save-format";
import fixture from "./__fixtures__/save-v20.json";

// The Coins migration can only be trusted if this save holds what it has to carry across.
const save = fixture as unknown as {
  version: number;
  gold: number;
  highestGold: number;
  voyage: unknown;
  fleet: {
    vesselClass: string;
    cargo: Record<GoodId, number>;
    averagePurchasePrice: Record<GoodId, number>;
    automatedRoute: { capital: number; phase: string } | null;
  }[];
  npcMerchants: { budget: number; phase: string; cargo: Record<GoodId, number>; cargoCost: Record<GoodId, number> }[];
  missions: { type: string; status: string; progress: number; purchasedQuantity: number; rewardGold: number }[];
  warehouseAveragePurchasePrice: Record<string, Record<GoodId, number>>;
  ownedWarehouses: string[];
  ownedFarms: string[];
  farmOutput: Record<string, number>;
  residenceTown: string | null;
  household: { spouse: unknown };
  completedMilestones: string[];
  reputation: number;
};

describe("v20 test save", () => {
  it("is a version 20 save that today's game can load", () => {
    expect(save.version).toBe(20);
    expect(() => validateSave(fixture, 1_800_100_000_000)).not.toThrow();
  });

  it("holds money in every form the migration has to convert", () => {
    expect(save.gold).toBeGreaterThan(0);
    expect(save.highestGold).toBeGreaterThan(save.gold);
    const carrying = save.fleet.filter((ship) =>
      GOODS.some((good) => ship.cargo[good.id] > 0 && ship.averagePurchasePrice[good.id] > 0),
    );
    expect(carrying.length).toBeGreaterThan(1);
    expect(
      Object.values(save.warehouseAveragePurchasePrice).some((port) =>
        Object.values(port).some((price) => price > 0),
      ),
    ).toBe(true);
    expect(save.fleet.some((ship) => (ship.automatedRoute?.capital ?? 0) > 0)).toBe(true);
    expect(save.npcMerchants.some((merchant) => merchant.budget > 0)).toBe(true);
    expect(
      save.npcMerchants.some((merchant) =>
        GOODS.some((good) => merchant.cargo[good.id] > 0 && merchant.cargoCost[good.id] > 0),
      ),
    ).toBe(true);
    expect(save.missions.every((mission) => mission.rewardGold > 0)).toBe(true);
    expect(save.missions.some((mission) => mission.type === "profitable_trade" && mission.progress > 0)).toBe(true);
    expect(save.missions.some((mission) => mission.status === "active" && mission.purchasedQuantity > 0)).toBe(true);
  });

  it("holds the other things the migration must leave alone", () => {
    expect(save.voyage).not.toBeNull();
    expect(save.fleet).toHaveLength(3);
    expect(new Set(save.fleet.map((ship) => ship.vesselClass)).size).toBe(3);
    expect(save.fleet.some((ship) => ship.automatedRoute?.phase === "traveling")).toBe(true);
    expect(save.npcMerchants.some((merchant) => merchant.phase === "traveling")).toBe(true);
    expect(save.ownedWarehouses.length).toBeGreaterThan(0);
    expect(save.ownedFarms.length).toBeGreaterThan(0);
    expect(save.farmOutput[save.ownedFarms[0]]).toBeGreaterThan(0);
    expect(save.residenceTown).not.toBeNull();
    expect(save.household.spouse).not.toBeNull();
    expect(save.completedMilestones.length).toBeGreaterThan(0);
    expect(save.missions.some((mission) => mission.status === "completed")).toBe(true);
    expect(save.reputation).toBeGreaterThan(0);
  });
});
