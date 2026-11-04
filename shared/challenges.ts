import { generateLevel } from "./level-generator";
import type { LevelData, Point } from "./schema";
import { solveStats } from "./solver";

/**
 * Dedicated daily/weekly puzzles.
 *
 * The campaign boards are intentionally left untouched: changing them would
 * invalidate saved ghost paths, level codes and old share cards. Instead the
 * challenges are drawn from the campaign's *provably single-solution* boards
 * (`UNIQUE_LEVEL_IDS`, verified by `shared/solver.ts`), then rotated or mirrored
 * so a challenge never looks exactly like the level it came from.
 *
 * Selection uses a fixed permutation of the whole pool indexed by the calendar
 * day/week. That guarantees no board repeats until the pool has been exhausted
 * (72 daily challenges / 72 weekly challenges), instead of the old
 * `hash(date) % 200` which repeated a board after about two weeks.
 */

export type ChallengeKind = "daily" | "weekly";

export interface ChallengeSpec {
  kind: ChallengeKind;
  /** Date key (`YYYY-MM-DD`) or ISO week key (`YYYY-Www`). */
  key: string;
  levelId: number;
  /** 0 = plain, 1 = mirrored, 2 = 180°, 3 = 90°. */
  variant: number;
  /** Index in the shuffled pool, for tests and share cards. */
  slot: number;
}

/** Levels with exactly one Hamiltonian solution, found by `script/audit-uniqueness.ts`. */
export const UNIQUE_LEVEL_IDS: readonly number[] = [
  1, 2, 3, 5, 7, 8, 10, 11, 13, 17, 19, 20, 22, 23, 37, 59, 62, 80,
];
export const CHALLENGE_VARIANTS = 4;
export const CHALLENGE_POOL_SIZE = UNIQUE_LEVEL_IDS.length * CHALLENGE_VARIANTS;

/** Same formula as the campaign's par time; kept here so the worker can use it too. */
export function challengeParMs(nodeCount: number): number {
  return Math.max(15_000, nodeCount * 1_100 + 4_000);
}

/** Par-normalised pace: 1000 means exactly par, higher is faster. */
export function challengeScore(timeMs: number, parMs: number): number {
  if (!Number.isFinite(timeMs) || timeMs <= 0 || parMs <= 0) return 0;
  return Math.max(1, Math.round((parMs / timeMs) * 1000));
}

const difficultyCache = new Map<number, { score: number; factor: number }>();

/**
 * Solver-based difficulty. The number of DFS nodes needed to prove the board
 * unique says more about how hard it is to read than the node count alone:
 * two 20-node boards can search very differently. The result is a 0–100 score
 * plus a small par-time factor, so the pace score stays fair between boards.
 */
export function challengeDifficulty(levelId: number, level: LevelData): { score: number; factor: number } {
  const cached = difficultyCache.get(levelId);
  if (cached) return cached;
  const value = boardDifficulty(level);
  difficultyCache.set(levelId, value);
  return value;
}

/**
 * Uncached variant for player-made boards, which must not share the campaign's
 * levelId keyed cache (every Lab board would otherwise report the first score).
 */
export function boardDifficulty(level: LevelData): { score: number; factor: number } {
  const { expanded } = solveStats(level);
  return difficultyFromExpanded(expanded, level.nodes.length);
}

/** Turns an already-counted DFS search into the same 0–100 score. */
export function difficultyFromExpanded(expanded: number, nodeCount: number): { score: number; factor: number } {
  const baseline = Math.max(16, nodeCount * 12);
  const effort = Math.log2(1 + expanded / baseline);
  const score = Math.round(Math.max(0, Math.min(100, effort * 14)));
  return { score, factor: 1 + score / 500 };
}

function mulberry32(seed: number): () => number {
  return () => {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function permutation(kind: ChallengeKind): number[] {
  const random = mulberry32(kind === "daily" ? 0x4e454f4e : 0x5745454b);
  const slots = Array.from({ length: CHALLENGE_POOL_SIZE }, (_, i) => i);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  return slots;
}

const POOLS: Record<ChallengeKind, number[]> = {
  daily: permutation("daily"),
  weekly: permutation("weekly"),
};

/**
 * Absolute period number derived from the key alone — never from a Date or a
 * timestamp. The client and the verification worker run in different timezones,
 * so a timestamp-based index would silently pick different boards.
 */
export function challengePeriod(kind: ChallengeKind, key: string): number {
  if (kind === "weekly") {
    const match = /^(\d{4})-W(\d{2})$/.exec(key);
    if (!match) return 0;
    const jan4 = Date.UTC(Number(match[1]), 0, 4);
    return Math.floor((jan4 + (Number(match[2]) - 1) * 7 * 86_400_000) / (7 * 86_400_000));
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return 0;
  return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000);
}

export function getChallengeSpec(kind: ChallengeKind, key: string): ChallengeSpec {
  const period = challengePeriod(kind, key);
  const pool = POOLS[kind];
  const slot = ((period % pool.length) + pool.length) % pool.length;
  const entry = pool[slot];
  return {
    kind,
    key,
    levelId: UNIQUE_LEVEL_IDS[Math.floor(entry / CHALLENGE_VARIANTS)],
    variant: entry % CHALLENGE_VARIANTS,
    slot,
  };
}

function transform(point: Point, size: number, variant: number): Point {
  const max = size - 1;
  switch (variant % 4) {
    case 1: return { x: max - point.x, y: point.y };
    case 2: return { x: max - point.x, y: max - point.y };
    case 3: return { x: max - point.y, y: point.x };
    default: return { ...point };
  }
}

export interface BuiltChallenge {
  level: LevelData;
  solution: Point[];
  parMs: number;
  /** 0–100 solver-based difficulty, used for the par-time factor and reports. */
  difficulty: number;
}

/**
 * Builds the playable board. `mirrored` is the weekly modifier and is applied
 * on top of the spec's rotation, in both the client and the verification worker.
 */
export function buildChallengeLevel(
  spec: ChallengeSpec,
  options: { mirrored?: boolean } = {},
): BuiltChallenge {
  const generated = generateLevel(spec.levelId);
  const size = generated.gridSize;
  const flip = (point: Point): Point => ({ x: size - 1 - point.x, y: point.y });
  const map = (point: Point): Point => {
    const rotated = transform(point, size, spec.variant);
    return options.mirrored ? flip(rotated) : rotated;
  };
  const base: LevelData = {
    id: generated.id,
    gridSize: size,
    start: map(generated.start),
    nodes: generated.nodes.map(map),
  };
  const { score, factor } = challengeDifficulty(spec.levelId, base);
  return {
    level: base,
    solution: generated.solution.map(map),
    parMs: Math.round(challengeParMs(base.nodes.length) * factor),
    difficulty: score,
  };
}
