import { RIFT_FIRST_LEVEL, RIFT_LAST_LEVEL } from "./rift";

const KEY = "neon_path_rift_v1";

export interface RiftRecord {
  stars: number;
  bestTimeMs: number | null;
}

export type RiftProgress = Record<string, RiftRecord>;

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Reads and sanitises the saved Rift records; anything malformed is dropped. */
export function readRiftProgress(): RiftProgress {
  const result: RiftProgress = {};
  try {
    const parsed = JSON.parse(storage()?.getItem(KEY) ?? "{}") as Record<string, Partial<RiftRecord>>;
    Object.entries(parsed ?? {}).forEach(([key, value]) => {
      const levelId = Number(key);
      if (!Number.isInteger(levelId) || levelId < RIFT_FIRST_LEVEL || levelId > RIFT_LAST_LEVEL) return;
      const stars = Math.trunc(Number(value?.stars));
      if (!Number.isFinite(stars) || stars < 1) return;
      const time = Number(value?.bestTimeMs);
      result[key] = {
        stars: Math.min(3, stars),
        bestTimeMs: Number.isFinite(time) && time > 0 ? Math.trunc(time) : null,
      };
    });
  } catch {
    // Unreadable save: start the sector fresh rather than crash the menu.
  }
  return result;
}

/** Keeps the best stars and the fastest time; a worse run never overwrites a better one. */
export function mergeRiftResult(current: RiftProgress, levelId: number, stars: number, timeMs: number): RiftProgress {
  const previous = current[String(levelId)];
  const bestTime = previous?.bestTimeMs == null ? timeMs : Math.min(previous.bestTimeMs, timeMs);
  return {
    ...current,
    [String(levelId)]: { stars: Math.max(previous?.stars ?? 0, Math.min(3, Math.max(1, stars))), bestTimeMs: bestTime },
  };
}

export function saveRiftResult(levelId: number, stars: number, timeMs: number): RiftProgress {
  const next = mergeRiftResult(readRiftProgress(), levelId, stars, timeMs);
  try {
    storage()?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: the result just isn't remembered.
  }
  return next;
}

export const countRiftCleared = (progress: RiftProgress) => Object.keys(progress).length;
