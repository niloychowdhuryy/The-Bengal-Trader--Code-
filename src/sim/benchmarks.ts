// The benchmarks for the economy rebalance: more kinds of player, watched for longer, with
// their income accounted for. They sit beside the baseline, which stays as the before-picture.
import { MARKET_PORTS, SHIPYARD_PORTS, VESSEL_CLASS_IDS, createNewGame, type GameState, type TownId } from "../game/model";
import { goodsAtReference } from "../game/npc";
import type { Baseline } from "./baseline";
import { createSim, sail, send } from "./driver";
import {
  findSamePortLoops,
  measureClosedLoops,
  measureContracts,
  measureFarmPayback,
  measureRouteShip,
} from "./experiments";
import { contractProfit, purseChange, tradeProfit, type Ledger } from "./ledger";
import { median, round } from "./metrics";
import { SIM_SEEDS, STRATEGIES, replayMatches, runStrategy, type DaySnapshot, type StrategyDefinition } from "./runner";
import {
  automated,
  contractFocused,
  farmCircuit,
  farmFocused,
  farmsOnRoute,
  manual,
  onMainShip,
  routeRules,
  skilledContractTrader,
  skilledManual,
  skilledWithContracts,
  skilledWithFarms,
  skilledWithRoutes,
  twoPort,
  visitRunner,
} from "./strategies";

export const BENCHMARK_DAYS = [30, 90, 200, 400] as const;
const WITHOUT_MERCHANTS_SEEDS = [1, 2] as const;
const ROUTE_TEST_CAPITAL = 15_000;
const ROUTE_TEST_DAYS = 200;

function player(id: string, label: string, strategy: StrategyDefinition["strategy"], noise = 0.15): StrategyDefinition {
  return { id, label, strategy, noise, speed: 1 };
}

// The skilled players judge exactly, so seeds only change what the merchants do around them.
export const BENCHMARKS: StrategyDefinition[] = [
  ...STRATEGIES,
  player("skilled", "Skilled manual", () => skilledManual(), 0),
  player("skilled-hold", "Skilled, 3 hold upgrades", () => skilledManual(3), 0),
  player("skilled-routes", "Skilled, 2 Bora routes", () => skilledWithRoutes(), 0),
  player("skilled-contracts", "Skilled, with contracts", () => skilledWithContracts(), 0),
  player("skilled-all-contracts", "Skilled, with profit-target contracts too", () => skilledWithContracts(true), 0),
  player("skilled-contract-trader", "Skilled, planning around contracts", () => skilledContractTrader, 0),
  player("visit-runner", "Visit contracts only", () => visitRunner),
  player("skilled-farms", "Skilled, up to 6 farms", () => skilledWithFarms(6), 0),
  player("skilled-patello", "Skilled, Patello as main ship", () => onMainShip("patello", skilledManual()), 0),
  player("manual-bora", "Basic, Bora as main ship", () => onMainShip("bora", manual)),
  player("manual-patello", "Basic, Patello as main ship", () => onMainShip("patello", manual)),
  player("automated-bora", "Basic, 2 Bora routes", () => automated(2, "bora")),
  player("repeat-best", "One route repeated, Hooghly–Tanda", () => twoPort("hooghly", "tanda")),
  player("farms-3", "3 farms", () => farmFocused(3)),
  player("farm-circuit", "Farm circuit", () => farmCircuit),
  player("farms-on-route", "2 farms on the best route", () => farmsOnRoute("hooghly", "tanda")),
  player("contract-focused", "Contract-focused", () => contractFocused),
];

/** What routes have gained: their Coins and goods, less what was put in and taken out. */
function routeGain(snapshot: DaySnapshot): number {
  return snapshot.routeValue - snapshot.ledger.routeDeposits + snapshot.ledger.routeWithdrawn;
}

function invested(ledger: Ledger): number {
  return ledger.upgrades + ledger.ships + ledger.farms + ledger.warehouses + ledger.routeDeposits;
}

export interface BenchmarkDay {
  day: number;
  netWorth: { min: number; median: number; max: number };
  rank: number;
  influenceRank: number;
  reputation: number;
  voyages: number;
  commands: number;
  realMinutes: number;
  tradeProfit: number;
  farmRevenue: number;
  cropCost: number;
  contractRewards: number;
  contractProfit: number;
  routeGain: number;
  routeRunningCost: number;
  invested: number;
  repairs: number;
  fleet: number;
  farms: number;
  npcTotalWorth: number;
  richestRival: number;
  priceIndex: number;
  largestPriceMove: number;
  stallsMoved: number;
  stallsNearLimit: number;
}

