import { cloudSyncReady } from "./cloudSync";
import { onlineBase } from "./leaderboard";
import { useSettingsStore } from "./settings";

/**
 * Privacy-friendly, opt-in diagnostics.
 *
 * Nothing is recorded until the player enables "Help improve the game" in
 * Settings. Events stay in a small local ring buffer on the device. If — and
 * only if — the player has also opted into online play, aggregated counters
 * (event name + level id + day, never a player id) are sent to the ranking
 * worker. There is no session id, no device id and no free-text field.
 */

export type TelemetryEventName =
  | "level_start"
  | "first_move"
  | "hint"
  | "backtrack"
  | "dead_end"
  | "crash"
  | "win"
  | "quit"
  | "error";

export interface TelemetryEvent {
  at: number;
  name: TelemetryEventName;
  levelId?: number;
  mode?: string;
}

const STORAGE_KEY = "neon-path-telemetry-v1";
const MAX_EVENTS = 250;
const FLUSH_INTERVAL_MS = 60_000;
let lastFlush = 0;

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function getTelemetryEvents(): TelemetryEvent[] {
  try {
    const parsed: unknown = JSON.parse(storage()?.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed as TelemetryEvent[] : [];
  } catch {
    return [];
  }
}

export function clearTelemetryEvents(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Private browsing: nothing to clear.
  }
}

export function telemetryEnabled(): boolean {
  return useSettingsStore.getState().telemetryEnabled;
}

/** Records one event. Silently does nothing when telemetry is off. */
export function track(
  name: TelemetryEventName,
  payload: { levelId?: number; mode?: string } = {},
): void {
  if (!telemetryEnabled()) return;
  const events = getTelemetryEvents();
  events.push({ at: Date.now(), name, levelId: payload.levelId, mode: payload.mode });
  const trimmed = events.slice(-MAX_EVENTS);
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    return;
  }
  void maybeFlush();
}

export function telemetryToJson(): string {
  return JSON.stringify({ app: "neon-path-puzzle", exportedAt: new Date().toISOString(), events: getTelemetryEvents() }, null, 2);
}

interface Counter {
  name: TelemetryEventName;
  levelId: number;
  count: number;
}

/** Collapses the local log into nameless counters before anything leaves the device. */
export function aggregateTelemetry(events: TelemetryEvent[]): { day: string; counters: Counter[] } {
  const day = new Date().toISOString().slice(0, 10);
  const map = new Map<string, Counter>();
  for (const event of events) {
    if (!event.at || !event.name) continue;
    const eventDay = new Date(event.at).toISOString().slice(0, 10);
    if (eventDay !== day) continue;
    const levelId = Number.isInteger(event.levelId) ? event.levelId! : 0;
    const key = `${event.name}:${levelId}`;
    const entry = map.get(key) ?? { name: event.name, levelId, count: 0 };
    entry.count += 1;
    map.set(key, entry);
  }
  return { day, counters: Array.from(map.values()) };
}

/** Best-effort upload; a failed or unavailable worker never affects play. */
export async function flushTelemetry(force = false): Promise<boolean> {
  if (!telemetryEnabled() || !cloudSyncReady()) return false;
  const now = Date.now();
  if (!force && now - lastFlush < FLUSH_INTERVAL_MS) return false;
  const { day, counters } = aggregateTelemetry(getTelemetryEvents());
  if (counters.length === 0) return false;
  lastFlush = now;
  try {
    const response = await fetch(`${onlineBase()}/telemetry`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ day, counters }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function maybeFlush(): void {
  void flushTelemetry();
}
