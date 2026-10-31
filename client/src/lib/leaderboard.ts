import type { Point } from "@shared/schema";
import { nameFromSeed } from "@shared/names";
import { forgetGoogleAccount } from "@/lib/googleSignIn";

/**
 * Online rankings talk to the Cloudflare Worker in /worker. With no URL set
 * (VITE_LEADERBOARD_URL) the feature is off and nothing ever leaves the device.
 */
const BASE = ((import.meta.env?.VITE_LEADERBOARD_URL as string | undefined) ?? "").replace(/\/+$/, "");

export const leaderboardEnabled = () => BASE !== "";

/** Base URL of the online worker, shared with cloud sync. */
export const onlineBase = () => BASE;

/** The worker address as a WebSocket URL, for duels. */
export const duelSocketBase = () => BASE.replace(/^http/, "ws");

const PLAYER_KEY = "neon_path_player_v1";
export const PLAYER_EVENT = "neon-path-player";

export interface Player {
  /** 32 hex characters; the backup code is this id in groups of four. */
  id: string;
  /** Generated, never typed: see shared/names.ts. */
  name: string;
  /** Nothing is sent to the server until the player opts in. */
  online: boolean;
  /** Seed behind the current name, so "new name" can step to the next one. */
  nameSeed: number;
  /** Name changes used on this device. Restoring a backup code does not reset it. */
  rerollsUsed: number;
  /** Signed in with Google: the id comes from the account, so the points follow it to any device. */
  google: boolean;
}

/** How many times a device may pick a new generated name. */
export const MAX_NAME_CHANGES = 10;

export const nameChangesLeft = (player: Player) => Math.max(0, MAX_NAME_CHANGES - (player.rerollsUsed || 0));

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

const ID_PATTERN = /^[0-9a-f]{32}$/;

function newId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes);
  else bytes.forEach((_, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

const newSeed = () => Math.floor(Math.random() * 0x7fffffff);

function save(player: Player): Player {
  try {
    storage()?.setItem(PLAYER_KEY, JSON.stringify(player));
  } catch {
    // Without storage the identity lasts for the session only.
  }
  return player;
}

let sessionPlayer: Player | null = null;

export function getPlayer(): Player {
  try {
    const parsed = JSON.parse(storage()?.getItem(PLAYER_KEY) ?? "null") as Partial<Player> | null;
    if (parsed && typeof parsed.id === "string" && ID_PATTERN.test(parsed.id)) {
      const seed = Number.isInteger(parsed.nameSeed) ? (parsed.nameSeed as number) : newSeed();
      return {
        id: parsed.id,
        name: nameFromSeed(seed),
        online: Boolean(parsed.online),
        nameSeed: seed,
        rerollsUsed: Math.min(MAX_NAME_CHANGES, Math.max(0, Math.trunc(Number(parsed.rerollsUsed)) || 0)),
        google: Boolean(parsed.google),
      };
    }
  } catch {
    // Fall through to a fresh identity.
  }
  if (sessionPlayer) return sessionPlayer;
  const seed = newSeed();
  sessionPlayer = save({ id: newId(), name: nameFromSeed(seed), online: false, nameSeed: seed, rerollsUsed: 0, google: false });
  return sessionPlayer;
}

function update(change: Partial<Player>): Player {
  sessionPlayer = save({ ...getPlayer(), ...change });
  // Lets other parts of the page (the menu button) follow a sign-in or sign-out.
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PLAYER_EVENT));
  return sessionPlayer;
}

export const setOnline = (online: boolean): Player => update({ online });

/**
 * A different generated name. A guest starts over with a new id, so the old
 * points stay with the old name; a Google account keeps its points.
 */
export function rerollName(): Player {
  const player = getPlayer();
  if (nameChangesLeft(player) === 0) return player;
  const seed = newSeed();
  return update({
    nameSeed: seed,
    name: nameFromSeed(seed),
    rerollsUsed: player.rerollsUsed + 1,
    ...(player.google ? {} : { id: newId() }),
  });
}

/** Trades a Google ID token for the account's player id; null when sign-in fails or is off. */
export async function signInWithGoogle(token: { idToken: string } | { accessToken: string }): Promise<Player | null> {
  if (!leaderboardEnabled()) return null;
  try {
    const response = await fetch(`${BASE}/auth/google`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(token),
    });
    const { playerId } = (await response.json()) as { playerId?: string };
    return response.ok && typeof playerId === "string" && ID_PATTERN.test(playerId) ? update({ id: playerId, online: true, google: true }) : null;
  } catch {
    return null;
  }
}

/** Back to a fresh guest, so the account's points are not mixed with a guest's. */
export const signOutGoogle = (): Player => {
  void forgetGoogleAccount();
  return update({ id: newId(), google: false });
};

/** The id in groups of four, e.g. "9F3A-0C11-...": enough to restore the rating on a new device. */
export const getBackupCode = (): string => (getPlayer().id.toUpperCase().match(/.{4}/g) ?? []).join("-");

/** Accepts the code in any case, with or without dashes and spaces. Returns null when it isn't a valid code. */
export function restoreFromBackupCode(code: string): Player | null {
  const id = code.toLowerCase().replace(/[^0-9a-f]/g, "");
  if (!ID_PATTERN.test(id)) return null;
  return update({ id, online: true, google: false });
}

export type BoardKind = "daily" | "weekly" | "stars" | "duel";

export interface BoardEntry {
  rank: number;
  name: string;
  value: number;
  you: boolean;
}

export interface BoardResult {
  board: string;
  entries: BoardEntry[];
  you: { rank: number; value: number; wins?: number; losses?: number } | null;
}

async function post(body: Record<string, unknown>): Promise<void> {
  const player = getPlayer();
  if (!leaderboardEnabled() || !player.online) return;
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

export const playerIdentity = () => {
  const { id, name } = getPlayer();
  return { playerId: id, name };
};

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
