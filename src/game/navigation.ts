import type { TownId } from "./model";

export interface RiverPoint {
  x: number;
  y: number;
}

export interface RiverNode {
  id: string;
  point: RiverPoint;
  port?: TownId;
}

export interface RiverEdge {
  id: string;
  from: string;
  to: string;
  points: RiverPoint[];
  minimumDepth: number;
}

export interface RouteConditions {
  eventBlockages?: readonly string[];
  militaryBlockages?: readonly string[];
  weatherBlockages?: readonly string[];
  vesselDraft?: number;
}

export interface RiverRoute {
  origin: TownId;
  destination: TownId;
  edgeIds: string[];
  points: RiverPoint[];
  distance: number;
}

export const PORT_LOCATIONS: Record<TownId, RiverPoint> = {
  dhaka: { x: 718, y: 320 },
  sonargaon: { x: 858, y: 296 },
  kasimbazar: { x: 415, y: 252 },
  chittagong: { x: 989, y: 520 },
  sylhet: { x: 946, y: 185 },
  hooghly: { x: 302, y: 324 },
  satgaon: { x: 420, y: 374 },
  rajmahal: { x: 493, y: 105 },
  tanda: { x: 489, y: 179 },
  malda: { x: 620, y: 171 },
  balasore: { x: 168, y: 519 },
  jessore: { x: 795, y: 405 },
  sandwip: { x: 795, y: 540 },
  "bakla-chandradwip": { x: 496, y: 548 },
  patna: { x: 204, y: 123 },
};

const UPPER_BEND: RiverPoint = { x: 588, y: 247 };
const LOWER_BEND: RiverPoint = { x: 911, y: 474 };

const DIRECT_WATERWAY_NODES: RiverNode[] = [
  { id: "patna-channel", point: { x: 270, y: 128 } },
  { id: "rajmahal-channel", point: { x: 468, y: 132 } },
  { id: "tanda-channel", point: { x: 526, y: 177 } },
  { id: "malda-channel", point: { x: 589, y: 184 } },
  { id: "kasimbazar-channel", point: { x: 457, y: 260 } },
  { id: "dhaka-channel", point: { x: 679, y: 306 } },
  { id: "sylhet-channel", point: { x: 881, y: 192 } },
  { id: "hooghly-channel", point: { x: 329, y: 311 } },
  { id: "satgaon-channel", point: { x: 393, y: 362 } },
  { id: "sonargaon-channel", point: { x: 825, y: 301 } },
  { id: "chittagong-channel", point: { x: 956, y: 503 } },
  { id: "jessore-channel", point: { x: 770, y: 380 } },
  { id: "bakla-channel", point: { x: 570, y: 535 } },
  { id: "sandwip-channel", point: { x: 754, y: 548 } },
  { id: "balasore-channel", point: { x: 259, y: 526 } },
];

export const RIVER_NODES: RiverNode[] = [
  ...Object.entries(PORT_LOCATIONS).map(([id, point]) => ({
    id,
    point,
    port: id as TownId,
  })),
  { id: "upper-bend", point: UPPER_BEND },
  { id: "lower-bend", point: LOWER_BEND },
  ...DIRECT_WATERWAY_NODES,
];

