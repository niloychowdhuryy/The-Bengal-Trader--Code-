// Sets the current economy beside the frozen gold-era record, in the same currency and from
// the same start, and checks it against the balance targets set before this work began.
import type { Baseline, StrategyDay } from "./baseline";
import { round } from "./metrics";

const COINS_PER_GOLD = 50;

type Loose = Record<string, any>;

function table(headers: string[], rows: (string | number | null)[][]): string {
  const line = (cells: (string | number | null)[]) => `| ${cells.map((cell) => cell ?? "–").join(" | ")} |`;
  return [line(headers), line(headers.map(() => "---")), ...rows.map(line)].join("\n");
}

function whole(value: number): string {
  return Math.round(value).toLocaleString("en-GB");
}

function dayOf(baseline: Baseline, id: string, day: number): StrategyDay {
  return baseline.strategies.find((entry) => entry.id === id)!.days.find((entry) => entry.day === day)!;
}

function oldDayOf(old: Loose, id: string, day: number): Loose {
  return old.strategies.find((entry: Loose) => entry.id === id).days.find((entry: Loose) => entry.day === day);
}

interface Target {
  label: string;
  target: string;
  measured: string;
  met: boolean;
}

function within(value: number, low: number, high: number): boolean {
  return value >= low && value <= high;
}

export function checkTargets(current: Baseline): Target[] {
  const mixed = (day: number) => dayOf(current, "mixed-active", day).netWorth.median;
  const strongest = Math.max(...current.strategies.map((entry) => entry.days.at(-1)!.netWorth.median));
  const last = current.strategies.map((entry) => entry.days.at(-1)!);
  const halfways = current.recovery.map((entry) => entry.daysToHalfway);
  const patello = current.strategies.find((entry) => entry.id === "mixed-active")!.firstDay.patello;
  const rivalShares = current.strategies
    .filter((entry) => !["two-port-start", "two-port-best", "warehouse", "passive"].includes(entry.id))
    .map((entry) => entry.topRouteProfitShare);
  const prices = last.map((day) => day.priceIndex);
  const extremes = last.map((day) => (day.stallsNearEmpty + day.stallsNearFull) / 120);
  return [
    { label: "Mixed net worth, day 30", target: "15,000–30,000", measured: whole(mixed(30)), met: within(mixed(30), 15_000, 30_000) },
    { label: "Mixed net worth, day 90", target: "50,000–120,000", measured: whole(mixed(90)), met: within(mixed(90), 50_000, 120_000) },
    { label: "Mixed net worth, day 200", target: "150,000–450,000", measured: whole(mixed(200)), met: within(mixed(200), 150_000, 450_000) },
    { label: "Strongest strategy against mixed", target: "at most 2×", measured: `${round(strongest / mixed(200), 2)}×`, met: strongest / mixed(200) <= 2 },
    { label: "Passive ends behind active play", target: "always", measured: `${whole(dayOf(current, "passive", 200).netWorth.median)} against ${whole(dayOf(current, "manual", 200).netWorth.median)}`, met: dayOf(current, "passive", 200).netWorth.median < dayOf(current, "manual", 200).netWorth.median },
    { label: "Average price index", target: "0.90–1.15", measured: `${Math.min(...prices)}–${Math.max(...prices)}`, met: prices.every((value) => within(value, 0.9, 1.15)) },
    { label: "Stalls near empty or full", target: "under 15%", measured: `${round(Math.max(...extremes) * 100, 1)}% at most`, met: extremes.every((value) => value < 0.15) },
    { label: "Days for a stall to recover halfway", target: "5–12", measured: `${Math.min(...halfways)}–${Math.max(...halfways)}`, met: halfways.every((value) => within(value, 5, 12)) },
    { label: "Best repeated route against a top-tenth route", target: "at most 3×", measured: `${current.sustainedRoutes.dominance}×`, met: current.sustainedRoutes.dominance <= 3 },
    { label: "Top route's share of profit, for players who choose routes", target: "under 25%", measured: `${Math.round(Math.max(...rivalShares) * 100)}% at most`, met: rivalShares.every((value) => value < 0.25) },
    { label: "First Patello for a mixed player", target: "day 50–100", measured: patello === null ? "never" : `day ${patello}`, met: patello !== null && within(patello, 50, 100) },
    { label: "Same-port loops that profit", target: "none", measured: String(current.exploits.samePortLoop.stallsExposed), met: current.exploits.samePortLoop.stallsExposed === 0 },
    { label: "Closed round trips that profit", target: "none", measured: `${current.exploits.closedLoops.profitableCycles} of ${current.exploits.closedLoops.cycles}`, met: current.exploits.closedLoops.profitableCycles === 0 },
  ];
}

/**
 * `sameStart` began with the old starting amount, so before and after are like for like.
 * `current` began as a real new game, and is what the targets apply to.
 */
