# Roadmap

Stage each system as a small, testable game loop, following the recommended rules in [CORE_GAME_RULES.md](./CORE_GAME_RULES.md). Stage numbers describe the forward sequence; completed stages are historical scope, not a second numbering system. Stage labels such as 3A and 4A–4C in the economy research documents are legacy workstream labels, not stages in this roadmap. Later work extends the existing prototype and preserves its saves.

## Stage 1 — First playable slice: complete

- Intro, Dhaka start, five selectable ports, trading, gold, cargo limits, three real ship upgrades, ship encounter and IndexedDB saves.
- Original Bengal-inspired SVG map and portrait-first Vite preview.
- Documented Chittagong 1665–1666 context, clearly separated from fictional gameplay effects.

## Stage 2 — World design, navigation and core interface: implemented foundation

- Make the interactive map the dominant play area; use compact navigation and toggleable panels, with a quick return to Map.
- Replace straight-line routing with a connected river graph shared by map rendering, route estimates and vessel movement; prevent voyages over closed channels.
- Add event, military, weather and vessel-draft blockage inputs. The current network is deliberately small and abstract, with no detour around a closed segment.
- Add port context actions, a separate illustrated current-port town scene, and directly tappable buildings. Market and Docks are functional; other city buildings are informative prototypes.
- Add finite per-port inventory and explainable stock-driven prices. Establish IndexedDB migration from Stage 1.
- Document long-term economy, ship, family/property/politics and event integration without implementing those complete systems.

**Exit check:** Can a player inspect a real graph route, follow it by ship, trade with local finite stock, enter/leave the current city, use working market/dock buildings, and restore an old Stage 1 save?

## Stage 3 — Foundational time and save rules: implemented

- Voyage timestamp handling checkpoints progress while the game is active and on page hide; resuming re-anchors from saved in-game progress, so closed-app wall time does not advance the voyage.
- The one-time first-arrival Chittagong introduction is persisted; later arrivals do not repeat it. Future encounters belong to a separate event system.
- Save version 6 migrates to version 7 with player state and the last saved voyage checkpoint preserved. Older voyage formats without a saved progress checkpoint do not use wall-clock time to infer progress.
- No market, event, or other world system advances from real-world time while the game is closed.

**Dependencies:** None beyond the existing Stage 1/2 prototype.

**Exit check:** Verified by tests for close/reopen without voyage progress, arrival after resuming, one-time encounter persistence, and version 6 migration. No market simulation was added.

## Stage 4 — Bounded market simulation: implemented

- Keep starting stock, player trades, and the existing limited event as the market influences. Changes are deterministic, bounded, and explainable.
- Retain current city profiles and quote rules as the market baseline.
- At arrival, move stall stock one unit per full sailing day toward its starting baseline, capped at 0–40. Reuse the existing Chittagong salt alert as the only temporary event; do not add event types in this stage.
- The alert's six-gold salt quote modifier expires when the in-game sailing day reaches 36.
- Defer autonomous NPC trading and production.
- Do not add real-time/offline market catch-up. Preserve all 15 cities and eight goods as available.
- Treat economic identities as design context, not proof of historical quantities or a city's established trade role.

**Dependencies:** Stage 3.

**Exit check:** Verified by tests for sailing-day stock recovery, 0–40 stock and 1–156 buy-quote bounds, event expiry, save/load, and no closed-app market catch-up. No autonomous NPC trading or production was added.

## Stage 5 — Basic reputation and optional milestones: implemented

- Add one persistent global reputation score: +1 for each first port visit and each first profitable sale for a distinct port-and-good pair; neither source can be repeated to farm it.
- Include three visible optional goals: visit five ports, make profitable sales in five distinct markets, and reach a lifetime peak of 250 gold. Completing them does not gate content or end the sandbox.
- Keep all 15 cities and eight goods available. Local standing, unlocks, property, household and rewards remain later work.
- Migrate version 7 saves to version 8 without resetting existing player state. Historical visit and trade history that old saves never recorded cannot be inferred.

