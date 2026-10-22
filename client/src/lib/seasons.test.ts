import assert from "node:assert/strict";
import test from "node:test";

import { applySeasonClear, getActiveSeason, SEASONS } from "./seasons";

test("seasons are found by calendar day, including the one that wraps the new year", () => {
  assert.equal(getActiveSeason(new Date(2026, 9, 22))?.season.id, "halloween");
  assert.equal(getActiveSeason(new Date(2026, 4, 10)), null);
  const winterEnd = getActiveSeason(new Date(2027, 0, 3));
  assert.equal(winterEnd?.season.id, "winter");
  assert.equal(winterEnd?.key, "winter-2026");
  assert.equal(winterEnd?.daysLeft, 3);
  assert.equal(getActiveSeason(new Date(2026, 11, 20))?.key, "winter-2026");
});

test("seasons never overlap", () => {
  for (let day = 0; day < 366; day++) {
    const date = new Date(2024, 0, 1 + day);
    const month = date.getMonth() + 1;
    const code = month * 100 + date.getDate();
    const hits = SEASONS.filter(season => {
      const from = season.from[0] * 100 + season.from[1];
      const to = season.to[0] * 100 + season.to[1];
      return from > to ? code >= from || code <= to : code >= from && code <= to;
    });
    assert.ok(hits.length <= 1, `overlap on ${date.toDateString()}`);
  }
});

test("the reward is earned once, after the goal of different levels", () => {
  const active = getActiveSeason(new Date(2026, 9, 22))!;
  let state = { progress: {}, claimed: [] as string[] };
  for (const level of [1, 1, 2, 3, 4]) {
    const result = applySeasonClear(state, active, level);
    assert.equal(result.justCompleted, false);
    state = result.state;
  }
  const done = applySeasonClear(state, active, 5);
  assert.equal(done.justCompleted, true);
  assert.deepEqual(done.state.claimed, ["halloween"]);
  assert.equal(applySeasonClear(done.state, active, 6).justCompleted, false);
});
