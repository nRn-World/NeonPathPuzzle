
import * as schema from "@shared/schema";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { Pool } from "pg";

let db: any;

if (process.env.NODE_ENV === "development" && !process.env.DATABASE_URL) {
  // For local development, use SQLite
  const sqlite = new Database("dev.db");
  db = drizzleSqlite(sqlite, { schema });
  
  // Create tables if they don't exist
  const tables = `
    CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      level_id INTEGER NOT NULL,
      completed BOOLEAN DEFAULT FALSE,
      hints_used BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  sqlite.exec(tables);
} else {
  // For production, use PostgreSQL
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzlePg(pool, { schema });
}

export { db };
