// Gathers every measurement into one record that contains no dates or machine details,
// so the same rules always produce the same record and later stages can compare against it.
import { VESSEL_CLASS_IDS, createNewGame } from "../game/model";
import {
  demonstrateSamePortLoop,
  findSamePortLoops,
  measureBreakInvariance,
  measureContracts,
  measureFarmPayback,
  measureLoopAtLowStock,
  measureNpcWorld,
  measureRecovery,
  measureRouteShip,
  measureSustainedRoutes,
  summariseFirstTrips,
} from "./experiments";
import { estimateNetWorth, fromTop, median, round } from "./metrics";
import {
  SIM_DAYS,
  SIM_SEEDS,
  STRATEGIES,
  replayMatches,
  runStrategy,
  type DaySnapshot,
  type RouteShare,
  type StrategyDefinition,
} from "./runner";

export interface Spread {
  min: number;
  median: number;
  max: number;
}

function spread(values: number[]): Spread {
  return { min: Math.min(...values), median: round(median(values)), max: Math.max(...values) };
}

export interface StrategyDay {
  day: number;
  gold: Spread;
  netWorth: Spread;
  goldPerDay: number;
  netWorthPerVoyage: number;
  netWorthPerRealMinute: number;
  voyages: number;
  realMinutes: number;
  reputation: number;
  standing: number;
  portsVisited: number;
  milestones: number;
  contractsDone: number;
  fleet: number;
  priceIndex: number;
  meanStockGap: number;
  stallsNearEmpty: number;
  stallsNearFull: number;
  stallsAtStart: number;
  npcTotalWorth: number;
}

export interface StrategySummary {
  id: string;
  label: string;
  seeds: number;
  days: StrategyDay[];
  firstDay: Record<string, number | null>;
  topRoutes: RouteShare[];
  topRouteProfitShare: number;
  farmUnitsCollected: number;
  refusedCommands: number;
  commands: number;
  allRunsReplayExactly: boolean;
}

const FIRST_DAY_EVENTS = [
  "upgrade",
  "extraShip",
  "patello",
  "automatedRoute",
  "warehouse",
  "farm",
  "river_explorer",
  "trusted_trader",
  "prosperous_merchant",
] as const;

function summariseStrategy(
  definition: StrategyDefinition,
  seeds: readonly number[],
  days: readonly number[],
): StrategySummary {
  const runs = seeds.map((seed) => {
    const run = runStrategy(definition, { seed, days });
    return { ...run, replays: replayMatches(run.sim) };
  });
  const middle = (pick: (snapshot: DaySnapshot) => number, index: number) =>
    round(median(runs.map((run) => pick(run.result.snapshots[index]))));
  const first = runs[0].result;
  const worthAtStart = estimateNetWorth(runs[0].sim.base);

  return {
    id: definition.id,
    label: definition.label,
    seeds: seeds.length,
    days: days.map((day, index) => {
      const gold = spread(runs.map((run) => run.result.snapshots[index].gold));
      const netWorth = spread(runs.map((run) => run.result.snapshots[index].netWorth));
      const sailingDay = middle((snapshot) => snapshot.sailingDay, index);
      const voyages = middle((snapshot) => snapshot.voyages, index);
      const realMinutes = middle((snapshot) => snapshot.realMinutes, index);
      const earned = netWorth.median - worthAtStart;
      return {
        day,
        gold,
        netWorth,
        goldPerDay: round((gold.median - runs[0].sim.base.gold) / sailingDay),
        netWorthPerVoyage: round(earned / Math.max(1, voyages)),
        netWorthPerRealMinute: round(earned / Math.max(0.01, realMinutes)),
        voyages,
        realMinutes,
        reputation: middle((snapshot) => snapshot.reputation, index),
        standing: middle((snapshot) => snapshot.standing, index),
        portsVisited: middle((snapshot) => snapshot.portsVisited, index),
        milestones: middle((snapshot) => snapshot.milestones, index),
        contractsDone: middle((snapshot) => snapshot.contractsDone, index),
        fleet: middle((snapshot) => snapshot.fleet, index),
        priceIndex: middle((snapshot) => snapshot.market.priceIndex, index),
        meanStockGap: middle((snapshot) => snapshot.market.meanStockGap, index),
        stallsNearEmpty: middle((snapshot) => snapshot.market.stallsNearEmpty, index),
        stallsNearFull: middle((snapshot) => snapshot.market.stallsNearFull, index),
        stallsAtStart: middle((snapshot) => snapshot.market.stallsAtStart, index),
        npcTotalWorth: middle((snapshot) => snapshot.npcTotalWorth, index),
      };
    }),
    firstDay: Object.fromEntries(
      FIRST_DAY_EVENTS.map((event) => {
        const seen = runs
          .map((run) => run.result.firstDay[event])
          .filter((day): day is number => day !== undefined);
        // Only a typical day if most runs got there at all.
        return [event, seen.length > runs.length / 2 ? round(median(seen)) : null];
      }),
    ),
    topRoutes: first.topRoutes,
    topRouteProfitShare: round(median(runs.map((run) => run.result.topRouteProfitShare))),
    farmUnitsCollected: round(median(runs.map((run) => run.result.farmUnitsCollected))),
    refusedCommands: runs.reduce((total, run) => total + run.result.refused.length, 0),
    commands: round(median(runs.map((run) => run.result.commands))),
    allRunsReplayExactly: runs.every((run) => run.replays),
  };
}

export function measureStrategies(
  definitions: readonly StrategyDefinition[] = STRATEGIES,
  seeds: readonly number[] = SIM_SEEDS,
  days: readonly number[] = SIM_DAYS,
): StrategySummary[] {
  return definitions.map((definition) => summariseStrategy(definition, seeds, days));
}

export function buildBaseline() {
  const sustained = measureSustainedRoutes(90);
  const perDay = sustained.map((route) => route.goldPerDay);
  const topTenth = fromTop(perDay, 0.1);
  const loops = findSamePortLoops();
  return {
    saveVersion: createNewGame("Simulated").version,
    newGameNetWorth: estimateNetWorth(createNewGame("Simulated")),
    strategies: measureStrategies(),
    firstTrips: summariseFirstTrips(),
    sustainedRoutes: {
      days: 90,
      pairs: sustained.length,
      best: sustained.slice(0, 5),
      worst: sustained.slice(-3),
      topTenthPerDay: topTenth,
      medianPerDay: round(median(perDay)),
      dominance: topTenth > 0 ? round(sustained[0].goldPerDay / topTenth, 1) : 0,
      routesThatTire: sustained.filter((route) => route.lateVsEarly > 0 && route.lateVsEarly < 0.9).length,
    },
    recovery: measureRecovery(),
    investments: {
      farm: measureFarmPayback(),
      routeShips: VESSEL_CLASS_IDS.map((vessel) => measureRouteShip(vessel)),
    },
    contracts: measureContracts(),
    npcWorld: measureNpcWorld(),
    exploits: {
      samePortLoop: {
        stallsExposed: loops.length,
        stallsExposedWithinOneHold: loops.filter((stall) => stall.unitsToDrain <= 12).length,
        cheapest: loops.slice(0, 5),
        atLowStock: {
          dhakaSilk: measureLoopAtLowStock("dhaka", "silk"),
          dhakaOpium: measureLoopAtLowStock("dhaka", "opium"),
        },
        demonstration: demonstrateSamePortLoop(),
      },
      closedTimeChangesNothing: measureBreakInvariance(),
    },
  };
}

export type Baseline = ReturnType<typeof buildBaseline>;
