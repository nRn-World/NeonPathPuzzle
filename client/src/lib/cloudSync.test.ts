import assert from "node:assert/strict";
import test from "node:test";

import { applyLevelResult, createEmptyProgress, mergeProgress } from "./progress";

const clear = (
  progress: ReturnType<typeof createEmptyProgress>,
  levelId: number,
  stars: number,
  timeMs: number,
) => applyLevelResult(progress, {
  levelId,
  completed: true,
  hintsUsed: false,
  stars,
  timeMs,
  moves: 10,
  mistakes: 0,
  path: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
}).progress;

test("merging keeps every clear from both sides", () => {
  const device = clear(createEmptyProgress(), 1, 2, 20_000);
  const cloud = clear(createEmptyProgress(), 2, 3, 15_000);

  const merged = mergeProgress(device, cloud);
  assert.deepEqual(merged.completed, [1, 2]);
  assert.equal(merged.records["1"].stars, 2);
  assert.equal(merged.records["2"].stars, 3);
});

test("the better run wins each record, never the newer one", () => {
  const slow = clear(createEmptyProgress(), 5, 3, 40_000);
  const fast = clear(createEmptyProgress(), 5, 1, 12_000);

  const merged = mergeProgress(slow, fast);
  assert.equal(merged.records["5"].bestTimeMs, 12_000, "fastest time");
  assert.equal(merged.records["5"].stars, 3, "best stars survive");

  const mergedBack = mergeProgress(fast, slow);
  assert.equal(mergedBack.records["5"].bestTimeMs, 12_000);
  assert.equal(mergedBack.records["5"].stars, 3);
});

test("the ghost comes from the faster run", () => {
  const slow = applyLevelResult(createEmptyProgress(), {
    levelId: 3,
    completed: true,
    hintsUsed: false,
    stars: 2,
    timeMs: 30_000,
    moves: 9,
    mistakes: 0,
    path: [{ x: 1, y: 1 }, { x: 1, y: 2 }],
  }).progress;
  const fast = applyLevelResult(createEmptyProgress(), {
    levelId: 3,
    completed: true,
    hintsUsed: false,
    stars: 3,
    timeMs: 10_000,
    moves: 9,
    mistakes: 0,
    path: [{ x: 2, y: 2 }, { x: 2, y: 3 }],
  }).progress;

  const merged = mergeProgress(slow, fast);
  assert.deepEqual(merged.records["3"].bestPath, [{ x: 2, y: 2 }, { x: 2, y: 3 }]);
});

test("hints and daily streaks follow the union, not one device", () => {
  const device = createEmptyProgress();
  device.hints = [4];
  device.daily = { lastPlayedDate: "2026-10-01", streak: 3, bestStreak: 5, results: {} };

  const cloud = createEmptyProgress();
  cloud.hints = [7];
  cloud.daily = { lastPlayedDate: "2026-10-09", streak: 1, bestStreak: 9, results: {} };

  const merged = mergeProgress(device, cloud);
  assert.deepEqual(merged.hints, [4, 7]);
  assert.equal(merged.daily.streak, 1, "the newer device owns the streak");
  assert.equal(merged.daily.bestStreak, 9);
});

test("merging with an empty snapshot changes nothing", () => {
  const device = clear(createEmptyProgress(), 1, 3, 11_000);
  const merged = mergeProgress(device, createEmptyProgress());
  assert.deepEqual(merged.completed, device.completed);
  assert.equal(merged.records["1"].bestTimeMs, 11_000);
  assert.equal(merged.records["1"].bestPath?.length, 2);
});
