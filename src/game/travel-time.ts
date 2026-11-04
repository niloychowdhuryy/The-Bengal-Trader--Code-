import {
  CHITTAGONG_ALERT_EXTRA_DAYS,
  IN_GAME_DAY_DURATION_MS,
  MAX_NORMAL_VOYAGE_DURATION_MS,
  SAILING_SPEEDS,
} from "./config/travel";
import {
  RIVER_NODES,
  getRouteTimeUnits,
  planRiverRoute,
  type RiverRoute,
} from "./navigation";

export {
  CHITTAGONG_ALERT_EXTRA_DAYS,
  IN_GAME_DAY_DURATION_MS,
  MAX_NORMAL_VOYAGE_DURATION_MS,
  SAILING_SPEEDS,
};
export type SailingSpeed = (typeof SAILING_SPEEDS)[number];

export interface VoyageProgress {
  durationMs: number;
  elapsedMs: number;
  progressUpdatedAt: number;
}

export function getVoyageProgressMs(
  voyage: VoyageProgress,
  speed: SailingSpeed,
  now: number,
): number {
  return Math.min(
    voyage.durationMs,
    voyage.elapsedMs + Math.max(0, now - voyage.progressUpdatedAt) * speed,
  );
}

export function getVoyageRemainingRealTimeMs(
  voyage: VoyageProgress,
  speed: SailingSpeed,
  now: number,
): number {
  return (
    (voyage.durationMs - getVoyageProgressMs(voyage, speed, now)) / speed
  );
}

let maximumRouteUnits: number | null = null;

/** The longest journey between any two ports, for a River boat, in time units. */
export function getMaximumRouteTimeUnits(): number {
  if (maximumRouteUnits !== null) return maximumRouteUnits;

  const ports = RIVER_NODES.flatMap((node) => node.port ? [node.port] : []);
  let longest = 0;
  for (const origin of ports) {
    for (const destination of ports) {
      if (origin === destination) continue;
      const route = planRiverRoute(origin, destination);
      if (route) longest = Math.max(longest, getRouteTimeUnits(route));
    }
  }

  if (longest <= 0) {
    throw new Error("Cannot calculate travel time without a navigable route.");
  }
  maximumRouteUnits = longest;
  return longest;
}

export interface RouteTravelTime {
  durationMs: number;
  durationDays: number;
}

export function getRouteTravelTime(
  route: RiverRoute,
  chittagongAlert = false,
  travelFactor = 1,
): RouteTravelTime {
  const normalDurationMs =
    (getRouteTimeUnits(route, travelFactor) / getMaximumRouteTimeUnits()) *
    MAX_NORMAL_VOYAGE_DURATION_MS;
  const alertDelayMs = chittagongAlert
    ? CHITTAGONG_ALERT_EXTRA_DAYS * IN_GAME_DAY_DURATION_MS
    : 0;
  const durationMs = Math.min(
    MAX_NORMAL_VOYAGE_DURATION_MS,
    normalDurationMs + alertDelayMs,
  );

  return {
    durationMs,
    durationDays: durationMs / IN_GAME_DAY_DURATION_MS,
  };
}

export function formatTravelDuration(durationMs: number): string {
  const totalSeconds = Math.ceil(Math.max(0, durationMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

export function formatInGameDays(days: number): string {
  return days.toFixed(1);
}
