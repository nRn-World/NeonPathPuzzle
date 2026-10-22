import assert from "node:assert/strict";
import test from "node:test";

import { generateLevel } from "./level-generator";
import {
  createMoveRules,
  EMPTY_MECHANICS,
  getLevelMechanics,
  isValidPlayerPath,
  mirrorLevel,
} from "./mechanics";

const key = (point: { x: number; y: number }) => `${point.x},${point.y}`;

test("all 300 levels keep their canonical solution valid with mechanics", () => {
  for (let levelId = 1; levelId <= 300; levelId++) {
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

    const pairEndpoints = new Set<string>();
    for (const pair of mechanics.pairs) {
      const first = solutionOrder.get(key(pair.first));
      const second = solutionOrder.get(key(pair.second));
      assert.notEqual(first, undefined, `level ${levelId}: pair start is not on the solution`);
      assert.notEqual(second, undefined, `level ${levelId}: pair end is not on the solution`);
      assert.ok((first ?? 0) < (second ?? 0), `level ${levelId}: pair order contradicts the solution`);
      for (const endpoint of [pair.first, pair.second]) {
        assert.equal(
          pairEndpoints.has(key(endpoint)),
          false,
          `level ${levelId}: one node carries two pair rings`,
        );
        pairEndpoints.add(key(endpoint));
      }
    }

    for (const portal of mechanics.portals) {
      assert.equal(nodeKeys.has(key(portal.a)), false, `level ${levelId}: portal sits on a node`);
      assert.equal(nodeKeys.has(key(portal.b)), false, `level ${levelId}: portal sits on a node`);
      assert.notEqual(key(portal.a), key(portal.b));
      assert.equal(solutionOrder.has(key(portal.a)), false);
      assert.equal(solutionOrder.has(key(portal.b)), false);
    }

    assert.equal(mechanics.isBoss, levelId % 25 === 0);
    assert.equal(
      isValidPlayerPath(level.solution, level, mechanics),
      true,
      `level ${levelId}: the canonical solution must validate as a played path`,
    );
    assert.deepEqual(getLevelMechanics(level, level.solution), mechanics, "mechanics must be deterministic");
  }
});

test("a played path may use a portal, but only with its twin", () => {
  const level = {
    id: 1,
    gridSize: 5,
    start: { x: 0, y: 0 },
    nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 4, y: 0 }],
  };
  const mechanics = {
    ...EMPTY_MECHANICS,
    portals: [{ a: { x: 1, y: 1 }, b: { x: 4, y: 1 } }],
  };

  assert.equal(
    isValidPlayerPath(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 0 }],
      level,
      mechanics,
    ),
    true,
  );

  assert.equal(
    isValidPlayerPath(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 4, y: 0 }],
      level,
      mechanics,
    ),
    false,
    "stepping onto a pad without its twin is not a valid recording",
  );

  assert.equal(
    isValidPlayerPath(
      [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 0 }, { x: 4, y: 1 }],
      level,
      mechanics,
    ),
    false,
    "a path may not visit a cell twice",
  );

  assert.equal(
    isValidPlayerPath([{ x: 0, y: 0 }, { x: 1, y: 0 }], level, mechanics),
    false,
    "a path that misses a node is not a finished run",
  );
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

test("every level can be finished by playing its solution through the real move rules", () => {
  for (let levelId = 1; levelId <= 300; levelId++) {
    const level = generateLevel(levelId);
    const mechanics = getLevelMechanics(level, level.solution);
    const rules = createMoveRules(level, mechanics);
    let path = [level.solution[0]];
    for (const point of level.solution.slice(1)) {
      const next = rules.step(path, point);
      assert.ok(next, `level ${levelId}: solution step to ${key(point)} is rejected`);
      path = next;
      assert.ok(!rules.isStuck(path), `level ${levelId}: solution walks into a dead end`);
    }
    assert.ok(rules.isComplete(path), `level ${levelId}: solution does not finish the board`);
  }
});

