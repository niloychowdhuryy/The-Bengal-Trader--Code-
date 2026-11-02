# Online Merchant Empire — Implementation Plan

**Status:** Stage 1 committed as `eb28e82`. Milestone S is live at https://bengal-trader-staging.vercel.app. Stage 2 is implemented and its Google login was tested by the owner on a local copy against the live project, 2 November 2026; it reaches the staging site once deployed. Later stages are planned only. Numbers are starting values that the simulations in Stage 13 may change; changes get recorded in the Decision log at the end.

## Essential milestones

These three requirements are part of the game, not optional extras. A basic version doesn't count as complete; each has its own exit check.

### Milestone S: online staging deployment

**Goal:** an early playable version at a stable web address, updated automatically, so the game can be tested from home well before it's finished.

- **Hosting:** Vercel, connected to the GitHub repository, which the owner made public on 2 November 2026 so the free plan would build it. Cloudflare Pages was tried first but didn't work during setup. Vercel's free Hobby plan is for personal, non-commercial use and its definition of commercial use is broad, so the game must move to a paid plan or another host before ads, revenue or public launch.
- **Updating:** each approved stage commit is pushed to GitHub and deploys itself. The build runs all tests first, so a failing version doesn't replace a working one.
- **Separation:** staging has its own Vercel project and Supabase project. Production gets separate ones later, with its own keys and data.
- **Secrets:** only the Supabase URL and publishable key reach the browser, and both are designed for that. Secret keys never go in the repository or Vercel's project settings.
- **Reporting problems:** the game shows its version in the More menu, with a simple way to send a report that includes it.

**Exit check:** the game opens at the stable address, plays and saves, works offline after first load, shows its version, and a pushed change appears without any manual build. The local version still works. Google login and cloud saves join this deployment when Stages 2 and 3 are ready.

### Milestone N: correct water and land navigation

**What's actually wrong, measured on 2 November 2026:**

- **The network doesn't match the painting.** Overlaying it on the map shows routes crossing Bakla and Sandwip islands, Dhaka itself and the Jessore land mass. 45 of 49 route segments measured under 75% on water. The detector is imperfect, but the overlay confirms the pattern.
- **Painted channels go unused.** The routes were traced for an earlier map, and the network is sparse.
- **It has almost no loops, so routes make long detours.** Balasore to Hooghly is 5.4 times the straight-line distance, because it must go via Dhaka despite open water between them. Bakla to Satgaon is 5.2 times, and Sonargaon to Sylhet 4.8 times.
- **Port markers aren't quays.** Many sit inside the town, so boats leave across land.
- **Speed isn't the cause,** and it won't be used to hide the problem.

**Automatic generation from the picture isn't enough.** A rough pathfinding test over the painted water showed one large connected water body, but colour detection breaks around ripples and bridges, so it isn't reliable by itself. Sylhet had no detected connected water near its marker, which needs a closer look. It may be a narrow channel or a genuine land case. The route network will be traced deliberately, then checked automatically against a water map baked from the painting.

**Design:**

- **One transport network** with water routes, land routes and named transfer points (quays and landings). Markers stay where they are for display; quays are separate points on the painted waterfront.
- **Water routes** are retraced on the current painting with real loops and branches, and each carries a width class that decides which vessels fit.
- **Land routes** are only added where the map needs them, following roads or sensible paths and avoiding water and buildings.
- **Route choice** minimises actual travel time for that vessel, across both modes. So a direct waterway always beats a detour.
- **Journeys** become a list of legs (water, land). The boat moors at the landing, a cart takes over, and it reverses on the way back. Cargo stays the same single record throughout, so nothing can be duplicated, lost or sold by a transition. The vehicle shown always matches the current leg.
- **Vessel rules:** River boat and Bora reach all 15 ports. Patello stays barred from Sylhet and Balasore by an explicit rule, so a land link can't bypass it. If a port can't be reached, the game says why.
- **Land speed:** starting at 40% of a River boat's normal water speed per unit of distance, to be tuned by simulation. Land is a necessity, not a shortcut.
- **One source of truth:** the route drawn, the vehicle's movement and the travel time all read the same legs.
- **Also uses the planner:** automated routes, return orders, NPC merchants and previews.
- **Saves:** a voyage under way at migration finishes on its old route. This takes save version 20, so Coins moves to version 21.
- **Art:** a bullock or horse-drawn cart, with historical suitability checked first.

