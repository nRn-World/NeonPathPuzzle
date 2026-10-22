import { generateLevel } from "../../shared/level-generator";
import { verifyPlayedPath } from "../../shared/verify";

/**
 * One best-of-three duel: the same level for both players, the first valid
 * solution wins the round, first to two rounds wins. This class is pure (no
 * sockets, no timers of its own) so it is tested with a fake clock; the
 * Durable Object in index.ts only feeds it messages and time.
 */
export interface Fighter {
  id: string;
  name: string;
  rating: number;
}

export type ClientMessage =
  | { type: "hello"; playerId: string }
  | { type: "done"; round: number; path: unknown }
  /** Live view for the opponent: only the last steps and a count, never the whole line. */
  | { type: "progress"; round: number; tail: unknown; count: unknown }
  | { type: "leave" };

export type ServerMessage = { type: string; [key: string]: unknown };

export interface Clock {
  now(): number;
  /** Runs `fn` after `ms`; the returned function cancels it. */
  after(ms: number, fn: () => void): () => void;
}

export interface MatchResult {
  winnerId: string | null;
  vsBot: boolean;
  forfeit: boolean;
  /** Rating after the match, per human player. */
  players: { id: string; name: string; rating: number; delta: number }[];
}

export const COUNTDOWN_MS = 3000;
export const ROUND_LIMIT_MS = 120_000;
export const BETWEEN_ROUNDS_MS = 4500;
export const JOIN_WAIT_MS = 25_000;
export const RECONNECT_MS = 15_000;
export const ROUNDS_TO_WIN = 2;
export const MAX_ROUNDS = 5;
export const START_RATING = 1000;
/** How many of the latest points an opponent gets to see. */
export const TAIL_LENGTH = 10;
const PROGRESS_MIN_GAP_MS = 80;
const BOT_TICK_MS = 500;
const K = 32;
/** Beating a bot is worth a little, up to this rating; losing to one costs nothing. */
const BOT_WIN_POINTS = 6;
const BOT_RATING_CEILING = 1200;
const MIN_RATING = 100;

/** Levels for a match: easier for lower ratings, spread over the first ~100 levels. */
export function pickLevels(averageRating: number, rng: () => number, count = MAX_ROUNDS): number[] {
  const high = Math.max(40, Math.min(140, Math.round(60 + (averageRating - START_RATING) / 8)));
  const low = 12;
  const picked: number[] = [];
  while (picked.length < count) {
    const id = low + Math.floor(rng() * (high - low + 1));
    if (!picked.includes(id)) picked.push(id);
  }
  return picked;
}

export function eloDelta(own: number, other: number, score: 0 | 0.5 | 1): number {
  const expected = 1 / (1 + 10 ** ((other - own) / 400));
  return Math.round(K * (score - expected));
}

interface Seat {
  fighter: Fighter;
  bot: boolean;
  send: ((message: ServerMessage) => void) | null;
  wins: number;
  dropTimer: (() => void) | null;
  lastProgressAt: number;
}

export class Match {
  private seats: Seat[];
  private levels: number[];
  private round = 0;
  private roundOpen = false;
  private startAt = 0;
  private started = false;
  private over = false;
  private timers: (() => void)[] = [];

  constructor(
    humans: Fighter[],
    private readonly vsBot: boolean,
    private readonly clock: Clock,
    private readonly rng: () => number,
    private readonly onFinished: (result: MatchResult) => void,
  ) {
    const seats: Seat[] = humans.map(fighter => ({ fighter, bot: false, send: null, wins: 0, dropTimer: null, lastProgressAt: 0 }));
    if (vsBot) {
      const human = humans[0];
      seats.push({ fighter: { id: "bot", name: "Bot", rating: human.rating }, bot: true, send: null, wins: 0, dropTimer: null, lastProgressAt: 0 });
    }
    this.seats = seats;
    this.levels = pickLevels(seats.reduce((sum, seat) => sum + seat.fighter.rating, 0) / seats.length, rng);
    // A match nobody turns up for must not live forever.
    this.timers.push(clock.after(JOIN_WAIT_MS, () => {
      if (!this.started) this.finish(null, false, true);
    }));
  }

  private seatOf(id: string) {
    return this.seats.find(seat => seat.fighter.id === id && !seat.bot);
  }

