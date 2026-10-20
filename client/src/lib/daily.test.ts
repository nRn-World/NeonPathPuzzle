import assert from "node:assert/strict";
import test from "node:test";

import {
  emptyDailyState,
  formatCountdown,
  getActiveStreak,
  getDailyLevelId,
  getDateKey,
  getRecentDateKeys,
  getTimeUntilNextDaily,
  shiftDateKey,
  updateDailyState,
} from "./daily";

test("daily level selection is stable and in range", () => {
  const levelA = getDailyLevelId("2026-10-19");
  const levelB = getDailyLevelId("2026-10-19");
  assert.equal(levelA, levelB);
  assert.ok(levelA >= 1 && levelA <= 200);
  assert.ok(Number.isInteger(levelA));
});

test("date keys use local calendar dates", () => {
  assert.equal(getDateKey(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(shiftDateKey("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDateKey("2026-12-31", 1), "2027-01-01");
});

test("recent day keys end on the requested day", () => {
  assert.deepEqual(getRecentDateKeys("2026-03-01", 3), ["2026-02-27", "2026-02-28", "2026-03-01"]);
  assert.deepEqual(getRecentDateKeys("2026-01-01", 1), ["2026-01-01"]);
});

test("the countdown always points at the next local midnight", () => {
  const evening = new Date(2026, 9, 19, 23, 59, 30);
  assert.equal(getTimeUntilNextDaily(evening), 30_000);

  const morning = new Date(2026, 9, 19, 0, 0, 0);
  assert.equal(getTimeUntilNextDaily(morning), 24 * 60 * 60 * 1000);
  assert.equal(formatCountdown(30_000), "30s");
  assert.equal(formatCountdown(65_000), "1m 05s");
  assert.equal(formatCountdown(3_725_000), "1h 02m");
});

test("streak grows on consecutive days and resets after a gap", () => {
  let state = emptyDailyState();

  state = updateDailyState(state, "2026-10-17", { levelId: 10, timeMs: 30_000, stars: 2 });
  assert.equal(state.streak, 1);

  state = updateDailyState(state, "2026-10-18", { levelId: 11, timeMs: 28_000, stars: 3 });
  assert.equal(state.streak, 2);
  assert.equal(state.bestStreak, 2);

  state = updateDailyState(state, "2026-10-20", { levelId: 13, timeMs: 25_000, stars: 3 });
  assert.equal(state.streak, 1);
  assert.equal(state.bestStreak, 2);
  assert.deepEqual(Object.keys(state.results).sort(), ["2026-10-17", "2026-10-18", "2026-10-20"]);
});

test("a streak expires when a day is missed", () => {
  let state = emptyDailyState();
  state = updateDailyState(state, "2026-10-17", { levelId: 10, timeMs: 30_000, stars: 2 });
  state = updateDailyState(state, "2026-10-18", { levelId: 11, timeMs: 28_000, stars: 3 });

  assert.equal(getActiveStreak(state, "2026-10-18"), 2);
  assert.equal(getActiveStreak(state, "2026-10-19"), 2);
  assert.equal(getActiveStreak(state, "2026-10-20"), 0);
});

test("replaying the same day keeps the best result and does not double the streak", () => {
  let state = emptyDailyState();
  state = updateDailyState(state, "2026-10-19", { levelId: 20, timeMs: 40_000, stars: 1 });
  state = updateDailyState(state, "2026-10-19", { levelId: 20, timeMs: 35_000, stars: 2 });

  assert.equal(state.streak, 1);
  assert.equal(state.results["2026-10-19"].timeMs, 35_000);
  assert.equal(state.results["2026-10-19"].stars, 2);
});