export interface BenchmarkSummary {
  id: string;
  label: string;
  days: BenchmarkDay[];
  refusedCommands: number;
  allRunsReplayExactly: boolean;
  ledgerBalances: boolean;
}

function summarise(definition: StrategyDefinition, seeds: readonly number[], base: GameState): BenchmarkSummary {
  const runs = seeds.map((seed) => {
    const run = runStrategy(definition, { seed, days: BENCHMARK_DAYS, base });
    return { ...run, replays: replayMatches(run.sim) };
  });
  return {
    id: definition.id,
    label: definition.label,
    days: BENCHMARK_DAYS.map((day, index) => {
      const snapshots = runs.map((run) => run.result.snapshots[index]);
      const middle = (pick: (snapshot: DaySnapshot) => number, places = 0) =>
        round(median(snapshots.map(pick)), places);
      const worths = snapshots.map((snapshot) => snapshot.netWorth);
      return {
        day,
        netWorth: { min: Math.min(...worths), median: median(worths), max: Math.max(...worths) },
        rank: middle((snapshot) => snapshot.playerRank),
        influenceRank: middle((snapshot) => snapshot.influenceRank),
        reputation: middle((snapshot) => snapshot.reputation),
        voyages: middle((snapshot) => snapshot.voyages),
        commands: middle((snapshot) => snapshot.commands),
        realMinutes: middle((snapshot) => snapshot.realMinutes),
        tradeProfit: middle((snapshot) => tradeProfit(snapshot.ledger)),
        farmRevenue: middle((snapshot) => snapshot.ledger.farmRevenue),
        cropCost: middle((snapshot) => snapshot.ledger.cropCost),
        contractRewards: middle((snapshot) => snapshot.ledger.contractRewards),
        contractProfit: middle((snapshot) => contractProfit(snapshot.ledger)),
        routeGain: middle(routeGain),
        routeRunningCost: middle((snapshot) => snapshot.routeRunningCost),
        invested: middle((snapshot) => invested(snapshot.ledger)),
        repairs: middle((snapshot) => snapshot.ledger.repairs),
        fleet: middle((snapshot) => snapshot.fleet),
        farms: middle((snapshot) => snapshot.farms),
        npcTotalWorth: middle((snapshot) => snapshot.npcTotalWorth),
        richestRival: middle((snapshot) => snapshot.richestRival),
        priceIndex: middle((snapshot) => snapshot.market.priceIndex, 3),
        largestPriceMove: middle((snapshot) => snapshot.market.largestPriceMove, 2),
        stallsMoved: middle((snapshot) => snapshot.market.stallsMoved),
        stallsNearLimit: Math.max(
          ...snapshots.map((snapshot) => snapshot.market.stallsNearEmpty + snapshot.market.stallsNearFull),
        ),
      };
    }),
    refusedCommands: runs.reduce((total, run) => total + run.result.refused.length, 0),
    allRunsReplayExactly: runs.every((run) => run.replays),
    ledgerBalances: runs.every(
      (run) => Math.abs(purseChange(run.sim.ledger) - (run.sim.state.coins - run.sim.base.coins)) < 0.01,
    ),
  };
}

export interface RouteTest {
  origin: TownId;
  destination: TownId;
  /** Null when no good could be traded at a profit on the day the route was set up. */
  coinsPerDay: number | null;
}

/** One Bora on each route from a shipyard, while the player only keeps the days moving. */
export function measureRouteSpread(): RouteTest[] {
  return SHIPYARD_PORTS.flatMap((origin) =>
    MARKET_PORTS.filter((port) => port.id !== origin).map(({ id: destination }) => {
      const sim = createSim({ ...createNewGame("Simulated"), coins: 250_000, highestCoins: 250_000 });
      sail(sim, destination);
      if (sim.state.currentTown !== origin) sail(sim, origin);
      send(sim, { type: "buyShip", vesselClass: "bora" });
      const rules = routeRules(sim.state, origin, destination);
      if (rules.length === 0) return { origin, destination, coinsPerDay: null };
      const shipId = sim.state.fleet.at(-1)!.id;
      send(sim, { type: "configureRoute", shipId, destination, rules, initialCapital: ROUTE_TEST_CAPITAL });
      const startDay = sim.state.sailingDay;
      while (sim.state.sailingDay - startDay < ROUTE_TEST_DAYS) {
        if (sim.state.shipHull <= 2) send(sim, { type: "repairShip" });
        sail(sim, sim.state.currentTown === origin ? destination : origin);
      }
      const ship = sim.state.fleet.find((entry) => entry.id === shipId)!;
      const days = sim.state.sailingDay - startDay;
      return {
        origin,
        destination,
        coinsPerDay: round((ship.automatedRoute!.capital + goodsAtReference(ship.cargo) - ROUTE_TEST_CAPITAL) / days),
      };
    }),
  );
}

