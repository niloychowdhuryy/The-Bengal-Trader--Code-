// A scripted game that uses every kind of command, so later stages can replay the same
// history under changed rules. It ends mid-voyage with money held in every form, and that
// final state is also the v20 test save.
import type { CommandType, RecordedCommand } from "../game/commands";
import { createNewGame, type GameState, type GoodId, type TownId } from "../game/model";
import { arrive, createSim, depart, sail, send, type Sim } from "./driver";
import { routeRules } from "./strategies";

export const RECORDED_GAME_COINS = 200_000;

// The recording is frozen at v20. Commands added since are listed here so that a new one
// must be looked at, and are tested where they're introduced. Rescues are covered by rescue.test.ts.
export const ALL_COMMAND_TYPES: Record<Exclude<CommandType, "takeRescueLoan" | "repayDebt">, true> = {
  selectDestination: true,
  startVoyage: true,
  changeVoyageSpeed: true,
  resumeVoyage: true,
  arrive: true,
  resolveEncounter: true,
  buyGood: true,
  sellGood: true,
  buyUpgrade: true,
  repairShip: true,
  buyShip: true,
  selectShip: true,
  orderShipReturn: true,
  configureRoute: true,
  setRouteStatus: true,
  cancelRoute: true,
  tradeWithMerchant: true,
  buyWarehouse: true,
  storeGood: true,
  retrieveGood: true,
  buyResidence: true,
  marry: true,
  buyFarm: true,
  collectFarm: true,
  acceptMission: true,
};

/** Every amount of money in a state, for comparing a replay step by step. */
export interface MoneyStep {
  seq: number;
  coins: number;
  highestCoins: number;
  routeCapital: number;
  npcPurses: number;
  cargoCostBasis: number;
  warehouseCostBasis: number;
  contractRewards: number;
  contractProfitProgress: number;
  /** Everything that isn't money, so a later stage can show it stayed the same. */
  sailingDay: number;
  reputation: number;
  cargoUnits: number;
}