const LEGACY_RIVER_EDGES: RiverEdge[] = [
  {
    id: "upper-ganges-west",
    from: "patna",
    to: "rajmahal",
    points: [
      PORT_LOCATIONS.patna,
      { x: 260, y: 131 },
      { x: 318, y: 149 },
      { x: 376, y: 154 },
      { x: 435, y: 137 },
      PORT_LOCATIONS.rajmahal,
    ],
    minimumDepth: 1.8,
  },
  {
    id: "rajmahal-tanda",
    from: "rajmahal",
    to: "tanda",
    points: [
      PORT_LOCATIONS.rajmahal,
      { x: 510, y: 130 },
      { x: 518, y: 151 },
      { x: 507, y: 166 },
      PORT_LOCATIONS.tanda,
    ],
    minimumDepth: 1.6,
  },
  {
    id: "tanda-malda",
    from: "tanda",
    to: "malda",
    points: [
      PORT_LOCATIONS.tanda,
      { x: 530, y: 193 },
      { x: 559, y: 188 },
      { x: 588, y: 176 },
      PORT_LOCATIONS.malda,
    ],
    minimumDepth: 1.5,
  },
  {
    id: "malda-kasimbazar",
    from: "malda",
    to: "kasimbazar",
    points: [
      PORT_LOCATIONS.malda,
      { x: 578, y: 199 },
      { x: 545, y: 225 },
      { x: 503, y: 244 },
      { x: 462, y: 251 },
      PORT_LOCATIONS.kasimbazar,
    ],
    minimumDepth: 1.5,
  },
  {
    id: "northwest-channel",
    from: "kasimbazar",
    to: "upper-bend",
    points: [
      PORT_LOCATIONS.kasimbazar,
      { x: 455, y: 247 },
      { x: 494, y: 239 },
      { x: 535, y: 237 },
      UPPER_BEND,
    ],
    minimumDepth: 1.8,
  },
  {
    id: "upper-river",
    from: "upper-bend",
    to: "dhaka",
    points: [
      UPPER_BEND,
      { x: 618, y: 264 },
      { x: 653, y: 285 },
      { x: 686, y: 305 },
      PORT_LOCATIONS.dhaka,
    ],
    minimumDepth: 1.6,
  },
  {
    id: "sylhet-branch",
    from: "upper-bend",
    to: "sylhet",
    points: [
      UPPER_BEND,
      { x: 660, y: 221 },
      { x: 735, y: 203 },
      { x: 811, y: 192 },
      { x: 878, y: 186 },
      PORT_LOCATIONS.sylhet,
    ],
    minimumDepth: 1.4,
  },
  {
    id: "kasimbazar-hooghly",
    from: "kasimbazar",
    to: "hooghly",
    points: [
      PORT_LOCATIONS.kasimbazar,
      { x: 384, y: 271 },
      { x: 357, y: 293 },
      { x: 333, y: 313 },
      PORT_LOCATIONS.hooghly,
    ],
    minimumDepth: 1.6,
  },
  {
    id: "hooghly-satgaon",
    from: "hooghly",
    to: "satgaon",
    points: [
      PORT_LOCATIONS.hooghly,
      { x: 331, y: 342 },
      { x: 362, y: 362 },
      { x: 392, y: 371 },
      PORT_LOCATIONS.satgaon,
    ],
    minimumDepth: 1.5,
  },
  {
    id: "eastern-river",
    from: "dhaka",
    to: "sonargaon",
    points: [
      PORT_LOCATIONS.dhaka,
      { x: 754, y: 313 },
      { x: 790, y: 305 },
      { x: 825, y: 300 },
      PORT_LOCATIONS.sonargaon,
    ],
    minimumDepth: 1.5,
  },
  {
    id: "southern-channel",
    from: "sonargaon",
    to: "lower-bend",
    points: [
      PORT_LOCATIONS.sonargaon,
      { x: 879, y: 324 },
      { x: 899, y: 359 },
      { x: 914, y: 406 },
      LOWER_BEND,
    ],
    minimumDepth: 1.7,
  },
  {
    id: "coastal-channel",
    from: "lower-bend",
    to: "chittagong",
    points: [
      LOWER_BEND,
      { x: 938, y: 484 },
      { x: 959, y: 500 },
      PORT_LOCATIONS.chittagong,
    ],
    minimumDepth: 2.2,
  },
  {
    id: "dhaka-jessore",
    from: "dhaka",
    to: "jessore",
    points: [
      PORT_LOCATIONS.dhaka,
      { x: 746, y: 346 },
      { x: 768, y: 373 },
      PORT_LOCATIONS.jessore,
    ],
    minimumDepth: 1.5,
  },
  {
    id: "jessore-bakla",
    from: "jessore",
    to: "bakla-chandradwip",
    points: [
      PORT_LOCATIONS.jessore,
      { x: 759, y: 432 },
      { x: 710, y: 465 },
      { x: 650, y: 503 },
      { x: 581, y: 531 },
      PORT_LOCATIONS["bakla-chandradwip"],
    ],
    minimumDepth: 1.5,
  },
  {
    id: "bakla-sandwip",
    from: "bakla-chandradwip",
    to: "sandwip",
    points: [
      PORT_LOCATIONS["bakla-chandradwip"],
      { x: 567, y: 564 },
      { x: 642, y: 566 },
      { x: 716, y: 556 },
      { x: 760, y: 547 },
      PORT_LOCATIONS.sandwip,
    ],
    minimumDepth: 1.4,
  },
  {
    id: "sandwip-chittagong",
    from: "sandwip",
    to: "chittagong",
    points: [
      PORT_LOCATIONS.sandwip,
      { x: 842, y: 559 },
      { x: 894, y: 561 },
      { x: 942, y: 546 },
      PORT_LOCATIONS.chittagong,
    ],
    minimumDepth: 1.6,
  },
  {
    id: "bakla-balasore",
    from: "bakla-chandradwip",
    to: "balasore",
    points: [
      PORT_LOCATIONS["bakla-chandradwip"],
      { x: 444, y: 563 },
      { x: 389, y: 559 },
      { x: 330, y: 545 },
      { x: 264, y: 530 },
      PORT_LOCATIONS.balasore,
    ],
    minimumDepth: 1.4,
  },
];

