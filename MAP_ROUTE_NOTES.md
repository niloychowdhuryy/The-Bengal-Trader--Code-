# Stage 3C — Supplied Map and Route Notes

## Artwork and port locations

The world map uses the user-supplied `1365 × 768` PNG directly at `public/images/bengal-world-map.png`, preserving its 16:9 aspect ratio. The existing navigation graph and port coordinates remain in their original `1152 × 768` coordinate space; the map presentation scales its overlay group horizontally to match the supplied artwork. The image is cropped to fill portrait and desktop viewports without distortion or blank bands.

The artwork is an illustrated game map, not a georeferenced survey. Marker positions are visual placements on the supplied image, not claims of precise historical coordinates. The map pans and zooms while the route path, ports, and moving ship share the same coordinate system.

## Gameplay route connections

The following links are implemented as connected polylines traced along water shapes depicted in the illustration. Each port has a short access channel into the shared waterway graph; route planning treats ports as endpoints, not intermediate waypoints. This allows a journey to use one continuous path without passing through another port as a graph stop. The network is approved as a **gameplay abstraction**; it does not assert that every channel was navigable by the game's vessel throughout 1660–1690.

- Patna — Rajmahal — Tanda — Malda — Kasimbazar
- Kasimbazar — upper river junction — Dhaka
- Upper river junction — Sylhet
- Kasimbazar — Hooghly — Satgaon
- Dhaka — Sonargaon — lower-delta junction — Chittagong
- Dhaka — Jessore — Bakla–Chandradwip — Sandwip — Chittagong
- Bakla–Chandradwip — Balasore

All five destinations from the previous playable map remain connected in the expanded network. Previously saved voyages using the old map's route geometry are normalized to the corresponding new route while retaining their elapsed-progress fraction.

## Historical and cartographic uncertainty

The supplied illustration shows rivers and coastal water but does not identify named channels, historical channel courses, seasonal depth, vessel draft limits, or verified port-to-port navigability. The route polylines are therefore gameplay paths traced by visual interpretation, not historically verified hydrography.

Treat these connections as provisional and visually inferred, especially:

- Patna–Rajmahal–Tanda–Malda–Kasimbazar: the upper-river path is schematic; the image does not identify period channel names or seasonal navigability.
- Kasimbazar–Hooghly–Satgaon: Satgaon is described in the economy research as a declined/legacy port. Its inclusion here is a game destination, not a claim that it remained a functioning late-17th-century seaport.
- Dhaka/Jessore through Bakla–Chandradwip and the island/coastal legs through Sandwip, Chittagong, and Balasore: the image depicts deltaic/coastal water, but does not establish specific historic channels, maritime passages, or draft suitability.
- Sylhet's connecting branch: the image indicates a northeast river corridor, but not a specific 17th-century navigable alignment.

The graph uses abstract minimum-depth values to preserve the existing route-planning interface. These are gameplay parameters, not researched historical measurements. Any future claim about period-specific navigability, named waterways, or seasonal access requires separate historical/cartographic research and should not be inferred from this artwork alone.
