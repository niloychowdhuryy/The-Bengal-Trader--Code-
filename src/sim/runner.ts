// Runs a scripted player for a number of in-game days, measuring as it passes each one.
import { createNewGame, type GameState } from "../game/model";
import { goodsAtReference } from "../game/npc";
import type { SailingSpeed } from "../game/travel-time";
import { createSim, replaySim, type Sim } from "./driver";
import type { Ledger } from "./ledger";
import { estimateNetWorth, measureMarket, npcWorth, round, type MarketSnapshot } from "./metrics";
import {
  automated,
  farming,
  manual,
  mixed,
  passive,
  twoPort,
  warehouseRoute,
  type BotContext,
  type Strategy,
} from "./strategies";

export const SIM_DAYS = [30, 90, 200] as const;
export const SIM_SEEDS = [1, 2, 3, 4, 5] as const;

export interface StrategyDefinition {
  id: string;
  label: string;
  strategy: () => Strategy;
  /** How much the bot misjudges opportunities. With 0, every seed plays the same. */
  noise: number;
  speed: SailingSpeed;
}

export const STRATEGIES: StrategyDefinition[] = [
  { id: "passive", label: "Passive", strategy: () => passive, noise: 0, speed: 1 },
  {
    id: "two-port-start",
    label: "Two-port loop, Hooghly–Satgaon",
    strategy: () => twoPort("hooghly", "satgaon"),
    noise: 0,
    speed: 1,
  },
  {
    id: "two-port-best",
    label: "Two-port loop, Kasimbazar–Tanda",
    strategy: () => twoPort("kasimbazar", "tanda"),
    noise: 0,
    speed: 1,
  },
  { id: "manual", label: "Manual trading", strategy: () => manual, noise: 0.15, speed: 1 },
  { id: "automated", label: "Automated routes", strategy: () => automated(2), noise: 0.15, speed: 1 },
  {
    id: "warehouse",
    label: "Warehouses, Hooghly–Satgaon",
    strategy: () => warehouseRoute("hooghly", "satgaon"),
    noise: 0,
    speed: 1,
  },
  { id: "farming", label: "Farms", strategy: () => farming, noise: 0.15, speed: 1 },
  { id: "mixed-active", label: "Mixed, active at 4×", strategy: () => mixed, noise: 0.15, speed: 4 },
  { id: "mixed-casual", label: "Mixed, casual at 1×", strategy: () => mixed, noise: 0.4, speed: 1 },
];

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export interface DaySnapshot {
  day: number;
  sailingDay: number;
  coins: number;
  netWorth: number;
  reputation: number;
  standing: number;
  voyages: number;
  /** Time spent watching voyages. Decisions take extra time this can't measure. */
  realMinutes: number;
  portsVisited: number;
  milestones: number;
  contractsDone: number;
  fleet: number;
  market: MarketSnapshot;
  npcTotalWorth: number;
  /** The player's place among all the merchants by net worth. 1 is the richest. */
  playerRank: number;
  richestRival: number;
  /** The player's place among the merchants by reputation. 1 is the most influential. */
  influenceRank: number;
  /** Coins held by routes, plus their goods at the value net worth gives them. */
  routeValue: number;
  commands: number;
  farms: number;
  ledger: Ledger;
}

export interface RouteShare {
  route: string;
  voyageShare: number;
  profit: number;
}

export interface RunResult {
  strategy: string;
  seed: number;
  snapshots: DaySnapshot[];
  firstDay: Partial<Record<string, number>>;
  topRoutes: RouteShare[];
  /** Largest share of positive route profit earned on one route. */
  topRouteProfitShare: number;
  farmUnitsCollected: number;
  refused: string[];
  commands: number;
}

function snapshot(sim: Sim, day: number): DaySnapshot {
  const { state } = sim;
  return {
    day,
    sailingDay: round(state.sailingDay),
    coins: state.coins,
    netWorth: estimateNetWorth(state),
    reputation: state.reputation,
    standing: Object.values(state.localStanding).reduce((total, value) => total + value, 0),
    voyages: sim.voyages,
    realMinutes: round(sim.realMs / 60_000),
    portsVisited: state.visitedTowns.length,
    milestones: state.completedMilestones.length,
    contractsDone: sim.ledger.contractsCompleted,
    fleet: state.fleet.length,
    market: measureMarket(state),
    npcTotalWorth: state.npcMerchants.reduce((total, merchant) => total + npcWorth(merchant), 0),
    playerRank:
      1 + state.npcMerchants.filter((merchant) => npcWorth(merchant) > estimateNetWorth(state)).length,
    richestRival: Math.max(0, ...state.npcMerchants.map(npcWorth)),
    influenceRank:
      1 + state.npcMerchants.filter((merchant) => merchant.reputation > state.reputation).length,
    routeValue: state.fleet.reduce(
      (total, ship) =>
        ship.automatedRoute
          ? total + ship.automatedRoute.capital + goodsAtReference(ship.cargo)
          : total,
      0,
    ),
    commands: sim.log.length,
    farms: state.ownedFarms.length,
    ledger: { ...sim.ledger },
  };
}

function summariseRoutes(sim: Sim): Pick<RunResult, "topRoutes" | "topRouteProfitShare"> {
  const legs = [...sim.legs.entries()];
  const voyages = legs.reduce((total, [, leg]) => total + leg.voyages, 0) || 1;
  const positive = legs.reduce((total, [, leg]) => total + Math.max(0, leg.profit), 0) || 1;
  const byProfit = legs.sort((a, b) => b[1].profit - a[1].profit || a[0].localeCompare(b[0]));
  return {
    topRoutes: byProfit.slice(0, 3).map(([route, leg]) => ({
      route,
      voyageShare: round(leg.voyages / voyages),
      profit: Math.round(leg.profit),
    })),
    topRouteProfitShare: round(Math.max(0, byProfit[0]?.[1].profit ?? 0) / positive),
  };
}

export interface RunOptions {
  seed?: number;
  days?: readonly number[];
  noise?: number;
  speed?: SailingSpeed;
  base?: GameState;
}

export function runStrategy(
  definition: Pick<StrategyDefinition, "id" | "strategy" | "noise" | "speed">,
  { seed = 1, days = SIM_DAYS, base = createNewGame("Simulated") }: RunOptions = {},
): { result: RunResult; sim: Sim } {
  const sim = createSim({ ...base, worldSeed: seed }, definition.speed);
  const context: BotContext = { random: seededRandom(seed), noise: definition.noise, reserved: {} };
  const snapshots: DaySnapshot[] = [];
  const remaining = [...days];
  sim.onArrive = () => {
    while (remaining.length > 0 && sim.state.sailingDay >= remaining[0]) {
      snapshots.push(snapshot(sim, remaining.shift()!));
    }
  };
  const strategy = definition.strategy();
  while (remaining.length > 0) strategy(sim, context);

  return {
    sim,
    result: {
      strategy: definition.id,
      seed,
      snapshots,
      firstDay: sim.firstDay,
      ...summariseRoutes(sim),
      farmUnitsCollected: sim.farmUnitsCollected,
      refused: sim.refused,
      commands: sim.log.length,
    },
  };
}

/** Whether replaying the run's commands rebuilds exactly the same game. */
export function replayMatches(sim: Sim): boolean {
  const replayed = replaySim(sim);
  return replayed.status === "accepted" &&
    JSON.stringify(replayed.state) === JSON.stringify(sim.state);
}
