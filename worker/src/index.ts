import { googleKeys, playerIdForGoogle, verifyGoogleToken } from "./google";
import { handleSubmit, handleTop } from "./logic";
import { Arena, Lobby, type RoomEnv } from "./rooms";
import { d1Store } from "./store";

export { Arena, Lobby };

/** GOOGLE_CLIENT_ID is the web client id from Google Cloud; empty keeps Google sign-in off. */
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
        const body = (await request.json().catch(() => null)) as { idToken?: unknown } | null;
        const sub = await verifyGoogleToken(body?.idToken, clientId, await googleKeys(now.getTime()), now.getTime());
        return sub ? json(200, { playerId: await playerIdForGoogle(sub) }) : json(401, { error: "invalid token" });
      } catch {
        return json(500, { error: "server error" });
      }
    }

    const store = d1Store(env.DB);
    try {
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