**Dependencies:** Stage 3; use Stage 4 market rules where progression depends on recurring market activity.

**Exit check:** Verified with tests for one-time reputation sources, milestone progress/completion, version 7 save migration, save/load, and unchanged availability of every city and good. Goals are visible from the header and More navigation.

## Stage 6 — First property: purchasable warehouses: implemented

- Allow one 20-space local warehouse per port, purchasable for 150 gold at the current port. No city or reputation locks.
- Show ownership, used capacity, and current ship cargo; allow one-unit transfers in either direction while at the port.
- Preserve weighted-average cargo cost basis across storage transfers and persist warehouse ownership, stock, and purchase cost.
- Save version 8 migrates to version 9 with existing progression and voyage state preserved; old saves start with no warehouse property.
- Farms, workshops, workers, relationships, households, production, and operating risks remain future work.

**Dependencies:** Stages 3–5.

**Exit check:** Verified purchase eligibility, gold deduction, local capacity, transfers, duplicate prevention, migration and save/load. All ports and goods remain available.

## Stage 7 — Shipyard repairs and basic upgrades: implemented

- Repair at every port for 2 gold per missing hull point.
- Keep the existing three upgrades: cannon (attack), reinforced hull (defence and maximum hull), and cargo hold (+6 spaces). Show level, cost and resulting stats before purchase.
- Enforce affordability, upgrade maximums, and docked-only repair/upgrades in both the UI and game model.
- Preserve the existing save version: hull, gold and upgrade levels are already persisted.
- Do not add ships, captains, combat systems, production, or automation.

**Dependencies:** Stages 3–6.

**Exit check:** Verified repair costs, upgrade effects and maximums, insufficient funds, save/load, and rejection of shipyard actions during voyages or encounters.

## Stage 8 — Functional town centre and home: implemented

- Show current-port visit status, global reputation, and locally owned property in the Town centre. Clearly note that reputation is not yet town-specific.
- Link Town centre to local Home and Warehouse actions.
- Allow one persistent residence at a player-chosen port for 250 gold, with no reputation gate or household/dynasty effects.
- Migrate version 9 saves to version 10, preserving all existing progress and warehouse data and initializing residence ownership as empty.
- Keep all 15 ports available; do not add family, marriage, children, aging, farms, production, workers, missions, NPC trading or fleet automation.

**Dependencies:** Stages 3–7.

**Exit check:** Verified town-centre information, residence purchase and affordability, duplicate prevention, save/load, and migration from version 9. Home ownership is a saved location only.

## Stage 9 — Basic owned farm and production loop: implemented

- Allow one farm per port for 200 gold; farms produce one Rice per full in-game sailing day after purchase.
- Credit production on voyage arrival only, preserving partial days. Closed-app time never advances production.
- Keep farm output in a separate, local 20-Rice store. Production over capacity is discarded; collect only at the farm and only into available ship cargo capacity.
- Save farm ownership, output and production-day checkpoints. Version 10 migrates to version 11 with existing progress, warehouses and residence preserved and no farms initially owned.
- Keep all ports and goods available; do not add workers, production chains, NPC trading, family/dynasty or fleet automation.

**Dependencies:** Stages 3, 4 and 6–8.

**Exit check:** Verified purchase and affordability, partial/full-day production, output cap and overflow behavior, collection and cargo limits, save/load, migration and no closed-app production.

## Stage 10 — Marriage and household foundations: implemented

- Require the player to own and be present at a residence before marriage is available; charge 100 gold as a clearly labeled gameplay abstraction.
- Save spouse status and the in-game day marriage was established. Keep marriage explicit and one-time.
- Add a Household screen showing residence, spouse status, empty children list and unset inheritance/heir state.
- Prepare child and designated-heir data fields, without implementing children, aging, succession or inheritance rules.
- Migrate version 11 saves to version 13, preserving existing progression, property and farm state and initializing an empty household.
- Do not add culturally specific ceremony claims; keep all cities and goods available.

**Dependencies:** Stages 3, 5 and 8.

