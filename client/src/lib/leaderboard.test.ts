import assert from "node:assert/strict";
import test from "node:test";

import { isValidName } from "./leaderboard";

test("public names follow the same rule as the server", () => {
  assert.equal(isValidName("Neo"), true);
  assert.equal(isValidName("  Åsa  Öberg "), true);
  assert.equal(isValidName("ab"), false);
  assert.equal(isValidName("a".repeat(17)), false);
  assert.equal(isValidName("evil@site.com"), false);
});
