import assert from "node:assert/strict";
import test from "node:test";

import { generateLevel } from "./level-generator";
import { getLevelMechanics, mirrorLevel } from "./mechanics";

const key = (point: { x: number; y: number }) => `${point.x},${point.y}`;

test("all 200 levels keep their canonical solution valid with mechanics", () => {
  for (let levelId = 1; levelId <= 200; levelId++) {
    const level = generateLevel(levelId);
    const mechanics = getLevelMechanics(level, level.solution);

    const nodeKeys = new Set(level.nodes.map(key));
    const solutionOrder = new Map(level.solution.map((point, index) => [key(point), index]));

    for (const wall of mechanics.walls) {
      assert.equal(nodeKeys.has(key(wall)), false, `level ${levelId}: wall overlaps a node`);
    }

    for (const oneWay of mechanics.oneWays) {
      const index = solutionOrder.get(key(oneWay.point));
      assert.notEqual(index, undefined, `level ${levelId}: one-way node is not on the solution`);
      const next = level.solution[(index ?? 0) + 1];
      assert.ok(next, `level ${levelId}: one-way node has no next step`);
      assert.equal(Math.sign(next.x - oneWay.point.x), oneWay.dx);
      assert.equal(Math.sign(next.y - oneWay.point.y), oneWay.dy);
    }

    for (const pair of mechanics.pairs) {
      const first = solutionOrder.get(key(pair.first));
      const second = solutionOrder.get(key(pair.second));
      assert.notEqual(first, undefined, `level ${levelId}: pair start is not on the solution`);
      assert.notEqual(second, undefined, `level ${levelId}: pair end is not on the solution`);
      assert.ok((first ?? 0) < (second ?? 0), `level ${levelId}: pair order contradicts the solution`);
    }

    for (const portal of mechanics.portals) {
      assert.equal(nodeKeys.has(key(portal.a)), false, `level ${levelId}: portal sits on a node`);
      assert.equal(nodeKeys.has(key(portal.b)), false, `level ${levelId}: portal sits on a node`);
      assert.notEqual(key(portal.a), key(portal.b));
      assert.equal(solutionOrder.has(key(portal.a)), false);
      assert.equal(solutionOrder.has(key(portal.b)), false);
    }

    assert.equal(mechanics.isBoss, levelId % 25 === 0);
    assert.deepEqual(getLevelMechanics(level, level.solution), mechanics, "mechanics must be deterministic");
  }
});

test("mechanics only appear in the intended difficulty bands", () => {
  const early = getLevelMechanics(generateLevel(5), generateLevel(5).solution);
  assert.equal(early.walls.length, 0);
  assert.equal(early.oneWays.length, 0);
  assert.equal(early.pairs.length, 0);
  assert.equal(early.portals.length, 0);

  const late = getLevelMechanics(generateLevel(150), generateLevel(150).solution);
  assert.ok(late.walls.length > 0);
  assert.ok(late.oneWays.length > 0);
  assert.ok(late.pairs.length > 0);
});

test("mirroring keeps a level solvable", () => {
  for (const levelId of [1, 40, 120, 200]) {
    const level = generateLevel(levelId);
    const mirrored = mirrorLevel(level, level.solution);
    assert.deepEqual(new Set(mirrored.level.nodes.map(key)), new Set(mirrored.solution.map(key)));
    assert.deepEqual(mirrored.level.start, mirrored.solution[0]);
  }
});
