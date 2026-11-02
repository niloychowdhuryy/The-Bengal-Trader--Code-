# Full Game Plan Audit

## Purpose and scope

This audit compares the current design and roadmap with the running implementation. It is a planning document only: no application code, game rules, tests, prices, routes, or save data were changed.

The review covered [GAME_DESIGN.md](./GAME_DESIGN.md), [GAME_RULES.md](./GAME_RULES.md), [ROADMAP.md](./ROADMAP.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [ART_GUIDE.md](./ART_GUIDE.md), [MAP_ROUTE_NOTES.md](./MAP_ROUTE_NOTES.md), [TRADE_ECONOMY_DESIGN.md](./TRADE_ECONOMY_DESIGN.md), [CITY_ECONOMIC_IDENTITY_AUDIT.md](./CITY_ECONOMIC_IDENTITY_AUDIT.md), and [HISTORICAL_EVENTS.md](./HISTORICAL_EVENTS.md). The implementation review covered `src/App.tsx`, `src/game/model.ts`, `src/game/storage.ts`, `src/game/navigation.ts`, `src/game/travel-time.ts`, `src/game/city-economic-identities.ts`, `src/components/BengalMap.tsx`, `src/components/CityScene.tsx`, `src/components/city-art/city-layout.ts`, `src/styles.css`, and the six test files under `src/`.

## Executive summary

**What exists:** A local, offline-friendly game prototype with an illustrated map, 15 selectable ports, continuous waterway routes, a moving ship, adjustable sailing speed, a deterministic eight-good market, finite local stall stock, cargo accounting, one ship with purchasable upgrades, a small encounter, an illustrated city scene, and IndexedDB saves with migrations.

**What does not exist yet:** A guided tutorial, evolving market simulation, NPC merchants, repeatable mission system, progression levels or reputation, city/good unlocks, functioning politics, homes or family, farms or workers, owned properties, multiple ships, fleet automation, a defined endgame, and online features.

**Main planning risk identified by the original audit:** The roadmap did not settle key rules for calendar/offline simulation, progression, encounters, and long-term goals before placing large systems. It also inverted fleet dependencies and mixed older economy workstream labels with the roadmap sequence.

**Current recommendation:** The overall direction and defaults in [CORE_GAME_RULES.md](./CORE_GAME_RULES.md) are approved. Resolve implementation of time/save behavior before simulation, define progression before property and household systems, and define ships/routes before automated fleets. Keep online features optional and last.

## Status labels

- **Implemented:** The behavior exists in the application and is exercised by code or tests.
- **Partial prototype:** A screen, data hook, or narrow example exists, but not the full system described.
- **Documented only:** The design describes a system, but there is no corresponding playable implementation.
- **Not yet designed:** The project does not define enough rules to implement the system consistently.

## 1. Current implementation status by system

| System | Status | What the repository actually implements |
|---|---|---|
| New game and first session | Partial prototype | The player names a captain and starts in Dhaka with 90 gold, 2 rice, 1 muslin, a 12-unit hold and a basic ship. The start screen has a short premise and a continue option, but no guided tutorial, staged objectives or contextual teaching sequence. |
| World map and port access | Implemented | Fifteen ports are selectable. Route planning, preview, travel timing and ship movement use the same connected river graph. The graph and map are explicitly gameplay abstractions, not verified historical hydrography. |
| Sailing and calendar | Implemented, narrowly scoped | The longest normal route is capped at five real minutes. Speeds are 1×, 2× and 4×; speed can change while sailing and is saved. The voyage's in-game days are credited on arrival. The displayed year is derived from `1665 + floor(sailingDay / 45)`; there is no month/day calendar or continuous on-screen date advancement during a voyage. |
| Encounters and combat | Partial prototype | There is one deterministic Chittagong raider encounter. It asks for one “Protect the cargo” action and calculates the result from the ship's attack, defence and hull. It has no tactical choices, random generation, cargo theft or general combat loop. The introduction now triggers only on first arrival and its completion flag is saved. |
| Market and trading | Implemented foundation | All eight goods can be traded in all 15 cities. Each city has supply/demand tiers; missing tier entries use neutral tier 2. Initial stock is 16, 20 or 24, capped at 40. Quotes depend on tiers and current stock, each trade changes stock, bulk quotes adjust per unit, and the player cannot exceed funds, hold, inventory or market capacity. |
| Market over time | Implemented bounded foundation | Player trades change stock immediately. On arrival, each whole sailing day crossed moves every stall one unit toward its existing profile-based starting stock, bounded at 0–40. The existing Chittagong salt alert remains the only temporary market event. There is no NPC trade, production, consumption, shipment, spoilage or seasonality. |
| City economic identities | Partial, descriptive data | `city-economic-identities.ts` has 120 city-good identity records with role, evidence basis, confidence, notes and source IDs. This is not connected to price profiles, market stock, availability, UI or save data. Tests check completeness and label constraints, not whether every historical claim is independently correct. |
| Cargo cost basis | Implemented | Purchases use weighted-average cost; partial sales retain the remaining cost basis, and selling the final unit clears it. The saved version-7 state records it. Old version-5 cargo receives an estimate from the current local buy quote because its old purchase basis is unknown. |
| Ship upgrades and repairs | Implemented for one ship | Cannon, hull and hold upgrades alter actual stats/capacity; repairs cost gold. They are dock-only. There are no classes, crew, captains, ship purchases or multiple vessels. |
| City screen and services | Partial prototype | The city is an illustrated SVG scene with tappable buildings. Dhaka has its own placement; other cities use a shared generic layout and backdrop. Market and Docks work. Warehouse, town centre, mosque, home, workshop and farm are informational placeholders, not operating services or owned buildings. |
| Reputation, politics and city access | Documented only | The More menu shows a placeholder panel. There is no reputation state, authority interaction, permission system, tax, embargo, level progression or city/good lock. All 15 destinations and eight goods are intentionally open in the current test build. |
| Levels and unlocks | Not yet designed | The earlier product brief describes a future start with four goods and five cities, followed by unlocking more through levels, gold, reputation and eventually farm ownership. No level rules, thresholds, order, interface or save model are specified or implemented. Do not apply those locks to the current build without approval. |
| Homes, family and dynasty | Documented only / under-defined | A home and family are described in the More panel and game design, but there are no relationship, marriage, child, household, inheritance or succession records or mechanics. The consequences of time, aging, succession and loss are not specified. |
| Farms, production and workers | Documented only / under-defined | Farms and workshops appear as city affordances and future properties. There are no purchases, workers, costs, production recipes, output storage, operating risks, ownership records or interactions with local markets. |
| NPC merchants, fleets and contracts | Documented only | The Fleet panel reports the one ship's stats. There are no NPC traders, shipments, multiple ships, hired captains, automated routes, cargo handoffs, delivery contracts or deadlines. |
| Missions and city services | Not yet designed | The documents mention choices, relationships, and future contracts, but do not define a mission structure, repeatable task loop, reward/penalty rules, or a full set of civic services. |
| Historical events | Partial prototype | A Chittagong campaign-inspired alert has a day-window, a capped route delay and a salt-price modifier. Historical facts and fictional effects are distinguished in the UI and documentation. There is no reusable dated event engine, event choice system, broad event schedule or general market/route consequence framework. |
| Save and offline play | Implemented foundation | A single local IndexedDB save is validated and migrated through game-state version 9, including reputation/milestones and local warehouse inventories and cost bases. Voyage progress is checkpointed while active and on page hide; loading re-anchors from the saved checkpoint without counting closed-app wall time. Arrival is idempotent once the voyage is cleared. The production PWA precaches the app shell. There are no accounts, cloud sync, save export, multi-device conflict resolution or authoritative server clock. |
| Mobile, desktop and accessibility | Partial / implemented foundation | CSS uses a mobile breakpoint, full-height mobile shell, compact navigation, and a separate wider desktop layout. Controls have accessible labels, focus styles and keyboard handling in SVG; reduced-motion CSS is present. The current test setup does not verify actual rendered layouts at specific phone/desktop viewport sizes or perform a screen-reader/contrast audit. |
| Art, animation and sound | Partial prototype | The map and city use original SVG illustration; CSS provides modest ambient movement and reduced-motion behavior. The city composition is shared across most ports, not a set of distinctive city scenes. The reviewed implementation and docs do not define or include a sound/music production system or a complete animation/content pipeline. |
| Online play | Documented only, optional | The roadmap says the core game should remain offline-playable and places online features last. No accounts, servers, sync, leaderboards or asynchronous competition exist. |

### Current playable loop

The player names a captain, starts in Dhaka, selects one of the 15 map ports, reads a route and travel estimate, sails, and arrives. They can trade locally, inspect cargo and gold, improve the ship or repair it at the docks, enter the current city scene, and choose another route. The longest normal voyage takes five minutes at 1×, 2 minutes 30 seconds at 2×, or 1 minute 15 seconds at 4×; the same full travel duration is credited in in-game days at arrival. Chittagong trips can trigger the alert and encounter.

This loop is playable and repeatable, but it does not yet have a tutorial objective, a market that changes while the player is away, a reliable source of new cargo stock, a defined progression target, or a long-term conclusion. For now, the player's meaningful strategy is choosing a route, what to carry, where to buy or sell, and which ship upgrade to purchase.

### Intended long-term player loop

The design documents imply a longer arc: learn local market identities; transport goods between distinct cities; take on risks or delivery work; build local standing; earn permissions and unlock access; establish a home and household; secure land; operate farms/workshops with workers; move goods through owned or hired ships; and pursue a lasting family or merchant legacy.

That is a plausible direction, but several links are still aspirations rather than rules. A player does not yet earn standing through trade, unlock a port, buy a home, operate a business, hire a captain or fulfill a contract. The long-term loop therefore cannot yet be played end to end.

## 2. Missing links and under-defined decisions

### Starting situation, tutorial and first choices

- The start state and basic interface are concrete; an actual teaching sequence is not. The player can begin and trade, but the game does not ensure they understand stock-sensitive quotes, cargo capacity, travel days, the Chittagong encounter, or why one destination might matter.
- The intro cover says “Five river towns” while the playable map has 15. This is likely stale copy and conflicts with the current game rules.
- **Recommendation:** Treat the first 10–15 minutes as a milestone of their own: teach one buy, one voyage, one sale, one upgrade, and one consequence without restricting the full map or goods.

### Economic identity and rewards

- Current profiles create different starting prices, but a supply tier is not a producer record and the descriptive identity data is not connected to price tiers. The trade-identity audit also notes that supply and demand affect the player's buy and sell quote together; the sell quote is simply three gold below the corresponding buy quote. This is not an independent NPC bid or market-clearing system.
- Stalls now recover toward their profile baseline by one unit per full sailing day crossed on arrival. This creates a small repeat-trading loop without production or NPC behavior.
- **Recommendation:** Validate the bounded recovery and preserve the historical identity record as distinct from gameplay inference and exact stock/price claims before expanding simulation.

### Calendar, voyage consequences and interruption rules

- The current calendar advances the full calculated duration on arrival, rather than continuously while at sea. The UI displays only an approximate year in 45-day increments. The 36-day Chittagong alert window is a story/gameplay interval, not a detailed historical calendar.
- Speed resets to 1× after a Chittagong arrival; other arrivals retain the selected speed. The encounter requires a player action and the Chittagong arrival resets speed, but there are no other random encounters or decision events to exercise the broader interruption rule.
- The game uses timestamps for active voyages but checkpoints and re-anchors progress so closed-app wall time is not counted. Local clock changes and multi-tab conflicts remain outside this stage.
- **Recommendation:** Future timed simulation must use the approved sailing-day clock and avoid closed-app catch-up.

### Progression and access

- The future product brief proposes five starting cities/four starting goods and later unlocks tied to levels, gold, reputation and eventually farm ownership. Current code correctly leaves everything available for testing.
- No progression formula defines what a “level” represents, whether gold is spent or merely required, what reputation measures, whether requirements differ by city, or how the player recovers from a missed requirement.
- The roadmap's broad reputation-to-property sequence does not specify how its actions award or reduce standing, how city access is earned, or how loss of access affects an active voyage, cargo, home or business.
- **Recommendation:** Approve an unlock table with city/good order, thresholds, source of each requirement, player feedback, and recovery paths before implementation. Preserve the current all-open test mode until that design is approved.

### Politics, events and conflict

- The historical event content handles one specific episode carefully, but the planned general event model has no common format, player choice, duration policy or recovery rule.
- There is no mission/politics loop connecting local authority, reputation, route closures, market supply or property access.
- The current encounter is a deterministic check, not tactical combat. Its code sets an encounter after every Chittagong arrival; the documents describe it as a tutorial encounter but do not establish whether repeated fights are intended. Decide whether this is one-time onboarding, a recurring hazard, or a specific dated event.
- **Recommendation:** Define encounter frequency and outcomes before adding more enemies. A player should see the risk and available choices before an irreversible cargo, hull or reputation loss.

### Household, production and long-term play

- The docs suggest a progression from relationships to home, family, land and business, but do not define marriage, family membership, age/time, succession, inheritance, or whether the dynasty can continue after a captain's death.
- Farms/workshops need a source and sink for goods, worker costs, output rates, storage, market impact, shutdown conditions and a way to manage risk. These rules depend on the time model and market replenishment policy.
- The game has no stated victory, endgame, legacy score, replay mode or open-ended sandbox contract. “Make your family proud” is a theme, not yet a measurable long-term goal.
- **Recommendation:** Decide whether players may continue indefinitely, choose a voluntary ending, or pursue both a legacy ending and a continuing sandbox. Avoid permanent failure without warning and a recovery path.

## 3. Contradictions, dependencies and roadmap risks

### Documentation and implementation mismatches

1. **Port count drift:** The intro copy says “Five river towns,” and `ART_GUIDE.md` still refers to “all five port labels,” while the current game has 15 ports. The Roadmap's Stage 1 five-port list is historical scope, but present-tense copy should be distinguished from it.
2. **Opium terminology:** `model.ts` describes opium as “A regulated, high-value commodity,” but the approved Stage 4B decision is to keep it freely tradable with no regulation or restriction. The code has no restriction mechanic. The label could imply a rule that does not exist.
3. **Repeated encounter behavior:** Resolved in Stage 3. The first-arrival introduction is recorded in save version 7 and does not repeat on later arrivals. Version 6 saves currently in Chittagong or with the encounter pending migrate as already introduced; older saves away from Chittagong may not contain enough history to determine whether the introduction was previously completed.
4. **Stage plan drift:** The roadmap numbers Stage 4 as historical events and Stage 5 as reputation/property, while Stage 4A and Stage 4B economic-identity work has since occurred and Stage 4C is expected next. The existing roadmap does not record these sub-stages or their acceptance criteria.
5. **Fleet dependency inversion:** Stage 5 proposes configuring fleets to move production, while Stage 6 introduces multiple ships, captains and automated fleet orders. Production logistics should not depend on fleet behavior that has not been specified or built.
6. **City distinctiveness gap:** The design aspires to distinctive places, but only Dhaka has custom building placements; every other city uses one generic layout. Economic identity data is more specific than the current city art or market behavior.

### Dependency risks in the existing order

- **Simulation before time/save rules:** Stage 3 proposes timed simulation intervals, shipments and seasons. Those systems need a clear clock, offline catch-up limit, deterministic tick ordering, save migrations, and duplicate-processing protection first.
- **NPC market before price meaning is settled:** NPC orders, replenishment and prices should follow the intended economic model. Adding traders first can multiply the current ambiguity between “supply tier,” “local production,” “aggregated stock,” and actual buyer demand.
- **Property before progression and economy:** Farms, workshops, workers and property penalties need agreed unlock conditions, running costs, production and inventory rules, and warning/recovery paths. Building these before market flow and access rules risks redesigning both.
- **Automated fleets before vessel and route constraints:** Draft, ship class, cargo ownership, route assignment, loss and handoff rules need a stable vessel model. Otherwise the fleet system may require replacing its save structure after launch.
- **Reputation before consequences are connected:** A number that does not affect a visible player choice or a recoverable outcome adds bookkeeping without a purpose. Tie standing to permissions, prices, missions, or property and tell the player why it changed.
- **Online play before the offline model is stable:** The existing local save is not authoritative or conflict-resolving. Accounts, sync or asynchronous competition require a security/privacy design and server-side validation, not just a transport layer.

## 4. Technical and production audit

### Save, timing and consistency

- **Existing strengths:** Game transitions are mostly pure functions in `model.ts`; save values are validated; save versions through 6 migrate to version 7; active-voyage checkpoints are re-anchored on load; arrival returns unchanged state if there is no active voyage. The introduction flag is saved.
- **Risks to resolve before more simulation:** Save format version 7 persists one game under a single IndexedDB key. There is no multi-tab lock/conflict policy, export/restore tool, sync, or server authority. Active voyage progress is checkpointed at one-second intervals and on page hide; older voyage formats without a saved progress checkpoint cannot distinguish time spent sailing from time spent closed and restart the active trip at its route duration.
- **Recommendation:** For each new stateful system, document its versioned schema and migration before adding the mechanic. Use explicit simulation timestamps/tick boundaries and deterministic catch-up, with caps and tests for long offline intervals, reloads, interrupted saves, duplicate tabs and arrival/event boundaries.

### Mobile, accessibility and usability

- **Existing strengths:** The shell responds at mobile and desktop breakpoints, uses a full-height phone layout, offers compact mobile navigation, and has a separate desktop arrangement. The map uses touch gestures and SVG markers; controls expose labels/pressed state; focus styles, keyboard interaction and reduced-motion CSS are present.
- **Coverage gap:** The six automated test files use Vitest and Testing Library. They exercise application behavior in a DOM test environment, not actual browser layout. They do not prove the map/city composition, touch target size, overflow, text scaling, color contrast or screen-reader flow at 320×600, 390×844 or desktop.
- **Recommendation:** Add a browser-based visual and interaction acceptance pass for key viewport sizes, plus keyboard-only, reduced-motion, screen-reader naming and contrast checks before a release milestone. Keep the SVG scene navigable without relying on pointer precision.

### Performance and scalability

- Fifteen ports, eight goods and one ship are small enough for the current model. Route tests exercise each port pair; market tests exercise each city-good combination.
- `App.tsx` owns many screen concerns in one component. It updates a wall-clock state every 120 ms, including when not sailing, which causes the app tree to render frequently. This is acceptable as a small prototype but should be measured before adding many simulation entities or frequent UI timers.
- **Recommendation:** Keep market/event/fleet simulation on deliberate scheduled ticks rather than per-frame updates; separate visual interpolation from saved simulation state; profile on lower-end phones as the number of ships, goods and owned properties grows.

### Historical content, art and release readiness

- The project is strongest where it explicitly marks game abstractions: the route graph is not surveyed hydrography; market prices and stock are balancing values; the city scene is not a reconstruction; and the Chittagong campaign's price/travel effects and raider are fictional.
- The city-good identity file and its tests enforce explicit confidence/basis labels, but tests cannot establish the historical accuracy of the cited claims. Further research is needed before turning low-confidence assumptions into player-facing factual descriptions.
- The current art is original and coherent, with reduced-motion treatment, but the city is mostly a shared scene, and no sound/music plan, final content schedule, localization plan, or platform/release checklist was identified in the reviewed materials.
- **Recommendation:** Keep researched fact, design inference and invented effect separate in data/UI. Set art, sound, content, accessibility, device-performance and save-recovery acceptance targets as explicit release criteria rather than assuming them from the prototype.

## 5. Recommended rules and reconciled roadmap

The overall direction and defaults in [CORE_GAME_RULES.md](./CORE_GAME_RULES.md) are approved: an open-ended sandbox with optional legacy goals; no closed-app time advancement and unchanged voyage time remaining on reopen; a one-time first-arrival Chittagong introduction; optional progression milestones without hard content locks; all 15 cities and eight goods open in the prototype; a market simulation limited to starting stock, player trades, bounded sailing-day recovery, and the existing temporary event; and clear separation of historical evidence from assumptions.

[ROADMAP.md](./ROADMAP.md) uses one forward stage sequence. It places time/save implementation before market simulation, progression before property and household systems, and ship classes and route constraints before automated fleets. Stages 3 and 4 are implemented. The bounded market simulation adds no autonomous NPC trading, production, new event types, or closed-app catch-up.

## 6. Details deferred to later design

The overall direction and defaults are approved. The following details are intentionally deferred for later design and balancing, not blockers to Stage 3:

1. **Progression balancing:** Exact thresholds and rewards for the approved optional milestone categories.
2. **Household and dynasty:** Optionality and consequences for relationships, aging, succession, inheritance, and property loss before implementing Stage 6.

## 7. Verification notes

- The repository contains six Vitest/Testing Library test files covering model transactions, market profiles, voyage timing and speed, navigation, save migration, economic identity metadata and key UI flows.
- The tests do **not** currently establish full-game completion, actual browser layout at named viewport sizes, accessibility conformance, multi-tab save consistency, or live long-duration offline simulation.
- No test suite or production build was run for the original documentation-only audit. The existing Vite preview was checked and returned HTTP 200 at `http://localhost:5173/`.
- Stage 3 and Stage 4 follow-up: all six test files pass (74 tests), the production build and TypeScript check pass, and the existing Vite preview returns HTTP 200. No progression or later-stage work was started.
