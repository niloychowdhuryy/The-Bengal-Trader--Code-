# Architecture

## Stack and boundaries

- **React + TypeScript** provide screens and accessible touch/keyboard controls.
- **Vite 8** serves the mobile/LAN development preview at `http://localhost:5173`, with HMR, and builds the app.
- **React + inline SVG** render the map and city scenes. Vessel art lives under `src/components/map-art/`; camera pan and zoom are viewBox state in `BengalMap`, while route, port and ship positions remain in the existing world coordinates. Phaser is not used: this game needs layered illustration, camera gestures and accessible controls, not physics or a scene engine.
- **Baked art:** `tools/art/bake-art.mjs` turns `asset-backups/bengal-world-map-master.png` into the served map, water and texture WebP files in `public/images/`. It paints out the name plates in the source painting and applies the colour grade. Rerun it to change either.
- **IndexedDB** stores the offline save. The production PWA build precaches the app shell.
- **Vitest + Testing Library** cover navigation, gameplay, UI, migration and persistence.

Game rules and data stay separate from rendering. No external image host or online service is needed to play.

## River network and drawing

`src/game/navigation.ts` is the transport network and planner. `tools/nav/bake-network.mjs` generates `src/game/transport-network.data.ts` by detecting painted water and tracing its centre lines, with a few thin channels added by hand. Rerun it if the painting changes. Routes are lists of water and land legs, and `getRouteStateAt` gives the position, vehicle and transfer state at any moment, for drawing and timing alike. `planRoute` minimises time per vessel, including carts at 2.5× and a fixed transfer cost. Ports are never waypoints, and vessels' `barredPorts` apply by any route.

Older notes on the graph:

- `RIVER_NODES` holds the named junctions and port locations.
- `RIVER_EDGES` holds connected endpoints, ordered artwork coordinates and an explicitly approximate minimum-depth value.
- `planRiverRoute` finds the least-distance open route. It accepts event, military and weather blockage lists plus an optional vessel draft. No route means no voyage.
- `buildRiverRoute` assembles an edge sequence into an ordered path. `pointAlongRiverRoute` interpolates by travelled distance along its segments.
- `riverPointsToSvgPath` serializes those same points for the visible waterway and preview route.

`src/components/map-art/VesselArt.tsx` draws a distinct boat for each vessel class; `BengalTradingVessel.tsx` places one on the map.

On touch screens, a dock's ships share one target of at least 44 pixels, which lists them if there's more than one. Moving ships get a 44-pixel target on every device.

`BengalMap` stays mounted but hidden while the player is in town, so it keeps its camera and loaded art. If the art fails it shows a message and retries, never a broken image. `src/components/BengalMap.tsx` stacks separate layers that share one viewBox: the painted map, two cross-fading water plates, drifting cloud layers, and the route, ship and port overlay. Keeping the painted layers apart means the browser animates them without repainting the overlay. Markers keep one on-screen size at every zoom, and the camera follows the ship during a voyage until the player drags the map. It supports pointer drag, mouse-wheel zoom and camera buttons; camera movement changes only the viewBox, not navigation, voyage timing, saves or other game state. Phones drag in all directions at one fixed map scale. The port panel (`PortContextPanel`) reports how much of the map it covers, and the camera may move past the south edge by that amount, so the south can always be brought above it. Opening the panel moves the view up, and closing it restores the view.

Port marker coordinates derive from the canonical port nodes. Thus the route shown, route planned and route travelled share one source. The graph deliberately describes a navigable game network, not accurate 17th-century hydrographic data. Depth restrictions apply per vessel class; no historical depth survey is implied. A draft above 1.5 would split the network, so `vessel-classes.test.ts` checks that every class has one connected network containing all shipyards.

The current simple network has no alternate loops. Closing a bridge channel can make a port unreachable. Add a documented game route or historically supported passage before promising detours.

## Gameplay and economy