**Exit check, with automated tests for each:** direct connected water routes; narrow waterway connections; dead ends; branching waterways; routes with unnecessary detours; vessel-specific draft restrictions; ports only reachable by land (on test networks, and on the real map wherever one exists); water-to-land and land-to-water transitions; cargo and journey preservation during transitions; land routes avoiding impassable terrain; unreachable destinations; and agreement between the displayed route, animation and travel time.

In addition, every water leg must stay on the baked water map, every land leg must stay off it except at marked bridges, and no route may exceed a set detour limit unless the map genuinely requires it. The five-minute cap is reviewed here, because all journey times change.

### Milestone T: individual town identities

Each of the 15 towns gets its own appearance, layout, waterfront and landmark, based on its historical character around 1665, and every important building does something. **[TOWN_IDENTITY_PLAN.md](./TOWN_IDENTITY_PLAN.md)** has the town-by-town design, the acceptance test and the research still needed. It's built progressively alongside Stage 9, starting with Dhaka, Chittagong, Sylhet, Sonargaon and Hooghly.

### What every stage must deliver

Its own commit, passing tests, type-check and production build, and a report of what changed, known limitations and what remains before the next stage. A feature isn't marked complete because a basic version exists. Physical mobile testing happens in a dedicated later phase, though the interface must stay responsive throughout.

## 1. What the audit found

| Finding | Evidence | What it means |
|---|---|---|
| The game rules are already pure functions | `src/game/` has no `Math.random` and takes the time as an argument; only a save migration default calls `Date.now` | The same rules can run in the browser and on a server. This is the most valuable thing to reuse |
| All rule changes happen in the browser | About 35 `updateGame(...)` calls in `App.tsx`; the save is one IndexedDB record | Anyone can edit their save today. Leaderboards need a server that re-checks play |
| Ports are never route waypoints | Measured: no route between the starting five passes through another port, for any vessel | Locks only need checking at destinations, so locked cities can't be reached indirectly |
| Starting five are connected for all vessels | Measured for River boat, Bora and Patello | Early game works without changing routes |
| Patello access already matches Part 13 | All except Sylhet and Balasore since Stage 13 | No change needed beyond keeping tests |
| One trade route dominates | Measured: Hooghly → Satgaon takes 0.39 days and earns 38 gold on a full 12-unit hold, or 97 gold per day. Most other starting routes earn 9–12 per day | The new starting economy would be solved on day one unless the market is rebalanced |
| Sell price is a flat 3 gold below buy | `MARKET_SELL_SPREAD` | Cheap goods lose half their value, expensive goods almost nothing. Must become a percentage |
| Gold appears throughout | 57 mentions in `model.ts`, 72 in `App.tsx`, 16 in `storage.ts` | Conversion is a real migration, not a label change |
| No backend tools on this machine | No Docker, Supabase CLI, Deno or psql | Database rules can be tested here with PGlite (Postgres in Node). A live end-to-end test needs your Supabase project |

## 2. Conflicts with the brief, and how they're resolved

