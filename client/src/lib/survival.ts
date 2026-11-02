import { GENERATOR_MAX_LEVEL_ID } from "@shared/level-generator";

/**
 * Rift Survival: an endless run built from the campaign's own boards. Each
 * round draws a level from a difficulty band that widens every two clears, so
 * the boards keep getting bigger while the clock keeps getting shorter.
 */

export const SURVIVAL_START_HEARTS = 3;
/** Free rewinds per board. Running out turns a dead end into a lost heart. */
export const SURVIVAL_UNDOS = 1;
/** Bands are ten levels wide, so band 33 tops out at the last generated board. */
export const SURVIVAL_BANDS = Math.floor(GENERATOR_MAX_LEVEL_ID / 10);

/** Which ten-level band a round draws from. */
export function bandForRound(round: number): number {
  return Math.max(1, Math.min(SURVIVAL_BANDS, 1 + Math.floor((round - 1) / 2)));
}

/**
 * A board for the round. `random` is injectable so the rule stays testable.
 */
export function levelIdForRound(round: number, random: () => number = Math.random): number {
  const base = (bandForRound(round) - 1) * 10;
  const offset = Math.min(9, Math.floor(random() * 10));
  return Math.min(GENERATOR_MAX_LEVEL_ID, base + 1 + offset);
}

/** Seconds on the clock: bigger boards get more time, later rounds get less. */
export function roundTimeMs(nodeCount: number, round: number): number {
  const raw = 9_000 + nodeCount * 1_150 - (round - 1) * 350;
  return Math.max(12_000, Math.min(48_000, raw));
}

/** Combo multiplier for the number of boards cleared in a row without a loss. */
export function comboMultiplier(streak: number): number {
  const safeStreak = Number.isFinite(streak) ? Math.max(0, streak) : 0;
  return Math.min(4, 1 + safeStreak * 0.25);
}

/** Points for a clear: the round and the clock both pay, then the combo scales it. */
export function scoreForClear(round: number, remainingMs: number, streak: number): number {
  const safeRound = Number.isFinite(round) ? Math.max(0, round) : 0;
  const safeMs = Number.isFinite(remainingMs) ? Math.max(0, remainingMs) : 0;
  const base = 120 + safeRound * 45 + safeMs / 1000 * 9;
  return Math.round(base * comboMultiplier(streak));
}

export interface SurvivalBest {
  bestRound: number;
  bestScore: number;
}

const BEST_KEY = "neon_path_survival_v1";

export const EMPTY_BEST: SurvivalBest = { bestRound: 0, bestScore: 0 };

export function readSurvivalBest(): SurvivalBest {
  try {
    const parsed = JSON.parse(localStorage.getItem(BEST_KEY) ?? "null") as Partial<SurvivalBest> | null;
    if (!parsed) return { ...EMPTY_BEST };
    return {
      bestRound: Math.max(0, Math.trunc(Number(parsed.bestRound)) || 0),
      bestScore: Math.max(0, Math.trunc(Number(parsed.bestScore)) || 0),
    };
  } catch {
    return { ...EMPTY_BEST };
  }
}

export function writeSurvivalBest(best: SurvivalBest): void {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    // A blocked storage only costs the record, never the run.
  }
}
