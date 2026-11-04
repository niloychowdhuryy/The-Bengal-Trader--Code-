# Feature A: distinct and responsive city prices

**Status:** investigation and design only, awaiting the owner's approval. E1 below is a candidate, not an approved design, and the harness check at the end recommends revising it. No game rule, price, save or screen has changed. Investigated on 4 November 2026 from commit `d3881d3`, save version 28. All candidates ran in temporary copies, since removed, and the committed records are untouched.

## Summary

- **The recommended design has three parts:** a new supply and demand profile for all 15 towns, slightly smaller price gaps from those profiles, and markets that recover about 40% more slowly.
- **What it achieves:** every good has at least 4 different prices across the map (some had 2), about 30 of 120 stalls sit visibly away from their starting price (13 today), and no single route dominates.
- **What it costs:** merchant wealth rises 8.7%, basic manual trading nearly doubles, the skilled bot's lead over it shrinks to 1.2×, and farms pull further ahead in the long run.
- **The main lesson:** wider gaps between towns make everyone richer, while slower recovery makes everyone poorer. The design uses each to offset the other.

## How markets work today

- A price is the good's base price × a supply and demand factor × a stock factor.
- **Supply and demand factor:** 1 + (demand − supply) × 0.15, with tiers of 1, 2 or 3 for each town and good.
- **Stock factor:** 90 ÷ (stock + 30). Usual stock is 48, 60 or 72, set by the supply tier.
- **Recovery:** each day a stall moves 6%, 8% or 12% of the way back to its usual stock, by tier, and at least 1, 2 or 3 units.
- **Selling:** pays 12% below the price at the stall's stock plus one.

**Problems found:**
- 9 of the 15 towns have no main produced good, and Hooghly has 6. (The roadmap first said 8, which was my miscount.)
- Any good a profile doesn't mention gets the default middle tier, so towns share identical prices. Opium and lac have only 2 prices across 15 ports.
- Hooghly's high supply is cancelled by its high demand on most goods, and Patna's saltpetre has the same problem, so they don't feel like sources.
- Sandwip's data calls salt scarce, against the evidence for its salt trade.
- A few outliers shape trading. Hooghly–Tanda earns 3× a top-tenth route, and one Kasimbazar–Tanda silk load earns 5,460 Coins in about a third of a day.

## Recommended town profiles

"Main" means supply tier 3, and "scarce" means supply tier 1. Demand is tier 3 for "wants" and tier 1 for "little need". Anything unlisted is the middle tier.

| Town | Main | Scarce | Wants | Little need |
|---|---|---|---|---|
| Dhaka | Cotton textiles | Saltpetre | Rice, salt, silk, lac | Saltpetre |
| Sonargaon | Cotton textiles | Opium | Salt, silk | – |
| Kasimbazar | Silk | Lac, salt | Rice, salt, cotton textiles | Silk |
| Chittagong | Salt | Silk | Rice, cotton textiles, sugar | Salt |
| Sylhet | Lac | Cotton textiles | Salt, cotton textiles, sugar | Lac |
| Hooghly | Saltpetre, sugar, opium | – | Rice, salt, cotton textiles, silk | – |
| Satgaon | Rice | Lac, sugar | Salt, cotton textiles | Rice |
| Rajmahal | Lac | Silk | Rice, cotton textiles | – |
| Tanda | Sugar | Cotton textiles | Salt, rice, lac | – |
| Malda | Silk | Lac | Salt, cotton textiles, saltpetre | Silk |
| Balasore | Salt | Lac, silk | Cotton textiles, sugar | Salt |
| Jessore | Sugar, rice | Saltpetre | Salt, cotton textiles, silk | – |
| Sandwip | Salt | Cotton textiles | Rice, cotton textiles, sugar | Salt |
| Bakla-Chandradwip | Rice | Lac, opium | Salt, cotton textiles, sugar | Rice |
| Patna | Saltpetre, opium | Salt | Cotton textiles, silk, salt | Saltpetre, opium |

### Historical basis

The game has only eight goods, so a profile can only be the closest fit among them. These labels would also go into `src/game/city-economic-identities.ts`.

