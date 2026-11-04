// Switches for what the game shows. Only screens may read these. A switch that changed game
// rules would stop saved games replaying, so rule changes ship with a new save version instead.

export const FEATURES = {
  /** Shows what each town is known for on the City, Map and Market screens. */
  townSpecialties: true,
  /** Tells a player once, after upgrading, that the markets have changed. */
  marketUpgradeNotice: true,
  /** Shows how many automated routes have stopped, on every screen. */
  routeWaitingMarker: true,
} as const;
