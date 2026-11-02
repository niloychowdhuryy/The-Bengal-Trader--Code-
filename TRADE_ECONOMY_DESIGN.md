# Stage 3A — Trade Economy Research and Design

**Status:** Historical and economic research baseline. The deterministic market, eight-good trading interface, descriptive Stage 4B city-good identity data, bounded Stage 4 market recovery, and Stage 12A NPC trading are implemented; NPC production remains out of scope.  
**Setting:** Bengal and connected Ganges-Bihar and Bay of Bengal trade, circa 1660–1690.  
**Goods:** Exactly eight proposed market goods.  
**Destinations:** The 15 places in the Stage 3A brief. All have market profiles and are available through the playable map and river-navigation graph.

## Stage 4B — Normalized city-good identity data

[`src/game/city-economic-identities.ts`](./src/game/city-economic-identities.ts) contains an explicit identity record for every one of the 15 cities and every one of the eight goods. Each record describes the city's broad economic context and assigns each city-good pair one role:

- **Local production or collection:** produced or gathered at/near the named place. Use only where the evidence supports this distinction.
- **Hinterland source:** the city's market catchment is treated as a regional source; this does not assert production within the city.
- **Aggregation / through-trade:** stock is represented as collected, consolidated, imported, or resold through a market hub; it is not local production.
- **Import dependency:** a modeled need or limited local source makes incoming supply a useful gameplay identity.
- **No established local role:** current research does not establish a port-specific role. This does not claim the good was absent.

Every assignment states its basis (`documented-context`, `gameplay-assumption`, or `not-established`), a confidence label, a plain-language note, and the supporting source IDs when applicable. “Documented context” is bounded to the note and citations; it does not mean an exact 1660s stock, price, or volume is known. Low-confidence assignments are gameplay assumptions, never documented local production.

This is **descriptive data only**. It does not feed `PORT_ECONOMIES`, starting stock, quote calculations, transactions, availability, save data, or the market interface. Existing supply/demand tiers remain balancing inputs, not evidence of production. In particular:

- Hooghly's broad profile is described as aggregation and through-trade, not production of every abundant good.
- Satgaon remains a smaller playable legacy/inland market, not a thriving late-17th-century seaport.
- Bakla–Chandradwip is a lower-delta regional market abstraction, not a verified single port.
- Salt is identified as a broad coastal supply role, not a claim that one named island or town is proven to have produced it.
- Opium remains freely available and tradable; identity records add no restrictions.

The focused tests in [`src/game/city-economic-identities.test.ts`](./src/game/city-economic-identities.test.ts) verify full city-good coverage, valid role/evidence/confidence labels, uncertainty labeling, and representative existing stock and quote values.

## How to read the evidence

- **Documented** means the cited source supports the historical statement, within its stated period and limits.
- **Design inference** means a plausible regional supply/demand relationship for a future game market. It is not a measured 17th-century quantity, price, or guaranteed commercial pattern.
- **Confidence** describes confidence in the historical basis for assigning the broad identity, not certainty about exact inventories.
- Source articles sometimes summarize many centuries or use later evidence to describe current geography and industries. A later source is not proof of 1660s production. Where the source does not establish a town's late-17th-century output, this design says so rather than presenting a game assumption as fact.

Bengal is treated as a connected but regionally varied delta and river basin, not as one uniform market. Contemporary river routes and navigability varied, and the project's small route graph is an abstraction. Economic relationships below are trading hypotheses only; they do not establish routes, sailing schedules, or historical transport times.

## The eight goods

The value and demand tiers below are **game-design baselines** (low / medium / high), not historical prices or measured consumption. A tier should be allowed to vary by town, season, stock, event, and buyer. “Typical demand” is broad across the proposed roster; the port profiles identify important local variation.

| # | Good | Relative value | Typical demand |
|---|---|---|---|
| 1 | Rice | Low per cargo unit | High |
| 2 | Salt | Low–medium per unit | High |
| 3 | Bengal cotton textiles (including fine muslin) | High for fine grades; medium for ordinary cloth | Medium |
| 4 | Bengal silk (raw silk as the standard cargo unit) | High | Medium |
| 5 | Sugar and molasses | Medium | Medium |
| 6 | Saltpetre | Medium | Low locally; high in specialist export markets |
| 7 | Opium | High | Low–medium, concentrated in specialist and elite/medicinal buyers |
| 8 | Lac resin | Medium–high | Low–medium |

### 1. Rice

