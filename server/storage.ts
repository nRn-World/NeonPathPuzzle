import { userProgress } from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

interface ProgressRow {
  id: number;
  userId: string;
  levelId: number;
  completed: boolean | null;
  hintsUsed: boolean | null;
  updatedAt: Date | null;
}

/**
 * Local development uses SQLite behind the Postgres-flavoured schema. SQLite
 * cannot bind JS booleans or Date objects, so bind those as numbers there while
 * production keeps sending real booleans and timestamps to Postgres.
 */
const isSqlite = process.env.NODE_ENV === "development" && !process.env.DATABASE_URL;
const booleanValue = (value: boolean) => (isSqlite ? sql`${value ? 1 : 0}` : value);
const timestampValue = () => (isSqlite ? sql`${Date.now()}` : new Date());

export interface IStorage {
  getUserProgress(userId: string): Promise<number[]>;
  getHintsUsed(userId: string): Promise<Map<number, boolean>>;
  updateUserProgress(userId: string, levelId: number, completed: boolean, hintsUsed: boolean): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUserProgress(userId: string): Promise<number[]> {
    try {
      // Bind only the string user id; filtering `completed` in SQL would bind a
      // JS boolean, which the SQLite driver rejects.
      const progress = await db.select().from(userProgress)
        .where(eq(userProgress.userId, userId)) as ProgressRow[];
      return progress.filter(row => Boolean(row.completed)).map(row => row.levelId);
    } catch (error) {
      console.error("Error getting user progress:", error);
      return [];
    }
  }

  async getHintsUsed(userId: string): Promise<Map<number, boolean>> {
    try {
      const progress = await db.select().from(userProgress)
        .where(eq(userProgress.userId, userId)) as ProgressRow[];
      return new Map(progress.filter(row => row.hintsUsed).map(row => [row.levelId, true]));
    } catch (error) {
      console.error("Error getting hints used:", error);
      return new Map();
    }
  }

  async updateUserProgress(userId: string, levelId: number, completed: boolean, hintsUsed: boolean): Promise<void> {
    try {
      const existing = await db.select().from(userProgress)
        .where(and(eq(userProgress.userId, userId), eq(userProgress.levelId, levelId))) as ProgressRow[];
      const values = {
        completed: booleanValue(completed || Boolean(existing[0]?.completed)),
        hintsUsed: booleanValue(hintsUsed || Boolean(existing[0]?.hintsUsed)),
        updatedAt: timestampValue(),
      };
      if (existing.length > 0) {
        await db.update(userProgress).set(values).where(eq(userProgress.id, existing[0].id));
      } else {
        await db.insert(userProgress).values({ userId, levelId, ...values });
      }
    } catch (error) {
      console.error("Error updating user progress:", error);
    }
  }
}

export const storage = new DatabaseStorage();
