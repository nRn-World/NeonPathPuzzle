import { handleSubmit, handleTop, type Order, type Store } from "./logic";

/** The slice of the D1 API used here, so the worker needs no extra type package. */
interface D1 {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T>(): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
  };
}

interface Env {
  DB: D1;
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function d1Store(db: D1): Store {
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

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const store = d1Store(env.DB);
    const now = new Date();

    try {
      if (request.method === "POST" && url.pathname === "/score") {
        const reply = await handleSubmit(await request.json().catch(() => null), store, now);
        return json(reply.status, reply.body);
      }
      if (request.method === "GET" && url.pathname === "/top") {
        const reply = await handleTop(
          url.searchParams.get("board"),
          url.searchParams.get("playerId"),
          url.searchParams.get("dateKey"),
          store,
          now,
        );
        return json(reply.status, reply.body);
      }
    } catch {
      return json(500, { error: "server error" });
    }
    return json(404, { error: "not found" });
  },
};