  private opponentOf(seat: Seat) {
    return this.seats.find(other => other !== seat)!;
  }

  private broadcast(build: (seat: Seat, opponent: Seat) => ServerMessage) {
    this.seats.forEach(seat => seat.send?.(build(seat, this.opponentOf(seat))));
  }

  private humans() {
    return this.seats.filter(seat => !seat.bot);
  }

  /** A player's socket is connected (or reconnected). */
  attach(playerId: string, send: (message: ServerMessage) => void) {
    const seat = this.seatOf(playerId);
    if (!seat) {
      send({ type: "error", reason: "not in this match" });
      return;
    }
    seat.dropTimer?.();
    seat.dropTimer = null;
    seat.send = send;
    const opponent = this.opponentOf(seat);
    send({
      type: "match",
      you: { name: seat.fighter.name, rating: seat.fighter.rating },
      opponent: { name: opponent.fighter.name, rating: opponent.fighter.rating, bot: opponent.bot },
      roundsToWin: ROUNDS_TO_WIN,
    });

    if (this.over) return;
    if (!this.started) {
      if (this.humans().every(human => human.send)) {
        this.started = true;
        this.beginRound();
      }
      return;
    }
    if (this.roundOpen) this.sendRound(seat);
  }

  /** A player's socket closed. They have RECONNECT_MS to come back before it counts as leaving. */
  detach(playerId: string) {
    const seat = this.seatOf(playerId);
    if (!seat || this.over) return;
    seat.send = null;
    seat.dropTimer?.();
    if (!this.started) {
      seat.dropTimer = this.clock.after(RECONNECT_MS, () => this.finish(null, false, true));
      return;
    }
    seat.dropTimer = this.clock.after(RECONNECT_MS, () => this.forfeit(seat));
  }

  receive(playerId: string, message: ClientMessage) {
    const seat = this.seatOf(playerId);
    if (!seat || this.over) return;
    if (message.type === "leave") {
      this.forfeit(seat);
      return;
    }
    if (message.type === "progress") {
      this.relayProgress(seat, message);
      return;
    }
    if (message.type !== "done" || !this.roundOpen || message.round !== this.round) return;

    const now = this.clock.now();
    if (now < this.startAt) {
      seat.send?.({ type: "rejected", reason: "too early" });
      return;
    }
    const elapsed = now - this.startAt;
    const problem = verifyPlayedPath(this.levels[this.round - 1], message.path, elapsed);
    if (problem) {
      seat.send?.({ type: "rejected", reason: problem });
      return;
    }
    this.endRound(seat, elapsed);
  }

  private relayProgress(from: Seat, message: { round: number; tail: unknown; count: unknown }) {
    const now = this.clock.now();
    if (!this.roundOpen || message.round !== this.round || now < this.startAt) return;
    if (now - from.lastProgressAt < PROGRESS_MIN_GAP_MS) return;
    const { tail, count } = message;
    if (!Array.isArray(tail) || tail.length > TAIL_LENGTH || !Number.isInteger(count) || (count as number) < 0 || (count as number) > 800) return;
    if (!tail.every(point => point && Number.isInteger(point.x) && Number.isInteger(point.y))) return;
    from.lastProgressAt = now;
    this.opponentOf(from).send?.({ type: "opponent", round: this.round, tail, count });
  }

  private sendRound(seat: Seat) {
    seat.send?.({
      type: "round",
      round: this.round,
      levelId: this.levels[this.round - 1],
      startsInMs: Math.max(0, this.startAt - this.clock.now()),
      limitMs: ROUND_LIMIT_MS,
      score: this.scoreFor(seat),
    });
  }

  private scoreFor(seat: Seat) {
    return { you: seat.wins, opponent: this.opponentOf(seat).wins };
  }

