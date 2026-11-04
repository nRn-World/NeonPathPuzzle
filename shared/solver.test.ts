import assert from "node:assert/strict";
import test from "node:test";

import { generateLevel } from "./level-generator";
import { EMPTY_MECHANICS, createMoveRules } from "./mechanics";
import { countSolutions, findCompletion, hasUniqueSolution, solveStats } from "./solver";

test("the solver finds the canonical solution of every built board", () => {
  for (let id = 1; id <= 30; id++) {
    const level = generateLevel(id);
    const result = countSolutions(level, { cap: 3, budget: 300_000 });
    assert.ok(result.count >= 1, `level ${id} has no solution`);
    assert.ok(!result.incomplete, `level ${id} search hit its budget`);
  }
});

test("tutorial boards have exactly one solution", () => {
  // A first puzzle with two different answers teaches the wrong lesson.
  assert.equal(hasUniqueSolution(generateLevel(1)), true);
  assert.equal(hasUniqueSolution(generateLevel(2)), true);
});

test("solveStats reports both the solution count and the search effort", () => {
  const stats = solveStats(generateLevel(4));
  assert.ok(stats.count >= 1);
  assert.ok(stats.expanded > 0);
});

test("findCompletion continues a partially drawn line through the real move rules", () => {
  const level = generateLevel(4);
  const partial = level.solution.slice(0, 3);
  const completed = findCompletion(level, EMPTY_MECHANICS, partial);
  assert.ok(completed, "a completion should exist from a correct prefix");
  assert.deepEqual(completed!.slice(0, 3), partial);
  const rules = createMoveRules(level, EMPTY_MECHANICS);
  assert.equal(rules.isComplete(completed!), true);
  assert.equal(completed!.length, level.nodes.length);
});

test("findCompletion refuses an impossible line", () => {
  const level = generateLevel(1);
  assert.equal(findCompletion(level, EMPTY_MECHANICS, []), null);
});