| Town | Main good | Basis |
|---|---|---|
| Dhaka, Sonargaon | Cotton textiles | **Documented:** muslin weaving (Banglapedia, cited in the existing audit) |
| Kasimbazar | Silk | **Documented:** major silk market, including Tavernier's estimate |
| Malda | Silk | **Documented,** from secondary sources: silk cloth with European demand |
| Patna | Saltpetre, opium | **Documented:** Bihar saltpetre and opium trade. The opium evidence is stronger for slightly later |
| Hooghly | Saltpetre, sugar, opium | **Documented as a trading hub, not a producer:** goods gathered for shipping, with the Dutch collecting saltpetre there |
| Sandwip | Salt | **Partly documented:** secondary sources describe a salt trade from the 16th century. I couldn't trace these to primary sources |
| Chittagong, Balasore | Salt | **Gameplay assumption:** plausible for coastal towns, with no town-level source found |
| Jessore | Sugar, rice | **Gameplay assumption:** no source found in this search |
| Bakla-Chandradwip | Rice | **Gameplay assumption:** no source found in this search |
| Satgaon | Rice | **Gameplay assumption:** Satgaon's decline after silting is documented, but its goods aren't |
| Sylhet, Rajmahal | Lac | **Gameplay assumption:** forest and hill country make it plausible, but no 1660s source was found |
| Tanda | Sugar | **Gameplay assumption:** chosen mainly for variety |

So **7 of the 15 towns rest on documented or partly documented goods, and 8 on gameplay assumption.** The hints below shouldn't present assumptions as history.

## Local stock and trading activity

**Recommendation: keep one rule, and make it last longer.** Anything bought or sold changes a stall's stock, stock sets the price, and the stall slowly returns to its usual level.

- **Recovery:** multiply today's rates by 0.6 (3.6%, 4.8% and 7.2% a day), with a daily minimum of 1, 1 and 2 units.
- **Result:** a stall takes about 10–20 days to recover halfway, up from 6–12, and 25–56 days fully, so the player's and merchants' trades stay visible.
- **For the player:** the market could show stock against usual, such as "Plenty in stock" or "Running low", beside the existing note of merchants' recent trades. That belongs in the implementation stage.

**Rejected: a separate memory of past trading** that shifts a town's usual price. It would add saved data and a second rule to explain, and slower recovery already makes activity last. Seasonal and event-driven changes remain the approved later phase.

## How prices vary between towns

- **Reduce the supply and demand weight from 0.15 to 0.12.** The new profiles use the full range far more often, so a smaller weight keeps gaps sensible.
- **Result:** the dearest town charges 1.7–2.15× the cheapest for any good (1.3–2× today), and every good has 4–6 different prices (2–6 today).

## Candidates tested

All on the same 5 seeds, at day 200, with the current game as the control. The control reproduced the committed record exactly.

| Candidate | Profile | Weight | Recovery | Basic | Skilled | Mixed | 6 farms | Merchant wealth | Targets met |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Current game | Today | 0.15 | 100% | 92,770 | 274,985 | 146,250 | 145,795 | +1% | 14 |
| P1 | Sharp | 0.15 | 100% | 464,000 | 523,070 | 576,980 | 507,230 | Very high | 8 |
| P1W10 | Sharp | 0.10 | 100% | 279,000 | 368,815 | 367,845 | 376,690 | High | 9 |
| R1 | Today | 0.15 | 60% | 64,430 | 186,570 | 104,845 | 89,430 | Lower | 8 |
| C1 | Sharp | 0.10 | 60% | 204,000 | 260,000 | 226,000 | 281,365 | +14.7% | 12 |
| D1 | Gentle | 0.10 | 60% | 162,000 | 206,550 | 171,000 | 212,000 | Within 5% | 12 |
| **E1, recommended** | **Final** | **0.12** | **60%** | **174,000** | **208,055** | **205,000** | **247,020** | **+8.7%** | **11** |
| E2 | Final | 0.10 | 60% | 157,000 | 204,230 | 153,000 | 207,000 | +4.7% | 11 |
| E3 | Final | 0.12 | 70% | 176,000 | 227,000 | 210,000 | 244,590 | +9.9% | 10 |
| E4 | Final | 0.15 | 60% | 213,000 | 259,000 | 239,000 | 268,605 | +16.9% | 11 |

