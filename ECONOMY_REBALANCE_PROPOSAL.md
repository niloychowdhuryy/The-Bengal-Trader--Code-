# Economy rebalance: investigation and proposal

**Status:** direction approved by the owner on 3 November 2026 (see section 8). Stages 1 to 3, the benchmarks, farm costs and repeating contracts, are approved and committed. Results are in [ECONOMY_BENCHMARKS.md](./ECONOMY_BENCHMARKS.md). Investigated on 3 November 2026, from commit `213dc62`, save version 25.

## Summary

- The headline gap of 352,160 against 92,770 Coins is misleading. The manual figure mostly reflects a weak scripted player: one that also considers the return trip earns **274,985** under the same rules.
- Farms are still the real outlier. They have no running cost, barely move the market and scale with the number owned. A player building them in every port reached **735,335** by day 200.
- The other systems are too weak rather than too strong. Warehouses barely pay, bigger ships and hold upgrades lose money or break even, and contracts run out by about day 90.
- Trading income doesn't grow with wealth. Starting with 25× the Coins earned no more over 200 days, so money has little use once a hold is affordable.
- A trial package brings every strategy within reach of the others: the strongest is about 2× mixed play, down from 5.8×. It doesn't fix warehouses, ship investment or the very rich early game.

## How this was measured

- The real rules ran with scripted players sending real commands, with all 26 merchants trading in the same markets.
- 18 strategies ran on 5 seeds, to days 30, 90, 200 and 400. Results are medians.
- Trial rules ran only in a temporary copy of the code, since removed. **The game, save format and the committed harness are unchanged.**

**Limits of this evidence:**
- Bots aren't people. They show what a rule allows, not what feels fun.
- Seeds vary only merchant decisions and how a bot misjudges prices, because the game has little randomness of its own.
- "Skilled manual" is a simple rule, not the best possible play, so a good player may beat it.
- Attention is estimated from commands sent, not from time spent thinking.
- Trial rules are simplified. The crop cost is charged at collection rather than as a timed order, and the rankings still value every farm at a flat price.
- Merchant totals include the effect of whichever bot was playing.
- The bot limited to "15 farms" only trades around 6 ports, so it matches the 6-farm result. The farm circuit bot is the true upper test.
- Warehouse and ship redesigns weren't simulated.

## 1. Results under the current rules

Net worth starts at 21,600. Rank is out of 27.

| Strategy | Day 30 | Day 90 | Day 200 | Day 400 | Rank at 30 / 90 / 200 | Commands to day 200 |
|---|---:|---:|---:|---:|---|---:|
| Passive | 21,680 | 21,280 | 20,480 | 19,280 | 22 / 25 / 27 | 423 |
| Manual, basic bot | 26,250 | 46,370 | 92,770 | 165,230 | 19 / 11 / 5 | 885 |
| **Manual, skilled bot** | 59,945 | 134,325 | **274,985** | 520,595 | 5 / 1 / 1 | 1,511 |
| One route repeated, Hooghly–Tanda | 48,175 | 105,230 | 201,275 | 375,210 | 9 / 4 / 1 | 1,697 |
| Two-port loop, Hooghly–Satgaon | 35,930 | 56,020 | 92,055 | 159,620 | 14 / 10 / 5 | 2,076 |
| Automated, basic bot + Boras | 26,250 | 46,370 | 98,225 | 249,770 | 19 / 11 / 4 | 874 |
| Automated, basic bot + Patellos | 26,250 | 46,370 | 88,350 | 231,995 | 19 / 11 / 6 | 883 |
| Skilled bot + 2 Bora routes | 56,190 | 126,560 | 289,900 | 580,060 | 7 / 1 / 1 | 1,497 |
| 3 farms | 32,865 | 97,970 | 240,970 | 487,225 | 16 / 4 / 1 | 1,012 |
| 6 farms | 32,865 | 109,875 | **352,160** | 795,890 | 16 / 4 / 1 | 1,073 |
| **Farm circuit, up to 14 farms** | 32,400 | 157,290 | **735,335** | 1,795,580 | 15 / 1 / 1 | 1,418 |
| 2 farms on the best route | 50,780 | 148,205 | 317,065 | 620,425 | 8 / 1 / 1 | 2,096 |
| Contract-focused | 47,230 | 81,600 | 139,470 | 248,515 | 9 / 5 / 2 | 1,932 |
| Warehouses, Hooghly–Satgaon | 35,640 | 57,630 | 91,665 | 153,835 | 14 / 9 / 6 | 2,474 |
| Mixed | 41,860 | 71,295 | 126,105 | 406,320 | 12 / 5 / 3 | 873 |

