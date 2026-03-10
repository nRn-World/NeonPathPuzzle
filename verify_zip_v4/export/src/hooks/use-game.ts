import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { v4 as uuidv4 } from "uuid";
import { useEffect, useState } from "react";

// Helper to get or create a persistent User ID
export function useUserId() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let id = localStorage.getItem("one_line_user_id");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("one_line_user_id", id);
    }
    setUserId(id);
  }, []);

  return userId;
}

// === API HOOKS ===

// List all levels
export function useLevels() {
  return useQuery({
    queryKey: [api.levels.list.path],
    queryFn: async () => {
      const res = await fetch(api.levels.list.path);
      if (!res.ok) throw new Error("Failed to fetch levels");
      return api.levels.list.responses[200].parse(await res.json());
    },
  });
}

// Get single level data
export function useLevel(id: number) {
  return useQuery({
    queryKey: [api.levels.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.levels.get.path, { id });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch level");
      return api.levels.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

// Get solution for hints
export function useSolution(id: number) {
  return useQuery({
    queryKey: [api.levels.solution.path, id],
    queryFn: async () => {
      const url = buildUrl(api.levels.solution.path, { id });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch solution");
      return api.levels.solution.responses[200].parse(await res.json());
    },
    enabled: false, // Only fetch when requested manually
  });
}

// Sync progress
export function useUpdateProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { userId: string; levelId: number; completed: boolean; hintsUsed: boolean }) => {
      const res = await fetch(api.progress.sync.path, {
        method: api.progress.sync.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to sync progress");
      return api.progress.sync.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.levels.list.path] });
    },
  });
}

// Get user progress
export function useUserProgress(userId: string) {
  return useQuery({
    queryKey: [api.progress.get.path, userId],
    queryFn: async () => {
      const url = buildUrl(api.progress.get.path, { userId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch progress");
      return api.progress.get.responses[200].parse(await res.json());
    },
    enabled: !!userId,
  });
}