function waterwayEdge(
  id: string,
  from: string,
  to: string,
  points: RiverPoint[],
  minimumDepth = 1.5,
): RiverEdge {
  return { id, from, to, points, minimumDepth };
}

const DIRECT_WATERWAY_EDGES: RiverEdge[] = [
  waterwayEdge("direct-access-patna", "patna", "patna-channel", [
    PORT_LOCATIONS.patna,
    { x: 232, y: 124 },
    { x: 252, y: 126 },
    { x: 270, y: 128 },
  ]),
  waterwayEdge("direct-access-rajmahal", "rajmahal", "rajmahal-channel", [
    PORT_LOCATIONS.rajmahal,
    { x: 489, y: 117 },
    { x: 480, y: 127 },
    { x: 468, y: 132 },
  ]),
  waterwayEdge("direct-access-tanda", "tanda", "tanda-channel", [
    PORT_LOCATIONS.tanda,
    { x: 503, y: 183 },
    { x: 515, y: 181 },
    { x: 526, y: 177 },
  ]),
  waterwayEdge("direct-access-malda", "malda", "malda-channel", [
    PORT_LOCATIONS.malda,
    { x: 611, y: 177 },
    { x: 600, y: 181 },
    { x: 589, y: 184 },
  ]),
  waterwayEdge("direct-access-kasimbazar", "kasimbazar", "kasimbazar-channel", [
    PORT_LOCATIONS.kasimbazar,
    { x: 431, y: 251 },
    { x: 445, y: 256 },
    { x: 457, y: 260 },
  ]),
  waterwayEdge("direct-access-dhaka", "dhaka", "dhaka-channel", [
    PORT_LOCATIONS.dhaka,
    { x: 708, y: 314 },
    { x: 694, y: 310 },
    { x: 679, y: 306 },
  ]),
  waterwayEdge("direct-access-sylhet", "sylhet", "sylhet-channel", [
    PORT_LOCATIONS.sylhet,
    { x: 924, y: 186 },
    { x: 901, y: 189 },
    { x: 881, y: 192 },
  ]),
  waterwayEdge("direct-access-hooghly", "hooghly", "hooghly-channel", [
    PORT_LOCATIONS.hooghly,
    { x: 311, y: 319 },
    { x: 321, y: 314 },
    { x: 329, y: 311 },
  ]),
  waterwayEdge("direct-access-satgaon", "satgaon", "satgaon-channel", [
    PORT_LOCATIONS.satgaon,
    { x: 412, y: 374 },
    { x: 404, y: 368 },
    { x: 393, y: 362 },
  ]),
  waterwayEdge("direct-access-sonargaon", "sonargaon", "sonargaon-channel", [
    PORT_LOCATIONS.sonargaon,
    { x: 847, y: 299 },
    { x: 836, y: 300 },
    { x: 825, y: 301 },
  ]),
  waterwayEdge("direct-access-chittagong", "chittagong", "chittagong-channel", [
    PORT_LOCATIONS.chittagong,
    { x: 977, y: 514 },
    { x: 966, y: 508 },
    { x: 956, y: 503 },
  ]),
  waterwayEdge("direct-access-jessore", "jessore", "jessore-channel", [
    PORT_LOCATIONS.jessore,
    { x: 787, y: 397 },
    { x: 778, y: 388 },
    { x: 770, y: 380 },
  ]),
  waterwayEdge("direct-access-bakla", "bakla-chandradwip", "bakla-channel", [
    PORT_LOCATIONS["bakla-chandradwip"],
    { x: 522, y: 544 },
    { x: 547, y: 539 },
    { x: 570, y: 535 },
  ]),
  waterwayEdge("direct-access-sandwip", "sandwip", "sandwip-channel", [
    PORT_LOCATIONS.sandwip,
    { x: 783, y: 543 },
    { x: 768, y: 546 },
    { x: 754, y: 548 },
  ]),
  waterwayEdge("direct-access-balasore", "balasore", "balasore-channel", [
    PORT_LOCATIONS.balasore,
    { x: 198, y: 522 },
    { x: 230, y: 524 },
    { x: 259, y: 526 },
  ]),
  waterwayEdge("direct-upper-patna-rajmahal", "patna-channel", "rajmahal-channel", [
    { x: 270, y: 128 },
    { x: 312, y: 144 },
    { x: 356, y: 151 },
    { x: 407, y: 145 },
    { x: 444, y: 136 },
    { x: 468, y: 132 },
  ], 1.8),
  waterwayEdge("direct-upper-rajmahal-tanda", "rajmahal-channel", "tanda-channel", [
    { x: 468, y: 132 },
    { x: 493, y: 142 },
    { x: 512, y: 160 },
    { x: 526, y: 177 },
  ], 1.6),
  waterwayEdge("direct-upper-tanda-malda", "tanda-channel", "malda-channel", [
    { x: 526, y: 177 },
    { x: 546, y: 190 },
    { x: 570, y: 188 },
    { x: 589, y: 184 },
  ], 1.5),
  waterwayEdge("direct-upper-malda-kasimbazar", "malda-channel", "kasimbazar-channel", [
    { x: 589, y: 184 },
    { x: 569, y: 208 },
    { x: 536, y: 233 },
    { x: 497, y: 250 },
    { x: 457, y: 260 },
  ], 1.5),
  waterwayEdge("direct-upper-kasimbazar-junction", "kasimbazar-channel", "upper-bend", [
    { x: 457, y: 260 },
    { x: 497, y: 250 },
    { x: 540, y: 245 },
    UPPER_BEND,
  ], 1.8),
  waterwayEdge("direct-upper-dhaka", "upper-bend", "dhaka-channel", [
    UPPER_BEND,
    { x: 616, y: 263 },
    { x: 649, y: 284 },
    { x: 679, y: 306 },
  ], 1.6),
  waterwayEdge("direct-upper-sylhet", "upper-bend", "sylhet-channel", [
    UPPER_BEND,
    { x: 658, y: 222 },
    { x: 731, y: 205 },
    { x: 805, y: 196 },
    { x: 881, y: 192 },
  ], 1.4),
  waterwayEdge("direct-west-kasimbazar-hooghly", "kasimbazar-channel", "hooghly-channel", [
    { x: 457, y: 260 },
    { x: 443, y: 280 },
    { x: 416, y: 291 },
    { x: 380, y: 299 },
    { x: 350, y: 304 },
    { x: 329, y: 311 },
  ], 1.6),
  waterwayEdge("direct-west-hooghly-satgaon", "hooghly-channel", "satgaon-channel", [
    { x: 329, y: 311 },
    { x: 333, y: 337 },
    { x: 358, y: 353 },
    { x: 393, y: 362 },
  ], 1.5),
  waterwayEdge("direct-delta-dhaka-sonargaon", "dhaka-channel", "sonargaon-channel", [
    { x: 679, y: 306 },
    { x: 700, y: 275 },
    { x: 744, y: 266 },
    { x: 786, y: 277 },
    { x: 807, y: 290 },
    { x: 825, y: 301 },
  ], 1.5),
  waterwayEdge("direct-delta-sonargaon-lower", "sonargaon-channel", "lower-bend", [
    { x: 825, y: 301 },
    { x: 840, y: 339 },
    { x: 865, y: 377 },
    { x: 895, y: 422 },
    LOWER_BEND,
  ], 1.7),
  waterwayEdge("direct-coast-lower-chittagong", "lower-bend", "chittagong-channel", [
    LOWER_BEND,
    { x: 930, y: 482 },
    { x: 946, y: 494 },
    { x: 956, y: 503 },
  ], 2.2),
  waterwayEdge("direct-delta-dhaka-jessore", "dhaka-channel", "jessore-channel", [
    { x: 679, y: 306 },
    { x: 681, y: 348 },
    { x: 718, y: 367 },
    { x: 751, y: 377 },
    { x: 770, y: 380 },
  ], 1.5),
  waterwayEdge("direct-delta-jessore-bakla", "jessore-channel", "bakla-channel", [
    { x: 770, y: 380 },
    { x: 751, y: 425 },
    { x: 704, y: 461 },
    { x: 647, y: 496 },
    { x: 570, y: 535 },
  ], 1.5),
  waterwayEdge("direct-delta-bakla-sandwip", "bakla-channel", "sandwip-channel", [
    { x: 570, y: 535 },
    { x: 598, y: 551 },
    { x: 650, y: 557 },
    { x: 708, y: 554 },
    { x: 754, y: 548 },
  ], 1.4),
  waterwayEdge("direct-coast-sandwip-chittagong", "sandwip-channel", "chittagong-channel", [
    { x: 754, y: 548 },
    { x: 780, y: 590 },
    { x: 840, y: 596 },
    { x: 900, y: 570 },
    { x: 930, y: 535 },
    { x: 956, y: 503 },
  ], 1.6),
  waterwayEdge("direct-coast-bakla-balasore", "bakla-channel", "balasore-channel", [
    { x: 570, y: 535 },
    { x: 540, y: 600 },
    { x: 470, y: 610 },
    { x: 390, y: 600 },
    { x: 320, y: 570 },
    { x: 259, y: 526 },
  ], 1.4),
];

