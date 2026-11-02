# The Bengal Trader: Project Status Summary

**As of:** 2 November 2026. Written from the repository, its Git history and its documents. It is for someone with no prior knowledge of the project, to help decide what to build next.

**Labels:**
- **Implemented:** works in the game and has automated tests.
- **Partially implemented:** some of it exists, but not what was asked for.
- **Planned:** designed or agreed, with no working version.
- **Blocked:** can't proceed without something external, or postponed by the owner.

**Read this first:**
- The navigation rebuild, map fix and collapsible port panel are finished, tested and committed with the owner's approval. They have not yet been tested on a real phone.
- The staging site shows no Google login, because its two Supabase settings aren't added, by the owner's choice. The game there saves on the device only.
- Saves are now version 20. Older saves migrate on load.
- Most of the planned commercial game is **not built**. In particular, the currency is still Gold, markets are simple, and there are no ads or leaderboards.

## 1. The game

**Concept:** a historical merchant strategy game set in Bengal around 1665. The player names a captain, starts in Dhaka, trades eight goods across 15 ports, and builds a business of ships and property.

**Design goals:**
- A coherent, approachable strategy game, with rules a 12-year-old could explain. The planned commercial version targets 13+, and that needs legal review.
- Port Royale as the benchmark for atmosphere and depth, with original setting, art and systems.
- Mobile-first, and playable offline.
- Documented history kept separate from game invention. No community is portrayed as a threat, and religious institutions are shown respectfully.
- An open-ended sandbox with no forced ending.

**Commercial aim:** the owner wants a commercially viable online game, with revenue mainly from optional rewarded ads. No revenue exists yet.

## 2. Features by system

### World and navigation

| Feature | Status | Notes |
|---|---|---|
| 15 selectable ports on an illustrated map | Implemented | All open to the player |
| Map pan and zoom | Partially implemented | Desktop has drag, wheel and buttons. Phones have drag in all directions, but no pinch zoom |
| Water routes traced from the painted map | Implemented | See section 5 |
| Boat-to-cart journeys | Implemented | See section 5 |
| Map stays alive when leaving and returning | Implemented | Fix made after the rebuild |
| City unlocks (only five starting cities) | Planned | All 15 are open today |
| Collapsible port panel that keeps the south reachable | Implemented | Compact by default, with a Details control. The map slides up when it opens |

### Trading and economy

| Feature | Status | Notes |
|---|---|---|
| Eight goods at all 15 ports | Implemented | Rice, cotton textiles, salt, raw silk, sugar, saltpetre, opium, lac resin |
| Finite stock with stock-sensitive prices | Implemented | Stock 0–40, buy price 1–156 gold |
| Weighted-average cargo cost and profit estimates | Implemented | |
| Daily stock recovery toward each port's baseline | Implemented | One unit per sailing day |
| Currency | Implemented as Gold | Coins are planned (below) |
| Coins at 50×, 5,000 starting balance | Planned | Stage 4 |
| Dynamic market (production, shortages, events, explained prices) | Partially implemented | Only stock movement and one fixed Chittagong salt event exist |
| Economic simulations | Planned | None exist, so no balance has been validated |

### Ships

| Feature | Status | Notes |
|---|---|---|
| River boat, Bora, Patello with distinct stats | Implemented | Prices are 500, 350 and 900 gold, with Coins not yet applied |
| Vessel access rules | Implemented | See section 8 |
| Up to three ships, each with its own cargo and hull | Implemented | Sold at Dhaka, Chittagong and Hooghly |
| Cannon, hull and hold upgrades; paid repairs | Implemented | Repair is 2 gold per hull, 3 for Patello |
| Automated two-port trade routes | Implemented | Patello trades up to 4 units per good per call, others 1 |
| Return orders for out-of-reach ships | Implemented | Free, and only for ships that can't otherwise be reached |
| Distinct art per vessel, plus a bullock cart | Implemented | |

### NPC traders

