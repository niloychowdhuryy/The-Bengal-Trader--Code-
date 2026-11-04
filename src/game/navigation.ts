import { LAND_TIME_FACTOR, TRANSFER_TIME_UNITS } from "./config/travel";
import type { TownId } from "./model";
import {
  PORT_QUAYS,
  TRANSPORT_EDGES,
  TRANSPORT_NODES,
} from "./transport-network.data";

// The map as a transport network. tools/nav/bake-network.mjs generates the real one
// from the painted water; the planner accepts any network, which is how tests try
// situations the map doesn't happen to contain.

export interface RiverPoint {
  x: number;
  y: number;
}

export type TransportMode = "water" | "land";

export interface TransportNode {
  id: string;
  point: RiverPoint;
  port?: TownId;
}

export interface TransportEdge {
  id: string;
  from: string;
  to: string;
  mode: TransportMode;
  points: RiverPoint[];
  /** Abstract depth for water edges, compared with a vessel's draft. Unused on land. */
  minimumDepth: number;
}

export interface TransportNetwork {
  nodes: readonly TransportNode[];
  edges: readonly TransportEdge[];
}

export type RiverNode = TransportNode;
export type RiverEdge = TransportEdge;

export interface RouteConditions {
  eventBlockages?: readonly string[];
  militaryBlockages?: readonly string[];
  weatherBlockages?: readonly string[];
  vesselDraft?: number;
  /** Multiplies water time for this vessel, so choices reflect its real speed. */
  travelFactor?: number;
  /** Ports this vessel may never travel to, by any combination of water and land. */
  barredPorts?: readonly TownId[];
}

/** A stretch of one transport mode, as positions within the route's points. */
export interface RouteLeg {
  mode: TransportMode;
  firstPoint: number;
  lastPoint: number;
  distance: number;
}

export interface RiverRoute {
  origin: TownId;
  destination: TownId;
  edgeIds: string[];
  points: RiverPoint[];
  distance: number;
  legs: RouteLeg[];
}

export { LAND_TIME_FACTOR, TRANSFER_TIME_UNITS };

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


export { PORT_QUAYS };

export const RIVER_NODES: TransportNode[] = TRANSPORT_NODES;
export const RIVER_EDGES: TransportEdge[] = TRANSPORT_EDGES;
const REAL_NETWORK: TransportNetwork = { nodes: RIVER_NODES, edges: RIVER_EDGES };

