import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { v4 as uuidv4 } from "uuid";
import { useState } from "react";
import { generateLevel } from "@shared/level-generator";
import { getCodeUnlockedThrough } from "@/lib/sessionLevelUnlock";
import { getActiveStreak } from "@/lib/daily";
import {
  getContinueLevel,
  getLevelRecord,
  getProgress,
  getTotalStars,
  saveLevelResult,
  TOTAL_LEVELS,
  type LevelRecord,
  type ProgressData,
} from "@/lib/progress";

// Storage can be blocked entirely (private modes, embedded webviews). Every
// component calls useUserId, so the fallback has to be one shared id per page
// session instead of a fresh uuid for each hook instance.
let fallbackUserId: string | null = null;

export function useUserId() {
  const [userId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      let id = localStorage.getItem("one_line_user_id");
      if (!id) {
        id = uuidv4();
        localStorage.setItem("one_line_user_id", id);
      }
      return id;
    } catch {
      console.warn("localStorage is disabled or restricted, falling back to session ID");
      if (!fallbackUserId) fallbackUserId = uuidv4();
      return fallbackUserId;
    }
  });
  return userId;
}

export interface LevelSummary {
  id: number;
  isCompleted: boolean;
  isLocked: boolean;
  hintsUsed: boolean;
  stars: number;
  bestTimeMs: number | null;
  bestScore: number | null;
}

/** `completed` is the current run: a crash locks everything after level 1 again. */
function isLevelLocked(levelId: number, completed: Set<number>, codeUnlockedThrough: number) {
  if (completed.has(levelId)) return false;
  if (levelId <= codeUnlockedThrough) return false;
  if (levelId === 1) return false;
  if (levelId <= 100) return !completed.has(levelId - 1);
  const firstHundredComplete = Array.from({ length: 100 }, (_, index) => index + 1)
    .every(id => completed.has(id));
  return !firstHundredComplete || !completed.has(levelId - 1);
}

export function useLevels(userId?: string) {
  const codeUnlockedThrough = getCodeUnlockedThrough();
  return useQuery({
    queryKey: [api.levels.list.path, userId, codeUnlockedThrough],
    queryFn: async (): Promise<LevelSummary[]> => {
      if (!userId) return [];
      const progress = getProgress(userId);
      const run = new Set(progress.runCompleted);
      const hints = new Set(progress.hints);
      return Array.from({ length: TOTAL_LEVELS }, (_, index) => {
        const id = index + 1;
        const record = getLevelRecord(progress, id);
        return {
          id,
          // Cleared in this run; stars below stay from every run.
          isCompleted: run.has(id),
          isLocked: isLevelLocked(id, run, codeUnlockedThrough),
          hintsUsed: hints.has(id),
          stars: record?.stars ?? 0,
          bestTimeMs: record?.bestTimeMs ?? null,
          bestScore: record?.bestScore ?? null,
        };
      });
    },
    enabled: !!userId,
  });
}

export function useLevel(id: number, userId?: string, allowLocked = false) {
  const codeUnlockedThrough = getCodeUnlockedThrough();
  return useQuery({
    queryKey: [api.levels.get.path, id, userId, codeUnlockedThrough, allowLocked],
    queryFn: async () => {
      if (!Number.isInteger(id) || id < 1 || id > TOTAL_LEVELS) throw new Error("Invalid level");
      if (!userId) throw new Error("Missing player id");
      const progress = getProgress(userId);
      const completed = new Set(progress.completed);
      if (!allowLocked && isLevelLocked(id, new Set(progress.runCompleted), codeUnlockedThrough)) {
        throw new Error("Level is locked");
      }
      const level = generateLevel(id);
      const record = getLevelRecord(progress, id);
      return {
        id: level.id,
        gridSize: level.gridSize,
        start: level.start,
        nodes: level.nodes,
        isLocked: false,
        isCompleted: completed.has(id),
        stars: record?.stars ?? 0,
        bestTimeMs: record?.bestTimeMs ?? null,
        bestMoves: record?.bestMoves ?? null,
        bestScore: record?.bestScore ?? null,
        bestPath: record?.bestPath ?? null,
      };
    },
    enabled: !!userId && Number.isInteger(id) && id >= 1 && id <= TOTAL_LEVELS,
  });
}

export function useSolution(id: number) {
  return useQuery({
    queryKey: [api.levels.solution.path, id],
    queryFn: async () => ({ path: generateLevel(id).solution }),
    enabled: false,
  });
}

export interface SaveLevelInput {
  userId: string;
  levelId: number;
  completed: boolean;
  hintsUsed: boolean;
  stars: number;
  timeMs: number;
  moves: number;
  mistakes: number;
  score?: number;
  path?: { x: number; y: number }[];
}

export function useUpdateProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: SaveLevelInput) => {
      const applied = saveLevelResult(data.userId, data);
      return {
        success: true,
        record: applied.record,
        isNewBest: applied.isNewBest,
      };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}

export interface ProgressSummary {
  currentLevel: number;
  continueLevel: number;
  unlockedLevels: number[];
  completedLevels: number[];
  completedCount: number;
  /** Levels cleared in the current run (resets on a crash). */
  runCount: number;
  crashes: number;
  totalStars: number;
  dailyStreak: number;
  bestStreak: number;
  records: Record<string, LevelRecord>;
  tutorialSeen: boolean;
}

export function useUserProgress(userId: string) {
  return useQuery({
    queryKey: [api.progress.get.path, userId],
    queryFn: async (): Promise<ProgressSummary> => {
      const progress: ProgressData = getProgress(userId);
      const run = new Set(progress.runCompleted);
      let continueLevel = getContinueLevel(progress);
      if (isLevelLocked(continueLevel, run, getCodeUnlockedThrough())) {
        for (let levelId = 1; levelId <= TOTAL_LEVELS; levelId++) {
          if (!run.has(levelId)) {
            continueLevel = levelId;
            break;
          }
        }
      }
      return {
        currentLevel: continueLevel,
        continueLevel,
        unlockedLevels: progress.runCompleted,
        completedLevels: progress.completed,
        completedCount: progress.completed.length,
        runCount: progress.runCompleted.length,
        crashes: progress.crashes,
        totalStars: getTotalStars(progress),
        dailyStreak: getActiveStreak(progress.daily),
        bestStreak: progress.daily.bestStreak,
        records: progress.records,
        tutorialSeen: progress.tutorialSeen,
      };
    },
    enabled: !!userId,
  });
}