- **Historical background:** Rice was a staple food and one of the agricultural products moving through Bengal's markets. The *Ain-i-Akbari* records paddy among Bengal's agricultural products, while the Banglapedia account of Satgaon lists rice among exports from the port in its earlier commercial period. The wider 17th-century export list includes foodgrain. [S1, S2, S8]
- **Class:** Locally produced agricultural staple; traded within the region and, in some contexts, exported.
- **Producing regions:** Broadly the fertile delta and river plains. The design should model a seasonal and local surplus, not assign invented production totals to each town.
- **Consuming/trading regions:** Urban and administrative centres, riverine settlements, port provisioning, and areas experiencing a local shortage.
- **Value / demand:** Low value per cargo unit; high and broadly distributed demand. It is a dependable essential, not a guaranteed high-margin trade.
- **Storage/transport:** Bulky; keep dry and protected from water, pests, and spoilage. Cargo capacity and voyage length should make it costly to haul long distances relative to fine goods.
- **Design note:** Model availability as harvest- and stock-sensitive. A poor harvest, seasonal disruption, or crowded town can change local demand, but must be an explicit game event or simulation, not a hidden historical claim.

### 2. Salt

- **Historical background:** Salt was an essential commodity. Banglapedia's account of the salt industry describes coastal salt-making as an old activity and notes salt production and state administration in Mughal-period coastal Bengal. Its detailed production geography and statistics are mostly much later; they should not be back-projected as 17th-century measurements. [S7]
- **Class:** Locally manufactured by evaporating saline water in coastal areas; also a commodity that could be moved inland through trade.
- **Producing regions:** Coastal Bengal is the broad documented context. Chittagong's coastal region is a reasonable candidate source; specific output at Sandwip or individual port sites needs further verification before being stated as fact.
- **Consuming/trading regions:** Inland river markets, towns, households, food preservation and crafts. Demand should remain broad because salt is an essential.
- **Value / demand:** Low–medium value per unit; high demand. It is bulky and useful, so shortages can matter more than its unit margin.
- **Storage/transport:** Keep dry and sealed against rain and river water. It is not perishable like food, but moisture can damage or reduce its saleability.
- **Design note:** Coastal abundance and inland scarcity are a regional gameplay hypothesis, not a fixed price ladder. Salt production could be seasonal and weather-sensitive; exact local producer locations and volumes are not established here.

### 3. Bengal cotton textiles (including fine muslin)

- **Historical background:** Bengal textiles were important in regional and overseas commerce. Banglapedia describes Dhaka-origin muslin made with locally produced cotton, and identifies fine muslin production and reputation at Sonargaon. The 17th-century foreign-trade summary includes textiles among exports. [S1, S3, S10]
- **Class:** Locally manufactured. Cotton is spun and woven into ordinary cloth and fine grades; muslin is the premium end of this one market good, not an additional ninth good.
- **Producing regions:** Dhaka and nearby weaving centres are documented for muslin. Sonargaon has a documented earlier reputation; by this period its reduced political and commercial importance after 1611 should prevent assuming it remained equal to Dhaka. Other regional production is possible but should be treated as an inference unless tied to specific evidence.
- **Consuming/trading regions:** Bengal towns, administrative and commercial centres, and overseas trade through major river and coastal entrepôts.
- **Value / demand:** Medium for ordinary cloth and high for fine muslin; medium overall demand with high value concentrated in premium grades and buyers.
- **Storage/transport:** High value for low volume, but protect from water, dirt, insects, and rough handling. Premium cloth can fit a small hold and reward careful market selection.
- **Design note:** Use quality or grade variation inside the textile good if desired; do not create multiple near-identical cloth commodities merely to inflate the item count. No exact historic price premium is asserted.

### 4. Bengal silk (raw silk as the standard cargo unit)

- **Historical background:** Silk production in Bengal had a long history, with rural households producing cocoons and reeling raw silk, and specialists weaving silk textiles. Banglapedia documents 17th-century silk activity around the Murshidabad/Kasimbazar area; Kasimbazar was a major commercial centre on the Bhagirathi during this century. Silk and raw silk are included in accounts of Bengal foreign trade. The much larger later-18th-century company trade should not be treated as a measure of the 1660s market. [S1, S4, S11, S17]
- **Class:** Locally produced and manufactured: silkworm rearing and reeling yield raw silk; weaving yields finished cloth. The standard game cargo is raw silk so it is distinct from cotton textiles.
- **Producing regions:** Rural silk-producing districts feeding the Kasimbazar/Murshidabad commercial area; other producing areas require local evidence before assigning strong abundance.
- **Consuming/trading regions:** Weaving centres and merchant hubs, with onward trade to other Asian and European markets.
- **Value / demand:** High value; medium general demand, with strong demand from specialist weavers and long-distance merchants.
- **Storage/transport:** Compact and valuable; keep dry, clean, and secure. Higher theft exposure can be a game risk, but it is a design rule rather than a claim about a specific historical route.
- **Design note:** Do not imply that every “silk port” produced the raw material. Distinguish producing villages from the market town that aggregates, finances, and resells it.

### 5. Sugar and molasses

