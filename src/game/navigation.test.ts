import { describe, expect, it } from "vitest";
import {
  smoothRoutePoints,
  LAND_TIME_FACTOR,
  PORT_LOCATIONS,
  PORT_QUAYS,
  RIVER_EDGES,
  RIVER_NODES,
  TRANSFER_TIME_UNITS,
  getRouteStateAt,
  getRouteTimeUnits,
  planRiverRoute,
  planRoute,
  type TransportEdge,
  type TransportMode,
  type TransportNetwork,
} from "./navigation";
import { VESSEL_CLASSES, VESSEL_CLASS_IDS, getShipRouteConditions, MARKET_PORTS, type TownId } from "./model";
import { MAX_NORMAL_VOYAGE_DURATION_MS, getMaximumRouteTimeUnits, getRouteTravelTime } from "./travel-time";
import waterMask from "./__fixtures__/water-mask.json";

// Test networks use real port ids as ordinary names.
const A = "dhaka" as TownId;
const B = "sonargaon" as TownId;
const C = "hooghly" as TownId;

function edge(
  id: string,
  from: string,
  to: string,
  length: number,
  { mode = "water", depth = 3, at = 0 }: { mode?: TransportMode; depth?: number; at?: number } = {},
): TransportEdge {
  return {
    id,
    from,
    to,
    mode,
    minimumDepth: depth,
    points: [{ x: at, y: 0 }, { x: at + length, y: 0 }],
  };
}

function network(edges: TransportEdge[], ports: TownId[] = [A, B, C]): TransportNetwork {
  const ids = new Set(edges.flatMap((e) => [e.from, e.to]));
  return {
    edges,
    nodes: [...ids].map((id) => ({
      id,
      point: { x: 0, y: 0 },
      ...(ports.includes(id as TownId) ? { port: id as TownId } : {}),
    })),
  };
}

const ids = (route: { edgeIds: string[] } | null) => route?.edgeIds;

describe("route planning", () => {
  it("takes a direct connection over a longer way round", () => {
    const net = network([
      edge("direct", A, B, 100),
      edge("away", A, "j", 80),
      edge("back", "j", B, 80),
    ]);
    expect(ids(planRoute(net, A, B))).toEqual(["direct"]);
  });

  it("picks the right branch at a junction", () => {
    const net = network([
      edge("main", A, "fork", 50),
      edge("left", "fork", B, 50),
      edge("right", "fork", C, 50),
    ]);
    expect(ids(planRoute(net, A, B))).toEqual(["main", "left"]);
    expect(ids(planRoute(net, A, C))).toEqual(["main", "right"]);
  });

  it("uses a narrow channel when the vessel fits, and goes round when it doesn't", () => {
    const net = network([
      edge("narrow", A, B, 20, { depth: 1.4 }),
      edge("wide-1", A, "j", 100),
      edge("wide-2", "j", B, 100),
    ]);
    expect(ids(planRoute(net, A, B, { vesselDraft: 1.2 }))).toEqual(["narrow"]);
    expect(ids(planRoute(net, A, B, { vesselDraft: 1.4 }))).toEqual(["narrow"]);
    expect(ids(planRoute(net, A, B, { vesselDraft: 1.5 }))).toEqual(["wide-1", "wide-2"]);
  });

  it("doesn't wander into dead ends", () => {
    const net = network([
      edge("way", A, B, 100),
      edge("dead-1", A, "dead", 5),
      edge("dead-2", "dead", "end", 5),
    ]);
    expect(ids(planRoute(net, A, B))).toEqual(["way"]);
    expect(planRoute(network([edge("dead", A, "end", 5), edge("other", B, "x", 5)]), A, B)).toBeNull();
  });

  it("never passes through another port", () => {
    const net = network([
      edge("to-c", A, C, 10),
      edge("from-c", C, B, 10),
      edge("long-1", A, "j", 500),
      edge("long-2", "j", B, 500),
    ]);
    expect(ids(planRoute(net, A, B))).toEqual(["long-1", "long-2"]);
  });

  it("returns nothing when no route exists, or for the same port", () => {
    const net = network([edge("a", A, "x", 5), edge("b", B, "y", 5)]);
    expect(planRoute(net, A, B)).toBeNull();
    expect(planRoute(net, A, A)).toBeNull();
  });

  it("respects closures", () => {
    const net = network([edge("one", A, B, 10), edge("two-a", A, "j", 50), edge("two-b", "j", B, 50)]);
    expect(ids(planRoute(net, A, B, { eventBlockages: ["one"] }))).toEqual(["two-a", "two-b"]);
    expect(planRoute(net, A, B, { weatherBlockages: ["one"], militaryBlockages: ["two-a"] })).toBeNull();
  });
});

