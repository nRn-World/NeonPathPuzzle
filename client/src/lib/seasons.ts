/**
 * Seasonal events. Each one runs on the same calendar days every year and asks
 * for a few campaign clears; finishing it earns a permanent theme and hint
 * tokens. Rewards are never taken away when the event ends.
 */
export interface Season {
  id: string;
  /** Inclusive [month, day] bounds; `to` may wrap into the next year. */
  from: [number, number];
  to: [number, number];
  themeId: string;
  accent: string;
  /** Different campaign levels to clear during the event. */
  goal: number;
  rewardTokens: number;
}

export const SEASONS: Season[] = [
  { id: "spring", from: [3, 20], to: [4, 20], themeId: "bloom", accent: "#ff9ecb", goal: 5, rewardTokens: 3 },
  { id: "summer", from: [6, 21], to: [7, 20], themeId: "solar", accent: "#ffb300", goal: 5, rewardTokens: 3 },
  { id: "halloween", from: [10, 18], to: [11, 2], themeId: "haunted", accent: "#ff7a00", goal: 5, rewardTokens: 3 },
  { id: "winter", from: [12, 15], to: [1, 6], themeId: "frost", accent: "#8fe8ff", goal: 5, rewardTokens: 3 },
];

export interface ActiveSeason {
  season: Season;
  /** Unique per event and year, e.g. "winter-2026" (a winter event belongs to the year it starts). */
  key: string;
  daysLeft: number;
}

const DAY_MS = 86_400_000;

const dayOfYear = (month: number, day: number) => month * 100 + day;

export function getActiveSeason(date: Date = new Date()): ActiveSeason | null {
  const today = dayOfYear(date.getMonth() + 1, date.getDate());
  for (const season of SEASONS) {
    const from = dayOfYear(...season.from);
    const to = dayOfYear(...season.to);
    const wraps = from > to;
    const inside = wraps ? today >= from || today <= to : today >= from && today <= to;
    if (!inside) continue;

    const startYear = wraps && today <= to ? date.getFullYear() - 1 : date.getFullYear();
    const endYear = wraps ? startYear + 1 : startYear;
    const end = new Date(endYear, season.to[0] - 1, season.to[1]);
    const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return {
      season,
      key: `${season.id}-${startYear}`,
      daysLeft: Math.max(0, Math.round((end.getTime() - midnight.getTime()) / DAY_MS)),
    };
  }
  return null;
}

export interface SeasonState {
  /** Levels cleared per event key. */
  progress: Record<string, number[]>;
  /** Season ids whose reward has been earned, for good. */
  claimed: string[];
}

const KEY = "neon_path_season_v1";

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readSeasonState(): SeasonState {
  const state: SeasonState = { progress: {}, claimed: [] };
  try {
    const parsed = JSON.parse(storage()?.getItem(KEY) ?? "{}") as Partial<SeasonState>;
    if (Array.isArray(parsed.claimed)) state.claimed = parsed.claimed.filter((id): id is string => typeof id === "string");
    Object.entries(parsed.progress ?? {}).forEach(([key, levels]) => {
      if (Array.isArray(levels)) state.progress[key] = levels.filter(level => Number.isInteger(level));
    });
  } catch {
    // Unreadable save: the event simply starts over, no reward is lost that was claimed elsewhere.
  }
  return state;
}

/** Pure update: records one cleared level and reports whether it finished the event. */
export function applySeasonClear(
  state: SeasonState,
  active: ActiveSeason,
  levelId: number,
): { state: SeasonState; justCompleted: boolean } {
  if (state.claimed.includes(active.season.id)) return { state, justCompleted: false };
  const cleared = new Set(state.progress[active.key] ?? []);
  cleared.add(levelId);
  const progress = { ...state.progress, [active.key]: Array.from(cleared) };
  const justCompleted = cleared.size >= active.season.goal;
  return {
    state: { progress, claimed: justCompleted ? [...state.claimed, active.season.id] : state.claimed },
    justCompleted,
  };
}

export function recordSeasonClear(active: ActiveSeason, levelId: number): boolean {
  const { state, justCompleted } = applySeasonClear(readSeasonState(), active, levelId);
  try {
    storage()?.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: progress isn't remembered, the reward is only given when it is.
    return false;
  }
  return justCompleted;
}

export const isSeasonRewardEarned = (seasonId: string) => readSeasonState().claimed.includes(seasonId);