E1 meets fewer targets than the current game, but two of its misses are stale: the route and warehouse targets are fixed to specific port pairs that the new map no longer favours. E2 is the closest alternative, but routes there lose money against skilled trading alone (−2.1%). E4 keeps the formula unchanged but inflates wealth the most. E3 has almost no benefit from routes (+0.2%).

## Benchmark impact of E1

Median of 5 seeds, current → E1.

| Strategy | Day 30 | Day 90 | Day 200 | Day 400 |
|---|---:|---:|---:|---:|
| Mixed | 32,445 → 43,120 | 69,330 → 83,000 | 146,250 → 205,000 | 387,860 → 446,000 |
| Skilled | 59,945 → 49,000 | 134,325 → 110,000 | 274,985 → 208,055 | 520,595 → 400,000 |
| Skilled + 2 Bora routes | 56,735 → 49,000 | 137,335 → 103,000 | 293,585 → 237,000 | 616,780 → 462,000 |
| Basic manual | 26,250 → 42,000 | 46,370 → 89,000 | 92,770 → 174,000 | 165,230 → 344,000 |
| 6 farms | 31,525 → 44,000 | 53,475 → 99,000 | 145,795 → 247,020 | 437,325 → 546,000 |
| Skilled + 6 farms | 53,055 → 43,000 | 151,815 → 116,000 | 414,675 → 313,000 | 880,860 → 655,000 |
| Farm circuit | 29,195 → 40,000 | 49,395 → 96,000 | 137,055 → 320,000 | 728,530 → 904,000 |
| Contract-focused | 38,410 → 49,000 | 74,975 → 101,000 | 135,785 → 186,000 | 238,410 → 355,000 |
| Passive | About 21,000, same | Same | Same | Same |

| Measure | Current | E1 |
|---|---:|---:|
| Contracts' share of mixed income, days 30 / 90 / 200 / 400 | 72 / 56 / 41 / 33% | 34 / 34 / **29** / 26% |
| Strongest against mixed, day 200 | 2.84× | **1.55×** |
| Strongest against skilled, day 400 | 1.69× | **2.26×** (farm circuit) |
| Skilled against basic manual, day 200 | 2.96× | **1.19×** |
| Best repeated route against a top-tenth route | 3× | **1.5×** |
| Best first load | 5,460 | 2,120 |
| Routes from shipyards: couldn't start / never sailed / lost money | 2 / 11 / 0 | 0 / 5 / 0 |
| Median route, Coins a day | 35 | 49 |
| Best route's payback, River boat / Bora | 66 / 46 days | **107 / 75 days** |
| Skilled with routes against skilled alone | +6.8% | **+14.1%** |
| Stalls 5% or more from their start, of 120 | About 13 | **About 30** |
| Largest move at a stall | 18–25% | 38–46% |
| Stalls near empty or full; price index | 0; about 1.00 | 0; about 1.01 |
| Merchants: median / fastest growth | 1.67× / 3.48× | 1.78× / 5.54× |
| Merchants laid up, stalled or shrunk below half | 0 | 0 |
| Delivery offers that profit at new-game prices, of 30 | 27 | 26 |
| Same-port or round-trip profit | None | None |
| Ledger, replays, refused commands | All clean | All clean |

**Targets at E1: 11 of 20.** Newly met: strongest against mixed, and contracts' share. Newly missed:
- Skilled day 200: 208,055, just under 225,000
- 6 farms day 200: 247,020, above 220,000
- Reputation: 160, above 150
- Merchant wealth: +8.7%, above +5%
- Recovery halfway: 10–20 days, against the baseline's 5–12 (a target in `ECONOMY_BASELINE.md`)

Still missed: mixed day 30 (43,120), strongest against skilled, warehouse payback and Patello. The route target also reads as missed, because it's fixed to Hooghly–Tanda, which no longer pays. Using the best route instead, payback is 107 and 75 days. A skilled Patello falls to 0.68×.

