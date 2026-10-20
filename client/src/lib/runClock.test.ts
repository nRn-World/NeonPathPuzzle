import assert from "node:assert/strict";
import test from "node:test";

import {
  createRunClock,
  elapsedAt,
  pauseClock,
  resumeClock,
  setFrozen,
  startRun,
} from "./runClock";

test("a plain run counts wall-clock time", () => {
  const clock = startRun(createRunClock(), 1_000, false);
  assert.equal(elapsedAt(clock, 6_000), 5_000);
});

test("a paused run does not count the pause", () => {
  const started = startRun(createRunClock(), 0, false);
  const paused = pauseClock(started, 2_000);
  assert.equal(elapsedAt(paused, 9_000), 2_000);
  assert.equal(elapsedAt(resumeClock(paused, 9_000, false), 10_000), 3_000);
});

test("a frozen run does not count the freeze", () => {
  const started = startRun(createRunClock(), 0, false);
  const frozen = setFrozen(started, 1_000, true);
  assert.equal(elapsedAt(frozen, 4_000), 1_000);
  const thawed = setFrozen(frozen, 6_000, false);
  assert.equal(elapsedAt(thawed, 7_000), 2_000);
});

test("pausing during a freeze deducts the stopped time only once", () => {
  // Run 0-1s, freeze 1-2s, pause 2-7s, freeze again 7-9s, run 9-10s.
  let clock = startRun(createRunClock(), 0, false);
  clock = setFrozen(clock, 1_000, true);
  clock = pauseClock(clock, 2_000);
  assert.equal(elapsedAt(clock, 5_000), 1_000, "the pause is not credited twice");

  clock = resumeClock(clock, 7_000, true);
  assert.equal(elapsedAt(clock, 8_000), 1_000);
  clock = setFrozen(clock, 9_000, false);
  assert.equal(elapsedAt(clock, 10_000), 2_000);
});

test("unfreezing while paused keeps the remaining pause excluded", () => {
  let clock = startRun(createRunClock(), 0, false);
  clock = setFrozen(clock, 1_000, true);
  clock = pauseClock(clock, 2_000);
  clock = setFrozen(clock, 4_000, false);
  clock = resumeClock(clock, 9_000, false);
  assert.equal(elapsedAt(clock, 10_000), 2_000);
});

test("a freeze activated before the first move does not discount earlier time", () => {
  let clock = createRunClock();
  clock = setFrozen(clock, 2_000, true);
  assert.equal(clock.freezeStartedAt, null);
  clock = startRun(clock, 5_000, true);
  assert.equal(elapsedAt(clock, 8_000), 0);
  clock = setFrozen(clock, 8_000, false);
  assert.equal(elapsedAt(clock, 9_000), 1_000);
});

test("the clock is idle until the run starts", () => {
  assert.equal(elapsedAt(createRunClock(), 50_000), 0);
});
