
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { generateLevel } from "@shared/level-generator";

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // === API: List Levels ===
  app.get(api.levels.list.path, async (req, res) => {
    // We have 200 levels (1-100 and 101-200).
    // Levels 1-100: Level 1 unlocked, others locked unless completed previous.
    // Levels 101-200: Locked until ALL levels 1-100 are completed, then follow same logic.
    const userId = firstString(req.headers["x-user-id"]) ?? "guest";
    
    const progress = await storage.getUserProgress(userId);
    const hintsUsedMap = await storage.getHintsUsed(userId);
    const completedSet = new Set(progress);
    
    // Check if all levels 1-100 are completed
    const allFirstHundredCompleted = Array.from({ length: 100 }, (_, i) => i + 1)
      .every(id => completedSet.has(id));
    
    const levels = [];
    
    // Levels 1-100
    for (let i = 1; i <= 100; i++) {
      const isCompleted = completedSet.has(i);
      const isLocked = i > 1 && !completedSet.has(i - 1);
      
      levels.push({
        id: i,
        isCompleted,
        isLocked,
        hintsUsed: hintsUsedMap.get(i) ?? false
      });
    }
    
    // Levels 101-200
    for (let i = 101; i <= 200; i++) {
      const isCompleted = completedSet.has(i);
      // Locked if: first 100 not all completed OR previous level not completed
      const isLocked = !allFirstHundredCompleted || !completedSet.has(i - 1);
      
      levels.push({
        id: i,
        isCompleted,
        isLocked,
        hintsUsed: hintsUsedMap.get(i) ?? false
      });
    }
    
    res.json(levels);
  });

  // === API: Get Level Data ===
  app.get(api.levels.get.path, async (req, res) => {
    const levelId = parseInt(firstString(req.params.id) ?? "", 10);
    if (isNaN(levelId) || levelId < 1 || levelId > 200) {
      return res.status(404).json({ message: "Level not found" });
    }

    const level = generateLevel(levelId);
    
    // Don't send the solution in the main GET!
    res.json({
      id: level.id,
      gridSize: level.gridSize,
      start: level.start,
      nodes: level.nodes
    });
  });

  // === API: Get Solution (Hint) ===
  app.get(api.levels.solution.path, async (req, res) => {
    const levelId = parseInt(firstString(req.params.id) ?? "", 10);
    const userId = firstString(req.headers["x-user-id"]) ?? "guest";
    
    if (isNaN(levelId) || levelId < 1 || levelId > 200) {
      return res.status(404).json({ message: "Level not found" });
    }

    // Mark hint as used in DB
    // We don't mark 'completed', just update 'hintsUsed'
    await storage.updateUserProgress(userId, levelId, false, true);

    const level = generateLevel(levelId);
    res.json({ path: level.solution });
  });

  // === API: Sync Progress ===
  app.post(api.progress.sync.path, async (req, res) => {
    try {
      const input = api.progress.sync.input.parse(req.body);
      await storage.updateUserProgress(input.userId, input.levelId, input.completed, input.hintsUsed);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ success: false });
    }
  });

  return httpServer;
}
