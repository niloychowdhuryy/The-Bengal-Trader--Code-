# Game Rules

These are rules implemented in the current slice. Systems described as planned are not available in the game yet.

Recommended future design decisions, which are not all implemented, are recorded in [CORE_GAME_RULES.md](./CORE_GAME_RULES.md).

## Start and save

- Start in Dhaka with **5,000 Coins**, **2 rice + 1 fine cloth**, a **12-item hold** and a basic wooden vessel.
- Each good takes one place in the hold.
- Progress saves to IndexedDB on this device. Version 19 saves add each ship's vessel class and any return order; version 18 ships migrate as River boats with everything else unchanged. Version 20 saves use the rebuilt routes. Version 26 saves change no data. Farms cost more from this version, so the command log restarts; farms already bought are kept. Version 25 saves add the merchant rankings, first counted from the save's current state. Version 24 saves add a debt record, empty for every existing game. Version 23 saves add 22 merchants and a world seed. Version 22 saves give stalls three times the stock, keeping each stall's share, and use a single world clock. Version 21 saves count in Coins: every older amount becomes exactly ×50, and the original save is kept as a backup under **More → Save backups**. Version 18 saves also persist each non-selected ship's automated route, route capital and recent activity. Version 17 fleets migrate with no routes assigned and empty activity logs; the selected ship and active voyage remain unchanged. Version 16 saves migrate their current vessel into one named ship without resetting cargo, upgrades, condition, Coins or voyage progress. Earlier versions migrate through the existing steps before receiving newer features. Version 15 saves preserve NPC trader state while removing the former voyage encounter; version 14 saves initialize bounded traders. Older voyage formats without a saved progress checkpoint restart the active trip at its route duration rather than using closed-app wall time. Production app files can be cached for offline reopening after first visit.

## Map and navigation

- Tap a port to see its context. Choose **Enter city** at your current port or **Travel to this port** elsewhere.
- The supplied illustrated map shows 15 market destinations. Each is selectable, with a marker placed at its settlement on the artwork. The route graph follows the waterway shapes depicted in the illustration; see [MAP_ROUTE_NOTES.md](./MAP_ROUTE_NOTES.md) for connections and historical uncertainty.
- Each voyage is planned as one continuous waterway path between its origin and destination. Intermediate port nodes are not used as waypoints; the route preview, travel estimate and moving ship all use the same path. Route estimates use polyline distance, not straight-line distance. The longest normal navigable route takes exactly five real-world minutes while the game is open; shorter routes take the same fraction of that time as their river distance. One real-world minute underway equals one in-game day, including fractional days. This is a gameplay scale, not a historical sailing-time claim.
- Voyages advance only while the game is open. Closing or backgrounding the game does not advance in-game time; reopening resumes with the same in-game travel time remaining as at the last saved checkpoint.
- Four named NPC merchants travel between ports and trade within the same saved market stock. They start at Dhaka (Abdul Rahman), Sonargaon (Mariam Banu), Kasimbazar (Govinda Das), and Patna (Fatima Khatun). Their names, home ports, preferences, and routes are game abstractions, not claims about documented individual merchants or exact historic trade roles.
- 26 fictional merchants share the world. They update only as active sailing crosses full in-game days, so they stop whenever you're not sailing or the game is closed. Each has a real ship with its usual limits, a finite purse and a hold, and buys and sells at the same prices you do. They also pay crew and port costs for each day at sea.
- Merchants differ. Cautious ones wait for large margins and short trips, bold ones take thinner margins and longer trips, and steady ones sit between. A route must be worth sailing before they'll load, and then they keep loading while the next unit still pays, across several goods if needed. Bulk carriers accept thinner margins per unit, so larger ships carry more. Specialists stick to their goods, regional traders stay near home until they've done well, and others go wherever the price gap is widest. Merchants buy a bigger ship at a shipyard when their trading record says it would pay for itself and they'd still have working capital left, unless that ship couldn't reach their home waters. Ambitious merchants do this sooner, and also buy bigger holds.
- Merchants leave at least 40% of a stall's usual stock for the town, and won't flood it past 160%. One who runs out of money and cargo lays up the ship and gets no help. One who hasn't traded for a while accepts thinner margins.
- Merchant ships sail on the map and wait at the docks. Tap one to see who it is, where it's going and what it carries. On a touch screen, tapping a busy dock lists its ships. You can also see them all under **More → Rival merchants**. Markets note a rival's recent trades at each stall. In the Town centre, a docked merchant with unsold cargo can sell you a unit at a time. These interactions are optional and never pause or interrupt you.
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
- Assign a non-selected ship to a two-port automated trade route using only visited ports with an open connected river route. Select one or more goods and at least one buy-at-origin and one sell-at-destination rule. Supply up to 250,000 Coins as route capital; buys, sales and cargo use shared market stock, prices and ship capacity. Each River boat or Bora route trades at most one unit per selected good per in-game day checkpoint, and each Patello route up to four, each unit priced against current stock. Routes move only on connected routes the ship can use, and retains its own capital up to 250,000 Coins. Cancel while docked to return remaining route capital to the purse. Pause, edit and cancel are available only while that ship is docked. They remain available while the selected ship is sailing, but not during an unresolved encounter. Routes progress on active in-game sailing-day checkpoints and never while the game is closed. A route that cannot be sailed waits at port without trading. Automation grants no mission or reputation rewards; it does not operate the selected ship, transfer goods between ships, or sail multiple voyages at once.
- Event, military and weather restrictions can close channel segments. The current network has no loop or alternate detour when a segment is closed, and no active segment closure in the Chittagong event.
- The fictional Chittagong alert adds up to one in-game day to the voyage (one real-world minute), capped so no journey exceeds five minutes. It does not assert a documented blockade or port closure.

