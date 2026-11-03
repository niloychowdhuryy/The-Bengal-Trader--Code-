# Core Game Rules

**Status:** Overall direction and defaults approved. Time/save, first-arrival, bounded market, Stage 5 reputation/milestone, Stage 11 mission/local-standing, Stage 12A bounded NPC-trading, Stage 12B player-owned ship, Stage 12C automated-route, and Stage 13 vessel-class foundations are implemented. For current playable rules, see [GAME_RULES.md](./GAME_RULES.md).

## Game structure

The game is an open-ended merchant sandbox. Players can keep trading and building after reaching major milestones. Optional legacy goals can give direction and celebrate long-term play, but there is no mandatory ending or forced retirement.

## Calendar and offline time

Keep the existing in-game sailing-day system for now. Sailing is the current source of in-game days; do not add a separate calendar clock or advance markets, production, events, or other world systems from real-world time while the game is closed. When reopening, resume an active voyage with the same in-game travel time remaining as when the game closed. Wall-clock elapsed time while closed has no effect.

Use one consistent rule for when in-game time advances and when time-based effects are processed. Apply it to all time-dependent systems, not independent timers or per-frame updates. Active voyages checkpoint progress during play and when the page is hidden or closed; saves re-anchor a voyage on load without using closed-app wall time.

## Chittagong encounter

Treat the existing Chittagong encounter as a one-time introduction on the player's first arrival. Later arrivals do not repeat the tutorial. Any later Chittagong encounters should be designed as part of a separate, reusable event system with its own rules and player-facing explanation.

The first-arrival flag is persisted with the save, so reopening during or after the introduction does not trigger it again.

## Progression and access

Keep all 15 cities and all eight goods available in the current prototype. Do not add content locks or unlocks yet.

Start progression with optional milestones, not hard content locks. Use wealth, local reputation, and achievements to make the player's choices grow over time, while keeping core trading open. Define milestones in these categories:

- **Trade and exploration:** learn routes and markets, visit destinations, and complete meaningful trades.
- **Wealth and investment:** earn and invest money in upgrades, ships, property, and businesses.
- **Local reputation:** build standing through reliable trade and helpful choices to gain optional services, contracts, relationships, and business opportunities.
- **Achievements and legacy:** recognize milestones and offer optional long-term goals without ending the sandbox.

Progression should add choices and capabilities rather than make the original trading loop feel withheld. Wealth should mainly let players afford investments; reputation should reflect local actions and open relevant opportunities; achievements should recognize milestones and point toward new goals. Show requirements and consequences clearly, and provide recovery paths after setbacks. Exact thresholds and rewards remain for later balancing.

The Stage 5 foundation uses a single, global reputation score: gain one point for the first visit to each port and one point for the first profitable sale of each good in each port. Each source can award reputation only once, and there are no reputation penalties. Initial optional goals track five visited ports, five distinct profitable port-and-good markets, and a lifetime peak of 12,500 Coins. These are first-playable targets and can be rebalanced later; they mark progress only, and no goal gates a city, good, or core action.

The Stage 11 mission foundation adds a separate 0–100 local standing per port. Completing a finite, one-time contract gives +5 standing at its issuing port; an occasional fictional river-pilot event can add +2 at the destination. Standing has no price, permission, city or goods effects yet. Contract rewards are fixed, paid once, and deadlines use sailing days. No offers refresh and only two contracts can be active, preventing repeatable reward farming. All 15 ports and eight goods remain accessible.

## Market evolution

The market starts from each city's existing supply-profile stock. Player trades change stock immediately. Each whole in-game sailing day, every stall closes part of its gap toward that city's usual starting stock, bounded from 0 to 40. Fractional sailing days accumulate until a whole day is crossed. Buy quotes remain between 1 and 7,800 Coins; the existing temporary Chittagong salt alert remains the only market event, adds 300 Coins to both salt quotes there while active, and expires when the in-game day reaches 36. Stage 12A adds four bounded traders whose purchases and sales affect this same market stock only as active in-game sailing advances; traders have capped cargo and budgets and do not produce goods. Their movement uses the shared route planner and sailing-time model. Port inspection and one-unit trading are optional and do not pause player voyages. Market identities, trader profiles, and events remain deterministic gameplay abstractions. Do not add real-time/offline market catch-up.

Stock and prices remain deterministic: current stock and the existing city profiles determine quotes; sailing-day recovery and player trades determine stock changes. Event timing uses the existing sailing-day calendar. Because stock and sailing day are already saved, the update needs no new save field and does not run on load or while the game is closed.

## Historical uncertainty

Keep historical evidence distinct from design inference and gameplay abstraction. Describe a fact only as far as its sources support it. Mark uncertain city trade roles as assumptions or unknowns, not established local production, demand, or port function. A regional market identity or game balance profile is not proof of a named city's historical trade role.

Apply the same distinction to the route graph, prices, quantities, travel times, encounters, and event effects. Consult [MAP_ROUTE_NOTES.md](./MAP_ROUTE_NOTES.md) and [TRADE_ECONOMY_DESIGN.md](./TRADE_ECONOMY_DESIGN.md) for existing uncertainty labels and supporting context.

## Roadmap order

The [ROADMAP.md](./ROADMAP.md) uses one numbered sequence and respects these dependencies:

1. Establish time, offline, and save rules before adding simulation.
2. Design progression before implementing property or dynasty systems.
3. Define ship classes and route constraints before automated fleets. Stage 12C added a small two-port automation layer first, and Stage 13 vessel classes were built to stay compatible with it.

The existing implemented prototype remains the starting point. Each later implementation stage still requires the user's approval.

## Details deferred to later design

The approved direction does not require further approval before planning the next foundation stage. Exact progression thresholds and rewards, specific limited market events and their bounds, and household/dynasty rules should be designed when their respective systems are scheduled.
