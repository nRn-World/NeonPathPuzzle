import type { Point } from "@shared/schema";
import {
  emptyDailyState,
  getDateKey,
  updateDailyState,
  type DailyResult,
  type DailyState,
} from "./daily";

export const TOTAL_LEVELS = 200;

const STORAGE_PREFIX = "neon_path_progress_v2_";
const LEGACY_PREFIX = "neon_path_progress_";

export interface LevelRecord {
  levelId: number;
  completed: boolean;
  stars: number;
  bestTimeMs: number | null;
  bestMoves: number | null;
  bestMistakes: number | null;
  bestScore: number | null;
  /** The path of the personal best run, used for the ghost overlay. */
  bestPath: Point[] | null;
  hintsUsed: boolean;
  updatedAt: number;
}

export interface ProgressData {
  version: 2;
  completed: number[];
  hints: number[];
  records: Record<string, LevelRecord>;
  lastLevelId: number;
  daily: DailyState;
  tutorialSeen: boolean;
  createdAt: number;
}

export interface LevelResultInput {
  levelId: number;
  completed: boolean;
  hintsUsed: boolean;
  stars: number;
  timeMs: number;
  moves: number;
  mistakes: number;
  score?: number;
  path?: Point[];
}

export interface AppliedLevelResult {
  progress: ProgressData;
  record: LevelRecord;
  isNewBest: boolean;
}

const fallbackProgress: Record<string, ProgressData> = {};

function now() {
  return Date.now();
}

function clampLevel(levelId: number): number {
  if (!Number.isFinite(levelId)) return 1;
  return Math.max(1, Math.min(TOTAL_LEVELS, Math.trunc(levelId)));
}

export function createEmptyProgress(): ProgressData {
  return {
    version: 2,
    completed: [],
    hints: [],
    records: {},
    lastLevelId: 1,
    daily: emptyDailyState(),
    tutorialSeen: false,
    createdAt: now(),
  };
}

function normalizeLevelIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .filter((item): item is number => Number.isInteger(item) && item >= 1 && item <= TOTAL_LEVELS)
      .map(item => Math.trunc(item)),
  )).sort((a, b) => a - b);
}

function sanitizePath(value: unknown): Point[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 600) return null;
  const points: Point[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const point = item as Partial<Point>;
    if (!Number.isInteger(point.x) || !Number.isInteger(point.y)) return null;
    if (point.x! < 0 || point.y! < 0 || point.x! > 64 || point.y! > 64) return null;
    points.push({ x: point.x!, y: point.y! });
  }
  return points;
}

/** Imported stats must never turn into a negative "best" that can't be beaten. */
function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : null;
}

function normalizeRecord(levelId: number, value: unknown): LevelRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<LevelRecord>;
  const stars = Number.isFinite(record.stars)
    ? Math.max(initialStars(record), Math.min(3, Math.trunc(record.stars as number)))
    : initialStars(record);

  return {
    levelId,
    completed: Boolean(record.completed),
    stars,
    bestTimeMs: nonNegativeInteger(record.bestTimeMs),
    bestMoves: nonNegativeInteger(record.bestMoves),
    bestMistakes: nonNegativeInteger(record.bestMistakes),
    bestScore: nonNegativeInteger(record.bestScore),
    bestPath: sanitizePath(record.bestPath),
    hintsUsed: Boolean(record.hintsUsed),
    updatedAt: Number.isFinite(record.updatedAt) ? Math.max(0, Number(record.updatedAt)) : 0,
  };
}

function initialStars(record: { completed?: unknown; stars?: unknown }): number {
  if (Number.isFinite(record.stars)) return Math.max(1, Math.min(3, Math.trunc(record.stars as number)));
  return record.completed ? 1 : 0;
}

function normalizeDaily(value: unknown): DailyState {
  if (!value || typeof value !== "object") return emptyDailyState();
  const daily = value as Partial<DailyState>;
  const results: Record<string, DailyResult> = {};

  if (daily.results && typeof daily.results === "object") {
    Object.entries(daily.results).forEach(([dateKey, result]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
      if (!result || typeof result !== "object") return;
      const candidate = result as Partial<DailyResult>;
      if (!Number.isInteger(candidate.levelId) || !Number.isFinite(candidate.timeMs)) return;
      results[dateKey] = {
        levelId: clampLevel(Number(candidate.levelId)),
        timeMs: Math.max(0, Number(candidate.timeMs)),
        stars: Math.max(1, Math.min(3, Math.trunc(Number(candidate.stars) || 1))),
        completedAt: Number.isFinite(candidate.completedAt) ? Number(candidate.completedAt) : 0,
      };
    });
  }

  return {
    lastPlayedDate: typeof daily.lastPlayedDate === "string" ? daily.lastPlayedDate : null,
    streak: Math.max(0, Math.trunc(Number(daily.streak) || 0)),
    bestStreak: Math.max(0, Math.trunc(Number(daily.bestStreak) || 0)),
    results,
  };
}

