import { describe, expect, it } from "vitest";
import { applyCommand } from "./commands";
import { getPlayerNetWorth } from "./leaderboard";
import {
  FARM_CROP_COST,
  FARM_PRICE,
  GOODS,
  advanceFarmProduction,
  buyFarm,
  collectFarmOutput,
  createNewGame,
  getRecoveryOptions,
  getRepaymentRisk,
  getRescueTerms,
  isStranded,
  sellGood,
  syncSelectedShip,
  takeRescueLoan,
  type GameState,
  type GoodId,
} from "./model";
import { migrateLegacySave, validateSave } from "./save-format";

const NO_GOODS = Object.fromEntries(GOODS.map((good) => [good.id, 0])) as Record<GoodId, number>;

/** An empty ship in Dhaka, with a farm there holding a crop, and no visit contracts left. */
function farmer(coins: number, crop = 10, shipHull = 8): GameState {
  const owned = buyFarm({ ...createNewGame("Maya", 8), coins: FARM_PRICE, highestCoins: 500_000 }).state;
  return syncSelectedShip({
    ...owned,
    coins,
    shipHull,
    cargo: { ...NO_GOODS },
    averagePurchasePrice: { ...NO_GOODS },
    farmOutput: { ...owned.farmOutput, dhaka: crop },
    missions: owned.missions.map((mission) =>
      mission.type === "visit" ? { ...mission, status: "completed" as const } : mission,
    ),
  });
}

describe("the approved farm costs", () => {
  it("are 20,000 Coins to buy and 150 Coins per unit of crop", () => {
    expect(FARM_PRICE).toBe(20_000);
    expect(FARM_CROP_COST).toBe(150);
  });

  it("charge every farm the same purchase price", () => {
    const first = buyFarm({ ...createNewGame("Maya"), coins: 100_000, highestCoins: 100_000 }).state;
    expect(first.coins).toBe(80_000);
    const second = buyFarm({ ...first, currentTown: "patna", selectedTown: "patna" }).state;
    expect(second.coins).toBe(60_000);
    expect(second.ownedFarms).toHaveLength(2);
  });

  it("charge for the crop once, when it's collected, and not while it grows", () => {
    const start = farmer(5_000, 0);
    const grown = advanceFarmProduction(start, 3);
    expect(grown.farmOutput.dhaka).toBe(3);
    expect(grown.coins).toBe(5_000);

    const { state, collected } = collectFarmOutput(grown);
    expect(collected).toBe(3);
    expect(state.coins).toBe(5_000 - 3 * 150);
    expect(state.cargo.rice).toBe(3);
    expect(state.farmOutput.dhaka).toBe(0);
    expect(state.fleet[0].cargo.rice).toBe(3);
    expect(collectFarmOutput(state).error).toBe("empty");
    expect(state.coins).toBe(4_550);
  });

  it("only charge for what fits in the hold", () => {
    const full = { ...farmer(5_000, 20), cargo: { ...NO_GOODS, salt: 8 }, averagePurchasePrice: { ...NO_GOODS, salt: 500 } };
    const { state, collected } = collectFarmOutput(full);
    expect(collected).toBe(4);
    expect(state.coins).toBe(5_000 - 4 * 150);
    expect(state.farmOutput.dhaka).toBe(16);
  });

  it("collect what a short purse can pay for, and leave the rest on the farm", () => {
    const { state, collected } = collectFarmOutput(farmer(400));
    expect(collected).toBe(2);
    expect(state.coins).toBe(100);
    expect(state.farmOutput.dhaka).toBe(8);
  });

  it("refuse a collection the purse can't start, and change nothing", () => {
    const poor = farmer(149);
    const result = collectFarmOutput(poor);
    expect(result.error).toBe("coins");
    expect(result.state).toBe(poor);
    const command = applyCommand(poor, { type: "collectFarm" }, 1_000);
    expect(command).toMatchObject({ status: "rejected", error: "coins" });
  });

  it("make the crop cost the rice's purchase price, blended with rice already held", () => {
    const fresh = collectFarmOutput(farmer(5_000, 2)).state;
    expect(fresh.averagePurchasePrice.rice).toBe(150);
    const mixed = collectFarmOutput({
      ...farmer(5_000, 2),
      cargo: { ...NO_GOODS, rice: 2 },
      averagePurchasePrice: { ...NO_GOODS, rice: 450 },
    }).state;
    expect(mixed.averagePurchasePrice.rice).toBe(300);
  });

  it("can't be turned into money by collecting and selling at a loss-free price for nothing", () => {
    const { state } = collectFarmOutput(farmer(5_000, 5));
    const sold = sellGood(state, "rice", 5).state;
    // What came in is the market's price, less what the crop already cost.
    expect(sold.coins).toBeLessThan(5_000 + 5 * 460);
    expect(sold.coins).toBeGreaterThan(state.coins);
  });

  it("value a farm at 70% of its price, and a crop on the farm as goods", () => {
    const worth = getPlayerNetWorth(farmer(0, 0));
    expect(worth).toBe(25_000 * 0.6 + 20_000 * 0.7);
    expect(getPlayerNetWorth(farmer(0, 2))).toBe(worth + 2 * 400 * 0.8);
  });

  it("are unaffected by a debt, because crops keep a merchant trading", () => {
    const owing = { ...farmer(1_000), debtOwed: 500, rescuesTaken: 1 };
    expect(collectFarmOutput(owing).error).toBeUndefined();
  });
});