## How it interacts with other systems

| System | Effect | Action |
|---|---|---|
| **Merchants** | They read the same data and earn more, and the richest grows 5.54×. Rules unchanged | Watch whether the fastest merchant runs away |
| **Automated routes** | Almost every pair now has something to trade, and hold their margin check. Hooghly–Tanda stops being the obvious choice | Fix the benchmark's hard-coded pair |
| **Contracts** | Rewards stay at 130% of reference value, unchanged. Local goods can now cost more or less, so offers vary more | None. The share target is met without changing rewards |
| **Farms** | Trading slows but rice keeps selling, so farms gain relatively. The circuit is 2.26× skilled at day 400 | Needs a decision below |
| **Warehouses** | No effect yet, and "never pays" on the fixed test pair. Distinct prices and slower recovery make holding stock more plausible, but seasons are still needed | Bench them on a pair that fits |
| **Moneylender, rankings** | Rankings use reference prices, so they're unaffected. Rescue thresholds shift a little | Re-check in testing |
| **Chittagong's salt event** | Its surcharge now sits on a salt-source town | Check that it still reads sensibly |

## Feature B: specialty hints

Feature B reads the same `PORT_ECONOMIES` data through one new function, so a hint can't disagree with what drives prices. It shows nothing new from stored prices.

```text
getTownSpecialties(town) -> goods whose supply tier is 3
```

- **Where:** in the port panel when a city is selected, for example: "**Known for:** silk."
- **Trading hubs:** Hooghly can say "**Traded here in quantity:** saltpetre, sugar, opium", using the role already in `city-economic-identities.ts`, so it doesn't claim to produce them.
- **The promise it doesn't make:** a short line such as "Often cheaper here, but stalls change with trade." It never says "cheap here", because stock, merchants and the player can all make a good dear on the day.
- **Gameplay assumptions:** "Known for" is game wording. The notes behind each town stay labelled as history or assumption, so the game doesn't present assumptions as documented fact.
- **No save change or balance effect.**

## Feature C

Rerouting or cancelling a voyage stays separate and on the roadmap. Nothing here depends on it.

## Risks

- **Skill matters less for the bots:** the skilled bot's lead over the basic bot falls from 2.96× to 1.19×. More profitable choices make simple play work better, or the skilled bot's rule may just suit the new map worse. Only a better bot or real play can tell these apart.
- **Farms in the long run:** E1 widens the gap at day 400, because slow recovery hits traders, while farm rice doesn't rely on buying from stalls.
- **Rivals:** most active bots rank first among merchants by day 200, including the basic one. Bots fixed to one route rank far lower, because those routes no longer pay.
- **Faster early money:** mixed at day 30 is 43,120, above the 25,000–35,000 target.
- **Evidence:** 8 town profiles are gameplay assumptions.
- **Seeds:** with more variety, 5 seeds show a wider spread, for example 183,055–214,950 for mixed.
- **Bots, not people:** none of this shows whether the markets feel better.
- **Tests:** many existing tests and the frozen v20 recording rely on today's prices, so expect a large, careful test update and possibly more recorded-game refusals.

## Implementation plan

1. **Harness first.** Pick the best route and warehouse pairs from the current data instead of naming them. Add a stronger skilled-bot check if practical. No rule changes.
2. **Feature A.** Apply the profiles, weight and recovery, in a new save version. Stock isn't rewritten: stalls drift to their new usual levels by the normal rule, and the command log restarts. Update `city-economic-identities.ts`, and add the stock labels to the market.
3. **Re-measure,** then a full checkpoint.
4. **Feature B,** as a small follow-up.

## Harness re-measure of E1

Run with `src/sim/market-check.ts`, on 5 seeds. Existing bots and benchmark records are unchanged, and the control run matched the committed record exactly. Three additions:

- **Expert bot:** plans a three-leg tour rather than one round trip.
- **Uninformed bot:** trades sensibly but picks its next port at random, to show what choice is worth.
- **Pair selection:** routes are chosen two ways, from day-one prices and by a 60-day trial, and warehouses are tested on the top three repeated routes as well as the old Hooghly–Satgaon pair.

