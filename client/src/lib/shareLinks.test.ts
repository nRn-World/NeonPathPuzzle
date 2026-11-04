import assert from "node:assert/strict";
import test from "node:test";

import { absoluteHashUrl, labRoute, rivalRoute } from "./shareLinks";

test("share routes are URL-safe and keep the code intact", () => {
  assert.equal(labRoute("Ab3_-x"), "/lab/Ab3_-x");
  assert.equal(rivalRoute("Qw1_-y"), "/rival/Qw1_-y");
  assert.equal(labRoute("a/b"), "/lab/a%2Fb");
});

test("absolute URLs replace any previous hash so links open the right screen", () => {
  const code = "Ab3_-x";
  assert.equal(absoluteHashUrl(labRoute(code)), `#/lab/${code}`, "no window (SSR/tests)");
});
