# Game Design

## The promise

Captain a small merchant boat through a stylised, historically informed Bengal river world. Trade, protect your ship, and gradually earn a place in port life. The broad merchant-strategy inspiration is Port Royale; the Bengal setting, world, history, interface, art and game systems are original.

The game should be immediately understandable to a 12-year-old while rewarding route, cargo, upgrade and risk choices. Tell the player what an action costs and what may change. Markets never promise profit.

The recommended long-term structure and progression principles are recorded in [CORE_GAME_RULES.md](./CORE_GAME_RULES.md); they are design direction, not a claim that future systems are implemented.

## Current playable loop

1. Select one of fifteen destinations on the illustrated map.
2. Read the connected-water route and its real-time estimate and matching in-game travel days.
3. Sail along the displayed channel, arrive and resolve the fictional Chittagong encounter on the first arrival at Chittagong.
4. See named merchants travel and trade as in-game sailing days pass, then compare local stall prices, stock, Coins and hold space; buy or sell goods.
5. Improve attack, defence or hold capacity at the docks.
6. Enter the current port's illustrated town and select its market, docks, warehouse, town centre, mosque, home, workshop or farm.
7. Accept an optional local contract, carry out its trade or journey objective, and earn a one-time reward and standing.
8. Leave for the map quickly and choose the next action.

The longest normal navigable route takes five real-world minutes. Shorter routes scale by river-path distance, and one real-world minute of sailing advances one in-game day. These are configurable gameplay abstractions, not historical sailing schedules.

## World and river travel — implemented

- The supplied illustrated map presents all 15 destinations. Their interactive markers and connected river/coastal polylines use the map artwork's 1152 × 768 coordinate space.
- The route graph connects all 15 ports with access channels, shared waterways and junctions. Ports are route endpoints, never intermediate waypoints. Each segment stores its map points, gameplay depth placeholder and endpoint nodes.
- Shortest-path planning, central travel-duration calculation, highlighted route and ship movement use the same route data. A voyage follows a single continuous waterway path rather than stopping at an intermediate port or taking a straight line across land.
- Event, military, weather and draft restrictions can close segments. The route planner returns no route when the destination is unreachable; sailing is then prevented.
- Route lines are visually traced from the supplied artwork as a gameplay abstraction, not surveyed or historically verified hydrography. The network currently has no detours around a closed segment. See [MAP_ROUTE_NOTES.md](./MAP_ROUTE_NOTES.md) for connections, migration behavior and uncertainties.
- The Chittagong campaign-inspired alert adds a travel day and changes salt quotes; it does not claim that a documented blockade or port closure occurred.
- The Chittagong encounter is a one-time introduction on first arrival. A persisted save flag prevents later arrivals or reloads from repeating it.

## Town entry and interface — implemented prototype

The map is the main play space. Compact contextual panels show a selected port's main action; Trade, Docks and Fleet are reachable from the bottom navigation. Politics, Family, Properties and Notifications are grouped under More. Panels close back to the world immediately.

Entering the current port replaces the map with an illustrated riverside town. Its buildings are tappable. Market, Docks, a purchasable local Warehouse, the Town centre, Home and Farm are functional. The Town centre shows visit status, global reputation and local property, and links to property actions. Establish one persistent residence at any port for 12,500 Coins; it has no reputation gate or household effect yet. The city composition is a general game scene, not a reconstruction of named historic buildings.

## Player-owned ships — Stage 12B implemented

The starter vessel and up to two purchased river boats are persistent, separately managed ships. A boat has its own generated name, port, hull condition, upgrades, capacity, cargo, purchase-cost basis and sailing speed. A new standard boat costs 25,000 Coins at Dhaka, Chittagong or Hooghly and begins with 8 hull, a 12-item hold, no upgrades and empty cargo. There are no reputation gates.

The player can switch ships only while docked and only when both are at the same port. The selected ship alone is used for direct trade, storage transfers, farm collection, repair, upgrades and player-controlled travel. Starting a voyage locks that ship until arrival; it then moves to the destination while unassigned ships stay put. Stage 12C adds optional, dock-managed, two-port automated trade routes for non-selected ships; it does not add captains, cargo handoffs, or remote repairs and upgrades. These ship names and purchase rules are gameplay abstractions, not claims about historical vessel classes.

## Vessel classes — Stage 13 implemented

