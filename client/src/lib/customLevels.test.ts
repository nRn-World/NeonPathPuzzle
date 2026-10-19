import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeCustomLevel,
  deleteCustomLevel,
  encodeCustomLevel,
  getSavedCustomLevels,
  saveCustomLevel,
} from "./customLevels";

const path = [
  { x: 0, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: 2 },
  { x: 1, y: 2 },
  { x: 2, y: 2 },
];

test("a drawn path round-trips through a shareable code", () => {
  const encoded = encodeCustomLevel({ name: "  My circuit  ", gridSize: 3, path });
  assert.equal(encoded.ok, true);
  if (!encoded.ok) return;

  const decoded = decodeCustomLevel(encoded.level.code);
  assert.equal(decoded.ok, true);
  if (!decoded.ok) return;

  assert.equal(decoded.level.data.name, "My circuit");
  assert.equal(decoded.level.data.gridSize, 3);
  assert.deepEqual(decoded.level.data.nodes, path);
  assert.deepEqual(decoded.level.data.start, path[0]);
});

test("invalid drawings are rejected before a code is made", () => {
  const cases = [
    [{ name: "short", gridSize: 4, path: path.slice(0, 2) }, "Draw at least three nodes."],
    [{ name: "jump", gridSize: 4, path: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }] }, "Every node must touch the previous one."],
    [{ name: "repeat", gridSize: 4, path: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 0 }] }, "The path crosses itself."],
    [{ name: "outside", gridSize: 3, path: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 4, y: 1 }] }, "A node is outside the grid."],
    [{ name: "grid", gridSize: 11, path }, "Grid size must be 3-10."],
  ] as const;

  for (const [input, error] of cases) {
    const encoded = encodeCustomLevel(input);
    assert.equal(encoded.ok, false);
    if (!encoded.ok) assert.equal(encoded.error, error);
  }
});

test("garbage codes fail gracefully", () => {
  for (const code of ["", "not-a-code", "e30", "W10"]) {
    const decoded = decodeCustomLevel(code);
    assert.equal(decoded.ok, false);
  }
});

test("saved custom levels can be listed and deleted", () => {
  const encoded = encodeCustomLevel({ name: "Saved one", gridSize: 3, path });
  assert.equal(encoded.ok, true);
  if (!encoded.ok) return;

  saveCustomLevel(encoded.level);
  const saved = getSavedCustomLevels();
  const entry = saved.find(item => item.code === encoded.level.code);
  assert.ok(entry);
  assert.equal(entry?.nodeCount, path.length);

  const remaining = deleteCustomLevel(encoded.level.code);
  assert.equal(remaining.some(item => item.code === encoded.level.code), false);
});
