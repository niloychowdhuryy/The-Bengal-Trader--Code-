import { describe, expect, it } from "vitest";
import { TOWNS } from "./model";
import {
  PORT_LOCATIONS,
  RIVER_EDGES,
  RIVER_NODES,
  planRiverRoute,
  pointAlongRiverRoute,
  riverPointsToSvgPath,
} from "./navigation";

describe("Bengal river navigation graph", () => {
  it("places every port on a connected waterway and connects edge junctions exactly", () => {
    for (const town of TOWNS) {
      const portNode = RIVER_NODES.find((node) => node.port === town.id);
      expect(portNode?.point).toEqual({ x: town.x, y: town.y });
      expect(portNode?.point).toEqual(PORT_LOCATIONS[town.id]);
      expect(
        RIVER_EDGES.some(
          (edge) => edge.from === portNode?.id || edge.to === portNode?.id,
        ),
      ).toBe(true);
    }

    for (const edge of RIVER_EDGES) {
      const start = RIVER_NODES.find((node) => node.id === edge.from);
      const end = RIVER_NODES.find((node) => node.id === edge.to);
      expect(edge.points[0]).toEqual(start?.point);
      expect(edge.points.at(-1)).toEqual(end?.point);
      expect(riverPointsToSvgPath(edge.points)).toContain("L");
    }
  });

  it("finds water-following paths between every pair of ports", () => {
    for (const origin of TOWNS) {
      for (const destination of TOWNS) {
        if (origin.id === destination.id) continue;
        const route = planRiverRoute(origin.id, destination.id);
        expect(route).not.toBeNull();
        expect(route?.origin).toBe(origin.id);
        expect(route?.destination).toBe(destination.id);
        expect(route?.points[0]).toEqual(PORT_LOCATIONS[origin.id]);
        expect(route?.points.at(-1)).toEqual(PORT_LOCATIONS[destination.id]);
        expect(route?.edgeIds.length).toBeGreaterThan(0);
        expect(route?.distance).toBeGreaterThan(0);

        for (const edgeId of route?.edgeIds ?? []) {
          expect(RIVER_EDGES.some((edge) => edge.id === edgeId)).toBe(true);
        }
      }
    }
  });

  it("plans port-to-port journeys without routing through another port", () => {
    const distanceToRoute = (
      route: NonNullable<ReturnType<typeof planRiverRoute>>,
      point: { x: number; y: number },
    ) =>
      Math.min(
        ...route.points.slice(1).map((end, index) => {
          const start = route.points[index];
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const segmentLengthSquared = dx * dx + dy * dy;
          const progress = segmentLengthSquared === 0
            ? 0
            : Math.max(
                0,
                Math.min(
                  1,
                  ((point.x - start.x) * dx + (point.y - start.y) * dy) /
                    segmentLengthSquared,
                ),
              );
          return Math.hypot(
            point.x - (start.x + progress * dx),
            point.y - (start.y + progress * dy),
          );
        }),
      );
    const crossings: string[] = [];

    for (const origin of TOWNS) {
      for (const destination of TOWNS) {
        if (origin.id === destination.id) continue;
        const route = planRiverRoute(origin.id, destination.id);
        expect(route).not.toBeNull();
        if (!route) continue;

        for (const town of TOWNS) {
          if (town.id === origin.id || town.id === destination.id) continue;
          expect(route.points).not.toContainEqual({ x: town.x, y: town.y });
          const mapTownPoint = { x: town.x * (1365 / 1152), y: town.y };
          const displayedRoute = {
            ...route,
            points: route.points.map((point) => ({
              x: point.x * (1365 / 1152),
              y: point.y,
            })),
          };
          const clearance = distanceToRoute(displayedRoute, mapTownPoint);
          if (clearance < 30) {
            crossings.push(
              `${origin.id} -> ${destination.id} near ${town.id} (${clearance.toFixed(1)})`,
            );
          }
        }
      }
    }
    expect(crossings.slice(0, 40)).toEqual([]);
  });

  it("keeps all 15 marker locations within the supplied 1152 by 768 map", () => {
    expect(TOWNS).toHaveLength(15);
    for (const town of TOWNS) {
      expect(town.x).toBeGreaterThanOrEqual(0);
      expect(town.x).toBeLessThanOrEqual(1152);
      expect(town.y).toBeGreaterThanOrEqual(0);
      expect(town.y).toBeLessThanOrEqual(768);
      expect(PORT_LOCATIONS[town.id]).toEqual({ x: town.x, y: town.y });
    }
  });

  it("moves a ship along a selected river path rather than across land", () => {
    const route = planRiverRoute("kasimbazar", "sonargaon");
    expect(route).not.toBeNull();
    if (!route) return;

    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const ship = pointAlongRiverRoute(route, progress);
      const liesOnRouteSegment = route.points.slice(1).some((end, index) => {
        const start = route.points[index];
        const cross =
          (ship.x - start.x) * (end.y - start.y) -
          (ship.y - start.y) * (end.x - start.x);
        const dot =
          (ship.x - start.x) * (end.x - start.x) +
          (ship.y - start.y) * (end.y - start.y);
        const lengthSquared =
          (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
        return (
          Math.abs(cross) < 0.001 &&
          dot >= -0.001 &&
          dot <= lengthSquared + 0.001
        );
      });
      expect(liesOnRouteSegment).toBe(true);
    }
  });

  it("rejects journeys when event, military, weather or vessel-depth restrictions close the path", () => {
    expect(planRiverRoute("dhaka", "kasimbazar", {
      eventBlockages: [
        "direct-upper-dhaka",
        "upper-river",
        "direct-upper-kasimbazar-junction",
        "northwest-channel",
      ],
    })).toBeNull();
    expect(
      planRiverRoute("dhaka", "kasimbazar", {
        militaryBlockages: [
          "direct-upper-dhaka",
          "upper-river",
          "direct-upper-kasimbazar-junction",
          "northwest-channel",
        ],
      }),
    ).toBeNull();
    expect(
      planRiverRoute("dhaka", "kasimbazar", {
        weatherBlockages: [
          "direct-upper-dhaka",
          "upper-river",
          "direct-upper-kasimbazar-junction",
          "northwest-channel",
        ],
      }),
    ).toBeNull();
    expect(
      planRiverRoute("sonargaon", "chittagong", { vesselDraft: 3 }),
    ).toBeNull();
    expect(planRiverRoute("dhaka", "dhaka")).toBeNull();
  });
});
