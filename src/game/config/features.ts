// Switches for what the game shows. Only screens may read these. A switch that changed game
// rules would stop saved games replaying, so rule changes ship with a new save version instead.

export const FEATURES = {
  /** Not built into the main game yet. */
  townSpecialties: false,
} as const;