  private beginRound() {
    this.round++;
    this.roundOpen = true;
    this.startAt = this.clock.now() + COUNTDOWN_MS;
    this.seats.forEach(seat => this.sendRound(seat));

    const level = generateLevel(this.levels[this.round - 1]);
    const bot = this.seats.find(seat => seat.bot);
    if (bot) {
      // The bot "solves" in a human-ish time: slower on big boards, a little random.
      const botMs = Math.min(ROUND_LIMIT_MS - 10_000, (2500 + level.nodes.length * 650) * (0.7 + this.rng() * 0.9));
      const round = this.round;
      const solution = level.solution;
      const tick = () => {
        if (!this.roundOpen || this.round !== round) return;
        const elapsed = this.clock.now() - this.startAt;
        // The bot's line grows at an even pace and a little behind its finish time.
        const count = Math.max(1, Math.min(solution.length - 1, Math.floor((elapsed / botMs) * solution.length)));
        this.seats.filter(seat => !seat.bot).forEach(seat => seat.send?.({
          type: "opponent",
          round,
          tail: solution.slice(Math.max(0, count - TAIL_LENGTH), count),
          count,
        }));
        this.timers.push(this.clock.after(BOT_TICK_MS, tick));
      };
      this.timers.push(this.clock.after(COUNTDOWN_MS + BOT_TICK_MS, tick));
      this.timers.push(this.clock.after(COUNTDOWN_MS + botMs, () => {
        if (this.roundOpen && this.round === round) this.endRound(bot, botMs);
      }));
    }
    const round = this.round;
    this.timers.push(this.clock.after(COUNTDOWN_MS + ROUND_LIMIT_MS, () => {
      if (this.roundOpen && this.round === round) this.endRound(null, ROUND_LIMIT_MS);
    }));
  }

  private endRound(winner: Seat | null, elapsedMs: number) {
    this.roundOpen = false;
    if (winner) winner.wins++;
    this.broadcast((seat, opponent) => ({
      type: "roundResult",
      round: this.round,
      winner: winner === null ? "none" : winner === seat ? "you" : "opponent",
      timeMs: Math.round(elapsedMs),
      score: { you: seat.wins, opponent: opponent.wins },
    }));

    const leader = this.seats.find(seat => seat.wins >= ROUNDS_TO_WIN);
    if (leader) {
      this.finish(leader, false, false);
      return;
    }
    if (this.round >= MAX_ROUNDS) {
      const [a, b] = this.seats;
      this.finish(a.wins === b.wins ? null : a.wins > b.wins ? a : b, false, false);
      return;
    }
    this.timers.push(this.clock.after(BETWEEN_ROUNDS_MS, () => this.beginRound()));
  }

  private forfeit(leaver: Seat) {
    if (this.over) return;
    this.finish(this.opponentOf(leaver), true, false);
  }

  /** `winner` null with `cancelled` means the match never really happened: no rating change. */
  private finish(winner: Seat | null, forfeit: boolean, cancelled: boolean) {
    if (this.over) return;
    this.over = true;
    this.roundOpen = false;
    this.timers.forEach(cancel => cancel());
    this.seats.forEach(seat => seat.dropTimer?.());

    const deltas = new Map<string, number>();
    if (!cancelled) {
      const humans = this.humans();
      if (this.vsBot) {
        const human = humans[0];
        const won = winner === human;
        deltas.set(human.fighter.id, won && human.fighter.rating < BOT_RATING_CEILING ? BOT_WIN_POINTS : 0);
      } else {
        const [a, b] = humans;
        const scoreA = winner === null ? 0.5 : winner === a ? 1 : 0;
        deltas.set(a.fighter.id, eloDelta(a.fighter.rating, b.fighter.rating, scoreA as 0 | 0.5 | 1));
        deltas.set(b.fighter.id, eloDelta(b.fighter.rating, a.fighter.rating, (1 - scoreA) as 0 | 0.5 | 1));
      }
    }

    const players = this.humans().map(seat => {
      const rating = Math.max(MIN_RATING, seat.fighter.rating + (deltas.get(seat.fighter.id) ?? 0));
      return { id: seat.fighter.id, name: seat.fighter.name, rating, delta: rating - seat.fighter.rating };
    });
    const humanWinner = winner && !winner.bot ? winner.fighter.id : null;

    this.seats.forEach(seat => {
      const mine = players.find(player => player.id === seat.fighter.id);
      seat.send?.({
        type: "matchResult",
        winner: cancelled ? "cancelled" : winner === null ? "draw" : winner === seat ? "you" : "opponent",
        forfeit,
        rating: mine?.rating ?? seat.fighter.rating,
        ratingDelta: mine?.delta ?? 0,
        score: this.scoreFor(seat),
      });
    });
    if (!cancelled) this.onFinished({ winnerId: humanWinner, vsBot: this.vsBot, forfeit, players });
  }
}