River boat, Bora and Patello give a cheap and quick option, an all-rounder that reaches every port, and a slow bulk carrier that reaches 13 ports. Draft applies per ship to voyages and automated routes, and route previews show the real path and time. A Patello on an automated route trades up to four units per good at each port call, within stock, hold and route-capital limits. A return order brings back any ship the selected ship cannot reach, so none is stranded. Bora and Patello are named after boats in 1675–85 records; stats, prices, shipyards and port limits are game rules. See [STAGE_13_VESSEL_CLASS_DESIGN.md](./STAGE_13_VESSEL_CLASS_DESIGN.md).

## Starter economy — implemented foundation

- The deterministic market and trading interface expose all eight goods at all 15 destinations described in [TRADE_ECONOMY_DESIGN.md](./TRADE_ECONOMY_DESIGN.md). Each good shows local prices, stall stock, player holdings and, when owned, average purchase cost and estimated local return.
- Market stock starts at 16, 20 or 24 units according to relative local supply, with a maximum of 40. Stocks persist in the offline save.
- Quotes use the port's supply and demand tiers and current stock: `5 × round(clamp(base value × (1 + 0.15 × (demand − supply)) × 90 / (stock + 30), 40% to 250% of base) ÷ 5) + event modifier`. A sale is priced at stock + 1, less 12%, so a unit meets the same price both ways. Buy reduces stock; sell adds stock. The sell quote is three Coins below the buy quote, with a floor of one.
- Quantity trades price each unit against the stock resulting from the previous unit in that transaction. Players preview and confirm the total before trading. Purchases check Coins, cargo space and available stall stock; sales check player stock and market capacity.
- Average purchase cost uses a weighted average of the existing cargo basis and the total cost of new purchases. Partial sales retain the remaining units' average cost; selling the last unit clears it. The value shown is an estimate based on the current local selling quote, not a guaranteed profit.
- Save version 22 gives stalls three times the stock and a single world clock. Save version 21 counts in Coins, keeping the original as a backup. Save version 19 adds vessel classes and return orders. It also persists this per-good purchase basis, the Chittagong-introduction flag, progression, property, household, missions, local standing, voyage events, bounded NPC traders, the player fleet, and each automated route's rules, capital, travel progress and recent activity. Version 17 saves migrate with routes unassigned and activity logs empty; existing ships and active voyage progress are preserved. Version 16 saves migrate the existing ship and any active voyage into a single starter-ship record. Earlier versions migrate through the existing steps before receiving newer features. Version 5 cargo is migrated with an estimate from the current port's buy quote because older saves did not record purchase history. The starter cargo is assigned its starting-port quote as a cost basis despite the free grant.
- Port supply and demand tiers generate different prices. The 300-Coin Chittagong salt modifier during the opening alert is fictional and applies to both quotes; no route guarantees a profit.
- Each whole sailing day, every stall closes 6–12% of the gap to its profile-based usual stock, at least one unit, within the 0–120 stock limits. Buy quotes stay between 40% and 250% of base price. This deterministic market recovery is separate from NPC trade, which also changes shared stock during active in-game time. Prices and port supply/demand tiers are gameplay assumptions, not historical prices or quantities.

The save model keeps each market's goods separate. The Chittagong alert remains the only temporary market price event; its 300-Coin salt quote modifier ends at in-game sailing day 36. Production/consumption by NPCs, shipment arrivals/losses, political restrictions and seasonality remain out of scope.

The approved first market-simulation step is implemented: retain current starting stock and player-driven trades, then move stock toward its starting baseline by a share of the gap each full sailing day. Stage 12A adds a bounded named NPC merchant layer: traders buy from and sell to those same local stalls only during active in-game time. Market prices and city supply profiles remain gameplay assumptions, not historical facts. See [TRADE_ECONOMY_DESIGN.md](./TRADE_ECONOMY_DESIGN.md), [CORE_GAME_RULES.md](./CORE_GAME_RULES.md) and [ROADMAP.md](./ROADMAP.md).

## NPC merchants — bounded living trade world