- **Historical background:** Sugar appears among the exports listed for Satgaon in Banglapedia's port history; sugar also appears among commodities exported from Bengal by European trading companies. This supports a commercial role but not a town-by-town output estimate for 1660–1690. [S1, S8]
- **Class:** Locally manufactured from sugarcane. Molasses is included with sugar as a lower-refinement grade of the same good, not another SKU.
- **Producing regions:** Sugar-growing and processing areas in Bengal's agricultural hinterland; the specific 17th-century supply shed for each named destination is not established by the sources used here.
- **Consuming/trading regions:** Town households, food and drink makers, merchants, and overseas or interregional trade.
- **Value / demand:** Medium value and medium demand. Processing and quality can create meaningful local differences.
- **Storage/transport:** Refined sugar should be kept dry and protected from pests; molasses is heavier, sticky, and vulnerable to leakage. A future market can represent both as one abstract cargo with a modest quality/handling penalty.
- **Design note:** Do not apply modern sugarcane district statistics to the 17th century. A sugar-rich port is a scenario assumption unless supported by a period source.

### 6. Saltpetre

- **Historical background:** Saltpetre was an important Bengal-and-Bihar export, especially for gunpowder markets. Banglapedia describes its collection from sandy areas in Bengal and Bihar, its use in gunpowder and other products, and European competition for it. The article's detailed export figures are from the 1730s, so this design uses them only as later evidence of importance, not as 1660s volumes or prices. Saltpetre is also listed among Bengal's export commodities. [S1, S5]
- **Class:** Collected and processed from mineral-rich earth; not an ordinary farm crop.
- **Producing regions:** Sandy tracts of Bengal and Bihar. Patna is a plausible aggregation and trade hub for the Bihar supply basin, but the port profile does not claim that all saltpetre was mined or produced in Patna.
- **Consuming/trading regions:** Government and military procurement, gunpowder makers, and long-distance merchants.
- **Value / demand:** Medium cargo value; low general household demand but high specialist demand and strategic importance.
- **Storage/transport:** Keep dry and segregated; the cargo is more weather-sensitive than cloth or metal goods. Do not simulate explosive handling without a clear, proportionate game rule.
- **Design note:** This is a differentiated trade good: its buyers are specialized and its market can react to military demand. Avoid turning military events into a guaranteed profit signal.

### 7. Opium

- **Historical background:** Banglapedia describes opium as known in Bengal before the 17th century, taxed under Mughal rule, and traded by maritime companies; it includes opium among Bengal's export commodities. It also notes large later cultivation and export changes under colonial rule. Those later monopolies and China-trade scales must not be attributed to 1660–1690. [S1, S6]
- **Class:** Locally grown poppy and processed latex product, with internal trade and export; the precise 17th-century production map is not established here.
- **Producing regions:** Bengal and the adjacent Bihar production region are broad candidates. The Banglapedia locations (Jessore, Nadia, Rajshahi and Bihar) are cited in the entry in a much later context; do not use them to assert 17th-century town-level abundance without corroboration.
- **Consuming/trading regions:** Medicinal and elite markets, state revenue channels, and specialist long-distance merchants. Consumption should not be portrayed as universal or harmless.
- **Value / demand:** High value per unit; low–medium and uneven demand. Its high unit value is balanced by uncertain legality, buyer access, and potential event restrictions.
- **Storage/transport:** Compact but valuable; protect from heat, contamination, loss, and theft. Future mechanics should make regulation and consequences clear rather than rewarding indiscriminate trafficking.
- **Design note:** Keep the item a historical trade good, not an endorsement of use. No real-world drug-use instructions or implied universal consumption belong in player-facing text.

### 8. Lac resin

- **Historical background:** Lac (spelled “lax” in one Banglapedia trade summary) is listed among Bengal export products. Banglapedia's Satgaon history specifically includes lac among the port's earlier exports. These references support lac as a commodity moving through Bengal, but do not establish a precise 17th-century production locality or volume for each destination. [S1, S8]
- **Class:** Collected from lac insects on host trees and processed into resin/dye material; for this design it is a single abstract trade good.
- **Producing regions:** Forest and wooded hinterlands connected to Bengal's river and inland markets. Assigning a strong supply to a particular named port is a gameplay inference pending more local evidence.
- **Consuming/trading regions:** Craft, dye, sealing, and merchant markets; it can travel onward through riverine or coastal hubs.
- **Value / demand:** Medium–high value relative to its hold space; low–medium demand concentrated in specialist craft and trade buyers.
- **Storage/transport:** More compact and durable than grain, but quality can vary and heat/contamination may affect processed forms.
- **Design note:** Avoid conflating raw lac, shellac, and finished lacquerware as if they were identical historical products. The game's single unit abstracts a marketable processed/resin lot.

## Port-by-port economic profiles

**Abundance/needs are relative design categories**, not historical stock counts. “High” or “medium” should seed a future simulation and remain affected by stocks, season, access, and events. The confidence column marks the basis for the profile: **High** = strong period-specific source; **Medium** = a documented regional/period identity but limited town-level trade detail; **Low** = primarily an explicitly labeled gameplay inference.

