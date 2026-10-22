import { handleSubmit, handleTop } from "./logic";
import { Arena, Lobby, type RoomEnv } from "./rooms";
import { d1Store } from "./store";

export { Arena, Lobby };

type Env = RoomEnv;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

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

    const store = d1Store(env.DB);
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