**Income per day, averaged to day 200:**

| Strategy | Trading | Farms | Contracts | Routes | Invested by day 200 | Repairs by day 200 |
|---|---:|---:|---:|---:|---:|---:|
| Manual, basic bot | 381 | 0 | 0 | 0 | 7,500 | 1,200 |
| Manual, skilled bot | 1,279 | 0 | 0 | 0 | 0 | 2,400 |
| Skilled bot + 2 Bora routes | 1,193 | 0 | 0 | 249 | 65,000 | 2,400 |
| 6 farms | 332 | 1,313 | 0 | 0 | 60,000 | 1,200 |
| Farm circuit | 716 | 2,896 | 0 | 0 | 147,500 | 2,000 |
| Contract-focused | 540 | 0 | 90 | 0 | 0 | 3,200 |
| Mixed | 386 | 20 | 111 | 171 | 87,500 | 1,200 |

"Invested" includes Coins placed in routes. "Routes" counts the rise in route Coins only, not goods on board. Repairs are the only operating cost a player ever pays.

**Effect of merchants on net worth at day 200:**

| Strategy | With merchants | Without | Change |
|---|---:|---:|---:|
| 6 farms | 352,160 | 415,422 | −15% |
| Two-port loop, Hooghly–Satgaon | 92,055 | 119,060 | −23% |
| Farm circuit | 735,335 | 1,027,900 | −28% |
| Manual, basic bot | 92,770 | 152,982 | −39% |
| Manual, skilled bot | 274,985 | 484,750 | −43% |
| Contract-focused | 139,470 | 272,318 | −49% |
| Automated, basic bot + Boras | 98,225 | 212,818 | −54% |
| Mixed | 126,105 | 342,460 | −63% |

**Markets stayed healthy in every run:** 13–18 of 120 stalls moved 5% or more, the largest move was 20–28%, and no stall came close to empty or full. Merchants' total wealth at day 200 ranged from about 1.56 to 1.75 million, lowest against the strongest traders.

## 2. Investment returns

| Investment | Cost | Return | Payback |
|---|---:|---|---|
| Farm, first | 10,000 | About 60,000 of rice in 200 days | **29 days** at the 345 Coins a day measured for one farm |
| Bora on the best route | 17,500 + 15,000 working capital | 218 Coins a day | 80 days |
| Patello on the best route | 45,000 + 15,000 working capital | 374 Coins a day | 120 days |
| Bora on a typical route | Same as above | 30 Coins a day (median of 22 possible routes) | **About 590 days** |
| 3 hold upgrades, basic bot | 7,500 | +5,980 trading profit and +3,855 net worth by day 200 | About 250 days |
| 3 hold upgrades, skilled bot | 7,500 | **−10,565** net worth by day 200 | Never, in this test |
| Patello as your main ship | 45,000 | **−28,010** net worth by day 200 | Never, in this test |
| Bora as your main ship | 17,500 | −1,565 net worth by day 200 | About break-even |
| 2 warehouses | 15,000 | +4,110 trading profit in 200 days | **About 730 days** |
| Cannon or hull upgrade | 1,750+ | Matters in one scripted fight | No economic return yet |

## 3. Problems and causes

**Farms: too generous, and cut off from the market**
- A farm costs 10,000, pays for itself in 29 days and has no running cost.
- Its rice is created free, so it never pays a stall or competes for stock. That's why merchants cost farms the least.
- Prices barely respond. Income per unit fell only from 407 Coins with one farm to 364 with six, and rice stalls averaged about 345 with 14.
- Farms are the only asset that grows with wealth, so they compound while everything else stays flat.
- The real limit is hold space when collecting, not demand.