| Destination | Principal economic activity and trading character | Likely relative abundance (design supply) | Likely needs / demand (design) | Confidence and historical caution |
|---|---|---|---|---|
| **Dhaka** | Mughal provincial capital from 1610; administrative population, river-linked commerce, and a major textile market. | Cotton textiles/muslin **high**; rice **medium** as a distribution market, not necessarily urban production. | Rice and salt **high**; silk and sugar **medium**; saltpetre **low–medium**. | **High** for capital, river connection and muslin context. The city article gives administrative and urban evidence; textile abundance follows the muslin sources. Do not claim exact 1660s output. [S3, S9] |
| **Sonargaon** | Historic port and commercial centre with a renowned muslin tradition; after 1611 it lost political pre-eminence and gradually declined commercially as Dhaka became the Mughal capital. Treat it as a connected regional bazaar, not an equal second capital. | Fine cotton cloth **medium** in the regional market; rice **medium** as an agricultural hinterland proxy. | Salt **high**; rice, sugar, and silk **medium** according to seasonal supply. | **High** for earlier port status, muslin reputation, and post-1611 decline. The exact 1660–1690 market size is unknown. [S10] |
| **Kasimbazar** | Major 17th-century commercial centre on the Bhagirathi, linked to Rajmahal, Bhagalpur, Patna, and Dhaka; silk brokerage and weaving. | Raw silk **high**; silk goods **medium–high** in the market. | Rice and salt **high**; cotton cloth **medium**; saltpetre **medium** through western connections. | **High** for 17th-century silk trade and routes as described by Banglapedia. Later 18th-century dominance must not be projected backward as exact scale. [S11] |
| **Chittagong** | International sea port and coastal exchange point. In 1660–1690, political control changed: Mughal forces captured it in 1666 after a campaign; do not treat the whole period as politically static. | Salt **medium** as a coastal-supply hypothesis; rice **medium** as provisioning; through-traded goods can include textiles, silk, saltpetre and opium without claiming local production. | Rice and salt **high** for provisioning; textiles and sugar **medium**; saltpetre **medium** for specialist buyers. | **High** for port and 1666 political transition; **low–medium** for exact commodity mix. Coastal salt supply is a plausible association, not a verified city-level 17th-century quantity. [S1, S7, S13, S14] |
| **Sylhet** | Northeastern riverine market linked to the Surma-Kushiyara basin and upland hinterlands. Use as a regional collection and provisioning market, not a documented major export entrepôt. | Rice **medium**; lac **low–medium** as a wooded-hinterland hypothesis. | Salt **high**; cotton textiles **medium–high**; sugar **medium**. | **Low** for specific 17th-century trade identity. Modern geography establishes river and upland context, not period output. All commodity assignments are provisional gameplay assumptions. [S18] |
| **Hooghly** | Major river-port and European trading-factory centre in the 17th-century Bengal trade network; merchant entrepôt, not necessarily producer of everything sold there. | Cotton textiles, raw silk, sugar, rice, saltpetre and opium **medium–high as aggregated market supply**, sourced from hinterlands and other ports. | Rice and salt **high** for provisioning; raw silk and premium cotton cloth **medium** as export-market demand. | **High** for factory/trade-hub role. Port-level market breadth is an inference from the documented export basket and factory network. Do not confuse Hooghly with the later city of Calcutta. [S1, S14] |
| **Satgaon** | Former port and commercial centre. The Saraswati channel silted and the old port lost maritime usefulness; by the late 17th century it should be a legacy/inland market or settlement attached to the wider Hooghly trade, not a thriving seaport equivalent to its earlier period. | Rice, sugar, and lac **low–medium**, representing legacy regional exchange rather than documented late-century bulk export. | Salt **high**; cotton cloth, rice, and sugar **medium**. | **High** for earlier exports and changing river course; **low** for exact late-17th-century market activity. The game destination must not be presented as a verified active 1660s seaport. [S8] |
| **Rajmahal** | Ganges crossing/strategic administrative town and former capital. Shah Shuja made it a capital from 1639; Mir Jumla moved the capital back to Dhaka in 1660. Its role in this setting is a transit and provisioning market, not a continuously expanding capital. | Rice **medium** as a hinterland/provisioning assumption; silk and saltpetre **low–medium** as through-trade. | Rice and salt **high**; textiles and sugar **medium** for administration and town demand. | **High** for political and river history; **low–medium** for commodity abundance, which needs town-level evidence. [S12] |
| **Tanda** | Former Bengal capital/administrative centre in the Gaur-Malda region, represented as a smaller inland market in this period. Its urban and riverine importance changed over time; avoid treating it as a modern port with stable access. | Rice and sugar **low–medium**; textiles and silk **low** as local market supply unless specifically established by further research. | Salt **high**; rice, cotton cloth, and silk **medium**. | **Low** for town-level late-17th-century trade. The broad region's agricultural products do not prove Tanda's own abundance. Seed this as a modest regional market hypothesis. [S15, S16] |
| **Malda** | Market for the Gaur-Malda hinterland and a plausible inland exchange point. Do not collapse it into the earlier political history of Gaur or infer that the modern district boundary existed. | Rice and sugar **medium**; silk **low–medium** as a regional supply hypothesis; lac **low–medium**. | Salt **high**; cotton cloth and silk **medium**; saltpetre **low–medium** via western trade. | **Low–medium** for the specific late-17th-century mix. The sources establish Bengal products and regional commercial links better than they establish a Malda port inventory. [S1, S2, S15] |
| **Balasore** | Coastal Odisha port on the southern edge of the proposed network; model as an external coastal exchange and provisioning market, not as a Bengal producer. | Rice **medium** as a coastal provisioning hypothesis; salt **low–medium** pending specific period evidence. Textiles and silk may arrive by trade. | Cotton textiles, silk, sugar, and saltpetre **medium** for onward merchant demand; rice **medium** for shipping provisions. | **Medium** for coastal gateway role within the broader regional trade; **low** for the exact good mix at Balasore itself. The EIC source documents an early factory at Hariharpur on the Mahanadi delta, not a Balasore-specific inventory. [S14] |
| **Jessore** | Riverine agricultural hinterland and collection market in the southwest. Use as a grain/sugar supplier with connections toward coastal channels and inland towns. | Rice **medium–high**; sugar **medium** as a crop-processing assumption; lac **low**. | Salt **high**; cotton textiles **medium**; silk and saltpetre **low–medium**. | **Low–medium** for 17th-century local trade. Later sources associate Jessore with indigo, but that is not sufficient evidence for a 1660s–1690s indigo boom; indigo is not included in this eight-good roster. [S6] |
| **Sandwip** | Island/coastal market and transshipment point in the Bay of Bengal approaches. Treat it as sensitive to storms, political control, and coastal access; do not make those risks a claim about any community. | Salt **low–medium** and rice **low–medium** as island/coastal provisioning hypotheses. | Rice, salt, and cotton textiles **medium–high**; sugar and silk **medium** when coastal traffic permits. | **Low** for exact period output at the island. Chittagong coastal salt is documented generally; Sandwip-specific production and export need more direct evidence. [S7, S13] |
| **Bakla–Chandradwip** | A regional delta/coastal market identity rather than a clearly documented single port-town. Represent the wider lower-delta exchange area, not a fixed urban wharf. | Rice **medium–high** and salt **low–medium** as delta/coastal gameplay assumptions; lac **low**. | Salt and textiles **medium–high**; sugar **medium**; saltpetre and silk **low–medium**. | **Low** for town-level period commerce. The regional name and river/coastal setting do not by themselves establish the proposed inventory. Do not present this as a researched fixed historical port. |
| **Patna** | Major Bihar/Ganges commercial hub connected to Bengal's western river corridor. A gateway and aggregation point, particularly for saltpetre and opium supply from the wider Bihar region. | Saltpetre **high**; opium **medium–high** as a regional collection hypothesis; rice **medium**. | Cotton textiles and silk **high** for merchant demand; salt **medium–high**; sugar **medium**. | **Medium–high** for the Bihar supply corridor and Bengal/Bihar saltpetre; **medium** for opium. Do not claim Patna alone produced all traded stock. [S4, S5, S6, S11] |