- `src/game/model.ts` owns game state transitions: start/arrival, cargo, prices, ship upgrades, repair, the encounter, active route conditions, reputation and milestones, warehouses, residence, farms, household, missions and local standing, NPC merchants, the player fleet, vessel classes, return orders and automated trade routes.
- Town base prices are separate from town inventory. Every `marketStock[town][good]` is finite, saved, modified by each transaction and used to calculate the next quote. There are no random per-second market changes.
- `advanceWorld` is the one world clock. Each whole in-game sailing day runs once, in a fixed order: stalls recover, then NPC merchants act, then automated ships. Stalls close 6–12% of the gap to their starting-stock baseline, at least 1–3 units, by supply or demand tier. Farm output is still credited on arrival, from its own saved day. The update is deterministic and bounded; loading a save and closing the app do not advance markets.
- `getGoodPrice` is the one price function, for the player, NPCs and automated ships. Prices stay within 40–250% of base, in steps of 5 Coins. Buying from stock `s` uses the price at `s`, and selling into stock `s` uses the price at `s + 1` less 12%, so a unit meets the same price both ways and no sequence of trades at a stall can earn money without time passing.
- Save data migrates from game format version 1 to 2 (initial local stall stock and voyage routes), then to version 3 (distance-scaled travel timing and fractional game days). Later steps continue through game format version 28 in `src/game/save-format.ts`. The IndexedDB object-store schema remains version 2; no destructive database changes are made.
- `src/game/travel-time.ts` is the single travel clock: it finds the longest navigable route from the port graph, scales normal durations proportionally to five minutes, and converts active sailing minutes directly to fractional in-game days. Voyage progress is checkpointed while the app is visible and on page hide; closed-app wall time is not counted. The Chittagong alert can add up to one game day but is capped at five minutes.
- `navigationConditions` separates event, military and weather closures. The Chittagong event changes travel time and salt quotes only; it is not misrepresented as a documented closure.
- Later simulation additions must use the same in-game clock, not wall-clock prices or closed-app catch-up.
- NPC merchants and automated trade routes follow that rule: `advanceWorld` processes whole in-game sailing-day checkpoints, trades against the same market stock and plans travel with the shared route planner. Neither runs while the game is closed.

Implemented integration points are per-town standing, residence and household, warehouses, farms, deadline-based contracts, the player fleet and two-port automated routes. Vessel stats are looked up from `VESSEL_CLASSES` by each ship's saved `vesselClass`. `getShipRouteConditions` merges a ship's draft into route planning for player and automated ships; NPC merchants plan with their own ship's draft and barred ports. The save validator does not check draft on saved routes, so a later rebalance makes a route wait rather than making a save unloadable. The current model does not yet simulate captains, cargo handoffs, shipment loss or remote property management.

## Merchants

`src/game/npc-roster.ts` lists the 26 fictional merchants: identity, ship, starting Coins, strategy, temperament and goods. `src/game/npc.ts` runs one day for all of them, called by `advanceWorld`. `npc.ts` and `model.ts` import each other, so nothing in `npc.ts` may use the model while loading.

Each merchant acts once a day, in an order drawn from `worldSeed`, the day and its id, and nothing random is stored. At sea, the voyage counts down. On arrival, it sells what meets its price floor, and stays 1–2 days. When ready, it sells again, may invest, then `chooseTrip` estimates the profit per day to each port it may reach with its ship. `loadCargo` buys one unit at a time. The first unit must clear the entry margin, which is what justifies the voyage. After that it keeps buying any traded good while the next unit clears a lower load margin, which is scaled by ship so bulk carriers go further. Merchants leave stalls at 40–160% of usual stock. `shipWorthBuying` estimates whether a bigger ship would repay itself from the merchant's own record. Merchants can see goods already heading to a port, which is how they avoid each other. Their idea of a distant price is off by a repeatable amount, more for bold merchants.

Purses change only through trade, crew costs and investment, with no cap. Everything here goes through `getGoodPrice` and `getMerchantRoute`, which applies vessel limits, and the same route is drawn on the map. Harness tests check that no goods appear, purses grow only with sales, and ships only move by finishing a journey.

## Interface and scenes

