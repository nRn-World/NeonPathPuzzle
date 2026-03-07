import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { v4 as uuidv4 } from "uuid";
import { useEffect, useState } from "react";
import { generateLevel } from "@shared/level-generator";

// Helper to get or create a persistent User ID
export function useUserId() {
  const [userId, setUserId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      let id = localStorage.getItem("one_line_user_id");
      if (!id) {
        id = uuidv4();
        localStorage.setItem("one_line_user_id", id);
      }
      return id;
    } catch (e) {
      console.warn("localStorage is disabled or restricted, falling back to session ID");
      return uuidv4();
    }
  });

  return userId;
}

// === LOCAL STORAGE HELPERS ===
const STORAGE_KEY = "neon_path_progress";

// In-memory fallback for progress if localStorage is blocked
let fallbackProgress: Record<string, any> = {};

function getLocalProgress(userId: string) {
  try {
    const data = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    return data ? JSON.parse(data) : { completed: [], hints: [] };
  } catch (e) {
    return fallbackProgress[userId] || { completed: [], hints: [] };
  }
}

function saveLocalProgress(userId: string, levelId: number, completed: boolean, hintUsed: boolean) {
  const progress = getLocalProgress(userId);
  if (completed && !progress.completed.includes(levelId)) {
    progress.completed.push(levelId);
  }
  if (hintUsed && !progress.hints.includes(levelId)) {
    progress.hints.push(levelId);
  }
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(progress));
  } catch (e) {
    fallbackProgress[userId] = progress;
  }
  return progress;
}

// === API HOOKS (Now Local) ===

// List all levels
export function useLevels(userId?: string) {
  return useQuery({
    queryKey: [api.levels.list.path, userId],
    queryFn: async () => {
      if (!userId) return [];
      const progress = getLocalProgress(userId);
      const completedSet = new Set(progress.completed as number[]);

      const allFirstHundredCompleted = Array.from({ length: 100 }, (_, i) => i + 1)
        .every(id => completedSet.has(id));

      const levels = [];
      for (let i = 1; i <= 200; i++) {
        const isCompleted = completedSet.has(i);
        let isLocked = false;
        if (i <= 100) {
          isLocked = i > 1 && !completedSet.has(i - 1);
        } else {
          isLocked = !allFirstHundredCompleted || !completedSet.has(i - 1);
        }

        levels.push({ id: i, isCompleted, isLocked });
      }
      return levels;
    },
    enabled: !!userId,
  });
}

// Get single level data
export function useLevel(id: number) {
  return useQuery({
    queryKey: [api.levels.get.path, id],
    queryFn: async () => {
      const level = generateLevel(id);
      return {
        id: level.id,
        gridSize: level.gridSize,
        start: level.start,
        nodes: level.nodes,
        isLocked: false,
        isCompleted: false
      };
    },
    enabled: !!id,
  });
}

// Get solution for hints
export function useSolution(id: number) {
  return useQuery({
    queryKey: [api.levels.solution.path, id],
    queryFn: async () => {
      const level = generateLevel(id);
      return { path: level.solution };
    },
    enabled: false,
  });
}

// Sync progress
export function useUpdateProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { userId: string; levelId: number; completed: boolean; hintsUsed: boolean }) => {
      saveLocalProgress(data.userId, data.levelId, data.completed, data.hintsUsed);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.levels.list.path] });
    },
  });
}

// Get user progress (Mocked for compatibility)
export function useUserProgress(userId: string) {
  return useQuery({
    queryKey: [api.progress.get.path, userId],
    queryFn: async () => {
      const progress = getLocalProgress(userId);
      return {
        currentLevel: Math.max(1, (progress.completed.length || 0) + 1),
        unlockedLevels: progress.completed, // Simplified
        completedLevels: progress.completed
      };
    },
    enabled: !!userId,
  });
}