### Reconciling destinations with historical place identities

- **Hooghly and Satgaon are not interchangeable.** Hooghly is the 17th-century active trading-factory hub in the sources used here. Satgaon was important earlier; the changing Saraswati channel undermined its port function. A future game may keep both destinations for play, but must explain Satgaon as a reduced inland/legacy market or make its port status an explicit alternate-history/gameplay abstraction.
- **Bakla–Chandradwip is a regional label**, not evidence of a single town-port with a verified 17th-century market. Define its map location and settlement abstraction separately in a later geography stage.
- **Balasore is outside the core Bengal delta.** Its inclusion creates a useful coastal connection but should be framed as an adjacent regional market.
- **Patna is in Bihar**, yet is commercially relevant through the Ganges and saltpetre/opium exchange. Its presence does not mean Bihar is part of every historical definition of Bengal.
- The other named destinations are not all established as equal-size ports. Future implementation should model market scale and role rather than make the player visit 15 equivalent profit centres.

## Regional supply and demand logic

These are the initial balancing hypotheses for a later simulation:

1. **Delta food and essentials:** Rice moves from harvest-surplus hinterlands toward administrative centres, ports, and local deficit markets. Salt moves from coastal production/collection zones inland. Both are high-demand staples with low-to-medium unit value and significant cargo-space cost.
2. **Textile value chain:** Cotton textiles are made in specialist centres and sold in dense markets or consolidated for export. Dhaka is the strongest candidate for premium muslin; Sonargaon's earlier reputation should be tempered by its post-1611 decline. Hooghly is a trade outlet, not the assumed source.
3. **Silk aggregation:** Rural silk production feeds specialist weaving and merchant markets around the Kasimbazar/Murshidabad region. Patna and Hooghly can be buyer or onward-trade markets without being producers.
4. **Processed crops:** Sugar and molasses turn agricultural output into a tradable good. Their abundance is local and seasonal; market demand varies with population, provisioning, and merchant traffic.
5. **Strategic mineral commodity:** Saltpetre follows a specialist Bihar/Bengal supply chain, with Patna a likely aggregation hub and Hooghly/other export houses as onward buyers. Military procurement can raise demand, but should also change access, not simply grant a guaranteed windfall.
6. **Regulated high-value cargo:** Opium is a compact, high-value commodity with uncertain and uneven buyers. State revenue and market rules should matter. Its later colonial monopoly and China trade are explicitly outside this period's assumptions.
7. **Craft/forest material:** Lac is a compact specialist good with a plausible wooded-hinterland supply chain and historical export evidence. Exact producing ports are not established; keep regional availability modest and uncertain.
8. **Regional difference matters:** Supply should be strongest only where a source supports production or a stated inference. A hub may have plentiful goods because it aggregates shipments, but this is different from local production and should be represented as such.