- Four fictional traders have distinct home ports, strategies, preferred goods and preferred destinations. They begin with 5,000 Coins and empty three-item holds; their budgets cannot exceed 9,000 Coins. Two are specialists, one seeks profitable reachable price differences, and one favors nearby ports.
- At each full sailing-day simulation checkpoint, a docked trader may buy up to two units from the shared local stock if funds and stock permit, then travels using the existing river route planner and duration. Route duration is rounded up to whole in-game days. On arrival, the trader sells carried goods only into available market capacity; stock remains between 0 and 40.
- The simulation is deterministic and saved. It advances only with active in-game sailing; reopening does not perform offline catch-up. Map route markers, port traffic, and a short recent-activity list make merchant actions visible.
- Docked traders can be inspected, traded with one unit at a time, or left alone in the port's town-centre panel. These optional interactions do not block travel or pause voyages. A player purchase transfers already-carried cargo at the local stock-sensitive buy quote; NPC market trades continue to affect market stock through their normal bounded purchases and sales.
- NPC identities, trading preferences, schedules, and activity are gameplay abstractions, not evidence that these named people or exact city roles are historically documented. No NPC production, autonomous goods creation, new goods, unlocks, or unlimited-budget loop is present.

## Ships and combat — implemented first vessel

- The starter wooden vessel holds 12 goods and begins with two rice, one fine cloth and 5,000 Coins.
- Cannon levels add attack; hull levels add defence and ship strength; hold levels add six cargo spaces. The same attack and defence values resolve the fictional river encounter.
- Repair costs 100 Coins per missing hull point. Upgrades and repairs can only be used while docked.
- The Fleet panel reports each vessel and its gameplay stats. Stage 12C adds simple automated trade routes for non-selected ships and Stage 13 adds vessel classes; captains, crews, production logistics and remote ship management remain future systems.
- Every port has the same functional shipyard. Repair and upgrade cards show current condition, price and resulting stats; insufficient funds and maximum levels prevent a purchase. Voyage and encounter states cannot be modified by shipyard purchases.

## Reputation, milestones and political standing — implemented foundation; dynasty planned

The global reputation foundation awards one point for each first visit to a port and each first profitable sale for a distinct port-and-good pair. Profitable sales use the existing weighted average cargo cost, and repeated pairs award nothing. Three optional goals track five visited ports, five distinct profitable markets and a lifetime peak of 12,500 Coins. The goals are visible in the Progress panel and do not gate content. Keep all 15 cities and eight goods available.

Local political standing is separate from global reputation: a port starts at 0/100, and completing a fixed contract there adds 5. Occasional river-pilot events add 2 at their destination. The score is informational only and never gates a city, good, or core action. A residence can be established for 12,500 Coins without a reputation gate. Marriage at that residence is available for a one-time 5,000 Coins household cost. This cost and interaction are explicit gameplay abstractions, not a reconstruction of a documented ceremony. The following sequence remains future direction rather than an approved unlock table:

1. Build good reputation in a town through reliable deliveries, fair dealing and helpful local choices.
2. Develop relationships with local authorities and social or trading groups.
3. Lobby the appropriate authority for permission to buy additional land.
4. Build workshops and other businesses suited to that town.
5. Manage properties from another city or while travelling.
6. Expand beyond two-port trade routes to carry production and manage more complex fleet logistics.
7. Add advanced contract variants with favourable prices, stricter deadlines and clear risks or consequences.

Future standing effects may affect optional local services, permissions, prices and business reliability, not access to core cities or goods. Any lasting consequences would need clear warnings and recovery paths. Household and dynasty systems are not playable yet. See [CORE_GAME_RULES.md](./CORE_GAME_RULES.md) for progression principles.

## Warehouses — implemented foundation

Each port can have one 20-space warehouse, purchased for 7,500 Coins at that port's Warehouse building. The player can transfer one unit at a time between ship cargo and local warehouse stock. The warehouse has a separate local inventory and weighted average purchase cost, so storing goods does not erase their realized-profit basis. It does not change ship hold capacity, market stall stock, or port access. No warehouse upgrades, production, or workers are included.

Suggested future records: political actions and relationship changes; household members and home town; property ownership, production, stock and operating status; advanced ship classes and fleet logistics; advanced contract variations.

## Town centre and residence — implemented foundation

The Town centre shows the current port's visit status, global reputation, local political standing, and property owned locally, with direct links to the mission board, Home, Warehouse and Farm. The player can establish one residence in any port for 12,500 Coins; save version 9 migrates with all existing progress and property preserved and initializes the residence as unowned. The residence is a persistent location only: it provides no income, permissions or dynasty effects. Marriage at the residence is implemented separately as a one-time household action.

