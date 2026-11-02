# Stage 13 Vessel Classes — Design for Approval

**Status:** Proposed, not implemented. No code changes until approved. All stats are gameplay values and are untested in play.

**Scope:** Three vessel classes, per-ship draft and the version 19 save. Captains, cargo handoffs, shipment loss and complex route orders stay out; none is needed by this design. The fleet limit stays at three ships, all 15 ports and eight goods stay in the game, and ships still cannot be sold.

## 1. Classes

| | River boat | Bora | Patello |
|---|---|---|---|
| Role | All-rounder | Cheap and quick | Bulk carrier |
| Purchase | 500 gold (starter is free) | 350 gold | 900 gold |
| Hold | 12 | 8 | 30 |
| Hold per upgrade level | +6 (max 30) | +3 (max 17) | +6 (max 48) |
| Hull | 8 | 6 | 14 |
| Hull per upgrade level | +3 (max 14) | +3 (max 12) | +3 (max 20) |
| Repair, per hull point | 2 gold | 2 gold | 3 gold |
| Travel time | Normal (×1) | Fast (×0.8) | Slow (×1.25) |
| Draft (internal) | 1.4 | 1.2 | 1.5 |
| Ports reachable | 15 | 15 | 13 (not Sylhet or Balasore) |

Every existing ship becomes a River boat with its stats unchanged. Attack, defence and upgrade prices are the same for every class.

**Why these numbers:** upgrade prices are already fixed (hold 150 gold in total, hull 105 gold), so class prices were checked with them included.

| Fully upgraded hold | Total cost | Hold | Gold per hold space |
|---|---|---|---|
| Bora | 500 | 17 | 29.4 |
| River boat | 650 | 30 | 21.7 |
| Patello | 1,050 | 48 | 21.9 |

- The Bora's hold upgrade is +3 because, at +6, it would reach 26 spaces for 500 gold and make the River boat pointless.
- The Patello starts at 30 spaces because, at a lower figure, an upgraded River boat would beat it outright.
- Stock-sensitive prices already limit bulk buying: a stall holds 16–24 units at the start, and each purchase raises the next quote.
- **What each class is for:** Bora for early money and tight contract deadlines, River boat for full map access, Patello for large loads on the main network.

## 2. Speed

- `sailingSpeed` is already taken: it is the player's 1×/2×/4× time control. The class value is a separate, derived `travelFactor`, and the time control does not change.
- `getRouteTravelTime` multiplies normal route time by the factor, adds the existing Chittagong alert delay, then applies the existing five-minute cap.
- Keeping the cap preserves the documented rule that no voyage exceeds five minutes. The side effect is that Patello voyages of 4 normal days or more all take five minutes.
- In-game days still equal sailing minutes, so a slow ship advances markets, farms and contract deadlines further per voyage. That is the intended cost of slow travel.

## 3. Draft and port access

**Measured on the current route graph:**

| Draft | Result |
|---|---|
| Up to 1.4 | All 15 ports connected |
| 1.5 | 13 ports connected; Sylhet and Balasore cut off |
| 1.6 | Splits into 11 separate groups |
| 1.8 and above | Almost no connections |

Any draft above 1.5 would strand ships, so **1.5 is the maximum**. The Bora's 1.2 has no effect today, because no channel is that shallow.

**Rules:**
- Ship planning merges the ship's draft with `navigationConditions`, using the larger value. NPC merchants are unchanged.
- Classes never change, and ships can only be bought at Dhaka, Chittagong or Hooghly, which are all inside the 13-port network. A Patello therefore can never end up somewhere it cannot leave.
- Draft can lengthen routes: 11 of 105 port pairs change for a Patello. The worst is Bakla–Sandwip, from 0.9 to 3.6 days. The longest Patello route is 4.6 normal days. The route preview must show this before sailing.
- Player text says "too large for the narrow channels", not "too deep". The sources call the patello very flat, so a deep draft would be misleading; the restriction is a game rule about size.

## 4. When a ship cannot serve a port or route

| Situation | What happens |
|---|---|
| Patello selected, player taps Sylhet or Balasore | Port details stay open. Travel is disabled with the reason and a pointer to use another ship. Nothing is lost. |
| Setting up a Patello route | Unreachable ports are left out of the list, with a note saying why. The model also refuses them with a new `too-large` error. |
| Contract names an unreachable port | The contract can still be accepted, with a warning on the card. Another ship can complete it. |
| Temporary channel closure | Unchanged: the voyage is refused, and an automated ship logs "waiting at port". |
| Saved route becomes impossible after a later rebalance | The ship waits at port and logs why. The save validator deliberately does not check draft, so a balance change cannot make a save unloadable. |
| **A ship is out of reach of the selected ship** | See below. |

**The one real trap:** switching ships requires both to be at the same port. A River boat can finish at Sylhet through an automated route. If that route is then cancelled and the other ships are Patellos, the player can never reach it to switch.

**Fix, using existing mechanics:** any docked non-selected ship can already be given a route remotely, and I confirmed that a zero-capital route still sails. The Stage 13 work is therefore:
- The route editor allows 0 gold starting capital, which the model already permits.
- The Fleet card explains: "Out of reach of your current ship. Set up a route to bring it back."

No new order type or cargo handoff is needed. The ship keeps its cargo, and the player can cancel the route once it docks somewhere reachable.

## 5. Automated routes (Stage 12C)

- Routes, rules, capital, pause, edit and cancel behave as they do now. Automation rewards are unchanged.
- Route setup and day-by-day planning use the ship's draft. Travel days become `max(1, ceil(days × travelFactor))`, still within the validator's 1–30 limit.
- All migrated ships are River boats at draft 1.4, so every existing route stays legal, on the same path and at the same duration.
- Routes still trade at most one unit per selected good at each checkpoint, so a big hold adds little on a route. This is existing behaviour and is left unchanged; players should expect the Patello to pay off most under direct control.

