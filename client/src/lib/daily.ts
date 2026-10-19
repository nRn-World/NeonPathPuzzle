export interface DailyResult {
  levelId: number;
  timeMs: number;
  stars: number;
  completedAt: number;
}

export interface DailyState {
  lastPlayedDate: string | null;
  streak: number;
  bestStreak: number;
  results: Record<string, DailyResult>;
}

export const DAILY_LEVEL_COUNT = 200;
const MAX_STORED_RESULTS = 60;

export function emptyDailyState(): DailyState {
  return {
    lastPlayedDate: null,
    streak: 0,
    bestStreak: 0,
    results: {},
  };
}

/** Local calendar date, not UTC, so a challenge changes at local midnight. */
export function getDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftDateKey(dateKey: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setDate(date.getDate() + days);
  return getDateKey(date);
}

/** Oldest-to-newest list of calendar days ending on `dateKey`. */
export function getRecentDateKeys(dateKey: string = getDateKey(), days = 7): string[] {
  const count = Math.max(1, Math.trunc(days));
  return Array.from({ length: count }, (_, index) => shiftDateKey(dateKey, index - (count - 1)));
}

/** Milliseconds until the next local midnight, when a new challenge starts. */
export function getTimeUntilNextDaily(now: Date = new Date()): number {
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, nextMidnight.getTime() - now.getTime());
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

/** Deterministic FNV-1a hash, so every player gets the same level each day. */
export function hashDateKey(dateKey: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < dateKey.length; index++) {
    hash ^= dateKey.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function getDailyLevelId(dateKey: string = getDateKey()): number {
  return (hashDateKey(dateKey) % DAILY_LEVEL_COUNT) + 1;
}

/**
 * Record a daily result without ever lowering a score. The streak only grows
 * when the previous completed day is yesterday.
 */
export function updateDailyState(
  state: DailyState,
  dateKey: string,
  result: Omit<DailyResult, "completedAt"> & { completedAt?: number },
): DailyState {
  const previous = state.results[dateKey];
  const isBetter = !previous
    || result.stars > previous.stars
    || (result.stars === previous.stars && result.timeMs < previous.timeMs);

  const results = { ...state.results };
  if (isBetter) {
    results[dateKey] = {
      levelId: result.levelId,
      timeMs: result.timeMs,
      stars: result.stars,
      completedAt: result.completedAt ?? Date.now(),
    };
  }

  let streak = state.streak;
  let bestStreak = state.bestStreak;

  if (state.lastPlayedDate !== dateKey) {
    const yesterday = shiftDateKey(dateKey, -1);
    streak = state.lastPlayedDate === yesterday ? state.streak + 1 : 1;
    bestStreak = Math.max(bestStreak, streak);
  } else if (streak < 1) {
    streak = 1;
  }

  const trimmedResults = Object.fromEntries(
    Object.entries(results)
      .sort(([, a], [, b]) => b.completedAt - a.completedAt)
      .slice(0, MAX_STORED_RESULTS),
  );

  return {
    lastPlayedDate: dateKey,
    streak,
    bestStreak: Math.max(bestStreak, streak),
    results: trimmedResults,
  };
}

export function hasCompletedDaily(state: DailyState, dateKey: string = getDateKey()): boolean {
  return Boolean(state.results[dateKey]);
}

/** A streak only counts while today or yesterday was played. */
export function getActiveStreak(state: DailyState, dateKey: string = getDateKey()): number {
  if (state.lastPlayedDate === dateKey || state.lastPlayedDate === shiftDateKey(dateKey, -1)) {
    return state.streak;
  }
  return 0;
}