export interface BenchmarkTarget {
  label: string;
  target: string;
  measured: string;
  met: boolean;
}

function whole(value: number): string {
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function checkTargets(record: Omit<BenchmarkRecord, "targets">): BenchmarkTarget[] {
  const worth = (id: string, day: number) => dayOf(record.strategies, id, day).netWorth.median;
  const strongest = (day: number, against: string) => {
    const best = record.strategies
      .filter((entry) => entry.id !== against)
      .reduce((top, entry) => (worth(entry.id, day) > worth(top.id, day) ? entry : top));
    return { label: best.label, ratio: worth(best.id, day) / worth(against, day) };
  };
  const range = (label: string, id: string, day: number, low: number, high: number): BenchmarkTarget => ({
    label,
    target: `${whole(low)}–${whole(high)}`,
    measured: whole(worth(id, day)),
    met: worth(id, day) >= low && worth(id, day) <= high,
  });
  const allDays = record.strategies.flatMap((entry) => entry.days);
  const againstMixed = strongest(200, "mixed-active");
  const againstSkilled = strongest(400, "skilled");
  const passiveBehind = BENCHMARK_DAYS.every((day) =>
    record.strategies.every((entry) => entry.id === "passive" || worth(entry.id, day) > worth("passive", day)),
  );
  const mixed200 = dayOf(record.strategies, "mixed-active", 200);
  const income =
    mixed200.tradeProfit + mixed200.farmRevenue - mixed200.cropCost + mixed200.contractProfit + mixed200.routeGain;
  const contractShare = income > 0 ? mixed200.contractProfit / income : 0;
  const goodRoutePayback = record.routeShips
    .map((ship) => ship.paybackDays)
    .filter((days): days is number => days !== null);
  const reputation = Math.max(
    dayOf(record.strategies, "mixed-active", 400).reputation,
    dayOf(record.strategies, "contract-focused", 400).reputation,
  );
  const stallShare = Math.max(...allDays.map((day) => day.stallsNearLimit)) / 120;
  const indexes = allDays.map((day) => day.priceIndex);
  const merchantChange = mixed200.npcTotalWorth / record.approved.mixedNpcWorth - 1;
  const patello = worth("skilled-patello", 400) / worth("skilled", 400);
  const withRoutes = worth("skilled-routes", 200) / worth("skilled", 200) - 1;

  return [
    {
      label: "Strongest strategy against mixed, day 200",
      target: "at most 2.2×",
      measured: `${round(againstMixed.ratio)}× (${againstMixed.label})`,
      met: againstMixed.ratio <= 2.2,
    },
    {
      label: "Strongest strategy against skilled manual, day 400",
      target: "at most 1.5×",
      measured: `${round(againstSkilled.ratio)}× (${againstSkilled.label})`,
      met: againstSkilled.ratio <= 1.5,
    },
    range("Mixed, day 30", "mixed-active", 30, 25_000, 35_000),
    range("Mixed, day 90", "mixed-active", 90, 60_000, 100_000),
    range("Mixed, day 200", "mixed-active", 200, 140_000, 250_000),
    range("Skilled manual, day 200", "skilled", 200, 225_000, 325_000),
    {
      label: "Basic manual, day 200",
      target: "at least 80,000",
      measured: whole(worth("manual", 200)),
      met: worth("manual", 200) >= 80_000,
    },
    {
      label: "Passive ends behind every active strategy, every day measured",
      target: "always",
      measured: passiveBehind ? "yes" : "no",
      met: passiveBehind,
    },
    range("Farm-focused (6 farms), day 200", "farming", 200, 120_000, 220_000),
    {
      label: "Farm payback",
      target: "80–120 days",
      measured: `${record.farmPayback.paybackDays} days`,
      met: record.farmPayback.paybackDays >= 80 && record.farmPayback.paybackDays <= 120,
    },
    {
      label: "A good route's payback, by ship",
      target: "80–130 days",
      measured: record.routeShips.map((ship) => `${ship.vessel} ${ship.paybackDays ?? "never"}`).join(", "),
      met:
        goodRoutePayback.length === record.routeShips.length &&
        goodRoutePayback.every((days) => days >= 80 && days <= 130),
    },
    {
      label: "Skilled with routes against skilled alone, day 200",
      target: "at least +5%",
      measured: `${withRoutes >= 0 ? "+" : ""}${round(withRoutes * 100, 1)}%`,
      met: withRoutes >= 0.05,
    },
    {
      label: "Contracts' share of mixed income, after goods costs, day 200",
      target: "15–30%",
      measured: `${round(contractShare * 100, 1)}%`,
      met: contractShare >= 0.15 && contractShare <= 0.3,
    },
    {
      label: "Warehouse payback",
      target: "within 150 days",
      measured: record.warehousePaybackDays === null ? "never" : `${record.warehousePaybackDays} days`,
      met: record.warehousePaybackDays !== null && record.warehousePaybackDays <= 150,
    },
    {
      label: "Patello as a skilled player's main ship against a River boat, day 400",
      target: "at least level",
      measured: `${round(patello, 2)}×`,
      met: patello >= 1,
    },
    {
      label: "Reputation of contract players, day 400",
      target: "under 150",
      measured: String(reputation),
      met: reputation < 150,
    },
    {
      label: "Merchants' total wealth against the approved baseline, mixed play, day 200",
      target: "within ±5%",
      measured: `${merchantChange >= 0 ? "+" : ""}${round(merchantChange * 100, 1)}%`,
      met: Math.abs(merchantChange) <= 0.05,
    },
    {
      label: "Stalls near empty or full, worst case",
      target: "under 15%",
      measured: `${round(stallShare * 100, 1)}%`,
      met: stallShare < 0.15,
    },
    {
      label: "Price index, across all strategies and days",
      target: "0.90–1.15",
      measured: `${Math.min(...indexes)}–${Math.max(...indexes)}`,
      met: Math.min(...indexes) >= 0.9 && Math.max(...indexes) <= 1.15,
    },
    {
      label: "Same-port loops and closed round trips that profit",
      target: "none",
      measured: `${record.exploits.samePortStalls} and ${record.exploits.profitableCycles}`,
      met: record.exploits.samePortStalls === 0 && record.exploits.profitableCycles === 0,
    },
  ];
}

export function dayOf(strategies: BenchmarkSummary[], id: string, day: number): BenchmarkDay {
  return strategies.find((entry) => entry.id === id)!.days.find((entry) => entry.day === day)!;
}

export interface BenchmarkRecord {
  saveVersion: number;
  seeds: number;
  strategies: BenchmarkSummary[];
  withoutMerchants: { id: string; label: string; netWorth: number }[];
  farmPayback: ReturnType<typeof measureFarmPayback>;
  routeShips: ReturnType<typeof measureRouteShip>[];
  routeSpread: RouteTest[];
  contracts: ReturnType<typeof measureContracts>;
  warehousePaybackDays: number | null;
  exploits: { samePortStalls: number; profitableCycles: number };
  /** Strategies the approved baseline also measured, and whether they still match it. */
  approved: { saveVersion: number; compared: number; differences: string[]; mixedNpcWorth: number };
  targets: BenchmarkTarget[];
}

export function buildBenchmarks(approved: Baseline, seeds: readonly number[] = SIM_SEEDS): BenchmarkRecord {
  const base = createNewGame("Simulated");
  const strategies = BENCHMARKS.map((definition) => summarise(definition, seeds, base));

  const noMerchants = { ...base, npcMerchants: [], npcActivity: [] };
  const withoutMerchants = BENCHMARKS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    netWorth: median(
      WITHOUT_MERCHANTS_SEEDS.map(
        (seed) => runStrategy(definition, { seed, days: [200], base: noMerchants }).result.snapshots[0].netWorth,
      ),
    ),
  }));

  const differences: string[] = [];
  let compared = 0;
  for (const earlier of approved.strategies) {
    for (const day of earlier.days) {
      compared += 1;
      const now = dayOf(strategies, earlier.id, day.day);
      if (now.netWorth.median !== day.netWorth.median) {
        differences.push(`${earlier.id} day ${day.day}: ${day.netWorth.median} → ${now.netWorth.median}`);
      }
    }
  }

  const withStore = dayOf(strategies, "warehouse", 200).tradeProfit;
  const without = dayOf(strategies, "two-port-start", 200).tradeProfit;
  const extraPerDay = (withStore - without) / 200;
  const warehouseCost = strategies.find((entry) => entry.id === "warehouse")!.days.at(-1)!.invested;
  const closed = measureClosedLoops();

  const record = {
    saveVersion: base.version,
    seeds: seeds.length,
    strategies,
    withoutMerchants,
    farmPayback: measureFarmPayback(),
    routeShips: VESSEL_CLASS_IDS.map((vessel) => measureRouteShip(vessel)),
    routeSpread: measureRouteSpread(),
    contracts: measureContracts(),
    warehousePaybackDays: extraPerDay > 0 ? round(warehouseCost / extraPerDay, 0) : null,
    exploits: { samePortStalls: findSamePortLoops().length, profitableCycles: closed.profitableCycles },
    approved: {
      saveVersion: approved.saveVersion,
      compared,
      differences,
      mixedNpcWorth: approved.strategies
        .find((entry) => entry.id === "mixed-active")!
        .days.find((entry) => entry.day === 200)!.npcTotalWorth,
    },
  };
  return { ...record, targets: checkTargets(record) };
}