1. **Ad verification decides the platform.** AdMob offers signed server-side verification, but its documentation covers native apps. Google's web game ads (H5 Games Ads) are by application only, and I found no server verification for them; Google states it doesn't grant or verify rewards. **Decision:** ship an Android app with Capacitor and AdMob. The web version stays playable with no ad rewards. iOS follows later.
2. **Google login inside an app.** Google refuses sign-in pages inside app web views. **Decision:** browser login on the web, the native Google plugin plus Supabase `signInWithIdToken` on Android.
3. **iOS login rule.** Apple guideline 4.8 requires an equivalent privacy-friendly login beside Google, such as Sign in with Apple. **Decision:** add it only when iOS is scheduled.
4. **Two clocks.** Existing rules say nothing advances while the game is closed, and one sailing minute is one in-game day. Farms, ad timers and offline production use real time. **Decision:** both clocks exist on purpose. Voyages, contracts and NPCs use sailing days. Farms and ads use trusted real time. Markets use sailing days plus a capped real-time recovery. `CORE_GAME_RULES.md` is updated in Stage 5.
5. **4× sailing speed.** It speeds trading but not real-time farms or ad timers, so the simulations must measure real minutes as well as game days.
6. **All cities open vs five to start.** Docs and tests currently require all 15 open. **Decision:** the docs and tests change. Old saves keep every port they have visited.
7. **Rice example.** At 50×, one rice is worth 300–600 Coins, so a 200 Coin order can't produce a whole unit. **Decision:** keep the discount target of 10–30% and sell orders as batches.
8. **Starting Coins.** 90 gold × 50 is 4,500, while the brief says 5,000. **Decision:** new games get 5,000. Old saves convert at exactly 50×.
9. **"Persistent world".** One market shared by all players would allow griefing and need permanent connections, ruling out offline play. **Decision:** each player has a private market, with shared world events from the server so everyone experiences the same season. Leaderboards stay fair.
10. **16 building types, 8 drawings.** Each town shows the buildings it has, so new drawings are needed. Portrait screens fit about 8–12, so towns get a vertically scrolling scene. Docks, Shipyard and Shipwright stay distinct: cargo, new vessels, and repairs.
11. **Audience.** Project docs target age 12, while the game will carry ads, a Google account and opium as a trade good. **Decision:** plan for 13+ with an age check at sign-in. This needs legal review before launch.

## 3. Architecture

### Commands and server replay

Every action becomes a named command, such as `buyGood`, `startVoyage` or `claimProduction`. One function, `applyCommand(state, command, context)`, is used by the browser and the server.

```
Browser: apply command at once → save locally → queue it
Server:  replay queued commands from the last verified state → accept or reject → store the result
```

- **Offline** is simply a long queue.
- **Cheating is limited:** the server recalculates everything, so a client can't claim Coins. Commands must be in order and can't be timed before the last sync or after the moment they arrive, so play can't claim more time than really passed.
- **Random events** use a seed stored in the save, so reloading can't reroll them.
- **Performance:** batches sent about once a minute, and at key moments.

### Save lifecycle

| Situation | Behaviour |
|---|---|
| Version 19 save | Migrates to version 20 on the device, with the original kept as a backup slot |
| Guest game started on version 20+ | Keeps a command log. Linking replays it and the account is ranked if it passes |
| Old save linked to an account | Fully playable, but marked `imported` and left off leaderboards, because its history can't be verified |
| Local and cloud both have progress | Server detects a revision mismatch. **Nothing is overwritten:** the player sees both summaries and chooses. The other copy stays as a backup |
| Reinstall or new device | Sign in and download the verified state |
| No configuration present | The game runs offline and shows no login button, rather than a fake one |

### Backend: Supabase

Chosen for Google login, Postgres with row-level security, and Edge Functions that can run the same TypeScript.

| Table | Purpose | Client access |
|---|---|---|
| `profiles` | Display name chosen by the player, age check, ranked flag | Read own, edit name through a function |
| `game_states` | Verified save, revision, schema version | Read own only |
| `command_batches` | Replay history and duplicate protection | None |
| `save_backups` | Previous copies for recovery | Read own only |
| `ad_opportunities`, `ad_transactions` | Timers, daily counts, unique verified views | None |
| `leaderboard_scores` | Server-calculated scores | Read by everyone: name and score only |
| `world_events` | Shared seasons and events | Read by everyone |