| Net worth multiple | Current, day 200 / 400 | Profile only | Slower recovery only | E1 |
|---|---:|---:|---:|---:|
| Skilled against basic | 2.96 / 3.15 | 1.18 / 1.12 | 2.90 / 3.24 | 1.20 / 1.16 |
| Expert against basic | 2.89 / 3.04 | 1.35 / 1.33 | 2.86 / 3.14 | 1.45 / 1.37 |
| Expert against skilled | 0.97 / 0.96 | 1.14 / 1.19 | 0.99 / 0.97 | 1.21 / 1.18 |
| Skilled against mixed | 1.88 / 1.34 | 0.98 / 0.89 | 1.78 / 1.32 | 1.01 / 0.90 |
| Expert against uninformed | 4.59 / 5.42 | 3.55 / 4.07 | 3.98 / 4.77 | 2.96 / 3.31 |
| Farm circuit against skilled | 0.50 / 1.40 | 1.33 / 1.75 | 0.47 / 1.35 | 1.54 / 2.26 |

**The skill gap is mainly a real market-design effect, caused by the town profile.** Slower recovery alone leaves it at 2.90×. The skilled bot understates skill under E1, because the expert bot earns 21% more, but the expert's lead over the basic bot still halves. From each port, the best round trip beats a typical one by 3.06× under E1, against 4.9× today. Part of today's gap is also a quirk of a sparse map that punishes the basic bot's one-way habit.

**Findings on recovery, routes and warehouses:**

- **Recovery:** with the profile alone, stalls recover halfway in 6–12 days, inside the 5–12 target. Slower recovery is what pushes E1 to 10–20 days. Slower recovery isn't needed for visible price movement either: 27 stalls moved with the profile alone, against 30 in E1. What it does is offset the extra income.
- **Routes:** choosing on day-one prices misleads badly under E1, predicting 920 Coins a day for a Bora that earns 48, a 362-day payback. A 60-day trial finds pairs that pay back in 129 days (River boat) and 87 days (Bora), both inside the 80–130 target. A Patello takes 218 days.
- **Warehouses:** they don't pay on any selected pair under either market. The bot's rule is limited, and prices that don't change over time give storage little purpose.

**Recommendation: revise E1 rather than implement it.** Test a candidate that narrows demand, so choosing well matters more, and offsets income with a lower price weight rather than slower recovery.

## Sources

Most are secondary, and several are general surveys, so they support broad context rather than town-by-town inventories for the 1660s.

- [Trade and Trading Items of Colonial Bengal, 1602–1757 (North Bengal University)](https://ir.nbu.ac.in/items/913a3cab-bbf7-4904-9e5a-eb95d316ba39/full)
- [SOAS repository study of European trade in Bengal](https://soas-repository.worktribe.com/OutputFile/390692)
- [Banglapedia: Trade and Commerce](https://en.banglapedia.org/index.php/Trade_and_Commerce)
- [Banglapedia: Bon-kar (forest revenue)](https://en.banglapedia.org/index.php/Bon-kar)
- [Encyclopedia.com: Bengal, Maritime Trade of](https://encyclopedia.com/history/encyclopedias-almanacs-transcripts-and-maps/bengal-maritime-trade)
- [Wikipedia: Sandwip Island (secondary, and its figures are unverified)](https://en.wikipedia.org/wiki/Sandwip_Island)
- [Wikipedia: Mughal conquest of Chittagong](https://en.wikipedia.org/wiki/Mughal_conquest_of_Chittagong)
- [The Daily Star: The great age of Chittagong](https://online-d11.thedailystar.net/slow-reads/news/the-great-age-chittagong-and-our-failure-understand-it-4112376)
- The existing [CITY_ECONOMIC_IDENTITY_AUDIT.md](./CITY_ECONOMIC_IDENTITY_AUDIT.md) and [TOWN_IDENTITY_PLAN.md](./TOWN_IDENTITY_PLAN.md)