describe("journeys by water and land", () => {
  const landOnly = network([
    edge("river", A, "landing", 100),
    edge("road", "landing", B, 40, { mode: "land" }),
  ]);

  it("reaches a port that only a road connects", () => {
    const route = planRoute(landOnly, A, B)!;
    expect(route.legs.map((leg) => leg.mode)).toEqual(["water", "land"]);
    expect(planRoute(network([edge("river", A, "landing", 100)]), A, B)).toBeNull();
  });

  it("travels from land back to water", () => {
    const route = planRoute(landOnly, B, A)!;
    expect(route.legs.map((leg) => leg.mode)).toEqual(["land", "water"]);
  });

  it("supports water, then land, then water as one journey", () => {
    const net = network([
      edge("first", A, "up", 100),
      edge("portage", "up", "down", 30, { mode: "land", at: 100 }),
      edge("second", "down", B, 100, { at: 130 }),
    ]);
    const route = planRoute(net, A, B)!;
    expect(route.legs.map((leg) => leg.mode)).toEqual(["water", "land", "water"]);
    expect(route.distance).toBeCloseTo(230);
    expect(getRouteTimeUnits(route)).toBeCloseTo(
      200 + 30 * LAND_TIME_FACTOR + 2 * TRANSFER_TIME_UNITS,
    );
  });

  it("prefers a longer waterway when carting would really be slower", () => {
    const net = network([
      edge("road", A, B, 100, { mode: "land" }),
      edge("river", A, B, 200),
    ]);
    expect(ids(planRoute(net, A, B))).toEqual(["river"]);
    const shortRoad = network([edge("road", A, B, 50, { mode: "land" }), edge("river", A, B, 200)]);
    expect(ids(planRoute(shortRoad, A, B))).toEqual(["road"]);
  });

  it("counts the time to transfer cargo when choosing", () => {
    const net = network([
      edge("all-water", A, B, 121),
      edge("water-part", A, "landing", 100),
      edge("land-part", "landing", B, 4, { mode: "land" }),
    ]);
    // 100 + 4 × 2.5 + 15 transfer = 125, so 121 by water wins despite being longer than 104.
    expect(ids(planRoute(net, A, B))).toEqual(["all-water"]);
  });

  it("doesn't let draft limits apply to roads, but never lets a road reach a barred port", () => {
    const net = network([
      edge("shallow", A, "landing", 50, { depth: 1 }),
      edge("deep", A, "landing2", 50, { depth: 3 }),
      edge("road", "landing2", B, 20, { mode: "land" }),
    ]);
    expect(ids(planRoute(net, A, B, { vesselDraft: 1.5 }))).toEqual(["deep", "road"]);
    expect(planRoute(net, A, B, { vesselDraft: 1.5, barredPorts: [B] })).toBeNull();
  });
});

