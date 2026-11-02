# Architecture

## Stack and boundaries

- **React + TypeScript** provide screens and accessible touch/keyboard controls.
- **Vite 8** serves the mobile/LAN development preview at `http://localhost:5173`, with HMR, and builds the app.
- **React + inline SVG** render the map and city scenes. The map prototype's reusable original terrain and vessel art lives under `src/components/map-art/`; camera pan and zoom are viewBox state in `BengalMap`, while route, port and ship positions remain in the existing world coordinates. Phaser is not used: this prototype needs layered illustration, camera gestures and accessible controls, not physics or a scene engine.
- **IndexedDB** stores the offline save. The production PWA build precaches the app shell.
- **Vitest + Testing Library** cover navigation, gameplay, UI, migration and persistence.

Game rules and data stay separate from rendering. No external image host or online service is needed to play.

## River network and drawing

`src/game/navigation.ts` is the canonical navigation graph:

- `RIVER_NODES` holds the named junctions and port locations.
- `RIVER_EDGES` holds connected endpoints, ordered artwork coordinates and an explicitly approximate minimum-depth value.
- `planRiverRoute` finds the least-distance open route. It accepts event, military and weather blockage lists plus an optional vessel draft. No route means no voyage.
- `buildRiverRoute` assembles an edge sequence into an ordered path. `pointAlongRiverRoute` interpolates by travelled distance along its segments.
- `riverPointsToSvgPath` serializes those same points for the visible waterway and preview route.

`src/components/map-art/BengalWorldArt.tsx` paints the prototype's top-down floodplain, paddies, woodlands, islands, generalized port clusters and broad river channels. Its navigable channel strokes use the river graph; narrower wetland creeks are illustrative scenery only and do not add routes.

`src/components/map-art/BengalTradingVessel.tsx` draws the original wooden trading boat used by the world view.

`src/components/BengalMap.tsx` draws the selected route and moving vessel, preserves accessible port controls, and supports pointer drag, pinch zoom, mouse-wheel zoom and camera buttons. Camera movement changes only the SVG viewBox; it does not change navigation, voyage timing, saves or other game state.

Port marker coordinates derive from the canonical port nodes. Thus the route shown, route planned and route travelled share one source. The graph deliberately describes a navigable game network, not accurate 17th-century hydrographic data. Depth restrictions apply per vessel class; no historical depth survey is implied. A draft above 1.5 would split the network, so `vessel-classes.test.ts` checks that every class has one connected network containing all shipyards.

The current simple network has no alternate loops. Closing a bridge channel can make a port unreachable. Add a documented game route or historically supported passage before promising detours.

## Gameplay and economy

- `src/game/model.ts` owns game state transitions: start/arrival, cargo, prices, ship upgrades, repair, the encounter, active route conditions, reputation and milestones, warehouses, residence, farms, household, missions and local standing, NPC merchants, the player fleet, vessel classes, return orders and automated trade routes.
- Town base prices are separate from town inventory. Every `marketStock[town][good]` is finite, saved, modified by each transaction and used to calculate the next quote. There are no random per-second market changes.
- On arrival, full in-game sailing days crossed advance market stock by one unit per stall toward its existing starting-stock baseline. The update is deterministic and bounded; loading a save and closing the app do not advance markets.
- Current buy quotes are bounded to 1–156 gold; sell quotes use the existing three-gold spread and one-gold floor.
- Save data migrates from game format version 1 to 2 (initial local stall stock and voyage routes), then to version 3 (distance-scaled travel timing and fractional game days). Later steps continue through game format version 19 in `src/game/storage.ts`. The IndexedDB object-store schema remains version 2; no destructive database changes are made.
- `src/game/travel-time.ts` is the single travel clock: it finds the longest navigable route from the port graph, scales normal durations proportionally to five minutes, and converts active sailing minutes directly to fractional in-game days. Voyage progress is checkpointed while the app is visible and on page hide; closed-app wall time is not counted. The Chittagong alert can add up to one game day but is capped at five minutes.
- `navigationConditions` separates event, military and weather closures. The Chittagong event changes travel time and salt quotes only; it is not misrepresented as a documented closure.
- The Stage 4 simulation advances market stock on voyage arrival from whole sailing days credited, using a bounded one-unit-per-day recovery toward existing profile stock. Later simulation additions must use the same in-game clock, not wall-clock prices or closed-app catch-up.
- NPC merchants and automated trade routes follow that rule: `advanceNpcWorld` processes whole in-game sailing-day checkpoints, trades against the same market stock and plans travel with the shared route planner. Neither runs while the game is closed.

Implemented integration points are per-town standing, residence and household, warehouses, farms, deadline-based contracts, the player fleet and two-port automated routes. Vessel stats are looked up from `VESSEL_CLASSES` by each ship's saved `vesselClass`. `getShipRouteConditions` merges a ship's draft into route planning for player and automated ships; NPC merchants plan without draft. The save validator does not check draft on saved routes, so a later rebalance makes a route wait rather than making a save unloadable. The current model does not yet simulate captains, cargo handoffs, shipment loss or remote property management.

## Interface and scenes

- `src/App.tsx` manages the save lifecycle, main navigation, selected port, contextual panels and current city.
- `src/components/BengalMap.tsx` is the dominant world scene with selectable accessible ports, a route preview and a visual-only pan/zoom camera. The illustrated terrain and vessel components are kept separate from game rules and organized under `src/components/map-art/`.
- `src/components/CityScene.tsx` composes the current-port city environment, accessible building targets and selected-building context. Reusable building illustrations live in `src/components/city-art/CityBuildingArt.tsx`; `city-layout.ts` separates building definitions from the Dhaka prototype and a generic port fallback so later towns can use their own placements. Market, Docks, Warehouse, Town centre, Home and Farm open functional panels; the city scene remains visible behind those overlays. Mosque and Workshop explicitly state their current or planned role.
- The Dhaka city scene is original inline SVG: a connected riverfront settlement with layered streets, paths, vegetation, courtyards, docks, boats and varied building silhouettes. Ambient water, boat, smoke and figure motion is CSS-based and reduced-motion aware. Artwork is illustrative rather than a reconstruction of a documented street plan or named buildings.
- Trade, Docks and Fleet are quick actions. Politics, Family, Properties and Notifications are grouped in More. Drawer close returns to the underlying map or city; Map is always a quick exit.
- `src/styles.css` defines the portrait-first screen, touch targets, desktop sizing, illustration palette, overlays and reduced-motion behavior.

## Save and offline behavior

`src/game/storage.ts` validates bounded game data before restoring it, migrates earlier game saves through game-state version 19, preserves cargo, market stock, progression, property, household, missions, NPC merchants, the player fleet, automated routes, warehouse inventories and cost basis, and surfaces IndexedDB errors. On load it also raises a recorded gold peak that is below current gold, because an earlier route-cancellation bug could save that state; other invalid data is still rejected. Version 6 voyages keep their last persisted elapsed-time checkpoint and are re-anchored on load; older voyage formats without a saved progress checkpoint restart the in-progress voyage at its current route duration instead of deriving progress from wall-clock time. Version 7 also persists whether the Chittagong introduction has occurred. A production service worker precaches the app shell for offline reopening after first visit. The dev server intentionally does not register a service worker so HMR remains reliable.

## Verification commands

- `npm run test`
- `npm run build`
- `npm run dev` (LAN binding is configured in Vite on port 5173)

The `dist/` folder contains the production build and generated service worker.
