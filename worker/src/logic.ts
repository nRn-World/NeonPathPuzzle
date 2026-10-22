import { getDailyLevelId } from "../../client/src/lib/daily";
import { getWeeklyChallenge } from "../../client/src/lib/weekly";
import { generateLevel } from "../../shared/level-generator";
import { getLevelMechanics, isValidPlayerPath, mirrorLevel } from "../../shared/mechanics";
import type { LevelData, Point } from "../../shared/schema";

export type Order = "low" | "high";

export interface Store {
  /** Keeps the better value: the lowest for "low" boards, the highest for "high" boards. */
  upsert(board: string, playerId: string, name: string, value: number, order: Order, now: number): Promise<void>;
  top(board: string, order: Order, limit: number): Promise<{ playerId: string; name: string; value: number }[]>;
  rank(board: string, playerId: string, order: Order): Promise<{ rank: number; value: number } | null>;
}

export interface Reply {
  status: number;
  body: unknown;
}

const MAX_STARS = 900;
const MAX_TIME_MS = 60 * 60 * 1000;
/** No honest run clears a node faster than this; it rejects replayed or scripted instant times. */
const MIN_MS_PER_NODE = 40;
const BLOCKED = ["nigg", "fuck", "shit", "cunt", "nazi", "hitler", "rape", "fagg"];

export const sanitizeName = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 3 || name.length > 16) return null;
  if (!/^[\p{L}\p{N} _.-]+$/u.test(name)) return null;
  const folded = name.toLowerCase().replace(/[^a-z]/g, "");
  return BLOCKED.some(word => folded.includes(word)) ? null : name;
};

const isPlayerId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9-]{16,64}$/.test(value);

const utcDay = (dateKey: string): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
};

function isPath(value: unknown): value is Point[] {
  return Array.isArray(value) && value.length >= 2 && value.length <= 800
    && value.every(point => point && Number.isInteger(point.x) && Number.isInteger(point.y));
}

/** The levels the server can check a path against: daily and weekly challenges. */
function verifyRun(levelId: number, mirrored: boolean, path: unknown, timeMs: number): string | null {
  if (!isPath(path)) return "path required";
  const generated = generateLevel(levelId);
  const base: LevelData = { id: generated.id, gridSize: generated.gridSize, start: generated.start, nodes: generated.nodes };
  const source = mirrored ? mirrorLevel(base, generated.solution) : { level: base, solution: generated.solution };
  const mechanics = getLevelMechanics(source.level, source.solution);
  if (!isValidPlayerPath(path, source.level, mechanics)) return "path does not solve the level";
  if (timeMs < source.level.nodes.length * MIN_MS_PER_NODE) return "time too short";
  return null;
}

const fail = (status: number, error: string): Reply => ({ status, body: { error } });

export async function handleSubmit(input: unknown, store: Store, now: Date): Promise<Reply> {
  const body = (input ?? {}) as Record<string, unknown>;
  const name = sanitizeName(body.name);
  if (!isPlayerId(body.playerId)) return fail(400, "invalid player id");
  if (!name) return fail(400, "invalid name");
  const value = body.value;
  if (!Number.isInteger(value) || (value as number) < 0) return fail(400, "invalid value");
  const score = value as number;

  if (body.kind === "stars") {
    if (score > MAX_STARS) return fail(400, "invalid value");
    await store.upsert("stars", body.playerId, name, score, "high", now.getTime());
    return { status: 200, body: { ok: true } };
  }

  if (body.kind === "daily") {
    const dateKey = typeof body.dateKey === "string" ? body.dateKey : "";
    const day = utcDay(dateKey);
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (day === null || Math.abs(day - today) > 86_400_000) return fail(400, "not today's challenge");
    if (score > MAX_TIME_MS) return fail(400, "invalid value");
    const problem = verifyRun(getDailyLevelId(dateKey), false, body.path, score);
    if (problem) return fail(422, problem);
    await store.upsert(`daily:${dateKey}`, body.playerId, name, score, "low", now.getTime());
    return { status: 200, body: { ok: true } };
  }

  if (body.kind === "weekly") {
    const challenge = getWeeklyChallenge(now);
    if (body.weekKey !== challenge.weekKey) return fail(400, "not this week's challenge");
    if (score > MAX_TIME_MS) return fail(400, "invalid value");
    const problem = verifyRun(challenge.levelId, challenge.modifier === "mirror", body.path, score);
    if (problem) return fail(422, problem);
    await store.upsert(`weekly:${challenge.weekKey}`, body.playerId, name, score, "low", now.getTime());
    return { status: 200, body: { ok: true } };
  }

  return fail(400, "unknown board");
}

export async function handleTop(
  kind: string | null,
  playerId: string | null,
  dateKey: string | null,
  store: Store,
  now: Date,
): Promise<Reply> {
  let board: string;
  let order: Order = "low";
  if (kind === "stars") {
    board = "stars";
    order = "high";
  } else if (kind === "daily") {
    // The client's local date decides which daily it is playing; the server only bounds it to today +-1.
    const day = dateKey ? utcDay(dateKey) : null;
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    board = dateKey && day !== null && Math.abs(day - today) <= 86_400_000
      ? `daily:${dateKey}`
      : `daily:${new Date(today).toISOString().slice(0, 10)}`;
  } else if (kind === "weekly") {
    board = `weekly:${getWeeklyChallenge(now).weekKey}`;
  } else {
    return fail(400, "unknown board");
  }

  const rows = await store.top(board, order, 20);
  const you = playerId && isPlayerId(playerId) ? await store.rank(board, playerId, order) : null;
  return {
    status: 200,
    body: {
      board,
      entries: rows.map((row, index) => ({ rank: index + 1, name: row.name, value: row.value, you: row.playerId === playerId })),
      you,
    },
  };
}