**Rule:** clients can never write to tables directly. Every change goes through Edge Functions (`sync`, `link-save`, `ad-callback`, `ad-claim`, `delete-account`). The service-role key lives only in Supabase's secrets. Account deletion is included because app stores require it.

### Code structure

`model.ts` (3,000+ lines) gets split gradually into `src/game/` modules as each stage touches it, with existing exports kept working. `App.tsx` keeps its screens and calls `dispatch(command)`. Every stage has migrations and tests.

## 4. Economy

### Coins (50× conversion)

| Item | Gold | Coins | | Item | Gold | Coins |
|---|---:|---:|---|---|---:|---:|
| Rice price range | 6–12 | 300–600 | | River boat | 500 | 25,000 |
| Silk price range | 24–42 | 1,200–2,100 | | Bora | 350 | 17,500 |
| Warehouse | 150 | 7,500 | | Patello | 900 | 45,000 |
| Farm | 200 | 10,000 | | Repair per hull (River boat, Bora) | 2 | 100 |
| Residence | 250 | 12,500 | | Repair per hull (Patello) | 3 | 150 |
| Marriage | 100 | 5,000 | | Route capital limit | 5,000 | 250,000 |
| Contract rewards | 18–30 | 900–1,500 | | Wealth milestone | 250 | 12,500 |

The migration multiplies gold, peak gold, cost basis on ships and in warehouses, route capital and NPC purses. Cargo, ships, upgrades, missions and progress stay the same.

### Dynamic market

```
price = base value × city demand × stock pressure × regional pressure × event effect
sell price = price × (1 − spread)
```

- **Stock pressure** keeps today's curve: fewer goods, higher price.
- **Local production and consumption** move stock toward a city-specific target each day.
- **Regional pressure:** a small, capped effect from nearby ports, so shortages spread.
- **Bounds:** prices stay within 40–250% of base, stock within limits, recovery is gradual.
- **Spread** becomes a percentage (starting near 12%), so buying and reselling at one port always loses money.
- **Everyone shares it:** manual trades, automated routes, NPCs and production deliveries use one pricing function.
- **"Why this price?"** Each good shows plain reasons, such as "Low stock" or "Grown locally".
- **Starting five:** Each lacks several goods at good prices, and some goods are scarce until cities unlock.

### Farms and production

- **Orders are paid up front** and take real time, including while offline.
- **Finishing time comes from the server** when online. An order placed offline is capped by the moment the server first sees it.
- **Claims are single-use:** each order has one ID that can only be claimed once.
- **One order per basic farm;** upgrades add output or speed.
- **Existing farms** stop producing free rice. Any rice already stored stays claimable.

| Good | Batch | Time | Notes |
|---|---:|---:|---|
| Rice | 4 | 5 min | Starter order, cheapest |
| Sugar | 3 | 8 min | |
| Salt | 3 | 8 min | Coastal farms only |
| Cotton textiles | 2 | 15 min | Needs reputation |
| Saltpetre | 2 | 15 min | Specific regions |
| Lac | 2 | 20 min | |
| Silk | 2 | 30 min | Needs reputation |
| Opium | 1 | 45 min | Advanced permit |

Cost is set at 70–90% of the city's usual value. Selling a large batch moves the price, which naturally stops farming from replacing trade.

### Warehouses

Each city's warehouse needs Recognised reputation or a political favour. Costs rise with each one owned and there are three capacity upgrades. Their value comes from buying low and holding for better prices, collecting farm output, and pre-positioning goods for contracts.

### City unlocks

| Tier | Cities | Typical requirements |
|---|---|---|
| Start | Dhaka, Sonargaon, Hooghly, Chittagong, Satgaon | Open |
| 1 (first session) | Jessore, Kasimbazar, Bakla-Chandradwip | Recognised in a neighbouring city, one mission |
| 2 | Malda, Tanda, Sandwip, Balasore | Respected, a favour, some merchant progress |
| 3 | Rajmahal, Sylhet, Patna | Respected in the region, a political mission, a larger net worth |

Unlocks are permanent, always show their requirements, and are checked for voyages, routes, return orders and missions.