| Feature | Status | Notes |
|---|---|---|
| 4 named merchants who travel and trade | Implemented | Shared market stock, 3-item holds, budgets capped at 180 gold |
| At least 25 active NPC traders | Planned | Owner's requirement. Save validation currently assumes exactly the 4 existing merchants, so this needs a migration and performance testing |

### Property, family and progress

| Feature | Status | Notes |
|---|---|---|
| Warehouses | Partially implemented | One per port, 150 gold, 20 spaces, one-unit transfers. No reputation unlocks, capacity upgrades or network view |
| Farms | Partially implemented | One per port, 200 gold. They produce free rice by sailing day, which the plan replaces with paid, timed orders of several goods |
| Residence | Implemented as a location | One, for 250 gold, with no other effect |
| Marriage and household screen | Partially implemented | One-time action. Children, aging and inheritance don't exist |
| Reputation | Partially implemented | One global score, plus a 0–100 standing per city that has no effects yet |
| Reputation levels and political favours | Planned | Stage 8 |
| Three optional milestones | Implemented | |

### Missions and towns

| Feature | Status | Notes |
|---|---|---|
| Missions | Partially implemented | 60 fixed one-time offers (4 per port), two active at a time. Hundreds of generated missions and a journal are planned |
| Town scenes | Partially implemented | 15 towns, but they share 8 building drawings, 4 layouts and 4 settings. **This fails the agreed requirement for individual identities** |
| Building functions | Partially implemented | Market, Docks, Warehouse, Town centre, Home and Farm work. Mosque and Workshop only show text |
| Other planned buildings | Planned | Temple, church, inn, shipwright, customs house, granary, guardhouse, governor's residence, separate shipyard |

### Voyages and combat

| Feature | Status | Notes |
|---|---|---|
| Sailing at 1×, 2× and 4×, resuming without counting closed time | Implemented | |
| Chittagong first-arrival encounter | Implemented | One simple scripted fight |
| Fixed travel event every fifth voyage | Implemented | Pilot or rough water, with no choices |
| Varied voyage events with choices | Planned | Pirates, storms, discoveries and so on. Stage 10 |

### Online and monetisation

| Feature | Status | Notes |
|---|---|---|
| Vercel staging site | Implemented | Older version without login. See section 6 |
| Google sign-in, merchant names, 13+ check | Partially implemented | Works on the local copy only. Not yet on staging |
| Named commands and replay | Implemented | Every player action is recorded and can be re-checked |
| Server replay logic and database rules | Partially implemented | Tested locally. The server function isn't deployed |
| Cloud saves and linking | Blocked | Owner postponed until the main game is built |
| Leaderboards | Planned | Depends on cloud saves |
| Rewarded ads ("Merchant's Opportunity") | Blocked | Needs an Android app and Google Play and AdMob accounts. Nothing is built |

### Presentation

| Feature | Status | Notes |
|---|---|---|
| Teak, brass and paper interface, with phone, tablet and desktop layouts | Implemented | Tested in Chrome only, never on a real phone |
| Animated map (water, clouds) | Implemented | |
| Sound and music | Planned | None exists, and no plan is written |
| Tutorial | Planned | None exists |

## 3. Architecture

**Stack:** React 19, TypeScript, Vite PWA. Inline SVG plus baked WebP art. IndexedDB saves. Vitest and Testing Library. Supabase and Vercel for online parts.

| File or folder | Purpose |
|---|---|
| `src/game/model.ts` | Game rules and state (about 3,100 lines) |
| `src/game/commands.ts` | Named player commands, validated and applied |
| `src/game/replay.ts` | Rebuilds and checks a game from its commands |
| `src/game/navigation.ts` | Route planner and journey state |
| `src/game/transport-network.data.ts` | Generated network. Don't edit by hand |
| `src/game/travel-time.ts` | Journey timing |
| `src/game/save-format.ts` | Save validation and all migrations |
| `src/game/storage.ts` | IndexedDB saves and command log |
| `src/App.tsx` | Screens and panels (about 3,100 lines) |
| `src/components/BengalMap.tsx`, `CityScene.tsx` | Map and towns |
| `src/online/`, `src/components/AccountPanel.tsx` | Google sign-in |
| `src/server/`, `supabase/` | Server logic, database schema, Edge Function |
| `tools/nav/`, `tools/art/` | Generate the route network and art |