describe("the moneylender, now that crops cost money", () => {
  it("still counts a farm as a way to raise money if the purse can pay for a crop", () => {
    expect(getRecoveryOptions(farmer(FARM_CROP_COST, 5, 3))).toEqual(["farm"]);
    expect(isStranded(farmer(FARM_CROP_COST, 5, 3))).toBe(false);
  });

  it("helps a player who owns a farm but can't afford to collect from it", () => {
    const poor = farmer(FARM_CROP_COST - 1, 5, 3);
    expect(getRecoveryOptions(poor)).not.toContain("farm");
    expect(isStranded(poor)).toBe(true);
    expect(getRescueTerms(poor)).not.toBeNull();
  });

  it("helps a player at 0 hull with a full farm and too little for a repair or a crop", () => {
    const stuck = farmer(99, 20, 0);
    expect(isStranded(stuck)).toBe(true);
    const { state, error } = takeRescueLoan(stuck);
    expect(error).toBeUndefined();
    expect(state.shipHull).toBe(2);
    // The advance leaves enough to collect, and the crop can then be sold.
    const collected = collectFarmOutput(state);
    expect(collected.error).toBeUndefined();
    expect(collected.state.cargo.rice).toBe(6);
    expect(isStranded(collected.state)).toBe(false);
  });

  it("doesn't count a farm the player could only reach by sailing, at 0 hull", () => {
    const stuck = { ...farmer(120, 20, 0), currentTown: "patna" as const, selectedTown: "patna" as const };
    expect(getRecoveryOptions(stuck)).not.toContain("farm");
  });

  it("warns before a repayment leaves too little to collect a crop", () => {
    const owing = { ...farmer(1_000, 5, 3), debtOwed: 1_500, rescuesTaken: 1 };
    expect(getRepaymentRisk(owing)).toMatchObject({ coinsLeft: 0, debtLeft: 500, mustBorrowAgain: true });
  });
});

describe("older saves", () => {
  it("keep their farms and crops, and restart under the new prices", () => {
    const owned = buyFarm({ ...createNewGame("Maya", 8), coins: FARM_PRICE + 5_000, highestCoins: FARM_PRICE + 5_000 }).state;
    const old = { ...owned, farmOutput: { ...owned.farmOutput, dhaka: 7 }, version: 25 };
    const migrated = validateSave(migrateLegacySave(old));
    expect(migrated.version).toBe(29);
    expect(migrated.ownedFarms).toEqual(["dhaka"]);
    expect(migrated.farmOutput.dhaka).toBe(7);
    expect(migrated.coins).toBe(5_000);
    const room = 12 - GOODS.reduce((total, good) => total + migrated.cargo[good.id], 0);
    expect(collectFarmOutput(migrated).state.coins).toBe(5_000 - Math.min(7, room) * 150);
  });
});