- `src/App.tsx` manages the save lifecycle, main navigation, selected port, contextual panels and current city.
- `src/components/BengalMap.tsx` is the dominant world scene with selectable accessible ports, a route preview and a visual-only pan/zoom camera.
- `src/components/CityScene.tsx` composes the current-port town, accessible building targets and selected-building context. `city-art/iso.tsx` is a small isometric drawing kit, `CityBuildingArt.tsx` draws the buildings with it, and `city-layout.ts` gives each of the 15 ports a setting (delta, coast, upland or plains), a layout and a seed for its scenery. Market, Docks, Warehouse, Town centre, Home and Farm open the existing functional panels; Mosque and Workshop explicitly state their current or planned role.
- Town scenes are original inline SVG. Portrait screens show the town at full width with more land and water above and below. Ambient water, boat, smoke and figure motion is CSS-based and reduced-motion aware. Artwork is illustrative rather than a reconstruction of a documented street plan or named buildings.
- Trade, Docks and Fleet are quick actions. Politics, Family, Properties and Notifications are grouped in More. Drawer close returns to the underlying map or city; Map is always a quick exit.
- `src/styles.css` defines the carved-teak, brass and ledger-paper interface: design tokens, portrait, landscape-phone and desktop layouts, touch targets, overlays and reduced-motion behavior. Fonts are served locally from `public/fonts/`.

## Commands and replay

Player actions never change game state directly. `src/App.tsx` calls `dispatch(command)`, and `src/game/commands.ts` validates and applies it through `applyCommand(state, command, at)`, which is pure. Commands also enforce rules the interface otherwise relies on, such as no trading at sea and no arriving before a voyage has finished.

Applied commands are numbered and written in the same IndexedDB transaction as the save (`commitGame` in `src/game/storage.ts`), so the saved game always equals its base state plus its log. Log records share the existing `save` object store, under `command-log:` keys, so the database version is unchanged. Refused and no-effect commands aren't recorded. A game started from an existing save is marked `imported`, because its earlier history can't be proved.

`src/game/replay.ts` rebuilds state from commands. A batch is all or nothing, and it's refused if numbering has gaps, a verified command is rewritten, time runs backward or beyond the moment it arrived, a command is refused by the rules, or the result fails save validation.

The voyage clock is the one exception to recording. Background checkpoints aren't logged, because any command during a voyage first brings it up to that command's time, so they don't change the result. Resuming records when the voyage paused, so closed-app time still counts for nothing. New player actions must be added as commands.

## Server foundation

`src/server/sync.ts` handles a batch of commands independently of any platform, and `src/server/supabase-store.ts` connects it to Supabase. `npm run build:server` bundles them with the game rules into `supabase/functions/_shared/game-server.js` (generated, not committed) for the Edge Function in `supabase/functions/sync/`. `supabase/migrations/` holds the schema: players can read their own records, and every write goes through server functions using the service role, whose key exists only in Supabase's secrets.

The browser game doesn't import any of this. Cloud saves connect it in Stage 3.

## Accounts

