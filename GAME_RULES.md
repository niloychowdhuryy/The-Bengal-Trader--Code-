# Game Rules

These are rules implemented in the current slice. Systems described as planned are not available in the game yet.

Recommended future design decisions, which are not all implemented, are recorded in [CORE_GAME_RULES.md](./CORE_GAME_RULES.md).

## Start and save

- Start in Dhaka with **5,000 Coins**, **2 rice + 1 fine cloth**, a **12-item hold** and a basic wooden vessel.
- Each good takes one place in the hold.
- Progress saves to IndexedDB on this device. Version 19 saves add each ship's vessel class and any return order; version 18 ships migrate as River boats with everything else unchanged. Version 20 saves use the rebuilt routes. Version 21 saves count in Coins: every older amount becomes exactly ×50, and the original save is kept as a backup under **More → Save backups**. Version 18 saves also persist each non-selected ship's automated route, route capital and recent activity. Version 17 fleets migrate with no routes assigned and empty activity logs; the selected ship and active voyage remain unchanged. Version 16 saves migrate their current vessel into one named ship without resetting cargo, upgrades, condition, Coins or voyage progress. Earlier versions migrate through the existing steps before receiving newer features. Version 15 saves preserve NPC trader state while removing the former voyage encounter; version 14 saves initialize bounded traders. Older voyage formats without a saved progress checkpoint restart the active trip at its route duration rather than using closed-app wall time. Production app files can be cached for offline reopening after first visit.

## Map and navigation

- Tap a port to see its context. Choose **Enter city** at your current port or **Travel to this port** elsewhere.
- The supplied illustrated map shows 15 market destinations. Each is selectable, with a marker placed at its settlement on the artwork. The route graph follows the waterway shapes depicted in the illustration; see [MAP_ROUTE_NOTES.md](./MAP_ROUTE_NOTES.md) for connections and historical uncertainty.
- Each voyage is planned as one continuous waterway path between its origin and destination. Intermediate port nodes are not used as waypoints; the route preview, travel estimate and moving ship all use the same path. Route estimates use polyline distance, not straight-line distance. The longest normal navigable route takes exactly five real-world minutes while the game is open; shorter routes take the same fraction of that time as their river distance. One real-world minute underway equals one in-game day, including fractional days. This is a gameplay scale, not a historical sailing-time claim.
- Voyages advance only while the game is open. Closing or backgrounding the game does not advance in-game time; reopening resumes with the same in-game travel time remaining as at the last saved checkpoint.
- Four named NPC merchants travel between ports and trade within the same saved market stock. They start at Dhaka (Abdul Rahman), Sonargaon (Mariam Banu), Kasimbazar (Govinda Das), and Patna (Fatima Khatun). Their names, home ports, preferences, and routes are game abstractions, not claims about documented individual merchants or exact historic trade roles.
- NPCs update only as active sailing crosses full in-game day checkpoints. Each has a three-item hold, starts with 5,000 Coins, and cannot hold more than 9,000 Coins. Specialists favor a small set of goods and destinations; one trader seeks reachable profitable price differences; one favors the nearest of a few regional ports. Traders buy up to two goods per docked day when stock and funds allow, then follow routes calculated from the shared river graph and sailing-time model. On arrival they sell cargo subject to the 0–40 market-stock limit. No NPC movement, purchase, or sale occurs during closed-app time.
- NPC activity is shown on the map and in port and town-centre merchant panels. Docked traders can be inspected, traded with one unit at a time, or left without interaction; these optional port interactions never pause or interrupt the player's voyage. All eight goods and 15 ports remain accessible.
- Sailing is refused if the route planner finds no open route or the vessel draft exceeds a channel's abstract minimum depth.
- Routes follow the painted waterways. Where water doesn't reach a town, the journey continues by bullock cart, with a stop to move the cargo, as one continuous trip. Balasore and Bakla-Chandradwip are always reached by cart from their landing. Sonargaon and Malda also have road landings. Cargo stays with the journey, and Patello can never reach Sylhet or Balasore, by any route. Saves are version 20; version 19 voyages move to the new routes keeping their progress.

## Player-owned ships

- The starter boat and each purchased boat have their own name, current port, hull, upgrades, cargo capacity, cargo and purchase-cost basis.
- Buy another boat at Dhaka, Chittagong or Hooghly. It starts at that port with no upgrades and empty cargo. The fleet limit is three ships.

| Class | Price | Hold (per upgrade) | Hull (per upgrade) | Repair per hull | Travel time | Ports | Route trade per good |
|---|---:|---|---|---:|---|---|---:|
| River boat | 25,000 | 12 (+6) | 8 (+3) | 100 Coins | Normal | 15 | 1 |
| Bora | 17,500 | 8 (+3) | 6 (+3) | 100 Coins | 0.8× | 15 | 1 |
| Patello | 45,000 | 30 (+6) | 14 (+3) | 150 Coins | 1.25× | 13 | 4 |

