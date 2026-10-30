import type { Point } from "@shared/schema";
import { getPlayer, leaderboardEnabled, onlineBase } from "@/lib/leaderboard";
import {
  getProgress,
  mergeProgress,
  sanitizeProgress,
  saveProgress,
  type LevelRecord,
  type ProgressData,
} from "@/lib/progress";

/**
 * Cloud sync: a signed-in device mirrors its progress to the worker so the same
 * Google account continues on another phone. The save is a compact copy of the
 * local blob — ghost paths and the long daily log stay on the device, because a
 * 300-level save has to stay around 40 KB.
 */

export type SyncOutcome = "synced" | "pushed" | "pulled" | "unavailable" | "failed";

/** How many days of the daily log ride along. */
const DAILY_HISTORY_DAYS = 60;

/** Cloud sync follows the online identity, which Google sign-in provides. */
export function cloudSyncReady(): boolean {
  return leaderboardEnabled() && getPlayer().online;
}

interface CompactRecord {
  levelId: number;
  completed: boolean;
  stars: number;
  bestTimeMs: number | null;
  bestMoves: number | null;
  bestMistakes: number | null;
  bestScore: number | null;
  hintsUsed: boolean;
  updatedAt: number;
}

function compactRecord(record: LevelRecord): CompactRecord {
  return {
    levelId: record.levelId,
    completed: record.completed,
    stars: record.stars,
    bestTimeMs: record.bestTimeMs,
    bestMoves: record.bestMoves,
    bestMistakes: record.bestMistakes,
    bestScore: record.bestScore,
    hintsUsed: record.hintsUsed,
    updatedAt: record.updatedAt,
  };
}

/** The wire format: the same shape as ProgressData minus the bulky parts. */
export function toCloudPayload(progress: ProgressData): Record<string, unknown> {
  const records: Record<string, CompactRecord> = {};
  Object.entries(progress.records).forEach(([key, record]) => {
    records[key] = compactRecord(record);
  });

  const dailyKeys = Object.keys(progress.daily.results).sort().slice(-DAILY_HISTORY_DAYS);
  const dailyResults: Record<string, unknown> = {};
  dailyKeys.forEach(key => {
    dailyResults[key] = progress.daily.results[key];
  });

  return {
    version: progress.version,
    completed: progress.completed,
    runCompleted: progress.runCompleted,
    attempts: progress.attempts,
    crashes: progress.crashes,
    hints: progress.hints,
    records,
    lastLevelId: progress.lastLevelId,
    daily: {
      lastPlayedDate: progress.daily.lastPlayedDate,
      streak: progress.daily.streak,
      bestStreak: progress.daily.bestStreak,
      results: dailyResults,
    },
    tutorialSeen: progress.tutorialSeen,
    createdAt: progress.createdAt,
  };
}

/** Ghost paths are device-local, so a downloaded save keeps the ones it had. */
function reattachGhosts(progress: ProgressData, existing: ProgressData): ProgressData {
  const records: Record<string, LevelRecord> = { ...progress.records };
  Object.entries(records).forEach(([key, record]) => {
    const localPath: Point[] | null = existing.records[key]?.bestPath ?? null;
    if (!record.bestPath && localPath) records[key] = { ...record, bestPath: localPath };
  });
  return { ...progress, records };
}

function normalizeRemote(data: unknown): ProgressData | null {
  if (!data || typeof data !== "object") return null;
  // The sanitiser is the same one used for pasted backups, so a hostile save
  // cannot inject a path outside the board or an unbeatable best time.
  return sanitizeProgress(data);
}

interface SaveResponse {
  data?: unknown;
  updatedAt?: number;
}

async function fetchSave(playerId: string): Promise<SaveResponse | null> {
  const response = await fetch(`${onlineBase()}/save?playerId=${encodeURIComponent(playerId)}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Save request failed (${response.status})`);
  return (await response.json()) as SaveResponse;
}

async function pushSave(playerId: string, progress: ProgressData): Promise<void> {
  const response = await fetch(`${onlineBase()}/save`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ playerId, data: toCloudPayload(progress) }),
  });
  if (!response.ok) throw new Error(`Save push failed (${response.status})`);
}

/**
 * Pull, merge and push in one pass. Merging (not overwriting) is what makes it
 * safe to sign in on a device that has been played offline for a week.
 */
export async function syncProgress(userId: string): Promise<SyncOutcome> {
  if (!userId || !cloudSyncReady()) return "unavailable";
  const playerId = getPlayer().id;

  try {
    const remote = await fetchSave(playerId);
    const local = getProgress(userId);

    if (!remote) {
      await pushSave(playerId, local);
      return "pushed";
    }

    const remoteProgress = normalizeRemote(remote.data);
    if (!remoteProgress) {
      await pushSave(playerId, local);
      return "pushed";
    }

    const merged = reattachGhosts(mergeProgress(local, remoteProgress), local);
    saveProgress(userId, merged);
    await pushSave(playerId, merged);
    return local.completed.length === 0 && remoteProgress.completed.length > 0 ? "pulled" : "synced";
  } catch {
    return "failed";
  }
}

let pushTimer = 0;

/**
 * Uploads after a clear without a request per level: the last result wins and
 * one write follows. Silent by design — a failed sync must never interrupt play.
 */
export function scheduleProgressPush(userId: string): void {
  if (!userId || !cloudSyncReady()) return;
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    void pushSave(getPlayer().id, getProgress(userId)).catch(() => {
      // The next clear retries; nothing is lost locally.
    });
  }, 2_500);
}
