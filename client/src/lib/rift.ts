/**
 * The Rift: a bonus sector after the 300-level campaign. It is not part of the
 * run, so it has no attempt limit and a crash never touches it.
 */
export const RIFT_FIRST_LEVEL = 301;
export const RIFT_LEVEL_COUNT = 30;
export const RIFT_LAST_LEVEL = RIFT_FIRST_LEVEL + RIFT_LEVEL_COUNT - 1;
/** Levels cleared (ever) before the sector opens, so new rules aren't a surprise on day one. */
export const RIFT_UNLOCK_CLEARS = 100;

export const isRiftLevel = (levelId: number) => levelId >= RIFT_FIRST_LEVEL && levelId <= RIFT_LAST_LEVEL;
export const isRiftUnlocked = (clearedCount: number) => clearedCount >= RIFT_UNLOCK_CLEARS;
