import assert from "node:assert/strict";
import test from "node:test";

import {
  CHAIN_MAX_GRID,
  CHAIN_MAX_WALL_SHARE,
  gridSizeForChain,
  generateChainBoard,
  isValidChainBoard,
  nodeCountFor,
  type ChainBoard,
} from "./chain";

/** Seeded PRNG (mulberry32) so every run tests the same boards. */
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("the grid grows slowly from 4x4 to 7x7", () => {
  assert.equal(gridSizeForChain(1), 4);
  assert.equal(gridSizeForChain(3), 4);
  assert.equal(gridSizeForChain(4), 5);
  assert.equal(gridSizeForChain(10), 7);
  assert.equal(gridSizeForChain(500), CHAIN_MAX_GRID);
  assert.equal(gridSizeForChain(Number.NaN), 4);
});

test("every chain board is solvable and keeps walls off the line", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const random = rng(seed);
    let previous: { path: ChainBoard["solution"]; gridSize: number } | null = null;
    for (let chain = 1; chain <= 40; chain++) {
      const board = generateChainBoard(chain, previous, random);
      assert.equal(board.gridSize, gridSizeForChain(chain));
      assert.equal(board.nodes.length, nodeCountFor(board.gridSize));
      assert.ok(isValidChainBoard(board), `invalid board seed=${seed} chain=${chain}`);
      assert.ok(
        board.walls.length <= Math.floor(board.gridSize * board.gridSize * CHAIN_MAX_WALL_SHARE),
        "walls exceed the cap",
      );
      previous = { path: board.solution, gridSize: board.gridSize };
    }
  }
});

test("the first board has no walls and a previous line becomes walls", () => {
  const first = generateChainBoard(1, null, rng(7));
  assert.equal(first.walls.length, 0);
  assert.equal(first.droppedWalls, 0);

  const second = generateChainBoard(2, { path: first.solution, gridSize: first.gridSize }, rng(7));
  assert.ok(second.walls.length > 0);
  assert.ok(isValidChainBoard(second));
});

test("a dense previous line still gives a valid board, with walls dropped if needed", () => {
  const dense = generateChainBoard(1, null, rng(3));
  const previous = { path: dense.solution, gridSize: 4 };
  const board = generateChainBoard(1, previous, rng(11));
  assert.ok(isValidChainBoard(board));
  assert.ok(board.droppedWalls >= 0);
});

test("the validator rejects a broken line", () => {
  const board = generateChainBoard(1, null, rng(5));
  const broken: ChainBoard = { ...board, solution: [...board.solution].reverse() };
  assert.equal(isValidChainBoard(broken), false);
});