### Reputation

Per city: Unknown Trader → Recognised Merchant → Respected Merchant → Master Merchant. Favours cost money, goods or missions, and each has a cooldown and a level ceiling, so top reputation can't be bought. The current 0–100 local standing carries over.

## 5. Buildings

Buildings open real functions through one shared interface. Town layouts list which ones each port has.

**Religious buildings need sources first.** The table below is provisional until the `historical-research` skill checks it:

| Building | Provisional places | Basis to verify |
|---|---|---|
| Mosque | Most towns | Mughal-era settlements |
| Temple | Most towns, not necessarily all | Local Hindu communities |
| Church | Hooghly, possibly Chittagong and Sandwip | Portuguese presence |

Donations are always voluntary and earn modest community standing, never a purchasable advantage. Missions focus on helping people, such as feeding travellers or repairing a shared well, and never reward or portray worship itself.

## 6. Mission engine

Missions are data, not code. A template defines objective, requirements, rewards, reputation effects, difficulty, expiry, repeat rule and failure result. The engine fills in cities and goods from what makes sense locally.

- **Scale:** about 40 templates across the 12 categories, with city-specific variations and 8–10 chains. That produces 500+ real combinations.
- **Boards:** each city shows a few at a time, refreshed daily and weekly from the player's seed.
- **Exploit protection:** every instance has a unique ID paid once, repeatables have cooldowns and shrinking rewards, and rewards are capped against current market value.
- **Journal:** Active, Available and Completed tabs.
- **Old contracts** carry over unchanged.

## 7. Voyages

Events roll on the voyage's seed from route, vessel, season and cargo. Roughly 1 voyage in 3 has an event, and most offer a choice. Hull damage can't take a ship below 1 from one event, cargo loss is capped at a share of the hold, and no single event can end a ship or a save. Disabled ships always have a free recovery route; the ad option only makes it faster. The five-minute travel cap gets reviewed with simulation data.

## 8. Leaderboards

Scores are calculated by the server from verified state only; there is no way to submit one.

Net worth uses **fixed reference prices**, not live ones, so nobody can pump a market to raise their rank: Coins, plus goods at reference value, plus ships and upgrades at 60% of cost, plus property at 70% of cost, plus route capital. Weekly boards can be added later from the same data.

## 9. Rewarded ads: Merchant's Opportunity

```
1. Timer ready (server-checked: 12 minutes since last, under 5 today)
2. Player taps. Server issues a one-time ticket
3. AdMob shows the ad, with the ticket attached as custom data
4. Google calls our server when it's earned; the signature is checked with Google's public keys
5. Transaction ID recorded once; ticket marked as earned
6. Player chooses one reward; the server applies it as a command
```

- Closing the ad early means no callback and no reward. Without internet, no opportunity is offered.
- **The reminder is a small chip,** never a pop-up, and it hides during decisions, encounters and voyages' critical moments.
- **Reward limits:** hull repair stays within maximum; cargo protection covers one event, up to a capped share; recovery only applies to disabled ships; mission doubling applies to Coins only, with a daily limit; instant production needs an already paid order.
- **Interstitial ads:** none at launch. The game's natural breaks are short, and they risk harming retention and trust. Revisit with real data.
- **Consent:** UK and EEA players need a Google-certified consent form, included in this stage. I still need to confirm the current details against Google's documentation when building it.

**Revenue is capped by design.** Five ads per player per day sets a ceiling. For scale only: at an *assumed* $10 per 1,000 views, that's at most $0.05 per active player per day. Real rates vary widely by country, so check this once real data arrives.

## 10. Simulations

`src/sim/` runs the real game rules headlessly with scripted players, so results reflect the actual game. Each strategy runs across many seeds for 30, 90 and 200 in-game days:

Manual trading · automated routes · farm-focused · warehouse-focused · mixed · minimal ads · maximum ads.

