import assert from "node:assert/strict";
import test from "node:test";

import { getBrainRank } from "./rank";

test("rank starts at novice and only moves up with stars", () => {
  assert.equal(getBrainRank(0).key, "rank0");
  assert.equal(getBrainRank(29).key, "rank0");
  assert.equal(getBrainRank(30).key, "rank1");
  assert.equal(getBrainRank(899).key, "rank6");
  let previous = -1;
  for (let stars = 0; stars <= 900; stars++) {
    const { tier } = getBrainRank(stars);
    assert.ok(tier >= previous, `rank dropped at ${stars} stars`);
    previous = tier;
  }
});

test("stars to the next rank counts down and ends at the top", () => {
  assert.equal(getBrainRank(0).starsToNext, 30);
  assert.equal(getBrainRank(29).starsToNext, 1);
  assert.equal(getBrainRank(850).starsToNext, null);
});

test("bad input never breaks the rank", () => {
  assert.equal(getBrainRank(Number.NaN).key, "rank0");
  assert.equal(getBrainRank(-5).key, "rank0");
});
