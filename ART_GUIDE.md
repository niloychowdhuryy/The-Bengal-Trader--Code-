# Art Guide

## Direction

Create an original, premium illustrated merchant strategy game set in Bengal around 1665. The world should feel warm, handmade, lived-in and shaped by rivers, wetlands, timber, earth, trade and weather. It should not read as a web dashboard.

## Interface

The interface is a merchant's working kit: carved dark teak frames, brass fittings and ledger paper. Headings use IM Fell English, a seventeenth-century revival, and all working text and numbers use Alegreya Sans. Use the tokens at the top of `src/styles.css`. Keep working text at 12.5px or larger, and use madder red for the one main action on a screen, jade for secondary confirmations and paper for neutral choices.

## Palette and materials

- **Water:** chalky jade, river blue-green, pale reed green; use layered banks and subtle water lines.
- **Land:** wet forest greens, muted mustard, reed gold and aged rice-paper ivory.
- **Buildings:** timber brown, earth-plaster ochre, brick rust and thatch cream; vary roofs, frontage, courtyards and quays.
- **Boats:** teak, river-worn mahogany, vegetable-dyed rust, muslin sail and muted brass.
- **Ink:** forest charcoal rather than pure black.
- Light from one warm late-afternoon source; soft shadows ground buildings and hulls.

Use delicate low-contrast paper texture beneath art, but keep labels, touch targets and routes high contrast. Reuse shared color, edge weight, texture and shadow rules.

## World map and paths

- The map is a stylised game abstraction, not a historically surveyed hydrographic chart.
- The navigable network in `src/game/navigation.ts` is the source for waterways, port-node positions, route highlights, route distance and moving-ship interpolation. Never draw a separate decorative route or animate the vessel away from its displayed channels.
- The world map is one painting, served as a graded WebP baked from `asset-backups/bengal-world-map-master.png` by `tools/art/bake-art.mjs`. Port names are vector labels, not part of the painting. Change colour or remove painted details in the bake, not with live SVG filters.
- The broad painted channels follow the existing graph. Do not make narrow creeks look like selectable or navigable routes until navigation data supports them.
- Keep all 15 port labels and hit areas readable in portrait orientation. Use the SVG viewBox camera for drag, pinch, wheel and button zoom; camera movement must not alter game-world coordinates.
- Blocked channels should be visibly distinct, labeled with their cause and reflected in route availability.
- Preserve visible room around port names and route overlays. Avoid contextual panels hiding destinations or making selection difficult.
- Use irregular hand-shaped banks, river islands, clustered settlements, groves, fine linework and the established paper texture.
- Make the initial map viewport feel composed around the port network, then let players pan and zoom to inspect scenery. Keep camera controls clear of port markers and contextual panels.

## City scene

- The city is a separate, portrait-friendly isometric settlement, not a map pinboard or row of isolated building cards. Compose it as one riverfront environment with a landing, connected lanes, courtyards, gardens and varied clusters of buildings. Each port has its own layout and one of four settings: delta, coast, upland or plains.
- Use the established warm light from the upper left: ochre plaster, weathered timber, fired-clay roof tones, muted brick, bamboo greens, rice-paper highlights and blue-green water. Show roof planes, shaded walls, eaves, doors, windows, awnings, timber framing, steps, yards and cast shadows to establish consistent 3D-like depth.
- Keep original building art as reusable inline SVG under `src/components/city-art/`, drawn with the shared kit in `iso.tsx` so geometry and light stay consistent. Store building meaning and placement separately so towns can vary without changing game logic. Curved roofs echo Bengal's bent-roof huts as a broad visual reference; settings and layouts are game abstractions, not claims about what a given town looked like.
- The Dhaka scene is a stylised prototype, not an exact reconstruction. *Banglapedia*'s “Dhaka” describes its river-linked Mughal provincial-capital context and records a 1666 observation by Jean-Baptiste Tavernier that residents wanted houses beside the river; it also relates Niccolao Manucci's 1663 description of many houses as straw-built. The scene's arrangement, buildings and boats are original interpretation, not specific documented structures.
- Keep the mosque modest and generic, with no named monument or claim to reproduce a particular surviving structure. Dhaka's article notes older mosque remains but does not establish this prototype's design.
- Draw farms and workshops as environments or workplaces, not generic floating icons. Keep planned/locked status clear without covering the city.
- Use only subtle, low-cost motion: slow water lines, gentle boat bob, faint workshop smoke and small ambient movement. Respect reduced-motion preferences and do not communicate gameplay state through animation alone.

## Boats, buildings and interaction

- Give every vessel a distinctive hand-built hull silhouette, joined plank detail, useful rigging and readable sail. The moving boat must remain recognisable at small mobile sizes.
- `src/components/map-art/VesselArt.tsx` holds one original drawing per vessel class. Keep them distinct at small sizes: a River boat with a barrel-vaulted cabin and striped sail, a long low Bora with a row of oars, and a broad planked Patello with a great square sail and cargo on deck.
- Give towns distinct vernacular layouts and work rhythms; do not make ports identical icon clusters.
- Building controls must remain accessible with large hit areas, clear labels and selected/focus states. The artwork supports the action; it must not obscure the control.
- Panels resemble durable travel papers or carved timber labels, not CRM cards. Keep one dominant action and reveal details only when needed.

## Motion

Use calm river flow, slight ship bob, quiet selection feedback and brief drawer/page transitions. Ship travel follows the selected channel at a steady, readable pace. Reduce motion for users who request it; no gameplay information depends on animation.

## Restrictions and review

- Draw original assets; avoid emoji, generic stock imagery, primitive shapes as the main art, and unrelated icon styles.
- Do not add a period object, costume, religious feature or named building as historical fact without checking it. Clearly identify visual abstractions.
- Do not turn a community into a threatening prop or faction stereotype.
- Review art at phone size: are the map and city scene dominant, are routes legible, can each building be tapped, and does the illustration still feel like the same Bengal world?

**Sources informing the city abstraction:** *Banglapedia*, “Dhaka,” https://en.banglapedia.org/index.php/Dhaka ; “Architecture,” https://en.banglapedia.org/index.php/Architecture . The broad architecture entry discusses materials across multiple periods and regions; it is not evidence that every material or building form shown here was present in Dhaka in 1665.