describe("route smoothing", () => {
  it("removes a small hook but keeps the ends", () => {
    const hooked = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 94, y: 1 }, { x: 200, y: 0 }];
    const smooth = smoothRoutePoints(hooked);
    expect(smooth[0]).toEqual(hooked[0]);
    expect(smooth.at(-1)).toEqual(hooked.at(-1));
    expect(smooth.every((point, i) => i === 0 || point.x >= smooth[i - 1].x)).toBe(true);
  });

  it("leaves a straight two-point channel alone", () => {
    const line = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    expect(smoothRoutePoints(line)).toEqual(line);
  });
});

describe("journey state, shared by drawing and timing", () => {
  const route = planRoute(
    network([edge("river", A, "landing", 100), edge("road", "landing", B, 40, { mode: "land", at: 100 })]),
    A,
    B,
  )!;
  const total = 100 + TRANSFER_TIME_UNITS + 40 * LAND_TIME_FACTOR;

  it("shows a boat on water, then a transfer, then a cart on land", () => {
    expect(getRouteStateAt(route, 0)).toMatchObject({ mode: "water", transferring: false });
    expect(getRouteStateAt(route, 50 / total)).toMatchObject({ mode: "water", point: { x: 50 } });
    expect(getRouteStateAt(route, 105 / total)).toMatchObject({ mode: "land", transferring: true });
    expect(getRouteStateAt(route, (115 + 50) / total)).toMatchObject({ mode: "land", transferring: false });
    expect(getRouteStateAt(route, 1)).toMatchObject({ mode: "land", point: { x: 140 } });
  });

  it("stays still during the transfer", () => {
    const start = getRouteStateAt(route, 101 / total).point;
    const end = getRouteStateAt(route, 114 / total).point;
    expect(start).toEqual(end);
  });

  it("slows the boat, not the cart, for a slower vessel", () => {
    expect(getRouteTimeUnits(route, 2)).toBeCloseTo(200 + TRANSFER_TIME_UNITS + 100);
    // 205 of 315 units is past the 200 of boat time, inside the transfer.
    expect(getRouteStateAt(route, 205 / 315, 2)).toMatchObject({ transferring: true });
  });
});

// The real map: the water map is baked from the painting, in its 1365 × 768 pixels.
const expanded: Uint8Array[] = waterMask.rows.map((runs) => {
  const row = new Uint8Array(waterMask.width);
  let x = 0;
  runs.forEach((run, index) => {
    if (index % 2 === 1) row.fill(1, x, x + run);
    x += run;
  });
  return row;
});
const isWater = (nx: number, ny: number, slack = 0) => {
  const x = Math.round((nx * waterMask.width) / 1152);
  const y = Math.round(ny);
  for (let dy = -slack; dy <= slack; dy += 1) {
    for (let dx = -slack; dx <= slack; dx += 1) {
      if (expanded[y + dy]?.[x + dx]) return true;
    }
  }
  return false;
};
function samples(points: readonly { x: number; y: number }[]) {
  const out: { x: number; y: number }[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const [a, b] = [points[i - 1], points[i]];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
    for (let s = 0; s <= steps; s += 1) {
      out.push({ x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps });
    }
  }
  return out;
}
const ports = MARKET_PORTS.map((port) => port.id);

