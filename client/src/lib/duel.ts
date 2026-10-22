import type { Point } from "@shared/schema";
import { duelSocketBase, getPlayer } from "./leaderboard";

/**
 * Client side of an online duel. Two WebSockets over a match's life: first the
 * queue (until an opponent or the bot is found), then the match's own room.
 * The room tolerates a dropped connection for 15 s, so the arena socket
 * reconnects by itself a few times.
 */
export interface DuelScore {
  you: number;
  opponent: number;
}

export type DuelEvent =
  | { kind: "queued"; botAfterMs: number }
  | { kind: "matched"; vsBot: boolean }
  | { kind: "match"; you: { name: string; rating: number }; opponent: { name: string; rating: number; bot: boolean }; roundsToWin: number }
  | { kind: "round"; round: number; levelId: number; startsInMs: number; limitMs: number; score: DuelScore; receivedAt: number }
  /** `opponentPath` is only sent to the round's loser, after the race, as help. */
  | { kind: "roundResult"; round: number; winner: "you" | "opponent" | "none"; timeMs: number; score: DuelScore; opponentPath?: Point[] }
  | { kind: "lateFinish"; round: number }
  | { kind: "opponentAway"; graceMs: number }
  | { kind: "opponentBack" }
  | { kind: "matchResult"; winner: "you" | "opponent" | "draw" | "cancelled"; forfeit: boolean; rating: number; ratingDelta: number; score: DuelScore }
  | { kind: "rejected"; reason: string }
  | { kind: "error"; reason: string };

const MAX_RECONNECTS = 5;

export class DuelConnection {
  private queue: WebSocket | null = null;
  private arena: WebSocket | null = null;
  private matchId: string | null = null;
  private finished = false;
  private closedByUs = false;
  private reconnects = 0;

  constructor(private readonly onEvent: (event: DuelEvent) => void) {}

  findMatch() {
    const player = getPlayer();
    const socket = new WebSocket(`${duelSocketBase()}/ws/queue`);
    this.queue = socket;
    socket.onopen = () => socket.send(JSON.stringify({ type: "queue", playerId: player.id, name: player.name }));
    socket.onmessage = event => {
      const message = JSON.parse(String(event.data)) as Record<string, unknown>;
      if (message.type === "queued") this.onEvent({ kind: "queued", botAfterMs: Number(message.botAfterMs) || 0 });
      else if (message.type === "matched") {
        this.matchId = String(message.matchId);
        this.onEvent({ kind: "matched", vsBot: Boolean(message.vsBot) });
        this.openArena();
      } else if (message.type === "error") this.onEvent({ kind: "error", reason: String(message.reason) });
    };
    socket.onerror = () => this.onEvent({ kind: "error", reason: "connection" });
  }

  private openArena() {
    if (!this.matchId) return;
    const player = getPlayer();
    const socket = new WebSocket(`${duelSocketBase()}/ws/arena/${this.matchId}`);
    this.arena = socket;
    socket.onopen = () => socket.send(JSON.stringify({ type: "hello", playerId: player.id }));
    socket.onmessage = event => {
      this.reconnects = 0;
      const message = JSON.parse(String(event.data)) as Record<string, unknown>;
      const translated = this.translate(message);
      if (translated) this.onEvent(translated);
    };
    socket.onclose = () => {
      if (this.closedByUs || this.finished) return;
      if (this.reconnects++ < MAX_RECONNECTS) window.setTimeout(() => !this.closedByUs && this.openArena(), 1000);
      else this.onEvent({ kind: "error", reason: "connection" });
    };
  }

  private translate(message: Record<string, unknown>): DuelEvent | null {
    switch (message.type) {
      case "match":
        return { kind: "match", you: message.you as never, opponent: message.opponent as never, roundsToWin: Number(message.roundsToWin) };
      case "round":
        return {
          kind: "round",
          round: Number(message.round),
          levelId: Number(message.levelId),
          startsInMs: Number(message.startsInMs),
          limitMs: Number(message.limitMs),
          score: message.score as DuelScore,
          receivedAt: performance.now(),
        };
      case "roundResult":
        return {
          kind: "roundResult",
          round: Number(message.round),
          winner: message.winner as never,
          timeMs: Number(message.timeMs),
          score: message.score as DuelScore,
          opponentPath: Array.isArray(message.opponentPath) ? (message.opponentPath as Point[]) : undefined,
        };
      case "opponentAway":
        return { kind: "opponentAway", graceMs: Number(message.graceMs) || 15_000 };
      case "opponentBack":
        return { kind: "opponentBack" };
      case "lateFinish":
        return { kind: "lateFinish", round: Number(message.round) };
      case "matchResult":
        this.finished = true;
        return {
          kind: "matchResult",
          winner: message.winner as never,
          forfeit: Boolean(message.forfeit),
          rating: Number(message.rating),
          ratingDelta: Number(message.ratingDelta),
          score: message.score as DuelScore,
        };
      case "rejected":
        return { kind: "rejected", reason: String(message.reason) };
      case "error":
        return { kind: "error", reason: String(message.reason) };
      default:
        return null;
    }
  }

  submit(round: number, path: Point[]) {
    if (this.arena?.readyState === WebSocket.OPEN) this.arena.send(JSON.stringify({ type: "done", round, path }));
  }

  /** Leaving mid-match counts as a forfeit. */
  leave() {
    if (this.arena?.readyState === WebSocket.OPEN) this.arena.send(JSON.stringify({ type: "leave" }));
    this.close();
  }

  close() {
    this.closedByUs = true;
    if (this.queue && this.queue.readyState <= WebSocket.OPEN) {
      try {
        this.queue.send(JSON.stringify({ type: "cancel" }));
      } catch {
        // Already closing.
      }
      this.queue.close();
    }
    this.arena?.close();
  }
}
