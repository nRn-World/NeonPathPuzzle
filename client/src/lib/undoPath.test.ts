import assert from "node:assert/strict";
import test from "node:test";

import type { PortalPair } from "@shared/mechanics";

import { undoLastStep } from "./undoPath";

const portals: PortalPair[] = [{ a: { x: 2, y: 1 }, b: { x: 5, y: 4 } }];

test("a normal step is undone one point at a time", () => {
  const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
  assert.deepEqual(undoLastStep(path, []), [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
});

test("a portal hop is undone as one action", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 1 },
    { x: 5, y: 4 },
  ];
  assert.deepEqual(undoLastStep(path, portals), [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
});

test("a portal hop is undone in either direction", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 6, y: 4 },
    { x: 5, y: 4 },
    { x: 2, y: 1 },
  ];
  assert.deepEqual(undoLastStep(path, portals), [{ x: 0, y: 0 }, { x: 6, y: 4 }]);
});

test("a step onto a pad without teleporting only removes that step", () => {
  const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }];
  assert.deepEqual(undoLastStep(path, portals), [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
});

test("the start point is never removed", () => {
  const path = [{ x: 0, y: 0 }];
  assert.deepEqual(undoLastStep(path, portals), [{ x: 0, y: 0 }]);
});
