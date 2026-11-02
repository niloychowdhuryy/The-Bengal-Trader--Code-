# Stage 4A — City Economic Identity Audit

**Status:** Stage 4A audit findings. Stage 4B adds descriptive identity metadata in [`src/game/city-economic-identities.ts`](./src/game/city-economic-identities.ts); it does not change application behavior, prices, profiles, or save data.

**Scope:** Current market implementation and its fit with the circa-1660–1690 setting and the existing 15-port design. All eight goods and all 15 destinations remain available. This report does not propose unlocks or implement economic changes.

**Stage 4B follow-up:** Each of the 120 city-good combinations now has an explicit economic role, evidence basis, confidence label, note, and source references where established. The added records distinguish documented context from gameplay assumptions and unestablished roles. They are descriptive only and do not feed current market behavior. See the implementation and label definitions in [`TRADE_ECONOMY_DESIGN.md`](./TRADE_ECONOMY_DESIGN.md#stage-4b--normalized-city-good-identity-data).

## Executive findings

- The game already has a distinct static supply/demand profile for each of the 15 ports. Each port carries all eight goods, however, and a missing profile entry silently means neutral supply or demand.
- The model does not distinguish goods **produced locally** from goods **collected nearby**, **aggregated by a trading hub**, or **imported**. Its supply tier represents relative starting abundance only.
- Current stock is saved per port and good, while prices are recalculated from static profile tiers and that stock. Buying and selling change stock and therefore later quotes. There is no production, consumption, replenishment, or NPC trade.
- The implementation supports different prices, but not every economic identity in the design produces a useful trade opportunity. In particular, salt lacks a high-supply source; Patna's and Hooghly's saltpetre profiles are effectively identical; and low supply raises both the player's buying and selling quote even when demand is only neutral.
- Several assignments—especially for Sylhet, Tanda, Malda, Balasore, Jessore, Sandwip, and Bakla–Chandradwip—remain low-confidence game assumptions, not established late-17th-century port inventories.

## 1. Current economy architecture

### Definitions and availability

- [`src/game/model.ts`](./src/game/model.ts) defines the eight `GoodId` values, the 15 `TOWNS`/`MARKET_PORTS`, `PORT_ECONOMIES`, market stock, quote calculation, and buy/sell transactions.
- `CURRENT_MARKET_GOODS` is the full `GOODS` list. The market interface in [`src/App.tsx`](./src/App.tsx) shows every good at the current port, its current local buy and sell quote, market stock, player cargo, quantity input, and confirmed trade actions.
- All eight goods are initially stocked and buyable at every port. Low supply means a lower starting stock and a different price; it is **not** an unavailable or locked good.

### Supply, demand, starting stock

For each port-good pair, the profile uses tiers 1 (low), 2 (neutral), or 3 (high):

- `getMarketSupply(port, good)` returns the explicit supply tier, or **2** if the profile omits the good.
- `getMarketDemand(port, good)` returns the explicit demand tier, or **2** if the profile omits the good.
- Initial market stock is `20 + 4 × (supply − 2)`: 16 for tier 1, 20 for tier 2, 24 for tier 3. Every good starts available. Stock has a cap of 40.
- These values describe a game starting condition. The code does not store a separate production amount, producer, supply shed, or source-versus-transit classification.

### Quotes

At the relevant stock level, the model calculates:

```text
local buy quote =
  max(1, round(base price × [1 + 0.15 × (demand − supply)]
                        × 30 / (stock + 10))
         + applicable event modifier)
local sell quote = max(1, local buy quote − 3)
```

The base values differ by good. The only current market event modifier is the fictional opening Chittagong salt effect (+6 while active); the profile and trade rules are documented in [`GAME_RULES.md`](./GAME_RULES.md).

The interface passes the current saved stock to quote calculation. A call to `getGoodPrice` without a stock argument instead uses the neutral default stock of 20. The transaction quote calculates each unit using the stock after the preceding unit: a multi-unit purchase becomes more expensive as the stall empties; a multi-unit sale receives progressively different quotes as the stall fills.

### Transactions and persistence

- A purchase checks integer quantity, stock, cargo space, and gold; it subtracts cargo and gold and reduces local stock.
- A sale checks integer quantity, player inventory, and market capacity; it adds gold and local stock.
- The player’s average purchase price is saved per good. New purchases update a weighted average; partial sales keep the basis of the remaining units; selling the last unit resets it.
- The version-7 save stores inventory, average purchase price, all port stock, voyage checkpoints, and whether the Chittagong introduction has occurred. Prices are derived rather than separately stored. [`src/game/storage.ts`](./src/game/storage.ts) migrates older save versions through version 7; version 5 cargo receives an estimated cost basis because its historical purchase prices were not saved.
- The tests in [`src/game/model.test.ts`](./src/game/model.test.ts), [`src/game/storage.test.ts`](./src/game/storage.test.ts), and [`src/App.test.tsx`](./src/App.test.tsx) cover all goods and ports, selected differences in supply/demand pricing, stock-sensitive quotes, transactions, quantity trades, UI visibility, and save migration. They do not assert that every port’s economic identity matches a historical producer/market role.

### What the formula means for trade

Supply and demand both affect both sides of the transaction. Low supply increases the buy quote, but it also increases the sell quote because the sell quote is just three gold below the corresponding local buy quote. High demand likewise increases both quotes; it does not create a separately modeled buyer bid. This means a scarce item is expensive for the player to buy and apparently valuable to sell even if local demand is neutral.

Stock changes are the only evolving market input. The calendar does not produce goods or consume them, and time at sea does not change stock. Therefore, trade opportunities are static until the player’s own trades change stock.

## 2. Historical basis and confidence

The starting point is [`TRADE_ECONOMY_DESIGN.md`](./TRADE_ECONOMY_DESIGN.md), which intentionally labels regional identities and tiers as gameplay assumptions rather than historical prices or measured local inventories. The source pages below support broad context, not a complete 1660s city-by-city commodity census:

- The Banglapedia “Foreign Trade” entry describes 17th-century foreign trading houses and names textiles, raw silk, saltpetre, opium, sugar, rice, wax, and lac among exports. This supports a regional trade basket, not the presence or volume of each good in every port.
- “Muslin” describes Dhaka and surrounding weaving places, including Sonargaon, and distinguishes several cloth qualities. It supports a Dhaka-area textile identity; it does not prove equal output at all destinations or exact game-era prices.
- “Silk” describes rural rearing/reeling and specialist weaving as different stages. “Kasimbazar” supports its role as a 17th-century commercial silk centre and link in the river trade network. A market hub should not automatically be labeled the place of production.
- “Saltpetre” supports collection in Bengal and Bihar and specialist export demand. Its cited quantities and price examples are later than the game setting and are not used here as 1660s values.
- “Salt Industry” describes Mughal-period administration and coastal production generally. It does not establish a precise 17th-century salt output for each of Chittagong, Sandwip, or Bakla.
- The “Satgaon” entry supports an earlier export role and the effects of the Saraswati’s changing course. This is a caution against presenting Satgaon as a thriving late-17th-century seaport equivalent to Hooghly.
- The “Dhaka,” “Sonargaon,” and “Rajmahal” entries support their changing political/commercial contexts: Dhaka became the Mughal capital in 1610; Sonargaon lost political pre-eminence after 1611; Rajmahal’s capital role ended when Mir Jumla returned the capital to Dhaka in 1660.
- The “Opium” entry documents early trade and Mughal revenue context but also covers much later colonial cultivation and monopoly systems. The latter must not be projected into 1660–1690.

The sources are encyclopedia articles of uneven scope and are not a substitute for specialist local histories, period records, or quantitative evidence. The research is strongest for Dhaka textiles, Kasimbazar’s commercial silk role, the regional saltpetre trade, and the historical shifts at Dhaka, Sonargaon, Rajmahal, and Satgaon. It is weaker for the specific late-17th-century commodity inventories of the lower-confidence destinations in the matrix.

## 3. City-by-city production, scarcity, and demand matrix

### How to read the matrix

- **D (documented context)** is a broad historical fact from the source record summarized above and in `TRADE_ECONOMY_DESIGN.md`.
- **I (inference)** is a plausible gameplay identity, not a verified late-17th-century local production claim.
- **Model abundance** lists explicit supply tier 3 (“abundant”) or tier 2 (“moderate”). Any goods not listed in the code’s supply profile default to tier 2, which means neutral starting availability—not evidence of local production.
- **Model scarcity** lists explicit tier 1 supply. These goods still begin in stock and remain buyable.
- **High demand** lists explicit demand tier 3. Unlisted demands default to tier 2; only Dhaka saltpetre and Bakla–Chandradwip silk and saltpetre currently have explicit tier-1 demand.
- “Bring” is a design reading of high demand and/or low supply, not a separate mechanic. “Buy outward” describes goods whose profile suggests an abundance source; aggregation and trade-through must be distinguished from local production.

| City | Primary / secondary identity (historical basis) | Model abundance (S3 / explicit S2) | Model scarcity (S1) | Strong local demand (D3) | Bring in / buy outward (design reading) |
|---|---|---|---|---|---|
| **Dhaka** | **D:** Mughal capital and major textile/weaving centre; fine muslin tied to Dhaka and nearby settlements. Rice as provisioning/distribution is **I**, not proof of urban production. | **S3:** Bengal cotton textiles. **S2:** rice. | None. | Rice, salt. | Bring rice and salt for high demand. Buy textiles as the strongest local source identity. |
| **Sonargaon** | **D:** Earlier port and muslin reputation; reduced political and commercial role after 1611. A smaller regional cloth bazaar is **I**. | **S2:** rice, cotton textiles. | None. | Salt. | Bring salt. Treat cloth as a regional secondary market, not a second Dhaka-sized producer. |
| **Kasimbazar** | **D:** Major 17th-century commercial centre and silk mart; its supply basin and trading role should not be confused with every unit being produced in town. | **S3:** raw silk. **S2:** rice. | None. | Rice, salt. | Buy silk for onward trade. Bring rice and salt. |
| **Chittagong** | **D:** Coastal/international port; political control changed with the Mughal capture in 1666. Coastal salt production is documented broadly, but city-level 1660s supply is not established. | **S2:** rice, salt. | None. | Rice, salt. | Bring provisioning goods, especially rice and salt in the model. The current profile does not make Chittagong a strong salt source; treat through-trade as provisional. |
| **Sylhet** | **D:** Northeastern river and upland geography. Rice and lac collection are **I**; the cited modern geography does not prove a 17th-century inventory. | **S2:** rice, lac. | None. | Salt, cotton textiles. | Bring salt and cloth. Rice/lac are modest regional-market possibilities, not established export surpluses. |
| **Hooghly** | **D:** 17th-century trading-factory and river-port hub. The broad supply profile should mean aggregated / through-traded goods, not six local industries. | **S3:** rice, cotton textiles, silk, sugar, saltpetre, opium. **S2:** salt. | None. | Rice, salt, cotton textiles, silk, saltpetre. | Use as an onward-trade and buyer hub, but avoid assuming it produces all six S3 goods. Salt is its clearest model import need. |
| **Satgaon** | **D:** Earlier port with an export record; channel change and decline make an active late-17th-century seaport identity uncertain. A legacy/inland market is a deliberate game abstraction. | None. | Rice, sugar, lac. | Salt. | Bring salt; scarcity may make the game’s sale quote attractive for low-supply goods, but the destination’s late-century market role needs review. |
| **Rajmahal** | **D:** Strategic river town and former capital; capital moved back to Dhaka in 1660. Provisioning/transit identity is **I**. | **S2:** rice. | Raw silk, saltpetre. | Rice, salt. | Bring salt and rice. Do not treat scarce silk/saltpetre as a documented local producer or guaranteed buyer. |
| **Tanda** | **D:** Historical regional/administrative importance; late-17th-century town-level inventory is not established. Its lower supply is a gameplay assumption. | None. | Rice, sugar, cotton textiles, silk. | Salt. | Bring salt; consider cloth and other scarce goods only as a testable market opportunity. The model scarcity alone currently raises the sale quote even at neutral demand. |
| **Malda** | **D:** Gaur–Malda hinterland context; specific late-17th-century port stock is not established. Rice/sugar and specialist goods are **I**. | **S2:** rice, sugar. | Silk, lac. | Salt. | Bring salt. Avoid describing silk/lac scarcity as a verified local production deficit without further research. |
| **Balasore** | **D:** Adjacent coastal Odisha market, not a core Bengal producer. Exact city-level good mix is not established by the sources used. | **S2:** rice. | Salt. | None (all current profile demand is neutral tier 2). | Potential salt need is only inferred from low supply; model currently gives no strong buyer demand. Use as an external coastal exchange point only with explicit uncertainty. |
| **Jessore** | **I:** Southwestern agricultural collection market; rice and sugar are plausible gameplay identities, but this design has no period-specific evidence for the assigned local quantities. Later opium evidence must not be back-projected. | **S3:** rice. **S2:** sugar. | None. | Salt. | Bring salt. Rice is the clearest proposed outward cargo, subject to the weak baseline margin described below. |
| **Sandwip** | **D:** Island/coastal geography. Salt and rice production or supply at this specific destination is **I** pending direct evidence. | None. | Rice, salt. | Rice, salt, cotton textiles. | Bring rice, salt, and cloth. Do not use the current profile as proof that Sandwip produced salt. |
| **Bakla–Chandradwip** | **D:** A regional lower-delta label, not a securely identified single port-town. Rice/salt/lac assignments are **I**. | **S3:** rice. | Salt, lac. | Salt, cotton textiles. | Bring salt and cloth; rice is a candidate regional surplus. Resolve the map/settlement abstraction and source uncertainty before calling it a fixed historical port economy. |
| **Patna** | **D:** Bihar/Ganges commercial gateway. Saltpetre from the wider Bengal–Bihar region and an opium trade are historically supported in broad terms; town-level production versus aggregation and exact 1660s scale need caution. | **S3:** saltpetre, opium. **S2:** rice. | None. | Saltpetre, cotton textiles, silk, salt. | Buy saltpetre/opium as regional supply-basin trade goods; bring salt, textiles, and silk for the model’s strong demand. Opium requires a separately approved period-appropriate regulation design. |

### Current profile coverage at a glance

Only six destinations have at least one explicit tier-3 supply group: Dhaka (textiles), Kasimbazar (silk), Hooghly (six goods), Jessore (rice), Bakla–Chandradwip (rice), and Patna (saltpetre and opium). No city has tier-3 supply of salt or lac. Hooghly’s six abundant goods make it a broad aggregation profile, not a plausible single-source producer for all of them.

Several profile pairs contradict or fail to express the written design cleanly:

- The design proposes a coastal salt source, but Chittagong has only tier-2 salt supply; Sandwip and Bakla have tier-1 salt supply. There is no high-supply salt source in the model.
- Patna and Hooghly both have tier-3 supply and tier-3 demand for saltpetre. At initial stock they therefore produce the same quotes, so the intended “Patna source → Hooghly export buyer” signal is absent.
- Rice supply is high at Jessore and Bakla, but the current local buy/sell equations do not make high-supply-to-high-demand rice a robust margin.
- Lac has no high-supply source. The two explicit low-supply profiles are Satgaon and Malda, which makes the model scarcity signal stronger than the documented location evidence.
- High demand is sparse and often not paired with distinct supply. Most unspecified relationships default to neutral rather than expressing researched local needs.

## 4. Trade network recommendations

These are market-design candidates over the existing navigable graph, not historical itineraries verified by this audit. The routes do not change navigation. “Lower risk” means no Chittagong-arrival encounter trigger in the current game; it is not a historical safety claim. The game currently has no general random encounter system.

| Candidate journey | Economic reasoning | Current-model status / caution |
|---|---|---|
| **Dhaka → Sonargaon → Dhaka** (short, lower encounter exposure) | A beginner’s short textile-and-essentials loop. Dhaka’s textile abundance can contrast with a smaller regional market; carry limited cloth and compare salt/rice quotes. | Best short candidate, but Sonargaon’s market size is a gameplay abstraction after its post-1611 decline. The profile’s demand is only neutral for textiles; test actual quotes rather than promise a profit. |
| **Jessore → Dhaka** (short/medium, rice) | A plausible hinterland-to-capital provisioning run. | Clear design target, but the current initial one-unit rice quotes exactly offset: Jessore buy is 6 gold and Dhaka sell is 6 gold before travel or other costs. The profile does not currently reward this intended staple route. |
| **Kasimbazar → Dhaka → Hooghly** (multi-city, raw silk) | Buy from the Kasimbazar silk-market profile, sell or compare in Dhaka, then use Hooghly as the documented export-oriented trade hub. Return with goods sought in the west. | The Kasimbazar-to-Dhaka silk difference can support a modest baseline trade under initial stocks. Hooghly is an aggregator in the design, but its high supply and demand can flatten its price signal. Do not assume a guaranteed result after stock changes. |
| **Dhaka → Patna** (longer, fine textiles) | Carry Dhaka-area cloth toward the profile’s strong textile demand in the Bihar gateway; compact cargo suits a longer voyage. | The baseline tiers create a stronger buy/sell contrast than the short staple loop. Market rules and actual multi-unit quotes must still be checked; historical supply at Dhaka and demand in Patna are broad roles, not exact fixed prices. |
| **Kasimbazar → Patna → Rajmahal** (longer western loop, silk and essentials) | Connect the silk mart to a Bihar buyer, then compare provisions and scarce specialist goods at a transit market. | A useful exploration loop but only the Kasimbazar silk role is strongly supported. Rajmahal’s low silk/saltpetre supply does not by itself prove buyer demand; current sale quotes can reward scarcity without demand. |
| **Hooghly → Tanda / Malda** (less-obvious northern market exploration) | Explore secondary markets for sugar, cloth, and specialist cargo instead of repeating the major hubs. | The current model can generate a large apparent sale quote at Tanda from tier-1 supply even though demand is neutral. Treat this as a balance defect to resolve, not a historically supported guaranteed arbitrage. Tanda and Malda need stronger place-specific research. |
| **Jessore → Bakla–Chandradwip → Sandwip → Chittagong** (multi-stop coastal/delta circuit) | Combine rice provisioning with the lower delta and coastal markets; salt is an obvious candidate to carry inland if a source market is properly established. | Rice supply and demand tiers suggest a circuit, but the initial Jessore-to-Dhaka rice example shows the current formula can erase margins. The model has no high-supply salt source. Chittagong arrival invokes the current fictional encounter and salt modifier; Sandwip/Bakla output remains provisional. |
| **Patna → Hooghly** (specialist saltpetre / opium corridor) | Broad regional history supports Bengal–Bihar saltpetre trade and a commercial outlet role at Hooghly. Opium is a second high-value regional commodity only if rules and historical framing are approved. | Saltpetre currently has identical tier-3 supply and demand at both ends, so the model creates no differentiated corridor. Opium supply is also high at both Patna and Hooghly; no legal or state-control behavior is modeled. |

No route should be called profitable solely because its source is marked “high supply” and destination “high demand.” Before balancing, compute actual starting and bulk quotes from the shared model, include the fixed spread and stock changes, and report a route as an opportunity only if the intended direction survives those calculations. The examples above are design targets, not a new promise of profit.

## 5. Weaknesses and risks in the current simulation

1. **Supply is not provenance.** The model cannot say whether stock was locally produced, collected in a nearby hinterland, imported, or aggregated. Hooghly’s breadth makes this especially visible.
2. **All goods are available everywhere.** The user requirement keeps that behavior for testing, but it means scarcity is price-only and cannot represent a missing trade chain or a market that depends on imports.
3. **Demand is symmetric in the quote formula.** Demand raises what the player pays as well as what the player receives. The code has no independent merchant bid, buyer capacity, or willingness-to-buy curve.
4. **Scarcity alone boosts a sale quote.** A low-supply, neutral-demand market can pay a high price under `sell = buy − 3`. For example, the apparent attraction of selling sugar in Tanda is driven by scarcity despite no tier-3 demand.
5. **The fixed three-gold spread is not proportional to good value.** It is a much larger share of low-value rice than high-value opium or silk and can erase modest opportunities or make high-value trades unusually favorable.
6. **Limited time evolution.** Stalls recover toward their profile-based starting stock by one unit per full sailing day crossed on arrival. This is a bounded gameplay abstraction, not evidence of production. There is still no harvest, NPC action, shipment, or consumption.
7. **Neutral fallback masks missing research.** Omitted profile values become tier 2, which is playable and deterministic but can look like researched equal availability.
8. **Current profiles are not balanced as a network.** Several historically intended source/buyer pairings have equal effective tiers; salt has no abundant source; Hooghly’s profile is broadly abundant; and modeled route opportunities can be accidental effects of low supply rather than demand.
9. **Quote work scales with quantity.** `getTradeQuote` loops once for every requested unit, while the UI calculates a quote before its cargo-capacity check. This is normally fine for ordinary trades, but an extremely large manually entered quantity can trigger unnecessary work; any future refinement should bound requested quantities before quote calculation.
10. **Profile updates can change old-save prices.** Stocks persist but profiles and base prices are code constants. Updating those constants changes derived quotes for existing version-7 saves even though their saved stocks do not change. Future profile changes should be treated as balance-data changes and regression-tested; adding time-evolving state would need explicit save/version and elapsed-time rules.

## 6. Recommended implementation plan

This sequence is a proposal only. The current audit has not implemented any stage.

### Stage 4B — Approve and normalize identity data

- Approve the city roles and resolve the questions in section 7 before changing profiles.
- Represent each good’s local role as a small explicit category: local production/collection, hinterland source, aggregation/through-trade, import dependency, or no established local role.
- Keep all 15 destinations and all eight goods selectable and tradable. Categories must affect explanation and balance only; they must not silently lock markets.
- Leave every uncertain assignment explicitly tagged as a gameplay assumption.

### Stage 4C — Rebalance deterministic starting profiles

- Make a minimal adjustment to supply and demand tiers only after profile approval; preserve the current simple deterministic model and save version if no saved data shape changes.
- Add test assertions for every intended source and buyer relationship, not only representative ports. Verify price ordering and starting stock across all 15 × 8 port-good pairs.
- Evaluate source buy quotes against destination sell quotes for the proposed short, long, and multi-city journeys. Include quantity effects, the sell spread, and cargo capacity. A test should catch unintended parity or a windfall.
- Address the supply-only sale premium. A later model could give player sales an explicit local bid based on demand and current stock, independent from the buy offer, with visible rules.
- Constrain quantity before calculating a bulk quote to avoid needless work on invalid input.

### Stage 4D — Player-facing economic identity

- Explain a market’s role in plain language (for example, “silk mart” or “river provisioning market”) and show whether a good is locally sourced or traded through only when the design record supports that label.
- Show current stock and prices as already implemented; do not imply a historical fixed price, guaranteed profit, or proven local production from a tier.
- Keep the current compact eight-good interface and its mobile/desktop layout.

### Later approved stages — deterministic market evolution

- Only after separate approval, add deterministic stock flows that are tied to visible and documented causes. Do not bundle farms, production buildings, NPC merchants, shipments, seasons, random events, or unlock restrictions into this audit.
- Define the time step, caps, offline catch-up behavior, and when production/consumption runs. Persist a last-simulated in-game time or equivalent so closing and reopening cannot duplicate stock, reset prices, or avoid elapsed consequences.
- Preserve existing saves through a migration if a new saved economic state is introduced; all 15 ports and eight goods must remain active during testing.

## 7. Historical uncertainties and decisions needing approval

1. **Which temporal snapshot governs each market?** The game begins around 1665, while Chittagong’s Mughal capture occurred in 1666. Should the market model change control context during that transition, or remain a simplified post-campaign setting?
2. **Salt source geography:** May Chittagong be treated as a regional coastal supplier, or should the player-facing source be a broader coastal supply shed? Current sources support coastal/Mughal-period salt production broadly but not Sandwip-specific 1660s output.
3. **Hooghly’s role:** Should its broad high stock represent a trade warehouse/aggregation hub, not local production? This is the least misleading reading of the current wide supply profile.
4. **Satgaon’s active-play role:** Keep the requested destination as a smaller legacy/inland market, or use an explicitly fictionalized “market catchment” abstraction? The map and game may retain the destination, but historical exposition should not call it a thriving late-17th-century seaport without stronger evidence.
5. **Bakla–Chandradwip:** Confirm that this is a regional lower-delta market abstraction rather than a single verified port. Its exact settlement and map placement need a separate geographical decision.
6. **Low-confidence commodity assignments:** Seek targeted sources or retain gameplay-only labels for Sylhet, Tanda, Malda, Balasore, Jessore, Sandwip, and Bakla–Chandradwip before using “produced here” language.
7. **Opium:** Decide whether the market is an abstract historical commodity with unrestricted test trading, or whether a future stage should model period-appropriate state control. Do not import the later colonial monopoly or China-trade system into this setting.
8. **All goods in all markets:** Preserve this as the current testing rule. If future production has locally scarce or absent goods, represent that through stock/price first; do not introduce purchase locks unless separately approved.

## Source notes

The existing research record and full citations are in [`TRADE_ECONOMY_DESIGN.md`](./TRADE_ECONOMY_DESIGN.md). The following Banglapedia entries were directly checked for this audit; they are used for bounded context and are not treated as quantitative local market data:

- [Foreign Trade](https://en.banglapedia.org/index.php?title=Foreign_Trade)
- [Muslin](https://en.banglapedia.org/index.php?title=Muslin)
- [Silk](https://en.banglapedia.org/index.php?title=Silk)
- [Saltpetre](https://en.banglapedia.org/index.php?title=Saltpetre)
- [Salt Industry](https://en.banglapedia.org/index.php?title=Salt_Industry)
- [Satgaon](https://en.banglapedia.org/index.php?title=Satgaon)
- [Kasimbazar](https://en.banglapedia.org/index.php?title=Kasimbazar)
- [Dhaka](https://en.banglapedia.org/index.php?title=Dhaka)
- [Sonargaon](https://en.banglapedia.org/index.php?title=Sonargaon)
- [Rajmahal](https://en.banglapedia.org/index.php?title=Rajmahal)
- [Opium](https://en.banglapedia.org/index.php?title=Opium)