## Illustrative trading opportunities

These are strategic examples, not fixed routes or guaranteed arbitrage. The map graph and river navigability remain unchanged in Stage 3A.

- Carry rice from a surplus hinterland market toward Dhaka, Rajmahal, or a coastal port when local stocks are low. Bulky cargo and a weak harvest can erase the apparent advantage.
- Buy coastal salt around the Chittagong region (and, only as a provisional game assumption, Sandwip) for inland markets such as Dhaka, Sylhet, Rajmahal, or Patna. Rain, season, access, and competing stock should change the opportunity.
- Buy fine cotton cloth in Dhaka or nearby textile markets and sell through Hooghly or an overseas-facing market. Premium value suits a small hold, but quality and buyer demand should be uncertain.
- Move raw silk from the Kasimbazar area toward Hooghly or specialist buyers in Dhaka/Patna. The player chooses between keeping it raw for a merchant market or waiting for future access to a weaving system.
- Move sugar/molasses from a producing hinterland or a legacy Satgaon-area market toward urban demand. The game must not assume Satgaon remains a flourishing seaport in the late 17th century.
- Carry saltpetre from Bihar/Patna toward export or military demand at a major trading hub. Political restrictions, specialist buyers, and cargo handling keep it from being a universally profitable commodity.
- Sell lac through an inland or coastal merchant hub when a specialist buyer is active. Its compactness allows mixed cargo, but sparse demand makes holding it risky.
- Opium might be bought or sold only where the future game explicitly models legal and state controls. The player should see why a market is restricted; no route should guarantee a price premium.

### No guaranteed arbitrage

The existing design already says that local finite stock changes quotes and that no route guarantees profit. Preserve that principle. Future market prices and stocks should reflect visible causes such as local supply, demand, season, event disruption, buyer capacity, and the player's own transactions. Do not encode one permanent “buy here, sell there” price table as historical fact. A base supply/demand profile may be a starting condition, not a promise of profit.

## Stage 3B simulation baseline

The simulation encodes the relative supply and demand profiles above as tiers: low = 1, medium or unspecified = 2, and high = 3. Unspecified port/good relationships use the neutral tier rather than implying a documented local trade. Starting stock is 20 units plus or minus 4 for each tier above or below neutral (16, 20, or 24 units); the stock ceiling remains 40.

Quotes are deterministic and derived from the saved local stock and the static port profile. For each good, its base value is multiplied by `1 + 0.15 × (demand tier − supply tier)` and by `30 / (stock + 10)`, then rounded to whole gold. Prices have a minimum of 1 gold. Selling pays 3 gold less than the current buy quote. The Chittagong salt event adds its existing 6-gold quote modifier, affecting both buy and sell quotes. These are balancing values, not historical prices.

Buying removes stock and selling adds stock, so subsequent quotes change. Multi-unit trades quote each unit against the local stock remaining after the preceding unit in that transaction. Market stock and player holdings are saved; supply/demand tiers and prices are reproducible from the versioned design data and do not reroll on load. The map exposes all 15 market profiles and eight goods.

The implemented Stage 4 market recovery is a small rule layered on this baseline: on voyage arrival, each full in-game sailing day crossed moves every stall one unit toward its existing starting-stock target (16, 20, or 24, according to the current supply tier). Stage 12A adds four deterministic, fictional merchants whose purchases and sales affect this same shared stock on full active sailing-day checkpoints. Each merchant starts with 100 gold and a three-item hold, can hold no more than 180 gold, buys up to two goods per docked checkpoint, and sells on arrival only where market capacity allows. Traders include goods specialists, an arbitrage-seeking trader that checks reachable price differences, and a regional trader that chooses the nearest preferred port. Their routes use the shared river graph and sailing-time model. Stock remains bounded from 0 to 40; buy quotes remain from 1 to 156 gold under current goods and profiles. NPC movement and trading do not occur during closed-app time. The existing Chittagong alert is the only temporary market price event and retains its bounded six-gold salt quote modifier until sailing day 36. There is no NPC production, consumption, or autonomous goods creation.

