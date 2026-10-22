import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyProgress, type LevelRecord } from "./progress";
import { computeProfileStats } from "./stats";

const record = (levelId: number, stars: number, bestTimeMs: number | null, hintsUsed = false, updatedAt = Date.UTC(2026, 9, 20, 12)): LevelRecord => ({
  levelId, completed: true, stars, bestTimeMs, bestMoves: null, bestMistakes: null, bestScore: null, bestPath: null, hintsUsed, updatedAt,
});

test("an empty save gives zeroed stats and a full, quiet calendar", () => {
  const stats = computeProfileStats(createEmptyProgress(), "2026-10-22");
  assert.equal(stats.clears, 0);
  assert.equal(stats.averageStars, 0);
  assert.equal(stats.activity.length, 84);
  assert.equal(stats.activeDays, 0);
  assert.equal(stats.activity.at(-1)?.dateKey, "2026-10-22");
});

test("stats count stars, flawless clears, chapters and the fastest levels", () => {
  const progress = createEmptyProgress();
  progress.completed = [1, 2, 30];
  progress.records = {
    "1": record(1, 3, 4000),
    "2": record(2, 3, 2500, true),
    "30": record(30, 2, 9000),
  };
  const stats = computeProfileStats(progress, "2026-10-22");
  assert.equal(stats.totalStars, 8);
  assert.equal(stats.threeStarClears, 2);
  assert.equal(stats.flawlessClears, 1);
  assert.deepEqual(stats.fastest.map(entry => entry.levelId), [2, 1, 30]);
  assert.equal(stats.chapters[0].cleared, 2);
  assert.equal(stats.chapters[1].stars, 2);
  assert.equal(stats.activeDays, 1);
  assert.equal(stats.totalBestTimeMs, 15500);
});