function distanceBetween(a: RiverPoint, b: RiverPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function routeLength(points: readonly RiverPoint[]): number {
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

function orientedPoints(edge: TransportEdge, from: string): RiverPoint[] {
  return edge.from === from ? edge.points : [...edge.points].reverse();
}

/** Finds the quickest allowed journey, or null if there's none. */
export function planRoute(
  network: TransportNetwork,
  origin: TownId,
  destination: TownId,
  conditions: RouteConditions = {},
): RiverRoute | null {
  if (origin === destination) return null;
  if (conditions.barredPorts?.includes(destination)) return null;
  const start = network.nodes.find((node) => node.port === origin);
  const finish = network.nodes.find((node) => node.port === destination);
  if (!start || !finish) return null;

  const closed = blockedEdgeIds(conditions);
  const draft = conditions.vesselDraft ?? 0;
  const waterFactor = conditions.travelFactor ?? 1;
  const portNodes = new Set(
    network.nodes.filter((node) => node.port !== undefined).map((node) => node.id),
  );
  const links = new Map<string, TransportEdge[]>();
  for (const edge of network.edges) {
    for (const nodeId of [edge.from, edge.to]) {
      if (!links.has(nodeId)) links.set(nodeId, []);
      links.get(nodeId)!.push(edge);
    }
  }

  // A state is a place plus how the journey arrived, because changing mode costs time.
  type State = { node: string; mode: TransportMode | null; cost: number };
  const key = (node: string, mode: TransportMode | null) => `${node}|${mode}`;
  const best = new Map<string, number>([[key(start.id, null), 0]]);
  const cameBy = new Map<string, { from: string; edge: TransportEdge }>();
  const queue: State[] = [{ node: start.id, mode: null, cost: 0 }];
  let arrival: string | null = null;

  while (queue.length > 0) {
    let lowest = 0;
    for (let i = 1; i < queue.length; i += 1) {
      if (queue[i].cost < queue[lowest].cost) lowest = i;
    }
    const state = queue.splice(lowest, 1)[0];
    const stateKey = key(state.node, state.mode);
    if (state.cost > (best.get(stateKey) ?? Infinity)) continue;
    if (state.node === finish.id) {
      arrival = stateKey;
      break;
    }
    for (const edge of links.get(state.node) ?? []) {
      const next = edge.from === state.node ? edge.to : edge.from;
      // Ports are ends of journeys, never places to pass through.
      if (next !== finish.id && portNodes.has(next)) continue;
      if (closed.has(edge.id)) continue;
      if (edge.mode === "water" && edge.minimumDepth < draft) continue;
      const cost =
        state.cost +
        routeLength(edge.points) * (edge.mode === "land" ? LAND_TIME_FACTOR : waterFactor) +
        (state.mode && state.mode !== edge.mode ? TRANSFER_TIME_UNITS : 0);
      const nextKey = key(next, edge.mode);
      if (cost < (best.get(nextKey) ?? Infinity)) {
        best.set(nextKey, cost);
        cameBy.set(nextKey, { from: stateKey, edge });
        queue.push({ node: next, mode: edge.mode, cost });
      }
    }
  }
  if (arrival === null) return null;

  const edgeIds: string[] = [];
  for (let cursor = arrival; cameBy.has(cursor); cursor = cameBy.get(cursor)!.from) {
    edgeIds.unshift(cameBy.get(cursor)!.edge.id);
  }
  return buildRoute(network, origin, destination, edgeIds);
}

const HAIRPIN_COSINE = -0.3;
/** A turn-back this short is a tracing artefact at a junction, not a real manoeuvre. */
const MAX_HOOK_LENGTH = 40;

function turnCosine(a: RiverPoint, b: RiverPoint, c: RiverPoint): number {
  const [ux, uy, vx, vy] = [b.x - a.x, b.y - a.y, c.x - b.x, c.y - b.y];
  const lengths = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  return lengths === 0 ? 1 : (ux * vx + uy * vy) / lengths;
}

/** Removes the small hooks left where traced channels meet, and rounds off corners. */
export function smoothRoutePoints(points: readonly RiverPoint[]): RiverPoint[] {
  const clean = [...points];
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 1; i < clean.length - 1; i += 1) {
      if (distanceBetween(clean[i], clean[i + 1]) < 0.01) {
        clean.splice(i, 1);
        changed = true;
        break;
      }
      const short =
        Math.min(distanceBetween(clean[i - 1], clean[i]), distanceBetween(clean[i], clean[i + 1])) <
        MAX_HOOK_LENGTH;
      if (short && turnCosine(clean[i - 1], clean[i], clean[i + 1]) < HAIRPIN_COSINE) {
        clean.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  if (clean.length < 3) return clean;
  const smooth: RiverPoint[] = [clean[0]];
  for (let i = 1; i < clean.length - 1; i += 1) {
    const [before, here, after] = [clean[i - 1], clean[i], clean[i + 1]];
    smooth.push(
      { x: here.x + (before.x - here.x) * 0.25, y: here.y + (before.y - here.y) * 0.25 },
      { x: here.x + (after.x - here.x) * 0.25, y: here.y + (after.y - here.y) * 0.25 },
    );
  }
  smooth.push(clean[clean.length - 1]);
  return smooth.map((point) => ({
    x: Math.round(point.x * 100) / 100,
    y: Math.round(point.y * 100) / 100,
  }));
}

export function buildRoute(
  network: TransportNetwork,
  origin: TownId,
  destination: TownId,
  edgeIds: string[],
): RiverRoute | null {
  const start = network.nodes.find((node) => node.port === origin);
  const finish = network.nodes.find((node) => node.port === destination);
  if (!start || !finish || edgeIds.length === 0) return null;

  // Group the edges into one stretch per transport mode.
  const stretches: { mode: TransportMode; points: RiverPoint[] }[] = [];
  let cursorNode = start.id;
  for (const edgeId of edgeIds) {
    const edge = network.edges.find((candidate) => candidate.id === edgeId);
    if (!edge || (edge.from !== cursorNode && edge.to !== cursorNode)) return null;
    const edgePoints = orientedPoints(edge, cursorNode);
    const current = stretches[stretches.length - 1];
    if (current?.mode === edge.mode) current.points.push(...edgePoints.slice(1));
    else stretches.push({ mode: edge.mode, points: [...edgePoints] });
    cursorNode = edge.from === cursorNode ? edge.to : edge.from;
  }
  if (cursorNode !== finish.id) return null;

  const points: RiverPoint[] = [];
  const legs: RouteLeg[] = [];
  for (const stretch of stretches) {
    const smooth = smoothRoutePoints(stretch.points);
    const firstPoint = Math.max(0, points.length - 1);
    points.push(...(points.length > 0 ? smooth.slice(1) : smooth));
    legs.push({
      mode: stretch.mode,
      firstPoint,
      lastPoint: points.length - 1,
      distance: routeLength(smooth),
    });
  }

  return {
    origin,
    destination,
    edgeIds,
    points,
    distance: routeLength(points),
    legs,
  };
}

// Routes are drawn many times a second, and the real network never changes.
const plannedRoutes = new Map<string, RiverRoute | null>();

export function planRiverRoute(
  origin: TownId,
  destination: TownId,
  conditions: RouteConditions = {},
): RiverRoute | null {
  const key = `${origin}|${destination}|${JSON.stringify(conditions)}`;
  if (plannedRoutes.has(key)) return plannedRoutes.get(key)!;
  const route = planRoute(REAL_NETWORK, origin, destination, conditions);
  plannedRoutes.set(key, route);
  return route;
}

export function buildRiverRoute(
  origin: TownId,
  destination: TownId,
  edgeIds: string[],
): RiverRoute | null {
  return buildRoute(REAL_NETWORK, origin, destination, edgeIds);
}

/** Journey length in time units: boat distance × vessel factor, carts and transfers. */
export function getRouteTimeUnits(route: RiverRoute, travelFactor = 1): number {
  return route.legs.reduce(
    (total, leg, index) =>
      total +
      leg.distance * (leg.mode === "land" ? LAND_TIME_FACTOR : travelFactor) +
      (index > 0 ? TRANSFER_TIME_UNITS : 0),
    0,
  );
}

export interface RouteState {
  point: RiverPoint;
  /** The vehicle to show. */
  mode: TransportMode;
  /** True while cargo is moving between boat and cart at a landing. */
  transferring: boolean;
}

function pointAlong(points: readonly RiverPoint[], distance: number): RiverPoint {
  let remaining = distance;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const length = distanceBetween(start, end);
    if (remaining <= length && length > 0) {
      const fraction = remaining / length;
      return {
        x: start.x + (end.x - start.x) * fraction,
        y: start.y + (end.y - start.y) * fraction,
      };
    }
    remaining -= length;
  }
  return points[points.length - 1];
}

/** Where the journey is at a fraction of its time. Drawing and timing both use this. */
export function getRouteStateAt(
  route: RiverRoute,
  progress: number,
  travelFactor = 1,
): RouteState {
  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped === 1) {
    const last = route.legs[route.legs.length - 1];
    return { point: route.points[route.points.length - 1], mode: last.mode, transferring: false };
  }
  let remaining = clamped * getRouteTimeUnits(route, travelFactor);
  for (let index = 0; index < route.legs.length; index += 1) {
    const leg = route.legs[index];
    const points = route.points.slice(leg.firstPoint, leg.lastPoint + 1);
    if (index > 0) {
      if (remaining < TRANSFER_TIME_UNITS) {
        return { point: points[0], mode: leg.mode, transferring: true };
      }
      remaining -= TRANSFER_TIME_UNITS;
    }
    const speed = leg.mode === "land" ? LAND_TIME_FACTOR : travelFactor;
    const legUnits = leg.distance * speed;
    if (remaining <= legUnits || index === route.legs.length - 1) {
      return {
        point: pointAlong(points, Math.min(leg.distance, remaining / speed)),
        mode: leg.mode,
        transferring: false,
      };
    }
    remaining -= legUnits;
  }
  return { point: route.points[route.points.length - 1], mode: "water", transferring: false };
}

export function pointAlongRiverRoute(
  route: RiverRoute,
  progress: number,
  travelFactor = 1,
): RiverPoint {
  return getRouteStateAt(route, progress, travelFactor).point;
}

export function riverPointsToSvgPath(points: readonly RiverPoint[]): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
}
