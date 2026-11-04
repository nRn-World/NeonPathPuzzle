import { googleKeys, playerIdForGoogle, verifyAccessToken, verifyGoogleToken } from "./google";
import { handleSubmit, handleTop } from "./logic";
import { Arena, Lobby, type RoomEnv } from "./rooms";
import { d1SaveStore, d1Store, d1TelemetryStore } from "./store";

export { Arena, Lobby };

/** GOOGLE_CLIENT_ID: comma-separated Google client ids (web, Android, iOS); empty keeps sign-in off. */
type Env = RoomEnv & { GOOGLE_CLIENT_ID?: string };

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

/**
 * Best-effort limit on score posts per IP. It lives in one isolate's memory, so
 * it only slows down a flood; a Cloudflare rate-limit rule is the real guard.
 */
const SCORE_LIMIT = 30;
const SCORE_WINDOW_MS = 60_000;
const recentPosts = new Map<string, number[]>();

function tooManyPosts(ip: string, now: number): boolean {
  const recent = (recentPosts.get(ip) ?? []).filter(at => now - at < SCORE_WINDOW_MS);
  recent.push(now);
  recentPosts.set(ip, recent);
  if (recentPosts.size > 5000) recentPosts.clear();
  return recent.length > SCORE_LIMIT;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const now = new Date();

    // Duels: browsers open a WebSocket to the queue, then to the match they are given.
    if (url.pathname === "/ws/queue" || url.pathname.startsWith("/ws/arena/")) {
      if (request.headers.get("upgrade") !== "websocket") return json(426, { error: "websocket required" });
      if (url.pathname === "/ws/queue") return env.LOBBY.get(env.LOBBY.idFromName("lobby")).fetch(request);
      const matchId = url.pathname.slice("/ws/arena/".length);
      if (!/^[0-9a-f-]{36}$/.test(matchId)) return json(400, { error: "bad match id" });
      return env.ARENA.get(env.ARENA.idFromName(matchId)).fetch(request);
    }

    if (request.method === "POST" && url.pathname === "/auth/google") {
      const clientId = env.GOOGLE_CLIENT_ID ?? "";
      if (clientId === "") return json(501, { error: "google sign-in is not set up" });
      if (Number(request.headers.get("content-length") ?? 0) > 8_000) return json(413, { error: "too large" });
      if (tooManyPosts(request.headers.get("cf-connecting-ip") ?? "unknown", now.getTime())) return json(429, { error: "slow down" });
      try {
        const body = (await request.json().catch(() => null)) as { idToken?: unknown; accessToken?: unknown } | null;
        const sub = body?.accessToken !== undefined
          ? await verifyAccessToken(body.accessToken, clientId)
          : await verifyGoogleToken(body?.idToken, clientId, await googleKeys(now.getTime()), now.getTime());
        return sub ? json(200, { playerId: await playerIdForGoogle(sub) }) : json(401, { error: "invalid token" });
      } catch {
        return json(500, { error: "server error" });
      }
    }

    const store = d1Store(env.DB);
    try {
      // === Cloud saves ===
      // A signed-in device mirrors its progress here. Read and write are keyed
      // by the player id the Google token produced, so the same account sees
      // the same save on every device.
      if (request.method === "POST" && url.pathname === "/save") {
        if (Number(request.headers.get("content-length") ?? 0) > 200_000) return json(413, { error: "too large" });
        if (tooManyPosts(request.headers.get("cf-connecting-ip") ?? "unknown", now.getTime())) return json(429, { error: "slow down" });
        const body = (await request.json().catch(() => null)) as { playerId?: unknown; data?: unknown } | null;
        const playerId = typeof body?.playerId === "string" ? body.playerId : "";
        if (!/^[0-9a-f]{32}$/.test(playerId)) return json(400, { error: "bad player id" });
        if (!body?.data || typeof body.data !== "object") return json(400, { error: "bad data" });
        const text = JSON.stringify(body.data);
        if (text.length > 160_000) return json(413, { error: "too large" });
        await d1SaveStore(env.DB).put(playerId, text, now.getTime());
        return json(200, { success: true, updatedAt: now.getTime() });
      }
      if (request.method === "GET" && url.pathname === "/save") {
        const playerId = url.searchParams.get("playerId") ?? "";
        if (!/^[0-9a-f]{32}$/.test(playerId)) return json(400, { error: "bad player id" });
        const save = await d1SaveStore(env.DB).get(playerId);
        if (!save) return json(404, { error: "no save" });
        return json(200, { data: JSON.parse(save.data), updatedAt: save.updatedAt });
      }

      // Opt-in aggregate diagnostics: only counted event names and level ids.
      if (request.method === "POST" && url.pathname === "/telemetry") {
        if (Number(request.headers.get("content-length") ?? 0) > 20_000) return json(413, { error: "too large" });
        if (tooManyPosts(request.headers.get("cf-connecting-ip") ?? "unknown", now.getTime())) return json(429, { error: "slow down" });
        const body = (await request.json().catch(() => null)) as {
          day?: unknown;
          counters?: { name?: unknown; levelId?: unknown; count?: unknown }[];
        } | null;
        const day = typeof body?.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.day)
          ? body.day : now.toISOString().slice(0, 10);
        const allowed = new Set(["level_start", "first_move", "hint", "backtrack", "dead_end", "crash", "win", "quit", "error"]);
        const telemetry = d1TelemetryStore(env.DB);
        const counters = Array.isArray(body?.counters) ? body!.counters!.slice(0, 40) : [];
        // Best effort: a database that has not run the latest schema.sql yet
        // must never break the game or produce a server error for opt-in stats.
        try {
          for (const entry of counters) {
            if (!entry || typeof entry.name !== "string" || !allowed.has(entry.name)) continue;
            const levelId = Number.isInteger(entry.levelId) ? Math.max(0, Math.min(400, entry.levelId as number)) : 0;
            const count = Number.isInteger(entry.count) ? Math.max(1, Math.min(500, entry.count as number)) : 1;
            await telemetry.record(day, entry.name, levelId, count);
          }
        } catch (error) {
          console.warn("telemetry unavailable", error);
        }
        return json(200, { ok: true });
      }

      if (request.method === "POST" && url.pathname === "/score") {
        // A line is at most ~800 points (about 12 KB): refuse anything much larger before parsing it.
        if (Number(request.headers.get("content-length") ?? 0) > 30_000) return json(413, { error: "too large" });
        if (tooManyPosts(request.headers.get("cf-connecting-ip") ?? "unknown", now.getTime())) return json(429, { error: "slow down" });
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
