// Sets the current economy beside the frozen gold-era record, in the same currency and from
// the same start, and checks it against the balance targets set before this work began.
import type { Baseline, StrategyDay } from "./baseline";
import { round } from "./metrics";

const COINS_PER_GOLD = 50;

// The merchants as they first stood in Step 4, before their cargo and investment were refined.
// Measured once on the same seeds, so the refinement can be compared with what it replaced.
const BEFORE_REFINEMENT = {"loads": {"river-boat": {"unitsPerVoyage": 3.101, "unitsPerLoadedVoyage": 5.555, "holdUse": 0.193, "loadedHoldUse": 0.352, "emptyShare": 0.442}, "bora": {"unitsPerVoyage": 3, "unitsPerLoadedVoyage": 4.416, "holdUse": 0.289, "loadedHoldUse": 0.39, "emptyShare": 0.32}, "patello": {"unitsPerVoyage": 3.184, "unitsPerLoadedVoyage": 3.993, "holdUse": 0.073, "loadedHoldUse": 0.089, "emptyShare": 0.203}}, "tiers": {"Great houses": {"medianGrowth": 1.11, "lowestGrowth": 0.92, "shareOfWealthAtEnd": 0.255}, "Established": {"medianGrowth": 1.73, "lowestGrowth": 1.05, "shareOfWealthAtEnd": 0.359}, "Modest": {"medianGrowth": 1.78, "lowestGrowth": 1.21, "shareOfWealthAtEnd": 0.254}, "Small": {"medianGrowth": 2.36, "lowestGrowth": 1.01, "shareOfWealthAtEnd": 0.132}}, "totalWorth": 1730195, "gini": 0.249, "topThree": 0.209, "medianGrowth": 1.7, "richestGrowth": 3.46, "unitsMovedPerDay": 40.64, "stallsMoved": 8, "largestMove": 0.171, "priceMovement": 0.008, "lowestStock": 44, "shipPurchases": 0, "holdUpgrades": 28.8, "manual": 102895, "mixed": 178145, "farms": 365195, "twoPort": 90570} as Loose;

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
    { label: "Median merchant's growth by day 200", target: "3–8×", measured: `${current.npcWorld.medianGrowth}×`, met: within(current.npcWorld.medianGrowth, 3, 8) },
    { label: "Merchants laid up on day 200", target: "under 20% (5 of 26)", measured: String(current.npcWorld.laidUpAtEnd), met: current.npcWorld.laidUpAtEnd < 5 },
    { label: "Merchants with no trade in the last 50 days", target: "none", measured: String(current.npcWorld.stalledAtEnd), met: current.npcWorld.stalledAtEnd === 0 },
    { label: "A strong player leads the merchants by day 200", target: "rank 1–3", measured: `rank ${dayOf(current, "mixed-active", 200).playerRank}`, met: dayOf(current, "mixed-active", 200).playerRank <= 3 },
    { label: "Vessel limit breaks, or goods from nowhere", target: "none", measured: String(current.npcWorld.restrictionBreaks + current.npcWorld.goodsUnaccounted + current.npcWorld.purseGrewWithoutSale), met: current.npcWorld.restrictionBreaks + current.npcWorld.goodsUnaccounted + current.npcWorld.purseGrewWithoutSale === 0 },
    { label: "Same-port loops that profit", target: "none", measured: String(current.exploits.samePortLoop.stallsExposed), met: current.exploits.samePortLoop.stallsExposed === 0 },
    { label: "Closed round trips that profit", target: "none", measured: `${current.exploits.closedLoops.profitableCycles} of ${current.exploits.closedLoops.cycles}`, met: current.exploits.closedLoops.profitableCycles === 0 },
  ];
}

/**
 * `sameStart` began with the old starting amount, so before and after are like for like.
 * `current` began as a real new game, and is what the targets apply to.
 */