export const RIVER_EDGES: RiverEdge[] = [
  ...LEGACY_RIVER_EDGES,
  ...DIRECT_WATERWAY_EDGES,
];

function distanceBetween(a: RiverPoint, b: RiverPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function routeLength(points: RiverPoint[]): number {
  return points.slice(1).reduce(
    (total, point, index) => total + distanceBetween(points[index], point),
    0,
  );
}

function blockedEdgeIds(conditions: RouteConditions): Set<string> {
  return new Set([
    ...(conditions.eventBlockages ?? []),
    ...(conditions.militaryBlockages ?? []),
    ...(conditions.weatherBlockages ?? []),
  ]);
}

function orientedPoints(edge: RiverEdge, from: string): RiverPoint[] {
  return edge.from === from ? edge.points : [...edge.points].reverse();
}

export function planRiverRoute(
  origin: TownId,
  destination: TownId,
  conditions: RouteConditions = {},
): RiverRoute | null {
  if (origin === destination) return null;

  const start = RIVER_NODES.find((node) => node.port === origin);
  const finish = RIVER_NODES.find((node) => node.port === destination);
  if (!start || !finish) return null;

  const closed = blockedEdgeIds(conditions);
  const distances = new Map<string, number>([[start.id, 0]]);
  const previous = new Map<string, { node: string; edge: RiverEdge }>();
  const remaining = new Set(RIVER_NODES.map((node) => node.id));
  const portNodeIds = new Set(
    RIVER_NODES.filter((node) => node.port !== undefined).map((node) => node.id),
  );

  while (remaining.size > 0) {
    let current: string | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const nodeId of remaining) {
      const candidate = distances.get(nodeId) ?? Number.POSITIVE_INFINITY;
      if (candidate < bestDistance) {
        current = nodeId;
        bestDistance = candidate;
      }
    }

    if (current === undefined || !Number.isFinite(bestDistance)) break;
    if (current === finish.id) break;
    remaining.delete(current);

    for (const edge of RIVER_EDGES) {
      const next = edge.from === current
        ? edge.to
        : edge.to === current
          ? edge.from
          : null;
      if (
        next === null ||
        !remaining.has(next) ||
        (next !== finish.id && portNodeIds.has(next)) ||
        closed.has(edge.id) ||
        edge.minimumDepth < (conditions.vesselDraft ?? 0)
      ) {
        continue;
      }

      const points = orientedPoints(edge, current);
      const candidate = bestDistance + routeLength(points);
      if (candidate < (distances.get(next) ?? Number.POSITIVE_INFINITY)) {
        distances.set(next, candidate);
        previous.set(next, { node: current, edge });
      }
    }
  }

  if (!distances.has(finish.id)) return null;

  const routeEdges: RiverEdge[] = [];
  let cursor = finish.id;
  while (cursor !== start.id) {
    const step = previous.get(cursor);
    if (!step) return null;
    routeEdges.unshift(step.edge);
    cursor = step.node;
  }

  return buildRiverRoute(
    origin,
    destination,
    routeEdges.map((edge) => edge.id),
  );
}