## 6. Version 19 save migration

The only change to a saved ship is one new field. Stats are looked up from the class, not stored separately.

```ts
if (save.version === 18) {
  save = {
    ...save,
    version: 19,
    fleet: Array.isArray(save.fleet)
      ? save.fleet.map((ship) =>
          isRecord(ship) ? { ...ship, vesselClass: "river-boat" } : ship,
        )
      : save.fleet,
  };
}
```

| Existing data | Result |
|---|---|
| Ship id and name | Unchanged |
| Cargo and cost basis | Unchanged |
| Hull, upgrades, `cargoCapacity`, `sailingSpeed` | Unchanged; River boat formulas equal today's fixed values |
| Automated route, capital, log, travel progress | Unchanged |
| Active voyage (route, `elapsedMs`, duration) | Unchanged, and re-anchored on load as now, so closed-app time still adds nothing |
| Gold-peak repair (`repairGoldPeak`) | Still runs, moved to the new final version |

**Code that must change with it:**
- Hard-coded stats: [storage.ts](src/game/storage.ts) (`isValidPlayerShip` and the 12/8 checks in `isValidGameState`), [model.ts](src/game/model.ts) (`syncSelectedShip`, `getCargoCapacity`, `getShipMaximumHull`, `repairShip`, `buyPlayerShip`), and [App.tsx](src/App.tsx) (three hull displays).
- `isVoyageTimingConsistent` and the `shipId` lookup must include the ship's `travelFactor`.
- An unknown `vesselClass` is rejected on load. The stored save is only replaced after a successful load.
- Older saves reach version 19 through the existing chain.

## 7. UI (portrait first)

- **Docks, buy a boat:** three stacked cards, each with one Buy button, showing hold, hull, speed and ports reached in words. Confirmation states the price and any restriction, for example "Cannot reach Sylhet or Balasore". No comparison table.
- **Fleet card:** class name, plus "Reaches 13 of 15 ports" when restricted, and the out-of-reach note.
- **Map port panel:** disabled travel with a visible text reason, not colour alone. The route preview shows the ship's actual route and days.
- **Shipyard:** repair cost uses the class rate, and the hold upgrade card shows the class value (+3 or +6), replacing the fixed "+6" label.
- **Route editor:** filtered port list, 0-capital option, and a note when ports are hidden.
- **Contracts:** warning line when the selected ship cannot reach the destination.
- **New ship names:** `River Trader II`, `Bora II`, `Patello III`, using the existing ordinal so names stay unique.
- **Map art:** simple size and sail variants of the existing vessel, so ships can be told apart. The class is always in text too.

## 8. Tests

- **Class data:** stats, formulas, upgrade limits and repair cost per class.
- **Network safety (guards all future tuning):** every class's reachable ports form one connected set containing all shipyards, and a River boat reaches all 15.
- **Planning:** Patello is refused at Sylhet and Balasore, takes the longer Bakla–Sandwip route, and NPC merchants are unaffected.
- **Timing:** factors, Chittagong alert, five-minute cap, speed changes mid-voyage, and in-game days credited on arrival.
- **Purchase:** price, gold, port and fleet limits, and generated names.
- **Automated routes:** `too-large` refusal, class travel days, one-unit limit, and waiting at port.
- **Recovery:** a stranded River boat is brought back by a zero-capital route, then selected, with cargo intact.
- **Migration:** version 18 and an older save, with a mid-voyage ship and a mid-route ship, checked field by field; unknown class rejected; save and reload; gold-peak repair still works.
- **Regression:** a migrated River boat's route, days and voyage time are identical to version 18.
- **UI:** purchase cards, disabled travel reason, filtered route editor, and contract warning. A real-browser check at 320×600 and 390×844 is also needed, as the test suite does not cover layout.

## 9. Historical basis

| Class | Evidence | What is invented |
|---|---|---|
| **Bora** | Hedges' Diary (1680, via *Hobson-Jobson*): "a very floaty light boat, rowinge with 20 to 30 Owars", carrying saltpetre and other goods from Hooghly downriver, with some trading to Dhaka in salt. | All stats and prices |
| **Patello** | Hedges' Diary (1680): boats from Patna with saltpetre and other goods, "built of an Exceeding Strength and are very flatt and burthensome". Also 1685; 35 tons in an 1860 source. | All stats and prices, the port limit, and sales at Chittagong; river-barge use on the coast is unsupported |
| **River boat** | The existing generic vessel, with no specific historical claim. | Everything |

**Limits of the evidence:**
- The quotations date from 1675–85, a decade or more after the game's 1665 start, so these are plausible for the period rather than proof for 1665.
- I read them as extracts in *Hobson-Jobson*, not in the diary itself.
- Considered and left out: the *bajra* (mainly passenger and luxury use), the *kosa* (described as a war boat), and the *sampan* and *balam* (evidence found is modern).

Game text should say these classes are inspired by historical boat types and that their stats are game values.

**Sources:** [Hobson-Jobson, P](https://en.wikisource.org/wiki/Hobson-Jobson/P) · [Hobson-Jobson, B](https://en.wikisource.org/wiki/Hobson-Jobson/B) · [Hobson-Jobson, full text](https://www.gutenberg.org/cache/epub/58529/pg58529-images.html) · [Banglapedia: Folk Transport](https://en.banglapedia.org/index.php?title=Folk_Transport) · [Banglapedia: Boat](https://en.banglapedia.org/index.php?title=Boat)