function normalizeProgress(value: unknown): ProgressData {
  if (!value || typeof value !== "object") return createEmptyProgress();
  const candidate = value as Partial<ProgressData>;
  const completed = normalizeLevelIds(candidate.completed);
  const hints = normalizeLevelIds(candidate.hints);
  const records: Record<string, LevelRecord> = {};

  if (candidate.records && typeof candidate.records === "object") {
    Object.entries(candidate.records).forEach(([key, raw]) => {
      const levelId = Number(key);
      if (!Number.isInteger(levelId) || levelId < 1 || levelId > TOTAL_LEVELS) return;
      const record = normalizeRecord(levelId, raw);
      if (record) records[String(levelId)] = record;
    });
  }

  // Guarantee a record for every completed level, even from a partial save.
  completed.forEach(levelId => {
    if (!records[String(levelId)]) {
      records[String(levelId)] = {
        levelId,
        completed: true,
        stars: 1,
        bestTimeMs: null,
        bestMoves: null,
        bestMistakes: null,
        bestScore: null,
        bestPath: null,
        hintsUsed: hints.includes(levelId),
        updatedAt: 0,
      };
    }
  });

  const lastLevelId = Number.isInteger(candidate.lastLevelId)
    ? clampLevel(Number(candidate.lastLevelId))
    : getFirstUnsolvedLevel(completed);

  return {
    version: 2,
    completed,
    hints,
    records,
    lastLevelId,
    daily: normalizeDaily(candidate.daily),
    tutorialSeen: Boolean(candidate.tutorialSeen),
    createdAt: Number.isFinite(candidate.createdAt) ? Number(candidate.createdAt) : now(),
  };
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function readLegacy(userId: string): ProgressData | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(`${LEGACY_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { completed?: unknown; hints?: unknown };
    const completed = normalizeLevelIds(parsed.completed);
    const hints = normalizeLevelIds(parsed.hints);
    const progress = createEmptyProgress();
    progress.completed = completed;
    progress.hints = hints;
    progress.tutorialSeen = completed.length > 0;
    progress.lastLevelId = getFirstUnsolvedLevel(completed);
    completed.forEach(levelId => {
      progress.records[String(levelId)] = {
        levelId,
        completed: true,
        stars: 1,
        bestTimeMs: null,
        bestMoves: null,
        bestMistakes: null,
        bestScore: null,
        bestPath: null,
        hintsUsed: hints.includes(levelId),
        updatedAt: 0,
      };
    });
    return progress;
  } catch {
    return null;
  }
}

export function getProgress(userId: string): ProgressData {
  if (!userId) return createEmptyProgress();
  const storage = getStorage();

  if (!storage) {
    if (!fallbackProgress[userId]) fallbackProgress[userId] = createEmptyProgress();
    return fallbackProgress[userId];
  }

  try {
    const raw = storage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (raw) return normalizeProgress(JSON.parse(raw));
  } catch {
    // Fall through to migration / empty progress.
  }

  const legacy = readLegacy(userId);
  if (legacy) {
    saveProgress(userId, legacy);
    return legacy;
  }

  return createEmptyProgress();
}

/** Replace all progress for a player with untrusted (imported) data. */
export function importProgress(userId: string, value: unknown): ProgressData {
  const normalized = normalizeProgress(value);
  saveProgress(userId, normalized);
  return normalized;
}

export function saveProgress(userId: string, progress: ProgressData): void {
  if (!userId) return;
  const normalized = normalizeProgress(progress);
  const storage = getStorage();

  if (!storage) {
    fallbackProgress[userId] = normalized;
    return;
  }

  try {
    storage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(normalized));
  } catch {
    fallbackProgress[userId] = normalized;
  }
}

function getFirstUnsolvedLevel(completed: number[]): number {
  const completedSet = new Set(completed);
  for (let levelId = 1; levelId <= TOTAL_LEVELS; levelId++) {
    if (!completedSet.has(levelId)) return levelId;
  }
  return TOTAL_LEVELS;
}

/**
 * Continue means "resume the level I was on, otherwise the next unsolved one".
 */
export function getContinueLevel(progress: ProgressData): number {
  const completed = new Set(progress.completed);
  if (progress.lastLevelId >= 1 && progress.lastLevelId <= TOTAL_LEVELS) {
    if (!completed.has(progress.lastLevelId)) return progress.lastLevelId;
  }
  return getFirstUnsolvedLevel(progress.completed);
}

export function getTotalStars(progress: ProgressData): number {
  return Object.values(progress.records).reduce((total, record) => total + record.stars, 0);
}

export function getTotalScore(progress: ProgressData): number {
  return Object.values(progress.records).reduce((total, record) => total + (record.bestScore ?? 0), 0);
}

export function getLevelRecord(progress: ProgressData, levelId: number): LevelRecord | null {
  return progress.records[String(levelId)] ?? null;
}

export function applyLevelResult(
  progress: ProgressData,
  input: LevelResultInput,
): AppliedLevelResult {
  const levelId = clampLevel(input.levelId);
  const timeMs = Number.isFinite(input.timeMs) ? Math.max(0, input.timeMs) : 0;
  const moves = Number.isFinite(input.moves) ? Math.max(0, Math.trunc(input.moves)) : 0;
  const mistakes = Number.isFinite(input.mistakes) ? Math.max(0, Math.trunc(input.mistakes)) : 0;
  const stars = Math.max(1, Math.min(3, Math.trunc(Number(input.stars) || 1)));
  const existing = progress.records[String(levelId)];
  // 0 ms is a real time: only a missing value counts as "no best yet".
  const isNewBest = input.completed && (
    existing?.bestTimeMs === null
    || existing?.bestTimeMs === undefined
    || timeMs < existing.bestTimeMs
  );

  const submittedPath = input.completed ? sanitizePath(input.path) : null;

  const record: LevelRecord = {
    levelId,
    completed: input.completed || Boolean(existing?.completed),
    stars: input.completed ? Math.max(existing?.stars ?? 0, stars) : existing?.stars ?? 0,
    bestTimeMs: input.completed
      ? (existing?.bestTimeMs === null || existing?.bestTimeMs === undefined
        ? timeMs
        : Math.min(existing.bestTimeMs, timeMs))
      : existing?.bestTimeMs ?? null,
    bestMoves: input.completed
      ? (existing?.bestMoves === null || existing?.bestMoves === undefined
        ? moves
        : Math.min(existing.bestMoves, moves))
      : existing?.bestMoves ?? null,
    bestMistakes: input.completed
      ? (existing?.bestMistakes === null || existing?.bestMistakes === undefined
        ? mistakes
        : Math.min(existing.bestMistakes, mistakes))
      : existing?.bestMistakes ?? null,
    bestScore: input.completed && input.score !== undefined && Number.isFinite(input.score)
      ? Math.max(existing?.bestScore ?? 0, Math.max(0, Math.trunc(input.score)))
      : existing?.bestScore ?? null,
    // A malformed new recording must not erase a usable older ghost.
    bestPath: input.completed
      ? (existing?.bestPath && existing.bestTimeMs !== null && existing.bestTimeMs < timeMs
        ? existing.bestPath
        : submittedPath ?? existing?.bestPath ?? null)
      : existing?.bestPath ?? null,
    hintsUsed: Boolean(existing?.hintsUsed) || input.hintsUsed,
    updatedAt: now(),
  };

  const completed = input.completed
    ? Array.from(new Set([...progress.completed, levelId])).sort((a, b) => a - b)
    : progress.completed;
  const hints = input.hintsUsed
    ? Array.from(new Set([...progress.hints, levelId])).sort((a, b) => a - b)
    : progress.hints;

  return {
    progress: {
      ...progress,
      completed,
      hints,
      records: { ...progress.records, [String(levelId)]: record },
      lastLevelId: levelId,
    },
    record,
    isNewBest,
  };
}

export function saveLevelResult(userId: string, input: LevelResultInput): AppliedLevelResult {
  const progress = getProgress(userId);
  const applied = applyLevelResult(progress, input);
  saveProgress(userId, applied.progress);
  return applied;
}

export function markLevelPlayed(userId: string, levelId: number): void {
  if (!userId) return;
  const progress = getProgress(userId);
  if (progress.lastLevelId === levelId) return;
  progress.lastLevelId = clampLevel(levelId);
  saveProgress(userId, progress);
}

export function markTutorialSeen(userId: string): void {
  const progress = getProgress(userId);
  if (progress.tutorialSeen) return;
  progress.tutorialSeen = true;
  saveProgress(userId, progress);
}

export function hasSeenTutorial(userId: string): boolean {
  return getProgress(userId).tutorialSeen;
}

export function recordDailyResult(
  userId: string,
  dateKey: string,
  result: Omit<DailyResult, "completedAt">,
): DailyState {
  const progress = getProgress(userId);
  progress.daily = updateDailyState(progress.daily, dateKey, result);
  saveProgress(userId, progress);
  return progress.daily;
}

export function getDailyState(userId: string, dateKey: string = getDateKey()): DailyState {
  return getProgress(userId).daily;
}