## City

- Enter the city of the current port while docked. Choose a building directly in the illustrated scene.
- Market, Docks, Warehouse, Town centre, Home and Farm have working interfaces; Mosque and Workshop show their current or planned role.
- Each port can have one warehouse, purchased for 7,500 Coins. It stores 20 goods locally; buy, sell, and ship-hold limits remain separate. Store and retrieve goods one at a time from the city's Warehouse building. Stored goods and their weighted average purchase cost are saved. The warehouse does not expand the ship's hold and does not unlock any port.
- The Town centre shows whether the player has visited, global reputation, and property in that port. Reputation is not yet town-specific.
- Establish one residence in any port for **12,500 Coins**, with no reputation requirement. Residence ownership is saved and creates no mechanical bonus by itself.
- Buy one farm per port for **20,000 Coins**, the same for every farm. Each farm grows **1 Rice per full in-game sailing day** after purchase, and collecting it costs **150 Coins per Rice**. A short purse collects what it can pay for, and the rest stays on the farm. That cost becomes the Rice's purchase price in profit estimates. Production is credited on voyage arrival, only for time spent sailing while the game is active; closing the game adds no time. Each farm stores up to **20 Rice** locally, separate from the warehouse. Production beyond the full limit is lost until goods are collected. Collect Rice only at that port's Farm building; it moves into available ship-hold space and never appears in cargo automatically.
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
- Starting stall stock reflects relative local supply: 48 units for low supply, 60 for neutral supply and 72 for high supply. Stock is saved, changes when you buy or sell, and is capped at **120**. Each whole sailing day, every stall moves part of the way back toward its usual starting stock; NPC trades also alter shared local stock during active in-game time. No stock changes while the game is closed.
- The deterministic buy quote is `max(1, round(base value × (1 + 0.15 × (demand tier − supply tier)) × 30 / (stall stock + 10)) + event modifier)`. Supply and demand tiers are 1 (low), 2 (neutral) or 3 (high); prices are balancing values, not historical prices.
- Stalls usually hold **48–72** units, and at most **120**. Prices stay between **40% and 250%** of a good's base price, and move in steps of 5 Coins.
- A **Buy** quote is the Coins you pay now. A **Sell** quote is 12% below what that unit would cost to buy back, so buying and reselling at one port always loses money, at any stock level and any quantity.
- A full River boat hold moves a typical price by about 12% and a full Patello hold by up to 40%, so large trades get steadily worse. Each day, a stall closes part of the gap to its usual stock: 12% for towns that produce a good or buy a lot of it, 8% for most, and 6% for towns that do neither. It always moves at least 1–3 units, for what a town makes and uses in an ordinary day. Emptied stalls get halfway back in 6–12 days.
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

