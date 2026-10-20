import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  generateLevelCode,
  getLevelFromCode,
  MAX_CODED_LEVEL,
  MIN_CODED_LEVEL,
} from "./levelCodes";

test("levels 10-300 have unique permanent four-digit codes", () => {
  const codes = Array.from(
    { length: MAX_CODED_LEVEL - MIN_CODED_LEVEL + 1 },
    (_, index) => generateLevelCode(index + MIN_CODED_LEVEL),
  );

  assert.equal(codes.length, 291);
  assert.equal(new Set(codes).size, 291);
  codes.forEach((code) => assert.match(code, /^\d{4}$/));

  // The hash covers the codes released before the expansion (levels 10-200).
  const contractHash = createHash("sha256")
    .update(codes.slice(0, 191).join(","))
    .digest("hex");
  assert.equal(
    contractHash,
    "f429c0efe380140060a04e0f9d262865c0c16176a924debf2600faeae7e242b7",
    "The public level-code mapping changed. Existing player codes must never change.",
  );
});

test("every permanent code resolves to its original level", () => {
  for (let levelId = MIN_CODED_LEVEL; levelId <= MAX_CODED_LEVEL; levelId++) {
    assert.equal(getLevelFromCode(generateLevelCode(levelId)), levelId);
  }
});

test("previously released codes remain unchanged", () => {
  assert.equal(generateLevelCode(10), "9730");
  assert.equal(generateLevelCode(30), "9190");
  assert.equal(generateLevelCode(100), "7300");
  assert.equal(generateLevelCode(110), "7030");
  assert.equal(generateLevelCode(200), "4600");
});

test("levels 1-9 have no code and Level 10 is the first coded level", () => {
  for (let levelId = 1; levelId < MIN_CODED_LEVEL; levelId++) {
    assert.equal(generateLevelCode(levelId), "");
  }
  assert.equal(generateLevelCode(10), "9730");
  assert.equal(generateLevelCode(101), "7273");
  assert.equal(generateLevelCode(109), "7057");
});

test("invalid levels and malformed codes are rejected", () => {
  assert.equal(generateLevelCode(0), "");
  assert.equal(generateLevelCode(301), "");
  assert.equal(generateLevelCode(1.5), "");
  assert.equal(getLevelFromCode("123"), null);
  assert.equal(getLevelFromCode("abcd"), null);
});