**Reported:** wealth curves, profit per voyage and per real minute, farm and warehouse return on investment, repair costs, mission income, inflation, stock depletion, recovery speed, ad share of income, and time to each city unlock.

**Automated failure conditions, run with the normal tests:**

- Buying and selling in a loop at one port never profits.
- A two-port loop's earnings fall with repetition.
- Prices and stock stay within bounds.
- No duplicate rewards.
- Ads never exceed a set share of income, and no strategy outperforms everything else by more than a set margin.

The harness starts in Stage 4, not Stage 13, so each economic stage is measured as it's built. Stage 13 is the full balancing pass.

## 11. Stages

Your order is kept, with these adjustments: the command layer went first because everything secure depends on it; simulations start early; Stage 12 includes the Android app; staging comes straight away; and navigation comes before cloud saves, Coins and markets. Navigation changes every journey time and the save format, so doing it first means balance work is measured on correct travel, and cloud data never needs this migration.

| # | Stage | Testable here without your accounts? |
|---|---|---|
| 1 | Command layer, server replay, database schema and rules — **done, `eb28e82`** | Yes |
| S | Online staging deployment — **live; report link and version added with Stage 2** | Needs your GitHub and Vercel accounts |
| 2 | Google login and profiles — **implemented; login tested locally against the live project** | Code yes; live login needs your setup |
| N | Correct water and land navigation, version 20 save | Yes |
| 3 | Cloud saves, linking, conflict handling, multi-tab safety | Logic yes; live sync needs your setup |
| 4 | Coins, version 21 migration, simulation harness | Yes |
| 5 | Dynamic markets | Yes |
| 6 | Farm production orders | Yes |
| 7 | Warehouse network | Yes |
| 8 | City unlocks, reputation levels, collapsible map panel (Part 15) | Yes |
| 9 | Buildings, mission engine, journal, and Milestone T town identities | Yes |
| 10 | Voyage events, vessel checks | Yes |
| 11 | Leaderboards | Logic yes; live needs your setup |
| 12 | Android app, AdMob, Merchant's Opportunity | Needs your accounts and a real device |
| 13 | Full simulations, integration, balancing | Yes |

Tests, type-check and build run after every stage, and docs are updated. Nothing gets committed without your approval.

## 12. What you need to set up

Setup for Milestone S and Stage 2 is now under way. Later items get step-by-step instructions when each is due.

| When | Account | Cost, to confirm at signup | What I need from you |
|---|---|---|---|
| Milestone S | GitHub (private repository) and Vercel | Free for testing; paid or moved before revenue | The staging web address |
| Stage 2 | Supabase project | Free to start; free projects may pause after a quiet week and can be restored, so a paid plan is needed for launch | Project URL and publishable key (`sb_publishable_...`), which replaces the older anon key. The secret key and database password are never shared |
| Stage 2 | Google Cloud OAuth client | Free | Consent screen, web client ID and secret entered directly in Supabase, redirect URLs |
| Stage 12 | Google Play Console | One-off fee | Developer account. New personal accounts may need a closed test with testers before release |
| Stage 12 | AdMob | Free | App and rewarded ad unit IDs, SSV enabled, payment details, consent message |
| Before launch | Legal documents | Varies | Privacy policy, terms, advice on age rating and children's privacy |
| If iOS | Apple Developer | Yearly fee | Account, Sign in with Apple |

Environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the app. Server secrets stay in Supabase only. Supabase is deprecating `anon` and `service_role` keys by the end of 2026, so Stage 3, which first deploys the Edge Function, moves it from `SUPABASE_SERVICE_ROLE_KEY` to the current secret key.

## 13. Biggest risks