- The starter ship is a River boat. Class stats, prices, shipyards and port limits are game rules, including the Patello's access to Chittagong and Sandwip; they are not historical facts.
- The Patello cannot reach Sylhet or Balasore, and some of its routes are longer. Route previews show the ship's actual path and time. Every class stays under the five-minute voyage cap.
- If the selected ship cannot reach another of your ships, the Fleet panel offers a free **return order**. That ship sails to the selected ship's port or destination as in-game days pass, keeping its cargo. It cannot be managed or given a route until it arrives. A channel closure can delay the order but does not lose the ship.
- Only the selected ship can be managed, repaired, upgraded, loaded, traded or sailed. Switching is allowed while docked, only to a ship at the same port. Other ships remain where they were left.
- The selected ship is locked for the whole player-controlled voyage and is recorded on arrival at its destination. Only non-selected ships assigned an automated route operate independently.
- Assign a non-selected ship to a two-port automated trade route using only visited ports with an open connected river route. Select one or more goods and at least one buy-at-origin and one sell-at-destination rule. Supply up to 5,0 Coins as route capital; buys, sales and cargo use shared market stock, prices and ship capacity. Each River boat or Bora route trades at most one unit per selected good per in-game day checkpoint, and each Patello route up to four, each unit priced against current stock. Routes move only on connected routes the ship can use, and retains its own capital up to 5,0 Coins. Cancel while docked to return remaining route capital to the purse. Pause, edit and cancel are available only while that ship is docked. They remain available while the selected ship is sailing, but not during an unresolved encounter. Routes progress on active in-game sailing-day checkpoints and never while the game is closed. A route that cannot be sailed waits at port without trading. Automation grants no mission or reputation rewards; it does not operate the selected ship, transfer goods between ships, or sail multiple voyages at once.
- Event, military and weather restrictions can close channel segments. The current network has no loop or alternate detour when a segment is closed, and no active segment closure in the Chittagong event.
- The fictional Chittagong alert adds up to one in-game day to the voyage (one real-world minute), capped so no journey exceeds five minutes. It does not assert a documented blockade or port closure.

## City

- Enter the city of the current port while docked. Choose a building directly in the illustrated scene.
- Market, Docks, Warehouse, Town centre, Home and Farm have working interfaces; Mosque and Workshop show their current or planned role.
- Each port can have one warehouse, purchased for 7,500 Coins. It stores 20 goods locally; buy, sell, and ship-hold limits remain separate. Store and retrieve goods one at a time from the city's Warehouse building. Stored goods and their weighted average purchase cost are saved. The warehouse does not expand the ship's hold and does not unlock any port.
- The Town centre shows whether the player has visited, global reputation, and property in that port. Reputation is not yet town-specific.
- Establish one residence in any port for **12,500 Coins**, with no reputation requirement. Residence ownership is saved and creates no mechanical bonus by itself.
- Buy one farm per port for **10,000 Coins**. Each farm grows **1 Rice per full in-game sailing day** after purchase. Production is credited on voyage arrival, only for time spent sailing while the game is active; closing the game adds no time. Each farm stores up to **20 Rice** locally, separate from the warehouse. Production beyond the full limit is lost until goods are collected. Collect Rice only at that port's Farm building; it moves into available ship-hold space and never appears in cargo automatically.
- At the player's residence, the player may explicitly establish a marriage and household for **5,000 Coins**. A residence is required, the player must be at that residence, and the action cannot be repeated. The spouse status, in-game day, future children list and empty heir-designation field are saved. The cost and interaction are gameplay abstractions, not claims about a historical ceremony or custom.
- The **Household** screen shows the residence, spouse status, children placeholder and inheritance placeholder. Children, aging, succession and inheritance rules are not implemented.
- Every port's mission board offers four fixed, one-time contracts: cargo delivery, buy-and-deliver, destination visit, and profitable sale. Accept up to two at a time. Rewards range from 900–1,500 Coins, plus 2 global reputation and 5 local standing at the issuing port. All rewards are paid once; offers do not refresh.
- Local standing is separate from global reputation and ranges from 0–100. Contract completion and an occasional travel event can increase it. For now it is informational only and never gates a city, good, or action.
- Contract deadlines use in-game sailing days and are checked on arrival; the world does not advance while the game is closed. Delivery missions transfer cargo from the ship to the contract on arrival. Purchase-and-deliver missions additionally require the contract's goods to have been bought at the issuing port after acceptance.
- A deterministic river event occurs every fifth voyage and resolves automatically on arrival: a helpful local pilot grants 2 standing at the destination, alternating with rough water that costs 1 hull. These are bounded gameplay events, not historical claims, and never interrupt sailing.
- The generic city art is not a reconstruction of named historic buildings.
- Use **Map** at any time to return to the world.

## Markets, stock and prices