**Exit check:** Verified residence dependency, marriage cost and one-time status, household display, save/load, and migration from version 11. Marriage is an explicit gameplay abstraction, not a historical custom claim.

## Stage 11 — Missions, trade contracts and political influence: implemented

- Add four deterministic, finite offers at each of the 15 ports: deliver cargo, buy and deliver goods, visit a destination, or complete a profitable sale objective.
- Limit the player to two active contracts. Use 20–30 in-game sailing-day deadlines, persist available/active/completed/expired states, and pay each fixed reward only once.
- Award 18–30 gold, +2 global reputation and +5 local standing at the issuing port for completion. Track local political standing separately on a 0–100 scale; it has no access, price or goods effects yet.
- Add a deterministic travel event every fifth voyage. Alternate between a local river pilot granting +2 standing at the destination and rough water causing 1 hull damage. Events resolve automatically on arrival and are gameplay abstractions, not historical claims.
- Migrate version 13 saves to version 14, preserving all prior progress and voyage time; initialize one finite board per port, zero local standing and no pending travel event.
- Keep all ports and goods available; do not add NPC trading, production, multiplayer, complex combat or fleet automation.

**Dependencies:** Stages 3 and 5.

**Exit check:** Verified deterministic generation, acceptance limits, all four objective types, progress, deadline expiry, one-time rewards, local standing, save/load, migration and travel-event outcomes. Contracts never gate ports or goods.

## Stage 12A — NPC merchants and a living trade world: implemented

- Add four fictional named traders with distinct home ports, strategies, preferences, limited cargo, and budgets. Include specialists, a trader seeking reachable price differences, and a regional trader favoring nearby ports.
- Move traders on routes and durations from the shared river graph and sailing-time model. Buy and sell against player-visible market stock and prices, respecting stock, cargo, and purse bounds.
- Advance activity only on full in-game sailing-day checkpoints; persist trader state and do not simulate closed-app time.
- Show movement and arrivals on the map and at ports. At a port, allow optional inspection, one-unit trading, or leaving a merchant alone; do not interrupt voyages.
- Migrate version 14 saves by initializing traders with empty cargo and 100 gold at their home ports. Migrate version 15 saves by preserving trader cargo, capital, routes, activity and voyage checkpoints while removing the former voyage encounter and adding strategy data.
- Do not add player fleets, NPC production, combat, multiplayer, or online systems.

**Dependencies:** Stages 3 and 4 for time, routes and markets.

**Exit check:** Tests verify deterministic behavior, strategy differences, movement using connected routes and existing sailing time, market transactions, cargo and purse bounds, optional port interactions, save/load, migration, visible activity, and no closed-app simulation. All ports and goods remain available.

## Stage 12B — Player-owned ships: implemented

- Buy up to two additional standard river boats for 500 gold each at Dhaka, Chittagong or Hooghly. New boats start with 8 hull, a 12-item hold, no upgrades and empty cargo.
- Persist each ship's name, location, condition, upgrades, cargo capacity, inventory, purchase-cost basis and sailing speed. Migrate version 16 saves by wrapping the existing vessel and voyage in a single starter-ship record without resetting progress.
- Allow management only while docked and only when a ship is at the player's current port. Trade, warehouse and farm cargo transfers, shipyard repairs/upgrades and sailing affect only the selected ship.
- Permit one player ship to sail at a time; lock ship selection during the voyage and record the selected ship's arrival port. Do not add automation or simultaneous voyages.

**Dependencies:** Stages 3, 5 and 7.

**Exit check:** Purchase, selection, cargo separation, ship-specific repairs/upgrades, voyage restrictions, save/load, migration and preservation of existing features are tested. All ports and goods remain accessible.

## Stage 12C — Automated trade routes: implemented

