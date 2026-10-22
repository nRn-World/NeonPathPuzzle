export type StarCount = 1 | 2 | 3;

export interface StarInput {
  mistakes: number;
  hintsUsed: boolean;
  timeMs: number;
  parTimeMs: number;
}

/**
 * Par time is generous enough to reward planning, not just speed. A perfect
 * run needs no hints, no backtracks, and a finish under par.
 */
export function getParTimeMs(nodeCount: number): number {
  return Math.max(15_000, nodeCount * 1_100 + 4_000);
}

export function calculateStars({ mistakes, hintsUsed, timeMs, parTimeMs }: StarInput): StarCount {
  let stars = 3;
  if (hintsUsed) stars -= 1;
  if (mistakes > 0) stars -= 1;
  if (timeMs > parTimeMs) stars -= 1;
  return Math.max(1, Math.min(3, stars)) as StarCount;
}

export function calculateScore(input: {
  nodeCount: number;
  stars: number;
  timeMs: number;
  multiplier?: number;
}): number {
  const { nodeCount, stars, timeMs, multiplier = 1 } = input;
  const timeBonus = Math.max(0, 30_000 - timeMs) / 50;
  const base = nodeCount * 100 + stars * 750 + timeBonus;
  return Math.round(base * multiplier);
}

/** A finished time with tenths ("0:07.4"): close races and quick boards need the extra digit. */
export function formatResultTime(ms: number): string {
  const tenths = Math.max(0, Math.floor(ms / 100));
  return `${formatDuration(tenths * 100)}.${tenths % 10}`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
