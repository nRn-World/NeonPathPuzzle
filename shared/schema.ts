
import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// === TABLE DEFINITIONS ===
export const userProgress = pgTable("user_progress", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(), // Simple session ID or UUID
  levelId: integer("level_id").notNull(),
  completed: boolean("completed").default(false),
  hintsUsed: boolean("hints_used").default(false),
  updatedAt: timestamp("updated_at"),
});

// === SCHEMAS ===
export const insertProgressSchema = createInsertSchema(userProgress).omit({ 
  id: true, 
  updatedAt: true 
});

// === GAME TYPES ===
export type Point = { x: number; y: number };

export interface LevelData {
  id: number;
  gridSize: number; // e.g., 5 for 5x5
  start: Point;
  // For a grid-based Hamiltonian path game:
  // We define which cells are "valid" (nodes) and which are empty/walls.
  // Or we just send the list of valid nodes.
  nodes: Point[]; 
  // We might not need edges if it's a grid where you can only move NESW.
  // But strictly speaking, we just need to know which cells are part of the shape.
}

export interface LevelSolution {
  path: Point[]; // Ordered list of points to visit
}

// === API CONTRACT TYPES ===
export type LevelResponse = LevelData & {
  isLocked: boolean;
  isCompleted: boolean;
};

export type ProgressUpdate = {
  levelId: number;
  completed: boolean;
  hintsUsed: boolean;
};

export type ProgressResponse = {
  currentLevel: number;
  unlockedLevels: number[]; // IDs of unlocked levels
  completedLevels: number[];
};