0. **Navigation rework.** Retracing the network changes every journey and could disturb saves and automated routes. Mitigation: automatic checks against the water map, and old voyages finish on their old routes.
1. **Economy balance.** Dynamic markets with real-time farms could easily collapse into one dominant strategy. Mitigation: simulations from Stage 4 on real game code.
2. **Scale of the work.** This is a very large expansion of a working game. Mitigation: each stage ships working, with the old systems kept until replaced.
3. **Cheating through offline play.** Replay stops false claims but can't catch a very skilled bot playing legally. Mitigation: plausibility flags, and restricting rewards to online play.
4. **Ad revenue may underwhelm.** The cap of five a day keeps the game fair but limits income, and app-store review and AdMob approval aren't guaranteed. Mitigation: consider other revenue later, such as a one-off paid upgrade.
5. **Complexity for players.** Fifteen systems can overwhelm a new player. Mitigation: unlocks introduce systems gradually, and a guided first session gets added in Stage 8.
6. **Children's privacy and sensitive content.** Ads, accounts, opium and religious buildings each need care. Mitigation: age check, respectful design and legal review before launch.
7. **Save safety.** One bad migration could damage real progress. Mitigation: backup before each migration, tests on every older save version, and recovery from `save_backups`.

## Decision log

| Date | Decision | Why |
|---|---|---|
| 2 Nov 2026 | Plan created with the decisions in section 2 | See section 2 |
| 2 Nov 2026 | Local provenance is `recorded` or `imported`; the database uses `verified` or `imported` | A local log is only verified once the server has replayed it |
| 2 Nov 2026 | The server bundle is generated by `npm run build:server` rather than importing game files directly | Supabase's runtime needs explicit file extensions the game code doesn't use, and this keeps a single copy of the rules |
| 2 Nov 2026 | Background voyage checkpoints aren't recorded; `resumeVoyage` records when a voyage paused | Logging one per second would bloat the log, and replay gives the same result without them |
| 2 Nov 2026 | Ad and leaderboard tables are left for Stages 11 and 12 | Stage 1 only creates what it uses |
| 2 Nov 2026 | Repository is public | Owner's choice, because Vercel's free plan blocked a private repository's commits from another identity. A history scan found no secrets |
| 2 Nov 2026 | Profiles change through a database function rather than an Edge Function | It uses the caller's verified identity, and needs no deployment step |
| 2 Nov 2026 | Public names are chosen by players and never copied from Google; age is a self-declared 13+ check | Privacy, and the plan's age decision. Legal review is still required |
| 2 Nov 2026 | Added Milestones S, N and T as essential work | Owner's requirement |
| 2 Nov 2026 | Navigation goes before cloud saves and Coins; it takes save version 20 and Coins version 21 | It changes every journey time, so balance has to be measured on correct travel |
| 2 Nov 2026 | Hosting is Vercel with a private GitHub repository, replacing Cloudflare Pages | Cloudflare setup failed for the owner. Vercel gives automatic deploys, but its free plan is non-commercial, so it must change before revenue |
| 2 Nov 2026 | Water routes are traced deliberately and checked against a baked water map rather than generated from colours | A rough test showed colour detection alone breaks around ripples and bridges |
| 2 Nov 2026 | Patello's limits are an explicit rule, not a result of channel width | Balasore sits on wide painted water, so width alone wouldn't exclude it |

## Sources

- [AdMob server-side verification](https://developers.google.com/admob/android/ssv)
- [H5 Games Ads overview](https://pub.dev/documentation/google_adsense/latest/topics/H5%20Games%20Ads-topic.html) and [how to sign up](https://developers.google.com/ad-placement/docs/signup)
- [Google publisher policy on rewarded ads](https://support.google.com/publisherpolicies/answer/11975916)
- [Google sign-in with Capacitor and Supabase, Capgo (secondary source)](https://capgo.app/blog/how-to-add-authentication-to-a-capacitor-app/)
- [Apple guideline 4.8, discussed on Apple's forums](https://developer.apple.com/forums/thread/765145)
- [Supabase free tier, secondary source](https://automationatlas.io/answers/supabase-free-tier-limits-2026/); check supabase.com/pricing at signup
- [Supabase: Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google), [API keys](https://supabase.com/docs/guides/api/api-keys), [going into production](https://supabase.com/docs/guides/platform/going-into-prod)
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby), [fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines)