**Key rule:** new player actions must be added as commands, so that server checks keep working.

**Tests:** 420 passing across 18 test files, plus a passing type-check and production build, at the navigation commit.

## 4. Saves

**Current format:** version 20. The database itself stays at IndexedDB version 2. Older saves migrate step by step on load.

| Version | Added |
|---|---|
| 2–4 | Stock and routes, distance timing, sailing speed |
| 5–6 | Eight goods, cost basis |
| 7 | Chittagong introduction flag, voyage checkpoints |
| 8–11 | Reputation and milestones, warehouses, residence, farms |
| 12–13 | Household |
| 14 | Missions, local standing, travel events |
| 15–16 | NPC merchants and strategies |
| 17–18 | Player fleet, automated routes |
| 19 | Vessel classes, return orders |
| 20 | New route network. Voyages move to it at the same percentage of progress |

A repair on load also fixes saves affected by an earlier gold-peak bug. After a migration, the command log restarts and the game is marked `imported`, because old commands used old rules.

**Planned:** Coins would be version 21.

## 5. Navigation rebuild: implemented and committed, phone testing still to come

**Why:** the old routes were traced for an earlier map, so they crossed islands and towns and had almost no alternatives.

**What it does now:**
- Builds the network from the painted water, using `tools/nav/bake-network.mjs`.
- Treats a journey as water and land legs, with a stop to transfer cargo. The map, panel and journey time all read the same route data.
- Chooses the quickest route for each vessel, counting carts as 2.5× a River boat's time and a fixed transfer cost.
- Never uses ports as waypoints.
- Average detour is 1.66× straight-line distance. Balasore to Hooghly went from 5.4× to 2.6×.

**Where carts appear:** Balasore and Bakla-Chandradwip are always reached by cart from their landing. Sonargaon and Malda also have road landings. No port needs a long overland trip.

**Port panel:** the bottom panel is 62–66px by default, down from 152–206px, and floats over the map instead of shrinking it. A Details control opens the full information, and closing it keeps the selected port. The camera can move past the south edge, and opening the panel moves the map up. Phones keep one map scale and can drag in all directions. At 320×600 the map went from 258px to 464px tall.

**Map fix:** leaving the map used to destroy and rebuild it, which reloaded its images and lost the camera. A failed reload showed Chrome's broken-image icon stretched across the map. The map now stays mounted while hidden, and failed art retries with a message instead.

**Known limitations:**
- Only 7 of the 105 port-to-port routes were checked by eye.
- Roads avoid water and prefer fields, but some still cross painted buildings.
- Rajmahal to Tanda is still 5.3× straight-line distance, because the boat goes round Tanda's island. Chittagong to Sylhet is 3.3×.
- Three thin channels were added by hand, including the link to Sylhet's river, so the automatic water check can't independently confirm them.
- Water detection is colour-based and imperfect.
- Route depths are abstract game values.
- No source was found for bullock carts specifically in 1660s Bengal, only general regional evidence. The cart is labelled a game abstraction.

## 6. Commits and online status

| Commit | Contents | Pushed to GitHub |
|---|---|---|
| `92c9978` | Baseline: everything through old Stage 12C, made before version control | Yes |
| `433bfa5` | Docs clean-up, tests | Yes |
| `e747f9f` | Gold-peak save fix | Yes |
| `925dbc8` | Stage 13 design | Yes |
| `ba64730` | Stage 13 vessel classes, save version 19 | Yes |
| `02759fa` | Visual handoff document | Yes |
| `80c3fb7` | Visual redesign | Yes |
| `eb28e82` | Online Stage 1: commands and replay | Yes |
| `4645376` | Staging, navigation and town plans | Yes |
| `7f1fa25` | Online Stage 2: Google sign-in and profiles | Approved for push |
| Latest | Navigation rebuild, map fix and port panel, save version 20 | Approved for push |

