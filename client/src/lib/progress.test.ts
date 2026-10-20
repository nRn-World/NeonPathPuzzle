import assert from "node:assert/strict";
import test from "node:test";

import {
  applyLevelResult,
  createEmptyProgress,
  getContinueLevel,
  getLevelRecord,
  getTotalScore,
  getTotalStars,
} from "./progress";

test("a completed level creates a record and unlocks the next level", () => {
  const progress = createEmptyProgress();
  const applied = applyLevelResult(progress, {
    levelId: 1,
    completed: true,
    hintsUsed: false,
    stars: 2,
    timeMs: 22_000,
    moves: 12,
    mistakes: 1,
  });

  assert.deepEqual(applied.progress.completed, [1]);
  assert.equal(applied.progress.lastLevelId, 1);
  assert.equal(applied.record.stars, 2);
  assert.equal(applied.record.bestTimeMs, 22_000);
  assert.equal(getContinueLevel(applied.progress), 2);
  assert.equal(getTotalStars(applied.progress), 2);
  assert.equal(progress.completed.length, 0, "input progress must not be mutated");
});

test("replays keep the best stars, time and move count", () => {
  const first = applyLevelResult(createEmptyProgress(), {
    levelId: 4,
    completed: true,
    hintsUsed: true,
    stars: 1,
    timeMs: 40_000,
    moves: 20,
    mistakes: 2,
    score: 1_200,
  });

  const second = applyLevelResult(first.progress, {
    levelId: 4,
    completed: true,
    hintsUsed: false,
    stars: 3,
    timeMs: 30_000,
    moves: 16,
    mistakes: 0,
    score: 2_400,
  });

  const record = getLevelRecord(second.progress, 4);
  assert.equal(record?.stars, 3);
  assert.equal(record?.bestTimeMs, 30_000);
  assert.equal(record?.bestMoves, 16);
  assert.equal(record?.bestMistakes, 0);
  assert.equal(record?.bestScore, 2_400);
  assert.equal(record?.hintsUsed, true, "a hint once used stays recorded");
  assert.equal(second.isNewBest, true);
});

test("a lower-scoring replay never lowers the best score", () => {
  const first = applyLevelResult(createEmptyProgress(), {
    levelId: 9,
    completed: true,
    hintsUsed: false,
    stars: 3,
    timeMs: 18_000,
    moves: 14,
    mistakes: 0,
    score: 3_000,
  });

  const second = applyLevelResult(first.progress, {
    levelId: 9,
    completed: true,
    hintsUsed: true,
    stars: 1,
    timeMs: 60_000,
    moves: 30,
    mistakes: 4,
    score: 900,
  });

  assert.equal(getLevelRecord(second.progress, 9)?.bestScore, 3_000);
  assert.equal(getTotalScore(second.progress), 3_000);
});

test("the ghost path follows the fastest run", () => {
  const slowPath = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
  const fastPath = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];

  const first = applyLevelResult(createEmptyProgress(), {
    levelId: 6,
    completed: true,
    hintsUsed: false,
    stars: 2,
    timeMs: 30_000,
    moves: 8,
    mistakes: 0,
    path: slowPath,
  });
  assert.deepEqual(getLevelRecord(first.progress, 6)?.bestPath, slowPath);

  const faster = applyLevelResult(first.progress, {
    levelId: 6,
    completed: true,
    hintsUsed: false,
    stars: 3,
    timeMs: 20_000,
    moves: 8,
    mistakes: 0,
    path: fastPath,
  });
  assert.deepEqual(getLevelRecord(faster.progress, 6)?.bestPath, fastPath);

  const slower = applyLevelResult(faster.progress, {
    levelId: 6,
    completed: true,
    hintsUsed: false,
    stars: 3,
    timeMs: 40_000,
    moves: 8,
    mistakes: 0,
    path: slowPath,
  });
  assert.deepEqual(getLevelRecord(slower.progress, 6)?.bestPath, fastPath);
});