export function renderComparison(old: Loose, stepThree: Loose, sameStart: Baseline, current: Baseline): string {
  const targets = checkTargets(current);
  const rows = sameStart.strategies.flatMap((strategy) =>
    [30, 90, 200].map((day) => {
      const before = oldDayOf(old, strategy.id, day);
      const previous = oldDayOf(stepThree, strategy.id, day);
      const after = dayOf(sameStart, strategy.id, day);
      return [
        strategy.label,
        day,
        whole(before.netWorth.median * COINS_PER_GOLD),
        whole(previous.netWorth.median),
        whole(after.netWorth.median),
        whole(after.netWorthPerVoyage),
        after.voyages,
        after.playerRank,
      ];
    }),
  );
  const world = current.npcWorld;
  const atDays = (list: { day: number; value: number }[], format: (value: number) => string = String) =>
    list.map((entry) => format(entry.value));
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  const oldLoop = old.exploits.samePortLoop;
  const newLoop = sameStart.exploits.samePortLoop;

  return `## Current results, after Economy Plan Step 4

Generated by \`npm run sim:freeze\` from save version ${current.saveVersion} rules. Everything in this section is in Coins. The gold-era amounts are multiplied by 50 for comparison.

### Targets

Set before this work began. Net worth includes the starter ship and cargo, worth ${whole(current.newGameNetWorth)} on day 0.

${table(
  ["Check", "Target", "Measured", "Met"],
  targets.map((target) => [target.label, target.target, target.measured, target.met ? "Yes" : "**No**"]),
)}

### Before and after

Median of ${sameStart.strategies[0].seeds} seeds, all from the old starting amount of 4,500 Coins. "Gold era" is the frozen record, "Step 3" had four small merchants, and "Now" has all 26. Rank is the player's place among 27 merchants by net worth.

${table(
  ["Strategy", "Day", "Net worth, gold era", "Step 3", "Now", "Net worth/voyage now", "Voyages now", "Rank now"],
  rows,
)}

### The merchants

${world.seeds} seeds, with no player, one day at a time.

${table(
  ["Measure", "Day 30", "Day 90", "Day 200"],
  [
    ["Total merchant wealth", ...atDays(world.totalWorth, whole)],
    ["Wealth inequality (Gini: 0 is equal, 1 is one owner)", ...atDays(world.gini)],
    ["Richest three's share", ...atDays(world.topThreeShare, percent)],
    ["Average price index", ...atDays(world.priceIndex)],
    ["Stalls moved 5% or more, of 120", ...atDays(world.stallsMoved)],
    ["Largest move at any stall", ...atDays(world.largestPriceMove, percent)],
    ["Stalls near empty", ...atDays(world.stallsNearEmpty)],
    ["Stalls near full", ...atDays(world.stallsNearFull)],
  ],
)}

Over 200 days: ${whole(world.journeysCompleted)} journeys completed, ${world.unitsMovedPerDay} units bought or sold a day, ${world.stalledAtEnd} merchants stalled and ${world.laidUpAtEnd} laid up. The median merchant grew ${world.medianGrowth}×, and the fastest ${world.richestGrowth}×. ${world.shrunkBelowHalf} merchants per world fell below half their starting worth.

**Checks across all seeds:** ${world.restrictionBreaks} vessel or route breaks, ${world.goodsUnaccounted} goods unaccounted for, and ${world.purseGrewWithoutSale} purses that grew without a sale.

### Cargo and investment, before and after refinement

"Before" is Step 4's first version, on the same seeds.

${table(
  ["Ship", "Units per voyage, before", "After", "Units per loaded voyage, before", "After", "Hold use on loaded voyages, before", "After", "Empty voyages, before", "After"],
  world.loads.map((load) => {
    const old = BEFORE_REFINEMENT.loads[load.vessel];
    return [
      load.vessel,
      old.unitsPerVoyage,
      load.unitsPerVoyage,
      old.unitsPerLoadedVoyage,
      load.unitsPerLoadedVoyage,
      percent(old.loadedHoldUse),
      percent(load.loadedHoldUse),
      percent(old.emptyShare),
      percent(load.emptyShare),
    ];
  }),
)}

${table(
  ["Measure on day 200", "Before", "After"],
  [
    ["Ship purchases per world", BEFORE_REFINEMENT.shipPurchases, world.shipPurchasesPerWorld],
    ["Hold upgrades per world", BEFORE_REFINEMENT.holdUpgrades, world.holdUpgradesPerWorld],
    ["Total merchant wealth", whole(BEFORE_REFINEMENT.totalWorth), whole(world.totalWorth.at(-1)!.value)],
    ["Median merchant's growth", `${BEFORE_REFINEMENT.medianGrowth}×`, `${world.medianGrowth}×`],
    ["Fastest merchant's growth", `${BEFORE_REFINEMENT.richestGrowth}×`, `${world.richestGrowth}×`],
    ["Wealth inequality (Gini)", BEFORE_REFINEMENT.gini, world.gini.at(-1)!.value],
    ["Richest three's share", percent(BEFORE_REFINEMENT.topThree), percent(world.topThreeShare.at(-1)!.value)],
    ["Units bought or sold a day", BEFORE_REFINEMENT.unitsMovedPerDay, world.unitsMovedPerDay],
    ["Stalls moved 5% or more, of 120", BEFORE_REFINEMENT.stallsMoved, world.stallsMoved.at(-1)!.value],
    ["Largest move at any stall", percent(BEFORE_REFINEMENT.largestMove), percent(world.largestPriceMove.at(-1)!.value)],
    ["Lowest stock any stall reached, any seed", BEFORE_REFINEMENT.lowestStock, world.lowestStock],
    ["Manual trading net worth", whole(BEFORE_REFINEMENT.manual), whole(dayOf(current, "manual", 200).netWorth.median)],
    ["Mixed net worth", whole(BEFORE_REFINEMENT.mixed), whole(dayOf(current, "mixed-active", 200).netWorth.median)],
    ["Two-port loop net worth", whole(BEFORE_REFINEMENT.twoPort), whole(dayOf(current, "two-port-start", 200).netWorth.median)],
    ["Farm player net worth", whole(BEFORE_REFINEMENT.farms), whole(dayOf(current, "farming", 200).netWorth.median)],
  ],
)}

**Do smaller merchants stay viable?**

${table(
  ["Starting tier", "Merchants", "Median growth, before", "After", "Lowest growth, before", "After", "Share of all wealth, before", "After"],
  world.tiers.map((tier) => {
    const old = BEFORE_REFINEMENT.tiers[tier.tier];
    return [
      tier.tier,
      tier.merchants,
      `${old.medianGrowth}×`,
      `${tier.medianGrowth}×`,
      `${old.lowestGrowth}×`,
      `${tier.lowestGrowth}×`,
      percent(old.shareOfWealthAtEnd),
      percent(tier.shareOfWealthAtEnd),
    ];
  }),
)}

Ship purchases in the first seed: ${world.shipPurchasesFirstWorld.length ? world.shipPurchasesFirstWorld.join("; ") : "none"}.

### Do personalities behave differently?

${table(
  ["Group", "Merchants", "Voyages each", "Units sold each", "Average trip, days", "Ports visited", "Profit per unit", "Growth"],
  [...world.behaviourByTemperament, ...world.behaviourByStrategy].map((group) => [
    group.group,
    group.merchants,
    group.tripsEach,
    group.unitsEach,
    group.averageTripDays,
    group.portsEach,
    whole(group.profitPerUnit),
    `${group.growth}×`,
  ]),
)}

### Every merchant, first seed

${table(
  ["Merchant", "Temperament", "Strategy", "Ship on day 200", "Start", "Day 30", "Day 90", "Day 200", "Voyages", "Units sold", "Ports"],
  [...world.first.merchants]
    .sort((a, b) => b.worthAt[200] - a.worthAt[200])
    .map((merchant) => [
      merchant.name,
      merchant.temperament,
      merchant.strategy,
      merchant.vessel,
      whole(merchant.startWorth),
      whole(merchant.worthAt[30]),
      whole(merchant.worthAt[90]),
      whole(merchant.worthAt[200]),
      merchant.trips,
      merchant.unitsSold,
      merchant.portsVisited,
    ]),
)}

### What rivals cost a player

The same scripted play and the same starting world, with and without merchants.

${table(
  ["Strategy", "Net worth on day 200 with merchants", "Without", "Change"],
  current.competition.map((entry) => [
    entry.strategy,
    whole(entry.withMerchants),
    whole(entry.withoutMerchants),
    percent(entry.change),
  ]),
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
    ["NPCs with no trade in the last 50 days, of 4 then and 26 now", old.npcWorld.stalledAtEnd, sameStart.npcWorld.stalledAtEnd],
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
