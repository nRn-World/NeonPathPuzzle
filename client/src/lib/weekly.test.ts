import assert from "node:assert/strict";
import test from "node:test";

import {
  getTimeUntilNextWeekly,
  getWeekKey,
  getWeeklyChallenge,
  getWeeklyResult,
  saveWeeklyResult,
} from "./weekly";

test("a week runs Monday through Sunday with a stable key", () => {
  const monday = new Date(2026, 9, 19, 9, 0, 0);
  const sunday = new Date(2026, 9, 25, 23, 0, 0);
  const nextMonday = new Date(2026, 9, 26, 0, 0, 0);

  assert.equal(getWeekKey(monday), getWeekKey(sunday));
  assert.notEqual(getWeekKey(monday), getWeekKey(nextMonday));
  assert.match(getWeekKey(monday), /^\d{4}-W\d{2}$/);
});

test("the weekly challenge is deterministic and valid", () => {
  const date = new Date(2026, 9, 19, 12, 0, 0);
  const first = getWeeklyChallenge(date);
  const second = getWeeklyChallenge(date);

  assert.deepEqual(first, second);
  assert.ok(first.levelId >= 1 && first.levelId <= 200);
  assert.ok(["mirror", "no-undo", "time-attack", "no-hints"].includes(first.modifier));
  // Calendar weeks can be one hour shorter or longer across DST changes.
  const weekMs = first.endsAt - first.startsAt;
  assert.ok(Math.abs(weekMs - 7 * 24 * 60 * 60 * 1000) <= 60 * 60 * 1000);
  assert.ok(first.endsAt > date.getTime());
  assert.equal(getTimeUntilNextWeekly(date), first.endsAt - date.getTime());
});

test("weekly results only improve", () => {
  const weekKey = "2099-W01";
  const levelId = 42;
  const modifier = "mirror" as const;

  const first = saveWeeklyResult({ weekKey, levelId, modifier, timeMs: 60_000, stars: 2, completedAt: 1 });
  assert.equal(first.stars, 2);

  const better = saveWeeklyResult({ weekKey, levelId, modifier, timeMs: 50_000, stars: 3, completedAt: 2 });
  assert.equal(better.stars, 3);
  assert.equal(getWeeklyResult(weekKey)?.timeMs, 50_000);

  const worse = saveWeeklyResult({ weekKey, levelId, modifier, timeMs: 20_000, stars: 1, completedAt: 3 });
  assert.equal(worse.stars, 3);
  assert.equal(getWeeklyResult(weekKey)?.timeMs, 50_000);
});