function table(headers: string[], rows: (string | number)[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function beforeAndAfter(record: BenchmarkRecord, before: BenchmarkRecord): string {
  return table(
    ["Strategy", "Day 30", "Day 90", "Day 200", "Day 400", "Wealth rank, day 400"],
    record.strategies.map((entry) => {
      const earlier = before.strategies.find((item) => item.id === entry.id);
      const pair = (now: number, then?: number) =>
        then === undefined ? `– → ${whole(now)}` : then === now ? `${whole(now)}, same` : `${whole(then)} → ${whole(now)}`;
      return [
        entry.label,
        ...entry.days.map((day, index) => pair(day.netWorth.median, earlier?.days[index].netWorth.median)),
        earlier ? `${earlier.days[3].rank} → ${entry.days[3].rank}` : String(entry.days[3].rank),
      ];
    }),
  );
}

export function renderBenchmarks(record: BenchmarkRecord, before: BenchmarkRecord): string {
  const met = record.targets.filter((target) => target.met).length;
  const routes = record.routeSpread;
  const earning = routes.map((route) => route.coinsPerDay).filter((days): days is number => days !== null);
  const merchantsEffect = (id: string, withThem: number) => {
    const alone = record.withoutMerchants.find((entry) => entry.id === id)!.netWorth;
    return alone > 0 ? `${round((withThem / alone - 1) * 100, 0)}%` : "–";
  };
  return `# Economy benchmarks (save version ${record.saveVersion})

Generated by \`npm run sim:freeze\`. Don't edit by hand. These are the kinds of player and the targets that [ECONOMY_REBALANCE_PROPOSAL.md](./ECONOMY_REBALANCE_PROPOSAL.md) is judged against. The record before any rebalance is frozen in \`economy-benchmark-v25.json\`.

Each strategy ran on ${record.seeds} seeds using only real commands, with all 26 merchants trading in the same markets. Figures are medians in Coins. Net worth starts at 21,600.

**Benchmarks:** the skilled bot is the engaged player, the basic manual bot the casual player, and mixed play a separate comparison.

## Targets

${met} of ${record.targets.length} met under the current rules.

${table(
    ["Check", "Target", "Measured", "Met"],
    record.targets.map((target) => [target.label, target.target, target.measured, target.met ? "Yes" : "**No**"]),
  )}

## Against the record before the rebalance (save version ${before.saveVersion})

Net worth, before → now.

${beforeAndAfter(record, before)}

## Net worth

${table(
    ["Strategy", "Day 30", "Day 90", "Day 200", "Day 400", "Lowest to highest, day 200", "Wealth rank at 30 / 90 / 200 / 400", "Influence rank, day 200"],
    record.strategies.map((entry) => {
      const day200 = entry.days[2];
      return [
        entry.label,
        ...entry.days.map((day) => whole(day.netWorth.median)),
        `${whole(day200.netWorth.min)}–${whole(day200.netWorth.max)}`,
        entry.days.map((day) => day.rank).join(" / "),
        day200.influenceRank,
      ];
    }),
  )}

## Income and attention, to day 200

Commands stand in for attention. Trading counts goods at what they cost. Contracts are shown after the cost of goods handed over, and routes count Coins and goods gained.

${table(
    ["Strategy", "Trading", "Farm sales", "Crop costs", "Contract rewards", "Contracts after goods", "Routes", "Route running costs, already taken from routes", "Invested", "Repairs", "Voyages", "Commands", "Merchants' effect on net worth"],
    record.strategies.map((entry) => {
      const day = entry.days[2];
      return [
        entry.label,
        whole(day.tradeProfit),
        whole(day.farmRevenue),
        whole(day.cropCost),
        whole(day.contractRewards),
        whole(day.contractProfit),
        whole(day.routeGain),
        whole(day.routeRunningCost),
        whole(day.invested),
        whole(day.repairs),
        day.voyages,
        day.commands,
        merchantsEffect(entry.id, day.netWorth.median),
      ];
    }),
  )}

"Merchants' effect" compares with the same player alone on seeds 1 and 2.

**Farms owned, median at each day:** ${record.strategies
    .filter((entry) => entry.days[3].farms > 0)
    .map((entry) => `${entry.label} ${entry.days.map((day) => day.farms).join(" / ")}`)
    .join("; ")}.

## Markets and merchants, day 200

${table(
    ["Strategy", "Stalls moved 5%+, of 120", "Largest move", "Near empty or full", "Price index", "All merchants' wealth", "Richest merchant"],
    record.strategies.map((entry) => {
      const day = entry.days[2];
      return [
        entry.label,
        day.stallsMoved,
        `${round(day.largestPriceMove * 100, 0)}%`,
        day.stallsNearLimit,
        day.priceIndex,
        whole(day.npcTotalWorth),
        whole(day.richestRival),
      ];
    }),
  )}

## Investments

- **Farm:** ${record.farmPayback.paybackDays} days to repay its price, at ${whole(record.farmPayback.coinsPerDay)} Coins a day after crop costs, selling at a typical stall.
- **Route ships on Hooghly–Tanda:** ${record.routeShips.map((ship) => `${ship.vessel} ${whole(ship.coinsPerDay)} Coins a day, ${ship.paybackDays ?? "never"} days`).join("; ")}.
- **A Bora on every route from a shipyard:** ${routes.length} routes. ${routes.length - earning.length} had nothing profitable to trade when set up. Of the rest, ${earning.filter((perDay) => perDay < 0).length} lost money, and the median earned ${whole(median(earning))} Coins a day, from ${whole(Math.min(...earning))} to ${whole(Math.max(...earning))}. Measured on one seed, counting route Coins and goods.
- **Contracts at a new game's prices, buying goods at the issuing port:** ${record.contracts
    .map((entry) => `${entry.type.replace("_", " ")}: ${entry.count} offers, average reward ${whole(entry.averageReward)}, goods ${whole(entry.averageGoodsCost)}, ${entry.worthDoing} pay more than the goods cost${entry.averageGoodsCost > 0 ? `, ${entry.beatsSelling} beat selling the goods at the destination` : ""}`)
    .join("; ")}.
- **Contracts' share of income, mixed play, after goods costs:** ${record.strategies
    .find((entry) => entry.id === "mixed-active")!
    .days.map((day) => {
      const income = day.tradeProfit + day.farmRevenue - day.cropCost + day.contractProfit + day.routeGain;
      return `day ${day.day}: ${income > 0 ? round((day.contractProfit / income) * 100, 1) : 0}%`;
    })
    .join(", ")}.
- **Two warehouses:** ${record.warehousePaybackDays === null ? "no extra profit" : `${record.warehousePaybackDays} days to repay, from the extra trading profit against the same loop without them`}.

## Against the baseline of save version ${record.approved.saveVersion}

${record.approved.differences.length === 0 ? `All ${record.approved.compared} measurements match it exactly.` : `${record.approved.differences.length} of ${record.approved.compared} measurements differ:\n\n${record.approved.differences.map((line) => `- ${line}`).join("\n")}`}

Every run replays exactly from its commands: ${record.strategies.every((entry) => entry.allRunsReplayExactly) ? "yes" : "**no**"}. Every run's income and spending add up to its change in Coins: ${record.strategies.every((entry) => entry.ledgerBalances) ? "yes" : "**no**"}. Commands refused: ${record.strategies.reduce((total, entry) => total + entry.refusedCommands, 0)}.

## Limits

- Bots show what the rules allow, not what feels fun. The skilled bot is a simple rule, so a good player may beat it.
- The skilled bots judge exactly, so their seeds only vary the merchants. No target covers a skilled player's early game.
- The farm circuit is an upper test, and most players wouldn't play that way. The "6 farms" bot buys only in ports it passes.
- Except where named, contract bots don't take profit-target contracts, so their contract income is a lower limit.
- Commands aren't time spent thinking.
`;
}
