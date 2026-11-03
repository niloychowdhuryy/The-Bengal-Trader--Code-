// Where a scripted player's Coins came from and went, noted from each command's effect.
// It only reads game state, so keeping it can't change what the game does.
import type { GameCommand } from "../game/commands";
import { FARM_CROP_COST, GOODS, type GameState } from "../game/model";

export interface Ledger {
  tradeRevenue: number;
  /** What the goods sold had cost, by the game's own average purchase price. */
  tradeCost: number;
  goodsBought: number;
  farmRevenue: number;
  farmUnitsSold: number;
  /** What was paid to collect crops, whether or not they've been sold yet. */
  cropCost: number;
  contractRewards: number;
  /** What the goods handed over to contracts had cost. */
  contractGoodsCost: number;
  contractsCompleted: number;
  repairs: number;
  upgrades: number;
  ships: number;
  farms: number;
  warehouses: number;
  routeDeposits: number;
  routeWithdrawn: number;
  /** Anything else that moved the purse, such as a residence, household or debt. */
  other: number;
  /** Farm rice still on board, kept apart so that its sale counts as farm income. */
  farmRiceHeld: number;
}

export function createLedger(): Ledger {
  return {
    tradeRevenue: 0,
    tradeCost: 0,
    goodsBought: 0,
    farmRevenue: 0,
    farmUnitsSold: 0,
    cropCost: 0,
    contractRewards: 0,
    contractGoodsCost: 0,
    contractsCompleted: 0,
    repairs: 0,
    upgrades: 0,
    ships: 0,
    farms: 0,
    warehouses: 0,
    routeDeposits: 0,
    routeWithdrawn: 0,
    other: 0,
    farmRiceHeld: 0,
  };
}

export function noteCommand(
  ledger: Ledger,
  before: GameState,
  after: GameState,
  command: GameCommand,
): void {
  let change = after.coins - before.coins;
  for (const mission of after.missions) {
    const earlier = before.missions.find((entry) => entry.id === mission.id);
    if (mission.status === "completed" && earlier?.status !== "completed") {
      ledger.contractRewards += mission.rewardCoins;
      ledger.contractsCompleted += 1;
      change -= mission.rewardCoins;
    }
  }

  switch (command.type) {
    case "sellGood": {
      const held = before.cargo[command.good];
      const fromFarm =
        command.good === "rice" ? command.quantity * (ledger.farmRiceHeld / held) : 0;
      const farmShare = fromFarm / command.quantity;
      ledger.farmRevenue += change * farmShare;
      ledger.farmUnitsSold += fromFarm;
      ledger.farmRiceHeld -= fromFarm;
      ledger.tradeRevenue += change * (1 - farmShare);
      // The average price blends bought rice with crop cost, so take the crop's part out.
      ledger.tradeCost +=
        command.quantity * before.averagePurchasePrice[command.good] - fromFarm * FARM_CROP_COST;
      break;
    }
    case "buyGood":
    case "tradeWithMerchant":
      ledger.goodsBought -= change;
      break;
    case "collectFarm":
      ledger.farmRiceHeld += after.cargo.rice - before.cargo.rice;
      ledger.cropCost -= change;
      break;
    case "arrive":
      for (const { id: good } of GOODS) {
        const handedOver = before.cargo[good] - after.cargo[good];
        if (handedOver > 0) ledger.contractGoodsCost += handedOver * before.averagePurchasePrice[good];
      }
      ledger.other += change;
      break;
    case "repairShip":
      ledger.repairs -= change;
      break;
    case "buyUpgrade":
      ledger.upgrades -= change;
      break;
    case "buyShip":
      ledger.ships -= change;
      break;
    case "buyFarm":
      ledger.farms -= change;
      break;
    case "buyWarehouse":
      ledger.warehouses -= change;
      break;
    case "configureRoute":
      ledger.routeDeposits -= change;
      break;
    case "cancelRoute":
      ledger.routeWithdrawn += change;
      break;
    default:
      ledger.other += change;
  }
}

/** Trading profit, which counts goods at what they cost, not at what was paid this period. */
export function tradeProfit(ledger: Ledger): number {
  return ledger.tradeRevenue - ledger.tradeCost;
}

export function contractProfit(ledger: Ledger): number {
  return ledger.contractRewards - ledger.contractGoodsCost;
}

/** The change in the purse that the ledger accounts for. */
export function purseChange(ledger: Ledger): number {
  return (
    ledger.tradeRevenue +
    ledger.farmRevenue +
    ledger.contractRewards +
    ledger.routeWithdrawn +
    ledger.other -
    ledger.goodsBought -
    ledger.cropCost -
    ledger.repairs -
    ledger.upgrades -
    ledger.ships -
    ledger.farms -
    ledger.warehouses -
    ledger.routeDeposits
  );
}