The four named traders, their preferences, schedules, routes, and price behavior are gameplay abstractions; they are not claims about documented individuals or established historic city trade roles. Docked traders appear in a port panel where the player may inspect their intentions and cargo, buy one carried unit at the local stock-sensitive buy quote, or leave. These optional interactions do not block or pause player travel. Market purchases previously deducted the goods from stall stock, so direct transfer from merchant cargo does not remove that same unit from market stock again.

Non-selected player ships may run optional, two-port automated trade routes between visited ports with an open connected river path. The player supplies route capital from the purse (up to 5,000 gold), chooses per-good buy-at-origin and sell-at-destination rules, and can manage the route only while that ship is docked, including while the selected ship is sailing. Each route processes up to one unit per selected good per in-game day checkpoint (up to four, each re-priced, for a Patello), using the same stock-sensitive quotes and shared 0–40 market stock as the player and NPCs. Ship cargo and route capital are separate per vessel; route capital cannot exceed 5,000, and cancelling at a dock returns the balance. Automation progresses only when active in-game sailing time crosses a full-day checkpoint. It does not award player mission or reputation progress, generate goods, transfer cargo to the player's ship, or advance while the game is closed. This is intentionally a small automation layer, not a captain or fleet logistics system.

## Trading interface and player cost basis

The market interface displays all eight goods at every accessible port, including local buy/sell quotes, available stall stock, player holdings and quantity-based trade controls. Players select a quantity, review the stock-sensitive total, then confirm the purchase or sale. The interface prevents unaffordable purchases, cargo-capacity overruns, sales beyond inventory, and sales that would exceed market capacity.

The saved player record tracks an average purchase price per good. On a purchase, the new average is `(existing average × existing quantity + transaction total) / resulting quantity`. A partial sale preserves the remaining average; selling all units resets it to zero. Estimated local proceeds use the current local selling quote and are informational, not guaranteed profit. New-game starter cargo is assigned the local starting-port buy quote as a cost basis despite being granted without a gold charge.

Save version 18 stores the cost basis alongside the Chittagong-introduction flag, paused voyage progress, bounded NPC merchant state, each player ship's cargo and purchase-cost basis, and automated route rules, capital, location and progress. Version 17 saves migrate with each existing ship preserved and automation unassigned; active voyage progress is retained. Version 16 saves migrate the current vessel and any active voyage into a single starter-ship record; earlier versions pass through the existing migrations first. Version 15 saves preserve merchant position, cargo, capital, activity and voyage checkpoints while migrating trading strategies from each saved identity and removing the former voyage-interrupt encounter. Version 14 saves initialize traders at their home ports with 100 gold, empty cargo, no activity history, and simulation time based on the saved sailing day. Version 5 saves did not record historic purchase costs, so migration estimates the average using the saved cargo quantity and the current port's local buy quote; this cannot recover the true historical cost.

## Future implementation assumptions

1. Keep the roster at **exactly these eight market goods** unless a later approved stage explicitly changes it. Grades (for example, ordinary cloth vs. fine muslin; refined sugar vs. molasses) should be variants or quality attributes, not extra goods.
2. Keep all eight goods exposed through the interface unless a later approved progression stage explicitly adds unlocks. The market model and port profiles remain the source of truth for market behavior.
3. Treat value/demand tiers and each port's abundance/needs as initial gameplay parameters, not historical prices, quantities, or proof of local production.
4. Separate **produced locally**, **collected locally**, **aggregated from hinterland**, and **imported/through-traded** stock in data or market explanations. A trading hub is not automatically a production site.
5. Add other market influences such as seasonal production, NPC production, shipment arrival/loss, and market events only as visible causes with documented implementation rules. Do not generate unexplained price changes.
6. Do not attribute 19th-century indigo production, 18th/19th-century company monopolies, or later export volumes to the 1660–1690 setting.
7. Before assigning fixed abundance to **Sylhet, Tanda, Malda, Sandwip, Balasore, or Bakla–Chandradwip**, find stronger place- and period-specific evidence or retain the low-confidence gameplay label.
8. Do not alter ports, routes, locations, city scenes, travel times, voyage saves, or encounter mechanics based on this design document.
9. Keep historical facts and invented market behavior visually and textually distinct in player-facing content.

## References

The following references are used for historical context. Where a reference spans multiple centuries, only the stated relevant claim is used; later data are not treated as 17th-century measurements.

