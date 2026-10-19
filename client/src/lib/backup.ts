import { getProgress, getTotalStars, importProgress, type ProgressData } from "./progress";

export const BACKUP_APP = "neon-path-puzzle";
export const BACKUP_VERSION = 1;

/**
 * Zustand stores that live next to the progress data. Backing them up means a
 * player keeps achievements, power-ups and the selected theme on a new device.
 */
export const BACKUP_STORE_KEYS = [
  "neon-path-achievements",
  "neon-path-powerups",
  "neon-path-theme",
  "neon-path-settings",
  "neon-path-hint-tokens",
  "neon-path-language",
  "neon_path_weekly_v1",
  "neon_path_custom_levels_v1",
] as const;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  progress: unknown;
  stores?: Record<string, string>;
}

export interface BackupStats {
  completedLevels: number;
  stars: number;
}

export type ParseBackupResult =
  | { ok: true; backup: BackupFile }
  | { ok: false; error: string };

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function createBackup(userId: string): BackupFile {
  const storage = getStorage();
  const stores: Record<string, string> = {};

  if (storage) {
    for (const key of BACKUP_STORE_KEYS) {
      const value = storage.getItem(key);
      if (value !== null) stores[key] = value;
    }
  }

  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    // Read through getProgress so legacy saves are migrated and normalized first.
    progress: getProgress(userId),
    stores: Object.keys(stores).length > 0 ? stores : undefined,
  };
}

export function backupToJson(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

export function parseBackup(text: string): ParseBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file is not valid JSON." };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "This file does not look like a save file." };
  }

  const candidate = parsed as Partial<BackupFile>;
  if (candidate.app !== BACKUP_APP) {
    return { ok: false, error: "This backup belongs to a different game." };
  }
  if (typeof candidate.version !== "number" || candidate.version > BACKUP_VERSION) {
    return { ok: false, error: "This backup was made by a newer version of the game." };
  }
  if (!candidate.progress || typeof candidate.progress !== "object") {
    return { ok: false, error: "This backup has no progress data." };
  }

  const completed = (candidate.progress as Partial<ProgressData>).completed;
  if (!Array.isArray(completed)) {
    return { ok: false, error: "This backup has no level progress." };
  }

  const stores: Record<string, string> = {};
  if (candidate.stores && typeof candidate.stores === "object") {
    for (const key of BACKUP_STORE_KEYS) {
      const value = (candidate.stores as Record<string, unknown>)[key];
      if (typeof value === "string") stores[key] = value;
    }
  }

  return {
    ok: true,
    backup: {
      app: BACKUP_APP,
      version: candidate.version,
      exportedAt: typeof candidate.exportedAt === "string" ? candidate.exportedAt : new Date().toISOString(),
      progress: candidate.progress,
      stores: Object.keys(stores).length > 0 ? stores : undefined,
    },
  };
}

export function applyBackup(userId: string, backup: BackupFile): BackupStats {
  const progress = importProgress(userId, backup.progress);
  const storage = getStorage();

  if (storage && backup.stores) {
    for (const key of BACKUP_STORE_KEYS) {
      const value = backup.stores[key];
      if (typeof value !== "string") continue;
      try {
        storage.setItem(key, value);
      } catch {
        // A full or blocked storage should not abort the progress import.
      }
    }
  }

  return {
    completedLevels: progress.completed.length,
    stars: getTotalStars(progress),
  };
}
