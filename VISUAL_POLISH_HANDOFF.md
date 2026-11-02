# Visual Polish Handoff

**Status, 2 November 2026:** the items below were carried out, see [ART_GUIDE.md](./ART_GUIDE.md) and [ARCHITECTURE.md](./ARCHITECTURE.md). This file is kept as the record of the brief, except for the "How to verify" section, which still applies. City scenes (item 9) now vary by port, the favicon (item 10) is linked, and the served map (item 11) is a 1 MB WebP.

**For:** Fable, taking on the v1 visual-polish stage.

**Goal:** make the existing game look and read better on phones and desktop. All gameplay for v1 is finished. This stage changes how things look, not how they work.

## Before you start

- Read [ART_GUIDE.md](./ART_GUIDE.md) and use the project skills in `.claude/skills/`: `game-art-direction` and `mobile-game-ui`. Use `historical-research` before making any new historical claim in art or text.
- Check `git status` first. Work in small stages and get the owner's approval before each new one. The repository is local, with no remote.
- Git has no identity configured on this machine. Pass one per commit, or ask the owner to set one.

## What must not change

- Game rules, prices, stats, routes, travel times and saves. Save version stays **19**, so `src/game/model.ts`, `storage.ts`, `navigation.ts` and `travel-time.ts` should need no logic changes.
- All 15 ports and all eight goods remain available.
- Art never draws its own routes: route lines and ship movement come from `src/game/navigation.ts`.
- Accessible names and roles. The tests rely on them, and players using assistive technology do too. Keep 44px touch targets and reduced-motion behaviour, and never show meaning through colour or animation alone.
- Original art only, with no third-party or branded assets. City art is illustrative, not a reconstruction of named buildings.
- Class names are inspired by history, but stats, prices, shipyards and port limits are game rules. Keep the note in the shipyard saying so.

## Priorities

These came from inspecting the game in Chrome at 320×600, 390×844 and 1280×800.

### Fix first (readability)

1. **Header at 320px:** "The Bengal Trader" is clipped to "The Bengal" by the gold, cargo and reputation pills.
2. **Map labels and markers:** marker rings sit on top of port names, including Hooghly, Satgaon, Balasore, Kasimbazar and Sonargaon, and make them hard to read.
3. **Small text:** shipyard, fleet and route panels use 9–10px text in many places (`src/styles.css`). Stat lines and the historical note are hard to read on a phone.
4. **Panels over the map strip:** the "Your next stop" strip stays partly visible behind open panels. On phones, the cut-off text shows just below the panel.

### Stage 13 screens that are functional but plain

5. **Vessel art:** all classes use the same `BengalTradingVessel`. Add simple variants so a Bora (light, narrow, many oars), River boat and Patello (broad, flat, heavy) can be told apart at small sizes. It is drawn on the map, so use the existing component in `src/components/map-art/`. Keep class names in text as well.
6. **Shipyard class cards** (`DockPanel` in `src/App.tsx`): they are text lists today. A small illustration and clearer stat grouping would help players compare them. Avoid a dense table.
7. **Long panels on phones:** Fleet cards and the route editor need a lot of scrolling at 320px. Consider progressive disclosure, without hiding the return-order button or blocked-travel reasons.
8. **Notes:** "too large" and "longer route" notes (`.route-size-note`) and the return-order box (`.fleet-return-order`) use provisional styling.

### Then, as time allows

9. **City scenes:** only Dhaka has its own layout, and every other port shares a generic one (`src/components/city-art/city-layout.ts`).
10. **Favicon:** `index.html` has no icon link, so browsers request `/favicon.ico` and get a 404. `public/bengal-trader-icon.svg` already exists.
11. **Map image size:** `public/images/bengal-world-map.png` is 21.7 MB and is included in the offline cache, which may slow a first load on phones. Discuss any compression with the owner, and check the markers still line up.

## How to verify

```
npm run test
npm run build
npm run dev
```

**Seeing the screens:** the Stage 13 screens need particular saves, so reaching them by normal play is slow. With the dev server running, you can seed one from the browser, as the Stage 13 inspection did:

1. Run `import("/src/game/model.ts")` in the page.
2. Build a state, for example `buyPlayerShip(state, "patello")` followed by `selectPlayerShip(state, "player-ship-2")`.
3. Write it to IndexedDB: database `bengal-trader` version 2, store `save`, key `captain`.
4. Reload the page.

**States worth checking:**

| Screen | Save state | Action |
|---|---|---|
| Blocked route | Patello selected | Tap Sylhet |
| Longer route | Patello selected at `bakla-chandradwip`, with that port in `visitedTowns` | Tap Sandwip |
| Return order | Patello selected, starter ship's `currentPort` set to `sylhet` | Open Fleet |
| Route editor | Patello not selected, `sylhet` in `visitedTowns` | Open Fleet, then Set up route |

On phones, Fleet and Docks are under **More**. Check 320×600, 390×844 and a desktop size, and look at the screenshots themselves as well as the automated checks.

**Not yet checked by anyone:** a real phone, touch gestures on the map, a screen reader, a colour-contrast audit, and the production build in a browser.