Upgrade cost grows with level; maximum levels are 3 cannon, 2 hull and 3 hold. Each shipyard card shows its current level, next cost and resulting stat before fitting. Hold upgrades add the class's spaces per level (six, or three on a Bora); hull upgrades improve defence and maximum hull; cannon upgrades improve attack. Repairs restore all missing hull at the ship's class rate, or as much as the purse can pay for. Repairs and upgrades are unavailable during a voyage or unresolved encounter, and purchases require enough Coins.

The fictional Chittagong river encounter has 3 hull and 3 attack. It is a one-time first-arrival introduction; the save records whether it has occurred. Later arrivals do not repeat it. Future Chittagong encounters belong to a separate event system.

1. Attack of 3 or more defeats the raider before it can hit.
2. Otherwise, your vessel loses `max(0, 3 − your defence)` hull, up to its current hull.
3. This tutorial encounter does not steal cargo.

## If a merchant runs out of options

A ship with 0 hull can't sail, and time only passes while sailing, so a player with no money and nothing to sell could otherwise be stuck for good.

A moneylender at the docks helps only when both of these are true:

- **No money to carry on:** at 0 hull, the purse can't pay for 1 hull. With hull left, the purse can't buy the cheapest good at any port the ship can reach.
- **No other way to raise it:**
  - no cargo that can be sold (here, if the ship can't sail)
  - no goods in a warehouse in reach
  - no farm in reach that the purse can collect from: it needs at least 150 Coins, and a crop already grown if the ship can't sail
  - no other sound ship in this port, or, if the ship can sail, no cargo on another ship
  - no route capital that can be called back
  - no visit contract that can still be completed, if the ship can sail

The advance patches the hull to 2 if it's lower and brings the purse up to 1,000 Coins. The player owes all of that plus a quarter, rounded up to 5 Coins, and loses 2 reputation. The debt doesn't grow with time.

Until the debt is repaid at the docks, in full or in parts, the player can't buy ships, upgrades, warehouses, farms or a residence, set up a household, or put capital into a trade route. Trading, repairs, contracts and sailing all still work. If a repayment would leave the player unable to buy goods or pay for repairs, with nothing to sell, the Docks show what would be left in the purse and ask them to confirm. A debt counts against net worth, so an advance always leaves the player worth less than before.

The moneylender is a game invention, not a documented historical practice.

## Merchant rankings

**More → Merchant rankings** compares the player with the 26 merchants on two boards. The player's rank and the gap to the merchant immediately above are always shown, and tapping a rival opens their profile. These rankings are offline, and only read the game: they never give or take anything.

**Wealthiest merchants** ranks by net worth:

| Counts as | Value |
|---|---|
| Coins in the purse | In full |
| Coins held by trade routes (goods a route has bought count as goods instead) | In full |
| Goods on any ship, in a warehouse or waiting on a farm | 80% of the good's fixed reference price, not today's market price |
| Ships and every upgrade level bought | 60% of purchase cost |
| Warehouses, farms and the residence | 70% of purchase cost |
| Debt to the moneylender | Subtracted in full, so net worth can go below zero |

A household's cost counts for nothing, because it isn't a property. Merchants are valued the same way. They have no routes, property or debt.

**Most influential merchants** ranks the player and every merchant by the same rule: personal reputation alone. Merchants have no local standing, so the player's doesn't count towards this score. It stays where it's already shown and keeps its existing uses.

**Counting:** the rankings are counted on every world day that is a multiple of 5, including during a voyage, and they don't change in between. Arrows show each merchant's change in rank since the count before. A new game is counted on day 0, and an older save is first counted when it's loaded, so neither shows movement until the next count. Equal scores keep their previous order. Nothing is counted while the game is closed.

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
