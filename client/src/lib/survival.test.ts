import assert from "node:assert/strict";
import test from "node:test";

import {
  SURVIVAL_START_HEARTS,
  SURVIVAL_UNDOS,
  bandForRound,
  comboMultiplier,
  levelIdForRound,
  roundTimeMs,
  scoreForClear,
} from "./survival";
import { GENERATOR_MAX_LEVEL_ID } from "@shared/level-generator";

test("the band widens every two rounds and never leaves the generator", () => {
  assert.equal(bandForRound(1), 1);
  assert.equal(bandForRound(2), 1);
  assert.equal(bandForRound(3), 2);
  assert.equal(bandForRound(4), 2);
  assert.equal(bandForRound(5), 3);
  assert.equal(bandForRound(9_999), 33);
});

test("every round draws a board the generator can actually build", () => {
  for (const round of [1, 2, 5, 20, 64, 200]) {
    for (const fraction of [0, 0.5, 0.999]) {
      const levelId = levelIdForRound(round, () => fraction);
      assert.ok(levelId >= 1, `round ${round} gave ${levelId}`);
      assert.ok(levelId <= GENERATOR_MAX_LEVEL_ID, `round ${round} gave ${levelId}`);
    }
  }
  // The last band must still land inside the generated range.
  assert.equal(levelIdForRound(9_999, () => 0.999), GENERATOR_MAX_LEVEL_ID);
});

test("the clock shrinks with the round but never drops below the floor", () => {
  const first = roundTimeMs(12, 1);
  const later = roundTimeMs(12, 10);
  assert.ok(later < first, "later rounds are tighter");
  assert.equal(roundTimeMs(2, 200), 12_000);
  assert.ok(roundTimeMs(60, 1) <= 48_000);
});

test("the combo climbs to a cap and payouts follow it", () => {
  assert.equal(comboMultiplier(0), 1);
  assert.equal(comboMultiplier(1), 1.25);
  assert.equal(comboMultiplier(50), 4);

  const plain = scoreForClear(3, 10_000, 0);
  const combed = scoreForClear(3, 10_000, 4);
  assert.ok(combed > plain);
  assert.ok(scoreForClear(3, 10_000, 0) > scoreForClear(3, 0, 0), "the clock pays");
  assert.equal(scoreForClear(1, Number.NaN, 0), scoreForClear(1, 0, 0));
});

test("a run starts with the documented resources", () => {
  assert.equal(SURVIVAL_START_HEARTS, 3);
  assert.equal(SURVIVAL_UNDOS, 1);
});