**Manual trading: stronger than it looked**
- The basic bot judges one leg at a time, so it takes profitable trips and then sails home empty. Counting the return leg nearly tripled income.
- Exploring beats repetition: the skilled bot earned 37% more than repeating the best route. Its top two legs still earned about 75% of its top-four profit, so a few routes matter most.
- The early game is too rich for a skilled player: 59,945 by day 30, against a 15,000–30,000 target. One Kasimbazar–Tanda load of silk earns 5,460 Coins in about a third of a day.

**Automated routes: a lottery, not an exploit**
- 18 of 40 sampled port pairs had no profitable good when the route was set up. Of the other 22, one lost money and the median earned 30 Coins a day. The Stage 1 benchmarks later measured every route from a shipyard: 8 of 42 had no profitable good, and of the other 34, five were down in Coins (not counting goods on board), with a median of 32 Coins a day.
- Routes buy at any price, because they have no profit check. They also trade one way and sail back empty.
- **More volume alone makes them worse.** Tripling units lowered the basic Patello bot from 88,350 to 75,285 at day 200.
- They do what they promise once running: they need almost no attention, and a skilled player gained about 15,000 at day 200 and 60,000 at day 400.

**Warehouses: no reason to own one**
- Prices only drift back toward normal, with no seasons or shortages, so storing goods can't catch a future high price.
- Moving goods one unit at a time also adds work. The warehouse bot sent about 400 more commands than the same loop without warehouses.

**Contracts: too scarce, and badly priced**
- Each of the 60 offers can be done once, worth 70,500 Coins at most. Bots earned 18,000–22,200, nearly all by day 90, and then the system goes quiet for good.
- Visit contracts pay 900 Coins for no goods. They caused a burst of 12,600–14,700 Coins by day 30, which is the main reason mixed play overshoots its day-30 target.
- Delivery contracts mostly lose money. They pay 1,200–1,500 Coins for goods costing about 2,200–2,300, so only 6 of 30 are worth doing.

**Ship and hold upgrades: progression that doesn't pay**
- One unit moves a price by about 2 points, so a 30-unit load pushes its buying price up 40%. Stalls limit income before holds do.
- A larger hold therefore mostly buys at worse prices. Nothing in the game currently rewards carrying a lot at once.

**Wealth has little use**
- Basic manual trading gained about 70,000 by day 200 whether it started with 5,000, 25,000 or 125,000 Coins. The richest start simply held 183,805 unused.
- There's no runaway compounding in trading, and a three-ship fleet limits routes too. Beyond farms, there's little to spend money on.

**Risk is nearly absent**
- No event can cost a player cargo, and a player's voyages cost nothing except occasional repairs. Merchants pay 30, 45 or 90 Coins a day to run their ships, while the player pays none.
- The only ways to lose money are poor trades, or a route on a bad pair.

**No exploit was found in these runs.** Earlier checks already show same-port and round-trip loops can't profit. The farm circuit is the closest thing to one, and it works by the normal rules.

## 4. The economy we're aiming for

| Strategy | Role | Intended feel |
|---|---|---|
| Manual trading | Highest skilled income from day one | Rewards attention and knowing the map |
| Automated routes | Steady side income that needs a good choice of route | Frees attention, and doesn't replace trading |
| Farms | Slow, dependable, capital-heavy | Poor early and strong in the long run |
| Contracts | A steady source of goals, reputation and moderate profit | Always something to pick up, never unlimited money |
| Warehouses | Make timing and scale possible | Earn only when used with judgement |
| Bigger ships | Pay off on bulk work | A real decision, not an automatic upgrade |

## 5. Proposed changes

### Tested in simulation

| System | Change | Now | Proposed |
|---|---|---|---:|
| Farms | Price | 10,000 | **20,000** |
| Farms | Cost per unit of crop | 0 | **150 Coins** |
| Routes | Buying | At any price | Only with at least **10% expected margin** |
| Routes | Direction | One way | **Trade on both legs** |
| Routes | Units per good, per stop | 1 (Patello 4) | **3 (Patello 12)** |
| Routes | Running cost per day | 0 | **Bora 30, River boat 45, Patello 90**, as merchants already pay |
| Contracts | Delivery rewards | Fixed 1,200–1,500 | **130% of the goods' reference value** |
| Contracts | Visit reward | 900 | **500** |
| Contracts | Availability | Once ever | **Available again 40 days after being taken** |
| Contracts | Reputation and standing | Every completion | **First completion only** |