`src/online/config.ts` reads the public `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, set in Vercel and in a local, uncommitted `.env.local`. Without them the game stays offline with no login shown, and it refuses a secret key. `src/online/account.ts` wraps Google sign-in and loads `supabase-js` separately, so offline play never depends on it. `src/components/AccountPanel.tsx` is the interface. A database trigger creates each profile, and `complete_profile` is the only way to change one. Signing out touches only the session, never the saved game. Accounts aren't connected to saves yet.

## Save and offline behavior

`src/game/save-format.ts` holds the pure validation and migrations, and `src/game/storage.ts` the IndexedDB access. Together they validate bounded game data before restoring it, migrates earlier game saves through game-state version 28, preserves cargo, market stock, progression, property, household, missions, NPC merchants, the player fleet, automated routes, warehouse inventories and cost basis, and surfaces IndexedDB errors. On load it also raises a recorded gold peak that is below current gold, because an earlier route-cancellation bug could save that state; other invalid data is still rejected. Version 6 voyages keep their last persisted elapsed-time checkpoint and are re-anchored on load; older voyage formats without a saved progress checkpoint restart the in-progress voyage at its current route duration instead of deriving progress from wall-clock time. Version 7 also persists whether the Chittagong introduction has occurred. A production service worker precaches the app shell for offline reopening after first visit. The dev server intentionally does not register a service worker so HMR remains reliable.

## Simulation harness

`src/sim/` plays the real game headlessly: scripted players (`strategies.ts`) send real commands through `driver.ts` on a virtual clock, so every run can be rebuilt by replay. `experiments.ts` measures one behaviour each, such as route income, stock recovery, the NPC world and known exploits. `baseline.ts` gathers these into a record with no dates or machine details, so the same rules always give the same record, and `report.ts` writes it up. Nothing in `src/sim/` is part of the game bundle.

`npm run sim` writes the current measurements to `sim-reports/` (not committed). The gold-era record in [ECONOMY_BASELINE.md](./ECONOMY_BASELINE.md), the recorded game (`recorded-game.ts`, using every kind of command) and the test save `src/game/__fixtures__/save-v20.json` were recorded once, on version 20 rules, and nothing rewrites them. These records stay in gold, and later rules are compared against them. `npm run sim:freeze` now records the current baseline and rewrites the results at the top of [ECONOMY_BASELINE.md](./ECONOMY_BASELINE.md), through `comparison.ts`. `src/sim/benchmarks.ts` adds the economy rebalance's benchmarks beside the baseline: 22 strategies on 5 seeds to day 400, including the skilled bot (the engaged player), the basic manual bot (the casual player) and mixed play, checked against 20 targets. `src/sim/ledger.ts` notes where each Coin came from and went, only by reading each command's effect, and a run's income and spending must add up to its change in Coins. `npm run sim:freeze` records them for the current save version, in `economy-benchmark-v<N>.json` and [ECONOMY_BENCHMARKS.md](./ECONOMY_BENCHMARKS.md). `economy-baseline-v25.json` and `economy-benchmark-v25.json` stay frozen as the record before the rebalance, and the report compares against them. Normal tests check the current baseline while the save version matches it. Known problems have tests that describe them, and a stage that fixes one changes its test to require the fix.

## Coins and save safety

`getRecoveryOptions` and `isStranded` in `model.ts` decide whether a player has any way left to raise money, and `takeRescueLoan` and `repayDebt` are ordinary commands, so they replay like the rest. The recorded game is frozen at version 20, so these two commands are excluded from its coverage check and tested in `rescue.test.ts`.

`src/game/leaderboard.ts` holds the game's one net worth valuation, which the harness's `estimateNetWorth` now uses, and the offline rankings. `advanceWorld` calls `refreshLeaderboards` at the end of each world day, so a count sits inside the same deterministic clock and replays exactly. `GameState.leaderboards` stores only the latest count: each entry has an id, a value, a rank and its previous rank, so movement needs no second snapshot. Names and details are read from live state. Influence reads `reputation` for the player and merchants alike, and doesn't read `localStanding`, because merchants don't have it. `src/components/Leaderboards.tsx` draws them.

Saves before version 21 count in gold. `migrateToCoins` multiplies every amount by 50 and renames the fields, as the last step of the chain, so older steps must add gold values: `createGoldMissionBoard`, `createGoldNpcMerchants`, `createOldMarketStock` and the version 6 cost estimate exist to stop today's templates being converted twice. The gold-peak repair checks a gold amount, so it runs just before the conversion. `migrateToWorldClock` (version 22) triples stock, keeping each stall's share of it, and applies any recovery a voyage under way was still due, so no day is skipped or counted twice.

`openGameSession` writes the original save and its command log to `save-backup:migration:v<version>` in the same IndexedDB transaction as the upgraded save. An interruption leaves the untouched original, and a save that fails to migrate is never written. Starting a new game keeps the old save at `save-backup:new-game`, and restoring keeps what it replaced at `save-backup:before-restore`. Copies are listed under **More → Save backups**, where they can be downloaded or restored. A restored save upgrades again on the next load. Backups share the save's browser storage, so clearing site data removes them too, and there's no import from a downloaded file yet.

A save from a later version raises `NewerSaveError`: the game asks for a reload and offers nothing that could replace it. Writes also refuse to overwrite a newer save, which protects saves from a tab left open across an update.

## Verification commands

- `npm run test`
- `npm run build`
- `npm run sim`
- `npm run dev` (LAN binding is configured in Vite on port 5173)

The `dist/` folder contains the production build and generated service worker.