- Assign non-selected ships to optional two-port routes between ports the player has visited. Routes use open connected river paths and existing whole-day sailing checkpoints.
- Configure per-good buy-at-origin and sell-at-destination rules. Route capital is transferred from the player's purse, limited to 5,000 gold, and held separately until the route is cancelled at a dock.
- Run no more than one unit per selected good per matching port checkpoint. Share existing market prices and stock limits; use each ship's cargo capacity and preserve its cargo, location and route progress in saves.
- Allow pause, resume, editing and cancellation while the automated ship is docked, including while the player's selected ship is sailing. Automated progress occurs only with active in-game sailing-day advances, never while the game is closed. Automation does not earn mission or reputation rewards.
- Migrate version 17 saves to version 18 by initializing routes as unassigned while preserving each ship and any active player voyage.

**Dependencies:** Stages 3, 4, 12A and 12B.

**Exit check:** Setup, connected travel, market transactions, bounded stock/cargo/capital, pause/resume/cancel, deterministic progress, save/load, migration and no closed-app progress are tested. All ports and goods remain available.

## Stage 13 — Vessel classes: implemented

- Add three classes: River boat (500 gold), Bora (350 gold) and Patello (900 gold), sold at Dhaka, Chittagong and Hooghly. Classes differ in hold, hull, upgrade steps, repair rate, travel time, draft and route trading. See [STAGE_13_VESSEL_CLASS_DESIGN.md](./STAGE_13_VESSEL_CLASS_DESIGN.md).
- Apply each ship's draft to voyages and automated routes. The Patello reaches 13 ports, not Sylhet or Balasore; route previews show actual travel time and any longer route. The five-minute voyage cap stays. Depths and port limits remain gameplay abstractions.
- Explain blocked travel, exclude unreachable ports from route setup, and make incompatible saved routes wait safely at port.
- Add a free return order, offered only for a ship the selected ship cannot reach, so no ship is permanently stranded.
- Let a Patello on an automated route trade up to four units per good at each port call. Other classes stay at one. Stock, hold, route capital and existing money rules still apply.
- Migrate version 18 saves to version 19 as River boats with no return order, preserving every ship, route and voyage.
- Captains, cargo handoffs, shipment loss and complex route orders are not part of v1.

**Dependencies:** Stages 3, 4, 6–12C.

**Exit check:** Class stats, draft-aware planning, connected networks for every class, route compatibility, trading bounds, return orders, migration, save/load and shipyard, fleet and route UI are tested. All 15 ports and eight goods remain in the game.

## Stage 14 — Add researched historical events and connected systems

- Research event dates, places, actors, evidence quality, disputed details, and local effects before using them.
- Separate supported fact from interpretation and fictional gameplay consequence. Do not present uncertain city trade roles as established facts.
- Connect event effects to time, routes, markets, reputation, or property only where those rules are defined.
- Avoid collective ethnic, religious, or cultural hostility; use specific political actors and multiple perspectives.

**Dependencies:** Stage 3 for event timing; any affected system must have its rules in place first.

**Exit check:** Each event records sources and uncertainty, explains its effects, and has tested start/end, save/reload, and recovery behavior.

## Stage 15 — Optional legacy goals and release readiness

- Offer optional goals for players who want a long-term direction; leave the sandbox playable after milestones.
- Validate the first trade-voyage-sale loop, city identity, accessibility, localization, performance, art/audio content, and save recovery.
- Do not add a mandatory ending unless separately approved.

**Dependencies:** Stages 3–14 for goals that rely on those systems.

**Exit check:** New players can learn the core loop, long-term goals are understandable and optional, and mobile/desktop usability and save recovery meet agreed criteria.

## Stage 16 — Optional online features

- Keep the base game offline-playable. Design privacy and sync before adding accounts or leaderboards.
- For any asynchronous competition, protect permanent progress and explain outcomes; validate authoritative state on the server.

**Dependencies:** Stable offline saves and completed privacy/security design.

**Exit check:** Offline play remains complete, sync conflicts are recoverable, and players understand what leaves their device.

## Current next milestone

Stage 13 is the last planned gameplay stage for v1. Next is visual polish ([VISUAL_POLISH_HANDOFF.md](./VISUAL_POLISH_HANDOFF.md)), then playtesting and release polish. Stages 14–16 are not planned for v1. No new major gameplay stage starts unless testing reveals a genuine blocker.