export function renderComparison(old: Loose, sameStart: Baseline, current: Baseline): string {
  const targets = checkTargets(current);
  const rows = sameStart.strategies.flatMap((strategy) =>
    [30, 90, 200].map((day) => {
      const before = oldDayOf(old, strategy.id, day);
      const after = dayOf(sameStart, strategy.id, day);
      return [
        strategy.label,
        day,
        whole(before.netWorth.median * COINS_PER_GOLD),
        whole(after.netWorth.median),
        whole(before.netWorthPerVoyage * COINS_PER_GOLD),
        whole(after.netWorthPerVoyage),
        before.voyages,
        after.voyages,
      ];
    }),
  );
  const oldLoop = old.exploits.samePortLoop;
  const newLoop = sameStart.exploits.samePortLoop;
  const oldNpcLost = old.npcWorld.merchants.reduce((total: number, entry: Loose) => total + entry.estimatedIncomeLostToCap, 0);
  const newNpcLost = sameStart.npcWorld.merchants.reduce((total, entry) => total + entry.estimatedIncomeLostToCap, 0);

  return `## Results after Economy Plan Step 3

Generated by \`npm run sim:freeze\` from save version ${current.saveVersion} rules. Everything in this section is in Coins. The gold-era amounts are multiplied by 50 for comparison.

### Targets

Set before this work began. Net worth includes the starter ship and cargo, worth ${whole(current.newGameNetWorth)} on day 0.

${table(
  ["Check", "Target", "Measured", "Met"],
  targets.map((target) => [target.label, target.target, target.measured, target.met ? "Yes" : "**No**"]),
)}

### Before and after

Median of ${sameStart.strategies[0].seeds} seeds, both from the old starting amount of 4,500 Coins.

${table(
  ["Strategy", "Day", "Net worth before", "After", "Net worth/voyage before", "After", "Voyages before", "After"],
  rows,
)}

### Market behaviour

${table(
  ["Measure", "Before", "After"],
  [
    ["Stalls where one hold can start a same-port money loop", oldLoop.stallsExposedWithinOneHold, newLoop.stallsExposedWithinOneHold],
    ["Stalls that can reach a same-port money loop at all", oldLoop.stallsExposed, newLoop.stallsExposed],
    ["Coins per 100 buy-and-sell-back loops, Dhaka opium, nearly empty stall", whole(oldLoop.atLowStock.dhakaOpium.at(-1).goldPer100Loops * COINS_PER_GOLD), whole(newLoop.atLowStock.dhakaOpium.at(-1)!.coinsPer100Loops)],
    ["Days for an emptied stall to recover halfway", old.recovery[0].daysToHalfway, sameStart.recovery[0].daysToHalfway],
    ["Days for an emptied stall to recover fully", old.recovery[0].daysToFull, sameStart.recovery[0].daysToFull],
    ["Best repeated route, Coins a day", whole(old.sustainedRoutes.best[0].goldPerDay * COINS_PER_GOLD), whole(sameStart.sustainedRoutes.best[0].coinsPerDay)],
    ["Median repeated route, Coins a day", whole(old.sustainedRoutes.medianPerDay * COINS_PER_GOLD), whole(sameStart.sustainedRoutes.medianPerDay)],
    ["Worst repeated route, Coins a day", whole(old.sustainedRoutes.worst.at(-1).goldPerDay * COINS_PER_GOLD), whole(sameStart.sustainedRoutes.worst.at(-1)?.coinsPerDay ?? 0)],
    ["Best repeated route against a top-tenth route", `${old.sustainedRoutes.dominance}×`, `${sameStart.sustainedRoutes.dominance}×`],
    ["Farm, days to repay", old.investments.farm.paybackDays, sameStart.investments.farm.paybackDays],
    ["Bora on a route, Coins a day", whole(old.investments.routeShips[1].goldPerDay * COINS_PER_GOLD), whole(sameStart.investments.routeShips[1].coinsPerDay)],
    ["Patello on a route, Coins a day", whole(old.investments.routeShips[2].goldPerDay * COINS_PER_GOLD), whole(sameStart.investments.routeShips[2].coinsPerDay)],
    ["NPC units moved a day", old.npcWorld.unitsMovedPerDay, sameStart.npcWorld.unitsMovedPerDay],
    ["NPC income lost to the purse limit (estimated)", whole(oldNpcLost * COINS_PER_GOLD), whole(newNpcLost)],
    ["NPCs with no trade in the last 50 days", old.npcWorld.stalledAtEnd, sameStart.npcWorld.stalledAtEnd],
  ],
)}

### Prices moved by play, on day 200

Stock depth tripled, so a stall's gap in units isn't comparable with the record. The price measures are.

${table(
  ["Strategy", "Stalls moved 5%+", "Largest move", "Price index", "Near empty", "Near full"],
  sameStart.strategies.map((strategy) => {
    const day = strategy.days.at(-1)!;
    return [strategy.label, day.stallsMoved, `${Math.round(day.largestPriceMove * 100)}%`, day.priceIndex, day.stallsNearEmpty, day.stallsNearFull];
  }),
)}

### One hold's effect on a stall

${table(
  ["Hold", "Stall", "Start price", "Last unit bought costs", "Last unit sold earns", "Lost buying and selling back"],
  sameStart.marketImpact.map((entry) => [
    entry.hold,
    entry.stall,
    entry.startPrice,
    `+${Math.round(entry.buyRise * 100)}%`,
    `-${Math.round(entry.sellFall * 100)}%`,
    `${Math.round(entry.roundTripLossShare * 100)}%`,
  ]),
)}

### Exploit checks

- **Same-port loops:** ${newLoop.stallsExposed} stalls can profit, at any stock, by buying and selling back.
- **Closed round trips:** ${sameStart.exploits.closedLoops.profitableCycles} of ${sameStart.exploits.closedLoops.cycles} carried one good to another port and straight back at a profit.
- **Closed time:** pausing a voyage for 8 hours changes nothing: ${sameStart.exploits.closedTimeChangesNothing ? "confirmed" : "**not confirmed**"}.
- **Checkpoints:** saving a voyage's progress more often changes nothing: ${sameStart.exploits.checkpointsChangeNothing ? "confirmed" : "**not confirmed**"}.
- **Replay:** every strategy run rebuilt exactly from its commands: ${sameStart.strategies.every((strategy) => strategy.allRunsReplayExactly) ? "yes" : "**no**"}.
`;
}