function sum(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

export function readMoney(state: GameState, seq: number): MoneyStep {
  const goods = Object.keys(state.cargo) as GoodId[];
  return {
    seq,
    coins: state.coins,
    highestCoins: state.highestCoins,
    routeCapital: sum(state.fleet.map((ship) => ship.automatedRoute?.capital ?? 0)),
    npcPurses: sum(state.npcMerchants.map((merchant) => merchant.budget)),
    cargoCostBasis: sum(
      state.fleet.flatMap((ship) => goods.map((good) => ship.averagePurchasePrice[good] * ship.cargo[good])),
    ),
    warehouseCostBasis: sum(
      Object.entries(state.warehouseStock).flatMap(([port, stock]) =>
        goods.map(
          (good) =>
            stock[good] *
            state.warehouseAveragePurchasePrice[port as keyof typeof state.warehouseStock][good],
        ),
      ),
    ),
    contractRewards: sum(state.missions.map((mission) => mission.rewardCoins)),
    contractProfitProgress: sum(
      state.missions.flatMap((mission) => (mission.type === "profitable_trade" ? [mission.progress] : [])),
    ),
    sailingDay: state.sailingDay,
    reputation: state.reputation,
    cargoUnits: sum(goods.map((good) => state.cargo[good])),
  };
}

function checked(label: string, ok: boolean): void {
  if (!ok) throw new Error(`The recorded game went wrong at: ${label}`);
}

function sailChecked(sim: Sim, port: TownId): void {
  if (sim.state.shipHull <= 2) send(sim, { type: "repairShip" });
  checked(`sailing to ${port}`, sail(sim, port));
}

function buildBase(): GameState {
  const fresh = createNewGame("Recorded");
  // NPCs sell everything they carry on arrival, so a merchant holding goods at the same
  // port as the player only happens in a set-up like this one.
  return {
    ...fresh,
    coins: RECORDED_GAME_COINS,
    highestCoins: RECORDED_GAME_COINS,
    npcMerchants: fresh.npcMerchants.map((merchant) =>
      merchant.id === "abdul-rahman"
        ? {
            ...merchant,
            cargo: { ...merchant.cargo, rice: 2 },
            cargoCost: { ...merchant.cargoCost, rice: 400 },
          }
        : merchant,
    ),
  };
}

/** Plays the recorded game. Any step that doesn't work as scripted stops it with an error. */
export function playRecordedGame(): Sim {
  const sim = createSim(buildBase());

  // Dhaka: trading, property, household and contracts.
  send(sim, { type: "tradeWithMerchant", merchantId: "abdul-rahman", good: "rice" });
  send(sim, { type: "buyGood", good: "muslin", quantity: 4 });
  send(sim, { type: "sellGood", good: "rice", quantity: 1 });
  send(sim, { type: "buyUpgrade", upgrade: "hold" });
  send(sim, { type: "buyUpgrade", upgrade: "cannon" });
  send(sim, { type: "buyUpgrade", upgrade: "hull" });
  send(sim, { type: "buyWarehouse" });
  send(sim, { type: "storeGood", good: "muslin" });
  send(sim, { type: "storeGood", good: "muslin" });
  send(sim, { type: "retrieveGood", good: "muslin" });
  send(sim, { type: "buyFarm" });
  send(sim, { type: "buyResidence" });
  send(sim, { type: "marry" });
  send(sim, { type: "acceptMission", missionId: "dhaka:visit" });

  // A voyage with a speed change and a long pause, as if the game was closed part way.
  checked("leaving Dhaka", depart(sim, "hooghly"));
  send(sim, { type: "changeVoyageSpeed", speed: 2 });
  sim.at += 30_000;
  const pausedAt = sim.at;
  sim.at += 6 * 60 * 60 * 1000;
  send(sim, { type: "resumeVoyage", pausedAt });
  send(sim, { type: "changeVoyageSpeed", speed: 1 });
  arrive(sim);

  // Hooghly: the fleet. The Bora takes a route to Balasore, where a Patello can't follow.
  send(sim, { type: "sellGood", good: "muslin", quantity: sim.state.cargo.muslin });
  send(sim, { type: "buyShip", vesselClass: "bora" });
  send(sim, { type: "buyShip", vesselClass: "patello" });
  const bora = sim.state.fleet[1].id;
  const patello = sim.state.fleet[2].id;
  // Routes can only name ports the captain has already seen.
  sailChecked(sim, "balasore");
  sailChecked(sim, "hooghly");
  send(sim, {
    type: "configureRoute",
    shipId: bora,
    destination: "balasore",
    // Any good that pays, because a route only sails when the journey is worth making.
    rules: routeRules(sim.state, "hooghly", "balasore"),
    initialCapital: 7_500,
  });

  // Chittagong: the introductory encounter, then repairs.
  sailChecked(sim, "chittagong");
  send(sim, { type: "repairShip" });
  sailChecked(sim, "hooghly");

  // Short hops until the Bora is docked at Balasore, then call it back with an order.
  let guard = 0;
  const boraAtBalasore = () => {
    const ship = sim.state.fleet.find((entry) => entry.id === bora)!;
    return ship.currentPort === "balasore" && ship.automatedRoute?.phase === "docked";
  };
  while (!boraAtBalasore()) {
    checked("waiting for the Bora", guard < 200);
    guard += 1;
    sailChecked(sim, sim.state.currentTown === "hooghly" ? "satgaon" : "hooghly");
  }
  send(sim, { type: "setRouteStatus", shipId: bora, status: "paused" });
  send(sim, { type: "setRouteStatus", shipId: bora, status: "running" });
  send(sim, { type: "cancelRoute", shipId: bora });

  // Back at Hooghly, move to the Patello. The starter ship takes a route of its own.
  if (sim.state.currentTown !== "hooghly") sailChecked(sim, "hooghly");
  const starter = sim.state.fleet[0].id;
  send(sim, { type: "selectShip", shipId: patello });
  send(sim, { type: "orderShipReturn", shipId: bora });
  send(sim, {
    type: "configureRoute",
    shipId: starter,
    destination: "satgaon",
    rules: [{ good: "sugar", buyAtOrigin: true, sellAtDestination: true }],
    initialCapital: 10_000,
  });

  // Goods for a contract, and cargo with a cost basis.
  send(sim, { type: "buyGood", good: "salt", quantity: 6 });
  sailChecked(sim, "dhaka");
  send(sim, { type: "collectFarm" });
  send(sim, { type: "sellGood", good: "rice", quantity: sim.state.cargo.rice });
  send(sim, { type: "acceptMission", missionId: "dhaka:purchase-delivery" });
  const delivery = sim.state.missions.find((mission) => mission.id === "dhaka:purchase-delivery")!;
  send(sim, { type: "buyGood", good: delivery.good!, quantity: delivery.quantity });

  // A profit contract part-way done: opium bought cheaply at Hooghly, sold at Sonargaon.
  sailChecked(sim, "sonargaon");
  send(sim, { type: "acceptMission", missionId: "sonargaon:profitable-trade" });
  sailChecked(sim, "hooghly");
  send(sim, { type: "buyGood", good: "opium", quantity: 1 });
  sailChecked(sim, "sonargaon");
  send(sim, { type: "sellGood", good: "opium", quantity: 1 });
  send(sim, { type: "sellGood", good: "salt", quantity: 2 });
  send(sim, { type: "buyGood", good: "sugar", quantity: 3 });

  // Stop partway through a voyage, so the test save has one under way.
  checked("starting the final voyage", depart(sim, "dhaka"));
  // Far enough to cross a day, so the automated ship and NPCs are under way too.
  sim.at += 40_000;
  send(sim, { type: "changeVoyageSpeed", speed: 2 });
  return sim;
}

export function commandTypesUsed(commands: readonly RecordedCommand[]): Set<CommandType> {
  return new Set(commands.map((entry) => entry.command.type));
}
