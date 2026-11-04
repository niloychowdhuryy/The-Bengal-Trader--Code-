// How long things take. Voyages already under way are checked against these on load.

export const MAX_NORMAL_VOYAGE_DURATION_MS = 5 * 60 * 1000;
export const IN_GAME_DAY_DURATION_MS = 60 * 1000;
export const SAILING_SPEEDS = [1, 2, 4] as const;

/** Carts cover the same distance in this many times a River boat's time. */
export const LAND_TIME_FACTOR = 2.5;
/** Moving cargo between boat and cart takes as long as this much distance by boat. */
export const TRANSFER_TIME_UNITS = 15;

export const CHITTAGONG_ALERT_EXTRA_DAYS = 1;
export const EVENT_LAST_DAY = 36;

/** Every this many voyages something happens on the way, in turn a pilot and rough water. */
export const TRAVEL_EVENT_INTERVAL = 5;
export const RIVER_PILOT_STANDING = 2;
export const ROUGH_WATER_HULL_DAMAGE = 1;