test("a 0 ms best time is kept when a slower run follows", () => {
  const fastPath = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
  const slowPath = [{ x: 0, y: 0 }, { x: 0, y: 1 }];

  const first = applyLevelResult(createEmptyProgress(), {
    levelId: 3,
    completed: true,
    hintsUsed: false,
    stars: 3,
    timeMs: 0,
    moves: 0,
    mistakes: 0,
    path: fastPath,
  });
  assert.equal(first.record.bestTimeMs, 0);
  assert.equal(first.isNewBest, true);

  const slower = applyLevelResult(first.progress, {
    levelId: 3,
    completed: true,
    hintsUsed: false,
    stars: 1,
    timeMs: 5_000,
    moves: 8,
    mistakes: 0,
    path: slowPath,
  });
  assert.equal(slower.record.bestTimeMs, 0);
  assert.equal(slower.record.bestMoves, 0);
  assert.equal(slower.isNewBest, false);
  assert.deepEqual(slower.record.bestPath, fastPath);
});

test("malformed ghost paths are ignored", () => {
  const applied = applyLevelResult(createEmptyProgress(), {
    levelId: 7,
    completed: true,
    hintsUsed: false,
    stars: 3,
    timeMs: 15_000,
    moves: 9,
    mistakes: 0,
    path: [{ x: 0, y: 0 }, { x: Number.NaN, y: 1 }],
  });
  assert.equal(getLevelRecord(applied.progress, 7)?.bestPath, null);
});

test("a malformed faster run does not erase the previous ghost", () => {
  const validPath = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
  const first = applyLevelResult(createEmptyProgress(), {
    levelId: 7,
    completed: true,
    hintsUsed: false,
    stars: 2,
    timeMs: 20_000,
    moves: 2,
    mistakes: 0,
    path: validPath,
  });

  const fasterButBroken = applyLevelResult(first.progress, {
    levelId: 7,
    completed: true,
    hintsUsed: false,
    stars: 3,
    timeMs: 10_000,
    moves: 2,
    mistakes: 0,
    path: [{ x: 0, y: 0 }, { x: Number.NaN, y: 1 }],
  });

  assert.equal(fasterButBroken.record.bestTimeMs, 10_000);
  assert.deepEqual(fasterButBroken.record.bestPath, validPath);
});

test("a negative or oversized result is clamped before it is stored", () => {
  const applied = applyLevelResult(createEmptyProgress(), {
    levelId: 2,
    completed: true,
    hintsUsed: false,
    stars: 9,
    timeMs: -50,
    moves: -2,
    mistakes: -1,
    score: -100,
  });

  assert.equal(applied.record.stars, 3);
  assert.equal(applied.record.bestTimeMs, 0);
  assert.equal(applied.record.bestMoves, 0);
  assert.equal(applied.record.bestMistakes, 0);
  assert.equal(applied.record.bestScore, 0);
});

test("total score sums the best score of every level", () => {
  let progress = createEmptyProgress();
  for (const [levelId, score] of [[1, 1_500], [2, 2_100]] as const) {
    progress = applyLevelResult(progress, {
      levelId,
      completed: true,
      hintsUsed: false,
      stars: 3,
      timeMs: 20_000,
      moves: 10,
      mistakes: 0,
      score,
    }).progress;
  }

  assert.equal(getTotalScore(progress), 3_600);
  assert.equal(getTotalScore(createEmptyProgress()), 0);
});

test("continue resumes an uncompleted level before advancing", () => {
  const progress = createEmptyProgress();
  progress.completed = [1, 2, 3];
  progress.lastLevelId = 3;
  assert.equal(getContinueLevel(progress), 4);

  progress.lastLevelId = 7;
  assert.equal(getContinueLevel(progress), 7);

  progress.completed = Array.from({ length: 200 }, (_, index) => index + 1);
  progress.lastLevelId = 200;
  assert.equal(getContinueLevel(progress), 200);
});

test("total stars sum every record", () => {
  let progress = createEmptyProgress();
  for (const levelId of [1, 2, 3]) {
    progress = applyLevelResult(progress, {
      levelId,
      completed: true,
      hintsUsed: false,
      stars: levelId === 2 ? 2 : 3,
      timeMs: 20_000,
      moves: 10,
      mistakes: 0,
    }).progress;
  }
  assert.equal(getTotalStars(progress), 8);
});
