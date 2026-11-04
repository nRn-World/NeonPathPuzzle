import assert from "node:assert/strict";
import test from "node:test";

import { aggregateTelemetry, getTelemetryEvents, clearTelemetryEvents, track, type TelemetryEvent } from "./telemetry";
import { useSettingsStore } from "./settings";

// zustand's persist middleware is inert without a browser localStorage.
const store = () => ({ ...(globalThis as { localStorage?: Storage }).localStorage });

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(key: string) { return this.map.get(key) ?? null; }
  key(index: number) { return [...this.map.keys()][index] ?? null; }
  removeItem(key: string) { this.map.delete(key); }
  setItem(key: string, value: string) { this.map.set(key, value); }
}

(globalThis as { localStorage?: Storage }).localStorage = new MemoryStorage();

test("nothing is recorded while telemetry is off", () => {
  clearTelemetryEvents();
  useSettingsStore.setState({ telemetryEnabled: false });
  track("level_start", { levelId: 7 });
  assert.equal(getTelemetryEvents().length, 0);
  assert.ok(store());
});

test("opted-in events are capped and aggregated without player data", () => {
  clearTelemetryEvents();
  useSettingsStore.setState({ telemetryEnabled: true });
  for (let i = 0; i < 300; i++) track("first_move", { levelId: 12 });
  track("win", { levelId: 12 });
  const events = getTelemetryEvents();
  assert.equal(events.length, 250);
  assert.ok(events.every(event => event.levelId === 12 || event.name === "win"));
  const { day, counters } = aggregateTelemetry(events);
  assert.match(day, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(counters.every(counter => !("playerId" in counter)));
  assert.ok(counters.find(counter => counter.name === "first_move" && counter.count > 1));
  useSettingsStore.setState({ telemetryEnabled: false });
});

test("aggregateTelemetry ignores malformed entries", () => {
  const bad = [{ at: Date.now(), name: "hint" }, { at: 0, name: "win" }] as TelemetryEvent[];
  const { counters } = aggregateTelemetry(bad);
  assert.equal(counters.length, 1);
  assert.equal(counters[0].name, "hint");
});
