import { hashDateKey } from "./daily";
import type { TranslationKey } from "./i18n";

export type WeeklyModifier = "mirror" | "no-undo" | "time-attack" | "no-hints";

export interface WeeklyModifierInfo {
  label: string;
  description: string;
}

export const weeklyModifierInfo: Record<WeeklyModifier, WeeklyModifierInfo> = {
  mirror: {
    label: "Mirrored",
    description: "The board is flipped. Same rules, new muscle memory.",
  },
  "no-undo": {
    label: "No undo",
    description: "The undo button and backwards drags are disabled.",
  },
  "time-attack": {
    label: "Time attack",
    description: "Par time is 25% tighter than usual.",
  },
  "no-hints": {
    label: "No hints",
    description: "Hint tokens cannot be spent this week.",
  },
};

const MODIFIERS: WeeklyModifier[] = ["mirror", "no-undo", "time-attack", "no-hints"];

export const weeklyModifierKeys: Record<WeeklyModifier, { label: TranslationKey; description: TranslationKey }> = {
  mirror: { label: "mirrorLabel", description: "mirrorDesc" },
  "no-undo": { label: "noUndoLabel", description: "noUndoDesc" },
  "time-attack": { label: "timeAttackLabel", description: "timeAttackDesc" },
  "no-hints": { label: "noHintsLabel", description: "noHintsDesc" },
};
const STORAGE_KEY = "neon_path_weekly_v1";
const MAX_STORED_WEEKS = 52;

export interface WeeklyChallenge {
  weekKey: string;
  levelId: number;
  modifier: WeeklyModifier;
  startsAt: number;
  endsAt: number;
}

export interface WeeklyResult {
  weekKey: string;
  levelId: number;
  modifier: WeeklyModifier;
  timeMs: number;
  stars: number;
  completedAt: number;
}

const fallbackResults: Record<string, WeeklyResult> = {};

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** ISO-8601 week number, so a challenge runs Monday through Sunday. */
export function getWeekKey(date: Date = new Date()): string {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = (utc.getUTCDay() + 6) % 7;
  utc.setUTCDate(utc.getUTCDate() - day + 3);
  const year = utc.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round((utc.getTime() - firstThursday.getTime()) / 604_800_000);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function getWeekNumber(date: Date): number {
  return Number(getWeekKey(date).split("-W")[1]);
}

export function getWeeklyChallenge(date: Date = new Date()): WeeklyChallenge {
  const weekKey = getWeekKey(date);
  const weekNumber = getWeekNumber(date);
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  monday.setHours(0, 0, 0, 0);
  const endsAt = new Date(monday);
  endsAt.setDate(endsAt.getDate() + 7);

  return {
    weekKey,
    levelId: (hashDateKey(`weekly-${weekKey}`) % 200) + 1,
    modifier: MODIFIERS[(weekNumber - 1) % MODIFIERS.length],
    startsAt: monday.getTime(),
    endsAt: endsAt.getTime(),
  };
}

export function getTimeUntilNextWeekly(date: Date = new Date()): number {
  return Math.max(0, getWeeklyChallenge(date).endsAt - date.getTime());
}

function isWeeklyResult(value: unknown): value is WeeklyResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<WeeklyResult>;
  return typeof result.weekKey === "string"
    && /^\d{4}-W\d{2}$/.test(result.weekKey)
    && Number.isInteger(result.levelId)
    && (result.levelId ?? 0) >= 1
    && (result.levelId ?? 0) <= 200
    && MODIFIERS.includes(result.modifier as WeeklyModifier)
    && Number.isFinite(result.timeMs)
    && (result.timeMs ?? -1) >= 0
    && Number.isInteger(result.stars)
    && (result.stars ?? 0) >= 1
    && (result.stars ?? 0) <= 3
    && Number.isFinite(result.completedAt);
}

export function getWeeklyResults(): Record<string, WeeklyResult> {
  const storage = getStorage();
  if (!storage) return { ...fallbackResults };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter((entry): entry is [string, WeeklyResult] =>
        isWeeklyResult(entry[1]),
      ),
    );
  } catch {
    return {};
  }
}

export function getWeeklyResult(weekKey: string = getWeekKey()): WeeklyResult | null {
  return getWeeklyResults()[weekKey] ?? null;
}

export function saveWeeklyResult(result: WeeklyResult): WeeklyResult {
  const results = getWeeklyResults();
  const previous = results[result.weekKey];
  const isBetter = !previous
    || result.stars > previous.stars
    || (result.stars === previous.stars && result.timeMs < previous.timeMs);
  const stored: WeeklyResult = isBetter ? result : previous as WeeklyResult;

  if (isBetter) {
    results[result.weekKey] = result;
  }

  const trimmed = Object.fromEntries(
    Object.entries(results)
      .sort(([, a], [, b]) => b.completedAt - a.completedAt)
      .slice(0, MAX_STORED_WEEKS),
  );

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      Object.assign(fallbackResults, trimmed);
    }
  } else {
    Object.assign(fallbackResults, trimmed);
  }

  return stored;
}
