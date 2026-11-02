import type { Order, Store } from "./logic";

/** The slice of the D1 API used here, so the worker needs no extra type package. */
export interface D1 {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
  };
}

/** The cloud save mirror: one JSON blob per player id. */
export interface SaveStore {
  put(playerId: string, data: string, now: number): Promise<void>;
  get(playerId: string): Promise<{ data: string; updatedAt: number } | null>;
}

export function d1SaveStore(db: D1): SaveStore {
  return {
    async put(playerId, data, now) {
      await db
        .prepare(
          `INSERT INTO saves (player_id, data, updated_at) VALUES (?1, ?2, ?3)
           ON CONFLICT(player_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
        )
        .bind(playerId, data, now)
        .run();
    },
    async get(playerId) {
      return db
        .prepare("SELECT data, updated_at AS updatedAt FROM saves WHERE player_id = ?1")
        .bind(playerId)
        .first<{ data: string; updatedAt: number }>();
    },
  };
}

export function d1Store(db: D1): Store {
  const better = (order: Order) => (order === "low" ? "<" : ">");
  const direction = (order: Order) => (order === "low" ? "ASC" : "DESC");
  return {
    async upsert(board, playerId, name, value, order, now) {
      await db
        .prepare(
          `INSERT INTO scores (board, player_id, name, value, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
           ON CONFLICT(board, player_id) DO UPDATE SET
             name = excluded.name,
             value = CASE WHEN excluded.value ${better(order)} scores.value THEN excluded.value ELSE scores.value END,
             updated_at = excluded.updated_at`,
        )
        .bind(board, playerId, name, value, now)
        .run();
    },
    async top(board, order, limit) {
      const { results } = await db
        .prepare(`SELECT player_id AS playerId, name, value FROM scores WHERE board = ?1 ORDER BY value ${direction(order)}, updated_at ASC LIMIT ?2`)
        .bind(board, limit)
        .all<{ playerId: string; name: string; value: number }>();
      return results;
    },
    async getRating(playerId) {
      return db
        .prepare("SELECT rating, wins, losses FROM ratings WHERE player_id = ?1")
        .bind(playerId)
        .first<{ rating: number; wins: number; losses: number }>();
    },
    async saveMatch(player, now) {
      await db
        .prepare(
          `INSERT INTO ratings (player_id, name, rating, wins, losses, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
           ON CONFLICT(player_id) DO UPDATE SET
             name = excluded.name, rating = excluded.rating,
             wins = ratings.wins + ?4, losses = ratings.losses + ?5, updated_at = excluded.updated_at`,
        )
        .bind(player.id, player.name, player.rating, player.outcome === "win" ? 1 : 0, player.outcome === "loss" ? 1 : 0, now)
        .run();
    },
    async topRatings(limit) {
      const { results } = await db
        .prepare("SELECT player_id AS playerId, name, rating AS value FROM ratings ORDER BY rating DESC, updated_at ASC LIMIT ?1")
        .bind(limit)
        .all<{ playerId: string; name: string; value: number }>();
      return results;
    },
    async rankRating(playerId) {
      const mine = await db
        .prepare("SELECT rating, wins, losses FROM ratings WHERE player_id = ?1")
        .bind(playerId)
        .first<{ rating: number; wins: number; losses: number }>();
      if (!mine) return null;
      const ahead = await db.prepare("SELECT COUNT(*) AS n FROM ratings WHERE rating > ?1").bind(mine.rating).first<{ n: number }>();
      return { rank: (ahead?.n ?? 0) + 1, value: mine.rating, wins: mine.wins, losses: mine.losses };
    },
    async rank(board, playerId, order) {
      const mine = await db
        .prepare("SELECT value FROM scores WHERE board = ?1 AND player_id = ?2")
        .bind(board, playerId)
        .first<{ value: number }>();
      if (!mine) return null;
      const ahead = await db
        .prepare(`SELECT COUNT(*) AS n FROM scores WHERE board = ?1 AND value ${better(order)} ?2`)
        .bind(board, mine.value)
        .first<{ n: number }>();
      return { rank: (ahead?.n ?? 0) + 1, value: mine.value };
    },
  };
}