test("expansion levels add sync nodes and blackout", () => {
  const sync = getLevelMechanics(generateLevel(230), generateLevel(230).solution);
  assert.equal(sync.syncNodes.length, 3);
  assert.equal(sync.blackout, false);
  const dark = getLevelMechanics(generateLevel(280), generateLevel(280).solution);
  assert.equal(dark.blackout, true);
  assert.ok(dark.syncNodes.length >= 3);
  assert.deepEqual(getLevelMechanics(generateLevel(150), generateLevel(150).solution).syncNodes, []);
});

test("a sync node rejects arriving on the wrong step", () => {
  const level = generateLevel(210);
  const mechanics = getLevelMechanics(level, level.solution);
  const [sync] = mechanics.syncNodes;
  assert.ok(sync);
  const rules = createMoveRules(level, { ...EMPTY_MECHANICS, syncNodes: [{ ...sync, step: sync.step + 1 }] });
  const before = level.solution.slice(0, sync.step);
  assert.equal(rules.step(before, sync.point), null);
});

test("a line with no legal forward move is stuck, a finished one is not", () => {
  const level = {
    id: 1,
    gridSize: 3,
    start: { x: 1, y: 0 },
    nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }],
  };
  const rules = createMoveRules(level, EMPTY_MECHANICS);
  const stuck = rules.step([level.start], { x: 0, y: 0 });
  assert.ok(stuck);
  assert.equal(rules.isStuck(stuck), true);
  assert.equal(rules.isStuck([level.start]), false);
});

test("every Rift level (301-330) is solvable through the real move rules", () => {
  for (let levelId = 301; levelId <= 330; levelId++) {
    const level = generateLevel(levelId);
    const mechanics = getLevelMechanics(level, level.solution);
    const rules = createMoveRules(level, mechanics);
    let path = [level.solution[0]];
    for (const point of level.solution.slice(1)) {
      const next = rules.step(path, point);
      assert.ok(next, `Rift level ${levelId}: solution step to ${key(point)} is rejected`);
      path = next;
      assert.ok(!rules.isStuck(path), `Rift level ${levelId}: solution walks into a dead end`);
    }
    assert.ok(rules.isComplete(path), `Rift level ${levelId}: solution does not finish the board`);
    assert.ok(mechanics.phaseNodes.length >= 3, `Rift level ${levelId}: phase nodes missing`);
    assert.equal(mechanics.flipArrows.length > 0, levelId >= 316, `Rift level ${levelId}: flip arrows only from 316`);
    assert.equal(mechanics.blackout, levelId >= 316);
  }
});

test("a phase node rejects the wrong parity and a flip arrow reverses with it", () => {
  const level = generateLevel(320);
  const mechanics = getLevelMechanics(level, level.solution);
  const phase = mechanics.phaseNodes[0];
  const step = level.solution.findIndex(point => key(point) === key(phase.point));
  const before = level.solution.slice(0, step);
  const rules = createMoveRules(level, { ...EMPTY_MECHANICS, phaseNodes: [phase] });
  assert.ok(rules.step(before, phase.point), "the right parity enters");
  const wrong = createMoveRules(level, { ...EMPTY_MECHANICS, phaseNodes: [{ ...phase, parity: (1 - phase.parity) as 0 | 1 }] });
  assert.equal(wrong.step(before, phase.point), null, "the other parity is refused");

  const flip = mechanics.flipArrows[0];
  const at = level.solution.findIndex(point => key(point) === key(flip.point));
  const head = level.solution.slice(0, at + 1);
  const next = level.solution[at + 1];
  assert.ok(createMoveRules(level, { ...EMPTY_MECHANICS, flipArrows: [flip] }).step(head, next), "the marked way is open");
  const reversed = createMoveRules(level, { ...EMPTY_MECHANICS, flipArrows: [{ ...flip, parity: (1 - flip.parity) as 0 | 1 }] });
  assert.equal(reversed.step(head, next), null, "the marked way closes on the other parity");
});
