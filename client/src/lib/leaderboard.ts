import type { Point } from "@shared/schema";

/**
 * Online rankings talk to the Cloudflare Worker in /worker. With no URL set
 * (VITE_LEADERBOARD_URL) the feature is off and nothing ever leaves the device.
 */
const BASE = ((import.meta.env?.VITE_LEADERBOARD_URL as string | undefined) ?? "").replace(/\/+$/, "");

export const leaderboardEnabled = () => BASE !== "";

const PLAYER_KEY = "neon_path_player_v1";

export interface Player {
  id: string;
  /** Null until the player opts in by choosing a public name. */
  name: string | null;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;

export function getPlayer(): Player {
  try {
    const parsed = JSON.parse(storage()?.getItem(PLAYER_KEY) ?? "null") as Partial<Player> | null;
    if (parsed && typeof parsed.id === "string" && parsed.id.length >= 16) {
      return { id: parsed.id, name: typeof parsed.name === "string" ? parsed.name : null };
    }
  } catch {
    // Fall through to a fresh identity.
  }
  const player: Player = { id: newId(), name: null };
  try {
    storage()?.setItem(PLAYER_KEY, JSON.stringify(player));
  } catch {
    // Without storage the id is per session; rankings still work, just not across restarts.
  }
  return player;
}

export function setPlayerName(name: string | null): Player {
  const player = { ...getPlayer(), name };
  try {
    storage()?.setItem(PLAYER_KEY, JSON.stringify(player));
  } catch {
    // Name just isn't remembered.
  }
  return player;
}

// Built from a string: the tsconfig has no ES target, so a literal /u regex would not compile.
const NAME_PATTERN = new RegExp("^[\\p{L}\\p{N} _.-]+$", "u");

/** Mirrors the server's rule, so the form can say no before sending anything. */
export const isValidName = (name: string) => {
  const trimmed = name.trim().replace(/\s+/g, " ");
  return trimmed.length >= 3 && trimmed.length <= 16 && NAME_PATTERN.test(trimmed);
};

export type BoardKind = "daily" | "weekly" | "stars";

export interface BoardEntry {
  rank: number;
  name: string;
  value: number;
  you: boolean;
}

export interface BoardResult {
  board: string;
  entries: BoardEntry[];
  you: { rank: number; value: number } | null;
}

async function post(body: Record<string, unknown>): Promise<void> {
  const player = getPlayer();
  if (!leaderboardEnabled() || !player.name) return;
  try {
    await fetch(`${BASE}/score`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, playerId: player.id, name: player.name }),
    });
  } catch {
    // Offline: the next result is submitted when the player is back online.
  }
}

export const submitStars = (value: number) => post({ kind: "stars", value });

export const submitDaily = (dateKey: string, value: number, path: Point[]) =>
  post({ kind: "daily", dateKey, value, path });

export const submitWeekly = (weekKey: string, value: number, path: Point[]) =>
  post({ kind: "weekly", weekKey, value, path });

export async function fetchBoard(kind: BoardKind, dateKey: string): Promise<BoardResult> {
  const params = new URLSearchParams({ board: kind, playerId: getPlayer().id, dateKey });
  const response = await fetch(`${BASE}/top?${params}`);
  if (!response.ok) throw new Error(`Ranking request failed (${response.status})`);
  return (await response.json()) as BoardResult;
}