- **[S1]** “Foreign Trade,” *Banglapedia: National Encyclopedia of Bangladesh*. Summarizes 17th-century trading houses and export goods including textiles, raw silk, saltpetre, opium, sugar, rice, wax, and lac; also includes later historical context. https://en.banglapedia.org/index.php?title=Foreign_Trade
- **[S2]** “Trade and Commerce,” *Banglapedia: National Encyclopedia of Bangladesh*. Regional river and sea-borne trade context and discussion of source limitations; much of the entry concerns periods before the target setting. https://en.banglapedia.org/index.php?title=Trade_and_Commerce
- **[S3]** “Muslin,” *Banglapedia: National Encyclopedia of Bangladesh*. Dhaka-origin production, local cotton, and textile background. https://en.banglapedia.org/index.php?title=Muslin
- **[S4]** “Silk,” *Banglapedia: National Encyclopedia of Bangladesh*. Bengal silk production chain, raw silk and woven goods, rural production, and exports. https://en.banglapedia.org/index.php?title=Silk
- **[S5]** “Saltpetre,” *Banglapedia: National Encyclopedia of Bangladesh*. Bengal/Bihar sandy-area collection, uses and export competition; the entry's quoted figures include 1733–1738 and are not used as 17th-century data. https://en.banglapedia.org/index.php?title=Saltpetre
- **[S6]** “Opium,” *Banglapedia: National Encyclopedia of Bangladesh*. Early references in Bengal, Mughal revenue context, maritime trade, and much later production/monopoly history. https://en.banglapedia.org/index.php?title=Opium
- **[S7]** “Salt Industry,” *Banglapedia: National Encyclopedia of Bangladesh*. Coastal salt-making and Mughal-period administrative references; most detailed statistics are modern. https://en.banglapedia.org/index.php?title=Salt_Industry
- **[S8]** “Satgaon,” *Banglapedia: National Encyclopedia of Bangladesh*. Earlier export list (including rice, cotton-stuffs, sugar and lac), the Saraswati river's changing course, and the port's decline. https://en.banglapedia.org/index.php?title=Satgaon
- **[S9]** “Dhaka,” *Banglapedia: National Encyclopedia of Bangladesh*. Dhaka's 1610 capital status, river connection, and 17th-century urban context. https://en.banglapedia.org/index.php?title=Dhaka
- **[S10]** “Sonargaon,” *Banglapedia: National Encyclopedia of Bangladesh*. Earlier port and muslin reputation, and its political/commercial decline after the Mughal conquest of Musa Khan in 1611. https://en.banglapedia.org/index.php?title=Sonargaon
- **[S11]** “Kasimbazar,” *Banglapedia: National Encyclopedia of Bangladesh*. 17th-century Bhagirathi commercial centre, silk market, and links to Rajmahal, Bhagalpur, Patna, and Dhaka. The entry also discusses much stronger later-18th-century trade. https://en.banglapedia.org/index.php?title=Kasimbazar
- **[S12]** “Rajmahal,” *Banglapedia: National Encyclopedia of Bangladesh*. Rajmahal's capital status under Raja Man Singh and Shah Shuja, and Mir Jumla's return of the capital to Dhaka in 1660. https://en.banglapedia.org/index.php?title=Rajmahal
- **[S13]** “Chittagong District,” *Banglapedia: National Encyclopedia of Bangladesh*. Long-distance port context, coastal geography, and Mughal capture in 1666; modern district statistics are not used for 17th-century markets. https://en.banglapedia.org/index.php?title=Chittagong_District
- **[S14]** “East India Company, The,” *Banglapedia: National Encyclopedia of Bangladesh*. English factory chronology in Bengal: Hariharpur in 1633, Hooghly in 1633, Kasimbazar in 1658, Dhaka in 1668, and Calcutta in 1690. https://en.banglapedia.org/index.php?title=East_India_Company,_The
- **[S15]** “Ain-i-Akbari,” *Banglapedia: National Encyclopedia of Bangladesh*. Describes Abul Fazl's administrative work and its Bengal sections on geography, products, and revenue units; also cautions that some historical summaries are less dependable than its administrative/geographic material. https://en.banglapedia.org/index.php?title=Ain-i-Akbari
- **[S16]** “Rice,” *Banglapedia: National Encyclopedia of Bangladesh*. Rice as staple crop and basic agricultural context. Modern statistics are not used as 17th-century output. https://en.banglapedia.org/index.php?title=Rice
- **[S17]** “Murshidabad,” *Banglapedia: National Encyclopedia of Bangladesh*. Reports 17th-century silk and silk-textile trade around the site and Kasimbazar; explains that Murshidabad's capital status begins in the early 18th century. https://en.banglapedia.org/index.php?title=Murshidabad
- **[S18]** “Sylhet District,” *Banglapedia: National Encyclopedia of Bangladesh*. Modern geographic description of the Surma, Kushiyara and upland border setting only; it is not evidence for the proposed 17th-century commodity inventory. https://en.banglapedia.org/index.php?title=Sylhet_District

## Open research before future economy expansion

- Verify period-specific local supply and market roles for Tanda, Malda, Jessore, Sandwip, Bakla–Chandradwip, and Balasore using primary or specialist regional histories.
- Confirm whether the proposed Sandwip and Bakla–Chandradwip destinations represent ports, islands, river stations, or regional market catchments in the intended map chronology.
- Find stronger evidence for the place-specific 1660–1690 salt and lac supply chains before elevating those ports from provisional abundance to high confidence.
- If an implementation later models opium or state-regulated goods, research late-Mughal controls and local variation separately; do not borrow colonial institutions.
- Treat *Ain-i-Akbari*, European factory records, and traveler accounts as partial perspectives: administrative records, company interests, and elite travel observations do not by themselves describe all producers, prices, or consumers.