- The market simulation and trading interface expose all eight goods and individual economy profiles at each of the 15 selectable destinations in [TRADE_ECONOMY_DESIGN.md](./TRADE_ECONOMY_DESIGN.md).
- Starting stall stock reflects relative local supply: 16 units for low supply, 20 for neutral supply and 24 for high supply. Stock is saved, changes when you buy or sell, and is capped at **40**. On arrival, each whole sailing day crossed moves every stall one item toward its usual starting stock; NPC trades also alter shared local stock during active in-game time. No stock changes while the game is closed.
- The deterministic buy quote is `max(1, round(base value × (1 + 0.15 × (demand tier − supply tier)) × 30 / (stall stock + 10)) + event modifier)`. Supply and demand tiers are 1 (low), 2 (neutral) or 3 (high); prices are balancing values, not historical prices.
- Stock is bounded from **0–40** and buy quotes from **50–7,800 Coins** under the current goods and profiles. Sell quotes remain 150 Coins below buy, with a 50-Coin minimum. Quotes move in steps of 50 Coins.
- A **Buy** quote is the Coins you pay now; a **Sell** quote is 150 Coins lower than the current buy quote, with a minimum of 50 Coins.
- Buying reduces stall stock and may raise the next quote. Selling increases stock and may lower the next quote. A stall cannot sell below zero stock or accept goods when full.
- Choose a quantity and review the total transaction quote before confirming. Bulk quotes update per unit as the transaction changes stall stock. Purchases check Coins, cargo space and available stock; sales check inventory and stall capacity.
- The interface tracks average purchase price per good using a weighted average. Partial sales preserve the average basis of remaining cargo; selling the last unit clears it. Estimated sale proceeds use the current local selling quote and are not guaranteed profit.
- An active fictional Chittagong alert adds 300 Coins to both salt quotes there. This is a game effect, not a documented historical price.
- Travel events are deterministic, infrequent game abstractions and do not represent documented historical events.
- Port supply and demand profiles create different starting prices, but a route, battle risk and market movement may erase a price difference. There is no guaranteed profit.
- Farm output is kept separate from market stock until collected and sold by the player. There is no autonomous production/consumption, shipments, seasons or offline catch-up.

## Ship, upgrades and encounter

| Upgrade | First cost | Implemented effect |
|---|---:|---|
| Stronger bow cannon | 1,750 Coins | +1 attack per level (starts at 2). |
| Reinforced hull | 1,750 Coins | +1 defence and extra hull per level (starts at 1 defence and 8 hull). |
| Roomier cargo hold | 1,250 Coins | More spaces per level, by vessel class (River boat starts at 12, +6). |

Upgrade cost grows with level; maximum levels are 3 cannon, 2 hull and 3 hold. Each shipyard card shows its current level, next cost and resulting stat before fitting. Hold upgrades add the class's spaces per level (six, or three on a Bora); hull upgrades improve defence and maximum hull; cannon upgrades improve attack. Repairs restore all missing hull at the ship's class rate. Repairs and upgrades are unavailable during a voyage or unresolved encounter, and purchases require enough Coins.

The fictional Chittagong river encounter has 3 hull and 3 attack. It is a one-time first-arrival introduction; the save records whether it has occurred. Later arrivals do not repeat it. Future Chittagong encounters belong to a separate event system.

1. Attack of 3 or more defeats the raider before it can hit.
2. Otherwise, your vessel loses `max(0, 3 − your defence)` hull, up to its current hull.
3. This tutorial encounter does not steal cargo.

## Reputation and optional milestones

- Reputation is a simple global standing score in this prototype. Gain **1 reputation** for the first visit to each port and **1 reputation** for the first profitable sale of each good in each port. A sale is profitable when its proceeds exceed the cargo's weighted average purchase cost. Repeating a visit or the same port-and-good profit does not award more reputation; there are no reputation penalties.
- The **Progress** panel shows three optional goals: visit five ports, make profitable sales in five distinct port-and-good markets, and reach a lifetime peak of 12,500 Coins. Peak wealth remains reached after spending.
- These goals do not unlock content. All 15 ports and eight goods remain open, and trading continues after completing every goal. Local reputation, permissions, contracts, property, and dynasty systems are not part of this foundation.

## Warehouses

- Buy one warehouse in each port for **7,500 Coins**; there are no reputation, wealth-milestone, or access requirements. Each warehouse holds **20 goods**.
- Warehouses are local. The selected ship and each port's warehouse have separate inventories; goods must be carried to a port before being stored or retrieved there. Transfers move one unit at a time and are available only in the current city's Warehouse building.
- Storing and retrieving cargo preserve the weighted average purchase cost used to estimate trade profit. Each ship's hold starts at 12 spaces and is expanded by that ship's upgrades. Warehouse stock and ownership persist in the current save.

## Future systems

Town-specific reputation, political permissions, children, aging, succession, inheritance rules, land, workshops, remote property management, fleet logistics beyond two-port automated routes, captains, advanced contracts and multiplayer are planned. See [GAME_DESIGN.md](./GAME_DESIGN.md) and [ROADMAP.md](./ROADMAP.md).