export function buildRiverRoute(
  origin: TownId,
  destination: TownId,
  edgeIds: string[],
): RiverRoute | null {
  const start = RIVER_NODES.find((node) => node.port === origin);
  const finish = RIVER_NODES.find((node) => node.port === destination);
  if (!start || !finish || edgeIds.length === 0) return null;

  const points: RiverPoint[] = [];
  let cursorNode = start.id;
  for (const edgeId of edgeIds) {
    const edge = RIVER_EDGES.find((candidate) => candidate.id === edgeId);
    if (!edge || (edge.from !== cursorNode && edge.to !== cursorNode)) return null;
    const edgePoints = orientedPoints(edge, cursorNode);
    points.push(...(points.length > 0 ? edgePoints.slice(1) : edgePoints));
    cursorNode = edge.from === cursorNode ? edge.to : edge.from;
  }
  if (cursorNode !== finish.id) return null;

  const distance = routeLength(points);
  return {
    origin,
    destination,
    edgeIds,
    points,
    distance,
  };
}

export function pointAlongRiverRoute(route: RiverRoute, progress: number): RiverPoint {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const remainingDistance = route.distance * clampedProgress;
  let covered = 0;

  for (let index = 1; index < route.points.length; index += 1) {
    const from = route.points[index - 1];
    const to = route.points[index];
    const segmentLength = distanceBetween(from, to);
    if (covered + segmentLength >= remainingDistance) {
      const segmentProgress =
        segmentLength === 0 ? 0 : (remainingDistance - covered) / segmentLength;
      return {
        x: from.x + (to.x - from.x) * segmentProgress,
        y: from.y + (to.y - from.y) * segmentProgress,
      };
    }
    covered += segmentLength;
  }

  return route.points.at(-1) ?? { x: 0, y: 0 };
}

export function riverPointsToSvgPath(points: RiverPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}