| Service | Status |
|---|---|
| GitHub | Public repository, by the owner's choice, so that Vercel's free plan would build it. A history scan found no secrets. Commit names and an email are visible |
| Vercel staging | Live at https://bengal-trader-staging.vercel.app. The version it runs is shown in the game under More. The two Supabase settings aren't added, by the owner's choice. The free Hobby plan is non-commercial, so the game must move to a paid plan or another host before revenue |
| Supabase | Project created in Mumbai. Both database migrations are applied. The Edge Function isn't deployed. Free projects may pause after a quiet week |
| Google login | Tested by the owner once on a local copy, successfully. Only listed test users can log in until the Google app is published |
| Cloud saves | **Blocked by choice:** postponed until the main game is built. Tables exist but nothing uses them |

**Needs checking:** the owner was asked to replace a Google client secret that was exposed in a screenshot, and answered "yes" to a combined question. That should be confirmed directly.

## 7. Outstanding requirements

| Requirement | Status | Current state |
|---|---|---|
| Distinct identity for all 15 towns | Partially implemented | Plan in `TOWN_IDENTITY_PLAN.md`. Today's towns fail its acceptance test. Religious placements and several town histories still need research |
| At least 25 active NPC traders | Planned | 4 exist. Not yet in a numbered stage |
| Dynamic markets | Partially implemented | Stage 5 |
| Coins (50×) | Planned | Stage 4 |
| Paid farm production orders | Planned | Stage 6. Needs a trusted clock for real-time timers, which is weak until cloud saves exist |
| Warehouse network | Partially implemented | Stage 7 |
| City unlocks and reputation levels | Planned | Stage 8 |
| Every building functional | Partially implemented | Stage 9 |
| Hundreds of missions, journal | Partially implemented | Stage 9. About 40 templates and 8–10 chains are planned |
| Voyage events with choices | Partially implemented | Stage 10 |
| Leaderboards | Planned | Stage 11 |
| Rewarded ads | Blocked | Stage 12 |
| Android app | Planned | Stage 12. Needed because verified ad rewards rely on AdMob in a native app |
| Economic simulations | Planned | Tools at Stage 4, full pass at Stage 13 |
| Real-phone testing | Planned | A later dedicated phase, by the owner's decision |

## 8. Agreed decisions and constraints

**Game rules:**
- **Five-minute cap:** no voyage exceeds five minutes at normal speed. The longest River boat route defines that length. Only the Patello hits the cap: 15 of its 182 routes, the longest of which would otherwise take about 7 minutes. Kept for now, with a review during simulations.
- **Time:** one sailing minute is one in-game day. Closed-app time never advances voyages or markets. Farms and ads are planned to use real time.
- **Vessels:** River boat and Bora reach all 15 ports. Patello can't reach Sylhet or Balasore by any route, including by land. Land travel is not a way round this rule.
- **Cargo in transfers:** never duplicated, lost or sold. It stays in one record.
- **Starting cities (planned):** Dhaka, Sonargaon, Hooghly, Chittagong, Satgaon. Unlocks are permanent.
- **Coins:** old saves convert at exactly 50×, and new games start with 5,000.
- **Markets (planned):** each player has a private market with shared world events, not one market shared by everyone.
- **Ads:** optional, never during critical moments, verified on the server, at most 5 a day, every 12 minutes. Alternative rewards. No interstitial ads at launch. Web version has no ad rewards.
- **Leaderboards:** server-calculated only, using fixed reference prices. Old imported saves stay unranked.

