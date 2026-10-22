import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateScore,
  calculateStars,
  formatDuration,
  formatResultTime,
  getParTimeMs,
} from "./scoring";

const par = 60_000;

test("a clean fast run earns three stars", () => {
  assert.equal(
    calculateStars({ mistakes: 0, hintsUsed: false, timeMs: 30_000, parTimeMs: par }),
    3,
  );
});

test("hints, backtracks and overtime each remove one star", () => {
  assert.equal(
    calculateStars({ mistakes: 0, hintsUsed: true, timeMs: 30_000, parTimeMs: par }),
    2,
  );
  assert.equal(
    calculateStars({ mistakes: 2, hintsUsed: false, timeMs: 30_000, parTimeMs: par }),
    2,
  );
  assert.equal(
    calculateStars({ mistakes: 0, hintsUsed: false, timeMs: 61_000, parTimeMs: par }),
    2,
  );
  assert.equal(
    calculateStars({ mistakes: 3, hintsUsed: true, timeMs: 61_000, parTimeMs: par }),
    1,
  );
});

test("par time grows with the number of nodes and has a floor", () => {
  assert.equal(getParTimeMs(3), 15_000);
  assert.ok(getParTimeMs(50) > getParTimeMs(25));
});

test("score rewards stars and speed", () => {
  const fast = calculateScore({ nodeCount: 20, stars: 3, timeMs: 20_000 });
  const slow = calculateScore({ nodeCount: 20, stars: 1, timeMs: 80_000 });
  assert.ok(fast > slow);
  assert.equal(
    calculateScore({ nodeCount: 20, stars: 3, timeMs: 20_000, multiplier: 2 }),
    fast * 2,
  );
});

test("durations format as minutes and seconds", () => {
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(65_000), "1:05");
  assert.equal(formatDuration(600_000), "10:00");
  assert.equal(formatResultTime(0), "0:00.0");
  assert.equal(formatResultTime(7_480), "0:07.4");
  assert.equal(formatResultTime(65_099), "1:05.0");
});