## Marriage and household — implemented foundation

Marriage is a one-time explicit action at the player's residence, requiring that home and 5,000 Coins. The saved spouse record stores only a married status and in-game day; no spouse name, specific custom or ceremony is invented. The Household screen shows residence, spouse status, an empty children list and an unset designated-heir field. These child/inheritance fields prepare the model but do not implement children, aging, succession or inheritance rules. Version 11 saves migrate to version 13 with all prior farm, warehouse, residence and player state preserved and an empty household.

## Mission board, local standing and river events — implemented foundation

Each port has four fixed, deterministic offers: deliver two carried goods; buy two specified goods at the issuing port and deliver them; visit a destination; or earn 1,250 Coins in realized profit from sales of a named good in the issuing port. Offers are finite and never refresh. The player can hold at most two active contracts. Deadlines are 20–30 in-game sailing days after acceptance and are checked when the voyage arrives; closing the app does not advance them.

Delivery transfers the required cargo out of the ship when it reaches the named destination. Purchase-and-deliver also requires that the player buy the contract quantity at the issuing market after accepting. Visit objectives complete on arrival. Profitable-trade progress counts only positive realized sale profit, using the existing weighted-average cargo cost. A completed contract pays 900–1,500 Coins, +2 global reputation, and +5 local standing at its issuing port once. Expired and completed offers remain in the saved history.

Local political standing is a separate 0–100 score. Contracts reward the issuing town; every fifth voyage also triggers a deterministic, non-interrupting event that either grants +2 destination standing or damages the ship by 1 hull on arrival. Standing is currently informational, with no price, permission, city or goods gates. The pilot and rough-water events are gameplay abstractions, not historical claims. Version 13 saves migrate to version 14, preserving existing state and active voyage progress while initializing finite boards, zero local standing, and no pending event.

## Farms — first bounded production loop

The player can buy one farm per port for 10,000 Coins. Each farm produces one Rice per full in-game sailing day after purchase. Production is credited only on arrival, from active sailing days; closing the game pauses the voyage and farm clock. Each farm has a separate local output store capped at 20 Rice; production over the cap is discarded rather than queued. The player must return to that port and collect available Rice into the ship's remaining hold space. Collection does not bypass cargo limits or silently add cargo, and farm output does not enter market stock until the player sells it. Save version 10 migrates with all prior cargo, trade, warehouse and residence state preserved and starts with no farms.

## Historical events — existing event plus extensible hooks

The game starts around 1665. The Chittagong campaign and 1666 capture are documented history; the route-day modifier, salt-price changes, fictional raider, river pilot and rough-water travel events are game inventions. A date window, affected route edges, towns, port access, infrastructure, inventory and quote changes can be represented as separate effects, with a source and a documented-versus-fiction label for every event.

Potential future effects include event-specific channel closures, military control, port restrictions, damaged facilities and interrupted shipments. Historical actors must be described specifically. Never treat an entire ethnic, religious or cultural community as inherently hostile.

## Stage status

- **Implemented:** first playable trading loop, 15-destination river graph and supplied map artwork, route previews and movement, map-first mobile interface, functional city-entry screens including Town centre, residence, farm and marriage interaction, persistent household screen, deterministic eight-good market simulation with 15 profiles and quantity-based trading interface, weighted-average purchase-cost tracking, three ship upgrades and paid hull repairs at every port, Stage 5 global reputation and optional milestones, local warehouses, residence ownership, bounded farm production, marriage foundation, finite missions/local political standing/occasional travel events, Stage 12A bounded NPC merchants, Stage 12B player-owned ships, Stage 12C automated trade routes, Stage 13 vessel classes and return orders, IndexedDB migration and production offline shell.
- **Partially prepared:** event-driven route restrictions, market production/consumption, and future-area navigation.
- **Planned:** NPC production/consumption simulation, contract refresh and advanced contract variants, political actions and standing effects, children, aging, succession and inheritance rules, land permission, warehouse upgrades, workshops, captains and expanded fleet logistics beyond the current two-port automated trade routes, additional towns and carefully sourced historical events.
- **Not in this stage:** multiplayer, online leaderboards or asynchronous attacks.

See [GAME_RULES.md](./GAME_RULES.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [HISTORICAL_EVENTS.md](./HISTORICAL_EVENTS.md) and [ROADMAP.md](./ROADMAP.md).
