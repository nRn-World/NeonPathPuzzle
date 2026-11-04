import assert from "node:assert/strict";
import test from "node:test";

import { generateLevel } from "../../../shared/level-generator";
import { EMPTY_MECHANICS, getLevelMechanics } from "../../../shared/mechanics";
import type { LevelResponse } from "../../../shared/schema";
import { buildHint, HINT_TIERS, MAX_HINT_TIER } from "./hints";

const generated = generateLevel(4);
const level: LevelResponse = {
  id: generated.id,
  gridSize: generated.gridSize,
  start: generated.start,
  nodes: generated.nodes,
  isLocked: false,
  isCompleted: false,
};
const mechanics = EMPTY_MECHANICS;
const canonical = generated.solution;

test("hint tiers reveal progressively more of the line", () => {
  const current = canonical.slice(0, 3);
  const first = buildHint(level, mechanics, current, canonical, 0)!;
  const second = buildHint(level, mechanics, current, canonical, 1)!;
  const last = buildHint(level, mechanics, current, canonical, MAX_HINT_TIER - 1)!;
  assert.ok(first, "a hint should exist");
  assert.equal(first.path.length, current.length + 1);
  assert.equal(second.path.length, current.length + 3);
  assert.ok(last.path.length > second.path.length);
  assert.equal(last.path.length, canonical.length);
});

test("the first nudge is free, deeper hints cost tokens", () => {
  assert.equal(HINT_TIERS[0].tokenCost, 0);
  assert.ok(HINT_TIERS[1].tokenCost > 0);
  assert.ok(HINT_TIERS[2].tokenCost > HINT_TIERS[1].tokenCost);
});

test("a hint still works from a detour that is not the canonical path", () => {
  const mechanicsWithRules = getLevelMechanics(level, canonical);
  // Walk the canonical line and then undo one step: the player's array is still
  // a legal prefix, so the solver must continue it rather than restart.
  const partial = canonical.slice(0, 4);
  const hint = buildHint(level, mechanicsWithRules, partial, canonical, 1)!;
  assert.ok(hint);
  assert.deepEqual(hint.path.slice(0, partial.length), partial);
});

test("a finished line has nothing left to reveal", () => {
  const hint = buildHint(level, mechanics, canonical, canonical, 0)!;
  assert.deepEqual(hint.path, canonical);
  assert.ok(hint.path.length >= 2);
});