**Technical and process:**
- Offline play must keep working. Existing saves must keep working.
- Secret keys never reach the browser or the repository. Commands must be used for all player actions.
- One commit per reviewed stage, with tests and build passing and a report. Nothing is committed without approval, and a basic version doesn't count as complete.
- **Login and cloud-save setup are postponed** until the main game is built.
- Claude makes technical and balance decisions and records them. The owner decides on accounts, credentials, legal matters and commits.

## 9. Bugs, gaps and risks

**Known bugs and rough edges:**
- The voyage panel, shown while travelling, is still large and can cover part of the south on desktop. Ports can't be selected during a voyage.
- When the port panel is open, the far north can move off-screen until dragged, and a plain sea-coloured strip can show below the painting.
- Roads cross some buildings (section 5).
- The Fleet card still says "At sea" for a ship on a cart.
- The welcome notice covers the top of the More menu on phones.
- On landscape phones, two map labels overlap something.
- A failed load always says "unsupported version", whatever the real cause.
- Button names read by screen readers sometimes differ from visible text.

**Incomplete work:**
- No save backup or export exists, and there is no way back from a bad migration.
- Two open tabs can overwrite each other's save and mix up the command log. This must be fixed before cloud saves.
- `BengalWorldArt.tsx` is unused. Parts of `ARCHITECTURE.md`, `GAME_DESIGN.md` and `FULL_GAME_PLAN_AUDIT.md` are out of date.
- The Edge Function still uses Supabase's retiring key name.
- No filter for offensive merchant names. Non-Latin names are untested.

**Technical and business risks:**
1. **Economy balance:** nothing has been simulated. An earlier measurement on the old routes found one route (Hooghly to Satgaon) far more profitable than the rest. Journey times have since changed, and this hasn't been remeasured.
2. **Scale:** most of the planned game is still unbuilt.
3. **Delaying cloud saves:** each new system adds saved data, and real-time farms can't be fully trusted without a server clock. Everything must stay in the command system so this can be added later.
4. **Performance with 25+ traders:** untested. The current planner is not optimised for many routes per day.
5. **Large source files:** `model.ts` and `App.tsx` are each about 3,100 lines.
6. **Ad income:** five ads a day caps revenue. At an assumed $10 per 1,000 views, that's at most $0.05 per active player per day.
7. **Hosting terms:** Vercel's free plan excludes commercial use.
8. **Age and content:** ads, accounts, opium as a good, and religious buildings all need care and legal review. Privacy policy and terms don't exist yet.
9. **Real devices:** never tested on a phone, with touch gestures or with a screen reader.

## 10. Next stages

**Roadmap order in `ONLINE_EXPANSION_PLAN.md`:** Stage 3 cloud saves, 4 Coins and simulation tools, 5 markets, 6 farms, 7 warehouses, 8 unlocks and reputation, 9 buildings, missions and towns, 10 voyage events, 11 leaderboards, 12 Android and ads, 13 full simulations.

**Recommended order now,** since cloud saves are postponed:

1. **Review and commit navigation, the map fix and the port panel,** then push so staging catches up.
2. **Coins and simulation tools** (Stage 4). Later balance depends on them.
3. **Dynamic markets, with the 25 NPC traders** (Stage 5). Traders are the main force on stock and prices, so they should be built and balanced together.
4. **Farms, then warehouses** (Stages 6–7), using the device clock for now, with that weakness recorded.
5. **City unlocks and reputation** (Stage 8).
6. **Buildings, missions and town identities** (Stage 9).
7. **Voyage events** (Stage 10).
8. **Full balancing** (Stage 13), before any online systems, so they launch on a stable economy.
9. **Cloud saves, then leaderboards** (Stages 3 and 11), once the main game is built, as the owner decided.
10. **Android, ads and real-phone testing** (Stage 12).

**The choice to weigh:** this order delays cloud saves and server trust to the end, so more saved data must eventually be migrated and verified at once. It keeps the owner's decision and gets the game itself playable sooner. The command system exists to make that later step manageable, but it will still be a substantial stage.