describe("the real map", () => {
  it("keeps every water route on painted water", () => {
    for (const e of RIVER_EDGES.filter((candidate) => candidate.mode === "water")) {
      const dry = samples(e.points).filter((p) => !isWater(p.x, p.y, 2));
      expect(dry, e.id).toEqual([]);
    }
  });

  it("keeps every cart road off the water, apart from reaching its landing", () => {
    const roads = RIVER_EDGES.filter((candidate) => candidate.mode === "land");
    expect(roads.length).toBeGreaterThan(0);
    for (const road of roads) {
      const path = samples(road.points);
      const landings = [path[0], path[path.length - 1]];
      const wet = path.filter(
        (p) => isWater(p.x, p.y) && landings.every((end) => Math.hypot(end.x - p.x, end.y - p.y) > 12),
      );
      expect(wet, road.id).toEqual([]);
    }
  });

  it("moors every ship on water", () => {
    for (const port of ports) expect(isWater(PORT_QUAYS[port].x, PORT_QUAYS[port].y, 1), port).toBe(true);
  });

  it("connects every edge's ends to its nodes", () => {
    const nodes = new Map(RIVER_NODES.map((node) => [node.id, node.point]));
    for (const e of RIVER_EDGES) {
      const [from, to] = [nodes.get(e.from), nodes.get(e.to)];
      expect(from, e.from).toBeDefined();
      expect(to, e.to).toBeDefined();
      expect(Math.hypot(e.points[0].x - from!.x, e.points[0].y - from!.y), e.id).toBeLessThan(3);
      expect(Math.hypot(e.points.at(-1)!.x - to!.x, e.points.at(-1)!.y - to!.y), e.id).toBeLessThan(3);
    }
  });

  it.each(["river-boat", "bora"] as const)("lets a %s reach all 15 ports from anywhere", (vessel) => {
    const conditions = getShipRouteConditions({}, vessel);
    for (const a of ports) for (const b of ports) {
      if (a !== b) expect(planRiverRoute(a, b, conditions), `${a}>${b}`).not.toBeNull();
    }
  });

  it("lets a Patello reach every port except Sylhet and Balasore", () => {
    const conditions = getShipRouteConditions({}, "patello");
    for (const a of ports) for (const b of ports) {
      if (a === b) continue;
      const route = planRiverRoute(a, b, conditions);
      if (b === "sylhet" || b === "balasore") expect(route, `${a}>${b}`).toBeNull();
      else expect(route, `${a}>${b}`).not.toBeNull();
    }
  });

  it("keeps a Patello out of narrow channels, while lighter boats may use them", () => {
    const narrow = (route: { edgeIds: string[] }) =>
      route.edgeIds.some((id) => (RIVER_EDGES.find((e) => e.id === id)!.minimumDepth) < 1.5 && RIVER_EDGES.find((e) => e.id === id)!.mode === "water");
    const river = planRiverRoute("dhaka", "malda", getShipRouteConditions({}, "river-boat"))!;
    const patello = planRiverRoute("dhaka", "malda", getShipRouteConditions({}, "patello"))!;
    expect(narrow(river)).toBe(true);
    expect(narrow(patello)).toBe(false);
    expect(patello.distance).toBeGreaterThan(river.distance);
  });

  it("uses neither ports as waypoints nor absurd detours", () => {
    const portNodes = new Set(RIVER_NODES.filter((node) => node.port).map((node) => node.id));
    for (const a of ports) for (const b of ports) {
      if (a >= b) continue;
      const route = planRiverRoute(a, b)!;
      const straight = Math.hypot(PORT_LOCATIONS[a].x - PORT_LOCATIONS[b].x, PORT_LOCATIONS[a].y - PORT_LOCATIONS[b].y);
      expect(route.distance / straight, `${a}-${b}`).toBeLessThan(6);
      let cursor = RIVER_NODES.find((node) => node.port === a)!.id;
      route.edgeIds.forEach((id, index) => {
        const e = RIVER_EDGES.find((candidate) => candidate.id === id)!;
        cursor = e.from === cursor ? e.to : e.from;
        if (index < route.edgeIds.length - 1) expect(portNodes.has(cursor), `${a}-${b}`).toBe(false);
      });
    }
  });

  it("has no sharp turn-backs on any route, for any vessel", () => {
    for (const vessel of VESSEL_CLASS_IDS) {
      const conditions = getShipRouteConditions({}, vessel);
      for (const a of ports) for (const b of ports) {
        const route = a === b ? null : planRiverRoute(a, b, conditions);
        if (!route) continue;
        for (const leg of route.legs) {
          const points = route.points.slice(leg.firstPoint, leg.lastPoint + 1);
          for (let i = 2; i < points.length; i += 1) {
            const [ux, uy] = [points[i - 1].x - points[i - 2].x, points[i - 1].y - points[i - 2].y];
            const [vx, vy] = [points[i].x - points[i - 1].x, points[i].y - points[i - 1].y];
            const lengths = Math.hypot(ux, uy) * Math.hypot(vx, vy);
            const cosine = lengths === 0 ? 1 : (ux * vx + uy * vy) / lengths;
            expect(cosine, `${vessel} ${a}>${b} point ${i}`).toBeGreaterThan(-0.3);
          }
        }
      }
    }
  });

  it("gets Dhaka to its neighbours quickly, fixing the old long ways round", () => {
    expect(getRouteTravelTime(planRiverRoute("dhaka", "sonargaon")!).durationMs).toBeLessThan(90_000);
    expect(getRouteTravelTime(planRiverRoute("hooghly", "satgaon")!).durationMs).toBeLessThan(60_000);
    expect(getRouteTravelTime(planRiverRoute("balasore", "hooghly")!).durationMs).toBeLessThan(180_000);
  });

  it("uses carts where the map needs them", () => {
    expect(planRiverRoute("dhaka", "sonargaon")!.legs.map((leg) => leg.mode)).toEqual(["water", "land"]);
    expect(planRiverRoute("balasore", "dhaka")!.legs.map((leg) => leg.mode)).toEqual(["land", "water"]);
    expect(planRiverRoute("dhaka", "bakla-chandradwip")!.legs.map((leg) => leg.mode)).toEqual(["water", "land"]);
    expect(planRiverRoute("dhaka", "hooghly")!.legs.map((leg) => leg.mode)).toEqual(["water"]);
  });

  it("makes route, vehicle and time agree for every journey and vessel", () => {
    for (const vessel of VESSEL_CLASS_IDS) {
      const factor = VESSEL_CLASSES[vessel].travelFactor;
      const conditions = getShipRouteConditions({}, vessel);
      for (const a of ports) for (const b of ports) {
        const route = a === b ? null : planRiverRoute(a, b, conditions);
        if (!route) continue;
        // Every boat position stays on the painted water, including after smoothing.
        const leg = route.legs.filter((candidate) => candidate.mode === "water");
        for (const part of leg) {
          const dry = samples(route.points.slice(part.firstPoint, part.lastPoint + 1)).filter(
            (p) => !isWater(p.x, p.y, 4),
          );
          expect(dry, `${vessel} ${a}>${b}`).toEqual([]);
        }
        expect(getRouteStateAt(route, 0, factor).point).toEqual(route.points[0]);
        expect(getRouteStateAt(route, 1, factor).point).toEqual(route.points.at(-1));
        expect(route.legs.reduce((sum, leg) => sum + leg.distance, 0)).toBeCloseTo(route.distance);
        // Boats only ever appear on water and carts only on land.
        for (let step = 0; step <= 40; step += 1) {
          const state = getRouteStateAt(route, step / 40, factor);
          if (state.transferring) continue;
          if (state.mode === "water") expect(isWater(state.point.x, state.point.y, 3), `${a}>${b}`).toBe(true);
        }
        const time = getRouteTravelTime(route, false, factor);
        expect(time.durationMs).toBeLessThanOrEqual(MAX_NORMAL_VOYAGE_DURATION_MS);
        const uncapped = (getRouteTimeUnits(route, factor) / getMaximumRouteTimeUnits()) * MAX_NORMAL_VOYAGE_DURATION_MS;
        expect(time.durationMs).toBeCloseTo(Math.min(uncapped, MAX_NORMAL_VOYAGE_DURATION_MS));
      }
    }
  });

  it("closes a port when every way in is closed, and reopens it", () => {
    const closures = RIVER_EDGES.filter((e) => e.from === "patna" || e.to === "patna").map((e) => e.id);
    expect(planRiverRoute("dhaka", "patna", { eventBlockages: closures })).toBeNull();
    expect(planRiverRoute("dhaka", "patna")).not.toBeNull();
  });
});
