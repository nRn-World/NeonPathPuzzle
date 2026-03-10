
import { userProgress } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  getUserProgress(userId: string): Promise<number[]>;
  getHintsUsed(userId: string): Promise<Map<number, boolean>>;
  updateUserProgress(userId: string, levelId: number, completed: boolean, hintsUsed: boolean): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUserProgress(userId: string): Promise<number[]> {
    try {
      const progress = await db
        .select()
        .from(userProgress)
        .where(and(eq(userProgress.userId, userId), eq(userProgress.completed, true)));
      
      return progress.map((p) => p.levelId);
    } catch (error) {
      console.error("Error getting user progress:", error);
      return [];
    }
  }

  async getHintsUsed(userId: string): Promise<Map<number, boolean>> {
    try {
      const progress = await db
        .select()
        .from(userProgress)
        .where(eq(userProgress.userId, userId));
      
      const hintsMap = new Map<number, boolean>();
      for (const p of progress) {
        if (p.hintsUsed) {
          hintsMap.set(p.levelId, true);
        }
      }
      return hintsMap;
    } catch (error) {
      console.error("Error getting hints used:", error);
      return new Map();
    }
  }

  async updateUserProgress(userId: string, levelId: number, completed: boolean, hintsUsed: boolean): Promise<void> {
    try {
      const existing = await db
        .select()
        .from(userProgress)
        .where(and(eq(userProgress.userId, userId), eq(userProgress.levelId, levelId)));

      if (existing.length > 0) {
        await db
          .update(userProgress)
          .set({ 
            completed: completed || Boolean(existing[0].completed),
            hintsUsed: hintsUsed || Boolean(existing[0].hintsUsed),
            updatedAt: new Date() 
          })
          .where(eq(userProgress.id, existing[0].id));
      } else {
        await db.insert(userProgress).values({
          userId,
          levelId,
          completed,
          hintsUsed,
          updatedAt: new Date()
        });
      }
    } catch (error) {
      console.error("Error updating user progress:", error);
    }
  }
}

export const storage = new DatabaseStorage();
