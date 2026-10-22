import { isGeneratedName } from "../../shared/names";
import { isPlayerId } from "./logic";
import { Match, START_RATING, type ClientMessage, type Fighter, type MatchResult } from "./match";
import { d1Store, type D1 } from "./store";

/**
 * The two Durable Objects behind online duels. `Lobby` (one global instance)
 * holds the matchmaking queue; `Arena` (one per match) runs a `Match`. Browsers
 * connect with a plain WebSocket and need no account.
 */
declare const WebSocketPair: new () => { 0: unknown; 1: unknown };

interface Socket {
  accept(): void;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "message" | "close" | "error", listener: (event: { data?: unknown }) => void): void;
}

interface Namespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(input: string | Request, init?: { method?: string; body?: string; headers?: Record<string, string> }): Promise<Response> };
}

export interface RoomEnv {
  DB: D1;
  ARENA: Namespace;
  LOBBY: Namespace;
}

/** After this long in the queue a player is offered a bot, so the game works with few players online. */
export const BOT_AFTER_MS = 21_000;
/** How far apart two waiting ratings may be at first, and how fast that widens. */
const BASE_WINDOW = 150;
const WINDOW_PER_SECOND = 20;

const upgrade = (): { client: unknown; server: Socket } => {
  const pair = new WebSocketPair();
  return { client: pair[0], server: pair[1] as Socket };
};

const asJson = (data: unknown): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(String(data)) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

interface Waiting {
  socket: Socket;
  fighter: Fighter;
  since: number;
  botTimer: ReturnType<typeof setTimeout>;
}

export class Lobby {
  private waiting: Waiting[] = [];

  constructor(_state: unknown, private readonly env: RoomEnv) {}

  async fetch(): Promise<Response> {
    const { client, server } = upgrade();
    server.accept();
    server.addEventListener("message", event => void this.onMessage(server, event.data));
    server.addEventListener("close", () => this.drop(server));
    server.addEventListener("error", () => this.drop(server));
    return new Response(null, { status: 101, webSocket: client } as ResponseInit);
  }

  private drop(socket: Socket) {
    const entry = this.waiting.find(item => item.socket === socket);
    if (!entry) return;
    clearTimeout(entry.botTimer);
    this.waiting = this.waiting.filter(item => item !== entry);
  }

  private async onMessage(socket: Socket, data: unknown) {
    const message = asJson(data);
    if (!message) return;
    if (message.type === "cancel") {
      this.drop(socket);
      return;
    }
    if (message.type !== "queue" || this.waiting.some(item => item.socket === socket)) return;
    if (!isPlayerId(message.playerId) || !isGeneratedName(message.name)) {
      socket.send(JSON.stringify({ type: "error", reason: "invalid player" }));
      socket.close(1008, "invalid player");
      return;
    }

    const saved = await d1Store(this.env.DB).getRating(message.playerId);
    // The same player in two tabs must not be matched against themselves.
    this.waiting.filter(item => item.fighter.id === message.playerId).forEach(item => {
      item.socket.send(JSON.stringify({ type: "error", reason: "queued elsewhere" }));
      item.socket.close(1000, "queued elsewhere");
      this.drop(item.socket);
    });
    const fighter: Fighter = { id: message.playerId, name: message.name, rating: saved?.rating ?? START_RATING };
    const entry: Waiting = {
      socket,
      fighter,
      since: Date.now(),
      botTimer: setTimeout(() => void this.startBot(entry), BOT_AFTER_MS),
    };
    this.waiting.push(entry);
    socket.send(JSON.stringify({ type: "queued", rating: fighter.rating, botAfterMs: BOT_AFTER_MS }));
    await this.pairUp();
  }

  /** Pairs the two closest ratings that fall inside each other's (widening) window. */
  private async pairUp() {
    const now = Date.now();
    for (const first of this.waiting) {
      for (const second of this.waiting) {
        if (first === second) continue;
        const window = (item: Waiting) => BASE_WINDOW + ((now - item.since) / 1000) * WINDOW_PER_SECOND;
        const gap = Math.abs(first.fighter.rating - second.fighter.rating);
        if (gap <= window(first) && gap <= window(second)) {
          await this.startMatch([first, second], false);
          return;
        }
      }
    }
  }

  private async startBot(entry: Waiting) {
    if (!this.waiting.includes(entry)) return;
    await this.startMatch([entry], true);
  }

  private async startMatch(entries: Waiting[], vsBot: boolean) {
    entries.forEach(entry => {
      clearTimeout(entry.botTimer);
      this.waiting = this.waiting.filter(item => item !== entry);
    });
    const matchId = crypto.randomUUID();
    await this.env.ARENA.get(this.env.ARENA.idFromName(matchId)).fetch("https://arena/init", {
      method: "POST",
      body: JSON.stringify({ players: entries.map(entry => entry.fighter), vsBot }),
    });
    entries.forEach(entry => {
      entry.socket.send(JSON.stringify({ type: "matched", matchId, vsBot }));
      entry.socket.close(1000, "matched");
    });
  }
}

export class Arena {
  private match: Match | null = null;
  private readonly sockets = new Set<Socket>();

  constructor(_state: unknown, private readonly env: RoomEnv) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/init" && request.method === "POST") {
      const body = (await request.json()) as { players: Fighter[]; vsBot: boolean };
      this.match = new Match(
        body.players,
        body.vsBot,
        { now: () => Date.now(), after: (ms, fn) => { const id = setTimeout(fn, ms); return () => clearTimeout(id); } },
        Math.random,
        result => void this.record(result),
      );
      return new Response("ok");
    }

    const match = this.match;
    const { client, server } = upgrade();
    server.accept();
    this.sockets.add(server);
    let playerId: string | null = null;
    const send = (message: unknown) => server.send(JSON.stringify(message));

    server.addEventListener("message", event => {
      const message = asJson(event.data) as ClientMessage | null;
      if (!message || !match) return;
      if (message.type === "hello" && !playerId && isPlayerId(message.playerId)) {
        playerId = message.playerId;
        match.attach(playerId, send);
        return;
      }
      if (playerId) match.receive(playerId, message);
    });
    const gone = () => {
      this.sockets.delete(server);
      if (match && playerId) match.detach(playerId);
    };
    server.addEventListener("close", gone);
    server.addEventListener("error", gone);
    if (!match) {
      send({ type: "error", reason: "match not found" });
      server.close(1008, "match not found");
    }
    return new Response(null, { status: 101, webSocket: client } as ResponseInit);
  }

  private async record(result: MatchResult) {
    const store = d1Store(this.env.DB);
    const now = Date.now();
    for (const player of result.players) {
      const outcome = result.winnerId === null ? "draw" : result.winnerId === player.id ? "win" : "loss";
      await store.saveMatch({ id: player.id, name: player.name, rating: player.rating, outcome }, now).catch(() => undefined);
    }
    // Leave a moment for the final messages to flush, then free the sockets.
    setTimeout(() => this.sockets.forEach(socket => socket.close(1000, "finished")), 3000);
  }
}
