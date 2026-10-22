import assert from "node:assert/strict";
import test from "node:test";

import { countRiftCleared, mergeRiftResult } from "./riftProgress";

test("a worse run never overwrites a better Rift record", () => {
  let progress = mergeRiftResult({}, 301, 3, 9000);
  progress = mergeRiftResult(progress, 301, 1, 20000);
  assert.deepEqual(progress["301"], { stars: 3, bestTimeMs: 9000 });
  progress = mergeRiftResult(progress, 301, 2, 7000);
  assert.deepEqual(progress["301"], { stars: 3, bestTimeMs: 7000 });
});

test("cleared levels are counted per level", () => {
  const progress = mergeRiftResult(mergeRiftResult({}, 301, 1, 100), 302, 2, 100);
  assert.equal(countRiftCleared(progress), 2);
});
