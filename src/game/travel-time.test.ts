import { describe, expect, it } from "vitest";
import { TOWNS } from "./model";
import { planRiverRoute } from "./navigation";
import {
  CHITTAGONG_ALERT_EXTRA_DAYS,
  getMaximumNavigableRouteDistance,
  getRouteTravelTime,
  IN_GAME_DAY_DURATION_MS,
  MAX_NORMAL_VOYAGE_DURATION_MS,
  getVoyageProgressMs,
  getVoyageRemainingRealTimeMs,
} from "./travel-time";

describe("river travel time", () => {
  it("scales every reachable port pair by navigable route distance", () => {
    const routes = TOWNS.flatMap((origin) =>
      TOWNS.flatMap((destination) => {
        if (origin.id === destination.id) return [];
        const route = planRiverRoute(origin.id, destination.id);
        return route ? [route] : [];
      }),
    );
    const shortest = routes.reduce((best, route) =>
      route.distance < best.distance ? route : best,
    );
    const longest = routes.reduce((best, route) =>
      route.distance > best.distance ? route : best,
    );
    const maximumDistance = getMaximumNavigableRouteDistance();

    expect(longest.distance).toBe(maximumDistance);
    expect(getRouteTravelTime(longest).durationMs).toBe(
      MAX_NORMAL_VOYAGE_DURATION_MS,
    );
    expect(getRouteTravelTime(shortest).durationMs).toBeGreaterThan(0);
    expect(getRouteTravelTime(shortest).durationMs).toBeLessThan(
      MAX_NORMAL_VOYAGE_DURATION_MS,
    );

    for (const route of routes) {
      const timing = getRouteTravelTime(route);
      expect(timing.durationMs).toBeCloseTo(
        (route.distance / maximumDistance) * MAX_NORMAL_VOYAGE_DURATION_MS,
        8,
      );
      expect(timing.durationDays).toBe(
        timing.durationMs / IN_GAME_DAY_DURATION_MS,
      );
    }
  });

  it("converts the Chittagong alert into a capped one-day sailing delay", () => {
    const route = planRiverRoute("dhaka", "chittagong");
    expect(route).not.toBeNull();
    if (!route) return;

    const normal = getRouteTravelTime(route);
    const delayed = getRouteTravelTime(route, true);
    expect(delayed.durationMs).toBeLessThanOrEqual(
      MAX_NORMAL_VOYAGE_DURATION_MS,
    );
    expect(delayed.durationDays).toBe(
      delayed.durationMs / IN_GAME_DAY_DURATION_MS,
    );
    expect(delayed.durationMs - normal.durationMs).toBe(
      Math.min(
        CHITTAGONG_ALERT_EXTRA_DAYS * IN_GAME_DAY_DURATION_MS,
        MAX_NORMAL_VOYAGE_DURATION_MS - normal.durationMs,
      ),
    );
  });

  it.each([
    [1, 300_000],
    [2, 150_000],
    [4, 75_000],
  ] as const)("uses the expected real duration at %s× speed", (speed, expectedMs) => {
    const voyage = {
      durationMs: MAX_NORMAL_VOYAGE_DURATION_MS,
      elapsedMs: 0,
      progressUpdatedAt: 10_000,
    };

    expect(getVoyageRemainingRealTimeMs(voyage, speed, 10_000)).toBe(
      expectedMs,
    );
    expect(
      getVoyageProgressMs(voyage, speed, 10_000 + expectedMs),
    ).toBe(MAX_NORMAL_VOYAGE_DURATION_MS);
  });

  it("uses the selected speed for elapsed progress and clamps arrival", () => {
    const voyage = {
      durationMs: 300_000,
      elapsedMs: 50_000,
      progressUpdatedAt: 10_000,
    };

    expect(getVoyageProgressMs(voyage, 4, 20_000)).toBe(90_000);
    expect(getVoyageRemainingRealTimeMs(voyage, 4, 20_000)).toBe(52_500);
    expect(getVoyageProgressMs(voyage, 4, 100_000)).toBe(300_000);
  });
});