Without that last rule, repeat contracts pushed reputation to about 240, close to the save limit of 255, and would have settled the Influence ranking by themselves.

### Result of the tested package

Median of 5 seeds:

| Strategy | Day 30 | Day 90 | Day 200 | Day 400 | Rank at 200 | Day 200 now |
|---|---:|---:|---:|---:|---:|---:|
| Passive | 21,680 | 21,280 | 20,480 | 19,280 | 27 | 20,480 |
| Manual, basic bot | 26,250 | 46,370 | 92,770 | 165,230 | 5 | 92,770 |
| Manual, skilled bot | 59,945 | 134,325 | 274,985 | 520,595 | 1 | 274,985 |
| Skilled bot + 2 Bora routes | 56,095 | 133,415 | **295,905** | 569,220 | 1 | 289,900 |
| Automated, basic bot + Boras | 26,250 | 46,370 | 100,845 | 249,775 | 4 | 98,225 |
| 3 farms | 31,525 | 53,475 | 142,390 | 324,270 | 2 | 240,970 |
| 6 farms | 31,525 | 53,475 | **145,795** | 437,325 | 2 | 352,160 |
| Farm circuit | 32,960 | 51,650 | **164,440** | 718,250 | 1 | 735,335 |
| 2 farms on the best route | 43,895 | 113,960 | 253,460 | 509,090 | 1 | 317,065 |
| Contract-focused | 38,410 | 73,890 | 134,315 | 245,900 | 3 | 139,470 |
| Mixed | **32,445** | 71,130 | **145,530** | 397,730 | 2 | 126,105 |
| Warehouses | 35,640 | 57,630 | 91,665 | 153,835 | 6 | 91,665 |

**What changes:**
- The strongest strategy goes from **5.8× mixed play** to **2.0×**.
- Farms now pay back in about **93 days**: roughly 364 Coins of rice less 150, or 214 a day. They start slower, then lead at day 400, which matches the intended long-term role.
- Mixed play meets its day-30 limit closely (32,445 against 30,000) and day 90, and just misses day 200 (145,530 against 150,000).
- Markets stay healthy, with 13–15 stalls moved, a largest move of 20–25%, none near empty or full and a price index of about 1.00.
- Merchant behaviour is unchanged, and their wealth stays within the normal range.

**Farm price growth, held in reserve:** making each additional farm cost 25% more than the base price lowered the farm circuit to 100,085 at day 200 and 261,890 at day 400. That looks too strong, partly because the rankings value farms at a flat price. I'd start without it. It's the first thing to reach for if flat-priced farms run away beyond day 400.

### Not simulated yet

These address real problems, but their numbers are only starting points:

| System | Direction |
|---|---|
| **Paid crop orders** | Replace the crop cost with a real order: pay up front and harvest after some in-game days, in several goods suited to the town. This is the plan's Stage 6, using in-game days so the game stays paused when closed. |
| **Warehouses** | Add multi-unit transfers, and let routes load from them. They also need prices that change over time, which means small seasonal or event-driven demand shifts. Without that, storage has no real purpose. |
| **Bulk contracts** | Offers needing 15–30 units with a large reward, which give the Patello and hold upgrades a reason to exist. |
| **Early game** | Look again at the first silk loads once the rest settles. This touches market data, so I wouldn't change it now. |

### Expected effects, risks and side effects

| Change | Expected effect | Risk |
|---|---|---|
| Farm cost | Stops one strategy winning alone | Existing cheap farms need a fair rule. I suggest they keep their purchase and pay the crop cost like any other |
| Crop cost | Adds a real operating cost and a capital need | A broke player can't collect their crop, which also affects the moneylender's "can raise money" check |
| Route profit check | Removes most of the lottery | A route can sit idle, so the Fleet screen must say why |
| Route running cost | Adds a real cost and a reason to choose well | A poor route can run out of Coins, so the player must be told and it must stop cleanly |
| Repeating contracts | Gives a lasting source of goals | Gross contract income rises to about 255,000, though most of it pays for goods. Reward must stay tied to reference value, not current stall prices, and be watched for repeat abuse |
| Lower visit reward | Calms the first 30 days | New players get a slower start |
| One-time reputation | Keeps the Influence ranking meaningful | Reputation stops rising from contracts once all are done |

