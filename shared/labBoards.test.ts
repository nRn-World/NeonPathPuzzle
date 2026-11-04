import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeLabBoard,
  decodeRivalRun,
  encodeLabBoard,
  encodeRivalRun,
  labBoardError,
  labBoardToLevel,
  type LabBoard,
} from "./labBoards";
import { countSolutions } from "./solver";

const BOARD: LabBoard = {
  gridSize: 3,
  start: { x: 2, y: 2 },
  nodes: [
    { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 },
    { x: 2, y: 1 }, { x: 2, y: 2 },
  ],
};

const PATH = [
  { x: 2, y: 2 }, { x: 2, y: 1 }, { x: 1, y: 1 },
  { x: 0, y: 1 }, { x: 0, y: 0 },
];

test("a board code round-trips through a URL-safe string", () => {
  const code = encodeLabBoard(BOARD);
  assert.ok(code.length > 0 && /^[A-Za-z0-9_-]+$/.test(code));
  const decoded = decodeLabBoard(code);
  assert.ok(decoded);
  assert.equal(decoded.gridSize, BOARD.gridSize);
  assert.deepEqual(decoded.start, BOARD.start);
  assert.deepEqual(decoded.nodes, BOARD.nodes);
});

test("a rival code carries the board, the drawn line and the time", () => {
  const code = encodeRivalRun({ board: BOARD, path: PATH, timeMs: 12_345 });
  assert.ok(code.length > 0);
  const run = decodeRivalRun(code);
  assert.ok(run);
  assert.deepEqual(run.board.nodes, BOARD.nodes);
  assert.deepEqual(run.path, PATH);
  assert.equal(run.timeMs, 12_345);
  assert.equal(decodeLabBoard(code), null, "a rival link must not be playable as a board");
});

test("tampered, truncated and wrong-kind codes are rejected", () => {
  const code = encodeLabBoard(BOARD);
  assert.equal(decodeLabBoard(`${code}A`), null);
  assert.equal(decodeLabBoard(code.slice(0, -2)), null);
  const flipped = `${code.slice(0, 1)}${code[1] === "A" ? "B" : "A"}${code.slice(2)}`;
  assert.equal(decodeLabBoard(flipped), null);
  assert.equal(decodeLabBoard(encodeRivalRun({ board: BOARD, path: PATH, timeMs: 1 })), null);
  assert.equal(decodeRivalRun(code), null);
});

test("invalid boards are refused before they can be encoded", () => {
  assert.equal(labBoardError({ ...BOARD, gridSize: 2 }), "grid");
  assert.equal(labBoardError({ ...BOARD, start: { x: 9, y: 9 } }), "start");
  assert.equal(labBoardError({ ...BOARD, nodes: BOARD.nodes.slice(0, 3) }), "nodes");
  assert.equal(labBoardError({ ...BOARD, nodes: [...BOARD.nodes, BOARD.nodes[0]] }), "duplicate");
  assert.equal(
    labBoardError({ ...BOARD, nodes: BOARD.nodes.filter(node => node.x !== 2 || node.y !== 2) }),
    "missingStart",
  );
  assert.equal(encodeLabBoard({ ...BOARD, gridSize: 99 }), "");
});

test("the decoded board is a real solvable puzzle shape", () => {
  const decoded = decodeLabBoard(encodeLabBoard(BOARD));
  assert.ok(decoded);
  const level = labBoardToLevel(decoded);
  assert.equal(level.nodes.length, 5);
  assert.equal(countSolutions(level, { cap: 2 }).count, 1);
});