**Save compatibility:** repeat contracts need a saved "already done" record, so this takes a new save version, with the usual backup and migration. The existing validator's reputation limit still holds with one-time reputation.

## 6. Suggested order

1. **Harness first.** Add the skilled, contract and farm circuit bots, plus the targets below. No rules change, and the baseline stays as a before-picture.
2. **Farms:** price and crop cost.
3. **Contracts:** rewards, repeats and one-time reputation.
4. **Routes:** profit check and both-way trading, then more units and running costs.
5. **Full checkpoint:** tests, type-check, build, browser and simulation.
6. **Warehouses and bulk contracts,** then ship and hold economics. These need decisions on price changes over time.
7. **Paid crop orders,** replacing the simple crop cost in Stage 6.

Each step is measured before the next starts, because fixes interact. Farms alone left mixed play unchanged, while contract repeats alone lifted it to about 185,000.

## 7. Simulation targets

Median of 5 seeds, with merchants present. These replace the current mixed-play and dominance targets if approved.

| Check | Target | Now | Tested package |
|---|---|---:|---:|
| Strongest strategy against mixed, day 200 | At most 2.2× | 5.8× | 2.0× |
| Strongest strategy against skilled manual, day 400 | At most 1.5× | 3.4× | 1.4× |
| Mixed, day 30 | 25,000–35,000 | 41,860 | 32,445 |
| Mixed, day 90 | 60,000–100,000 | 71,295 | 71,130 |
| Mixed, day 200 | 140,000–250,000 | 126,105 | 145,530 |
| Skilled manual, day 200 | 225,000–325,000 | 274,985 | 274,985 |
| Basic manual, day 200 | At least 80,000 | 92,770 | 92,770 |
| Passive | Behind every active strategy | Yes | Yes |
| Farm-focused, day 200 | 120,000–220,000 | 352,160 | 145,795 |
| Farm payback | 80–120 days | 29 | About 93 |
| A good route's payback | 80–130 days | 80–120 | To be measured in step 4 |
| Skilled + routes against skilled alone, day 200 | At least +5% | +5% | +8% |
| Contract income share, mixed, after goods costs | 15–30% | Not measured | To be measured in step 3 |
| Warehouse payback | Within 150 days | About 730 | Not fixed yet |
| Patello as main ship against River boat, day 400 | At least level | Behind | Not fixed yet |
| Reputation from contracts, day 400 | Under 150 | 83 | About 125 |
| Merchants' total wealth, compared with now | Within ±5% | – | Within 3% for mixed |
| Stalls near empty or full; price index | Under 15%; 0.90–1.15 | 0%; about 1.00 | 0%; about 1.00 |
| Same-port or round-trip profit | None | None | Re-check in each step |

## Corrections after Stage 2

The tested package in section 5 had no bot that combined skilled trading with farms. Stage 2 added one, and it changes this proposal's claims:

- **The strongest strategy isn't about 2× mixed play.** A skilled trader with 6 farms reaches 414,675 at day 200 and 880,860 at day 400, which is 3.35× mixed and 1.69× skilled alone under the Stage 2 costs.
- **Farms keep pulling away beyond day 400.** They don't compound, but they earn on top of trading with little trade-off, and idle Coins have nothing better to do.
- **Farm payback** is 103 days at a typical stall, or about 110 in play, not 93.

**After Stage 3:** contracts' share of mixed income is 37.4% at day 200 (target 15–30%), though a skilled trader who plans around contracts earns less than one who ignores them. The owner approved 130% and first-success-only reputation and standing, and the reward stays at 130% through Stage 4.

## 8. The owner's decisions

Made on 3 November 2026:

1. **Benchmarks:** the skilled bot is the engaged player, the basic bot the casual player, and mixed play stays a separate comparison.
2. **Farms:** provisionally 20,000 Coins and 150 per unit of crop, with no rising cost for additional farms. Approved in Stage 2. The strongest-strategy targets stay visible even while they fail, and whether farms need more is decided after routes.
3. **Contracts:** repeat after 40 days, with reputation only on the first successful completion.
4. **Route running costs:** routes pay the same running costs as merchants.
5. **Prices over time:** small seasonal or event-driven changes are approved, as a later, separate phase.
6. **Merchants:** their strength stays unchanged until the player economy's rebalance has been tested.
