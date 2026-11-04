import assert from "node:assert/strict";
import test from "node:test";

import { getDateKey, shiftDateKey } from "../client/src/lib/daily";
import { getWeekKey } from "../client/src/lib/weekly";
import {
  buildChallengeLevel,
  CHALLENGE_POOL_SIZE,
  challengeParMs,
  challengeScore,
  getChallengeSpec,
  UNIQUE_LEVEL_IDS,
} from "./challenges";
import { countSolutions } from "./solver";
import { createMoveRules, getLevelMechanics } from "./mechanics";

test("challenge boards come from the unique-solution pool", () => {
  assert.equal(CHALLENGE_POOL_SIZE, UNIQUE_LEVEL_IDS.length * 4);
  for (const id of UNIQUE_LEVEL_IDS) {
    const spec = { kind: "daily" as const, key: "2026-11-03", levelId: id, variant: 0, slot: 0 };
    const built = buildChallengeLevel(spec);
    assert.equal(countSolutions(built.level, { cap: 2 }).count, 1, `level ${id} should be unique`);
  }
});

test("a daily board never repeats inside the pool and stays inside a readable size", () => {
  const seen = new Set<string>();
  let day = "2026-11-03";
  for (let i = 0; i < CHALLENGE_POOL_SIZE; i++) {
    const spec = getChallengeSpec("daily", day);
    const signature = `${spec.levelId}:${spec.variant}`;
    assert.ok(!seen.has(signature), `board repeated on day ${i} (${day})`);
    seen.add(signature);
    const built = buildChallengeLevel(spec);
    assert.ok(built.level.nodes.length >= 5 && built.level.nodes.length <= 40);
    assert.ok(built.parMs > 0);
    day = shiftDateKey(day, 1);
  }
  // The next day starts the cycle over, but never before the pool is exhausted.
  assert.equal(seen.size, CHALLENGE_POOL_SIZE);
});

test("weekly specs are deterministic across timezones and separate from daily", () => {
  const key = "2026-W45";
  const a = getChallengeSpec("weekly", key);
  const b = getChallengeSpec("weekly", key);
  assert.deepEqual(a, b);
  assert.equal(a.kind, "weekly");
  assert.notDeepEqual(a, getChallengeSpec("daily", key));
});

test("rotations and mirrors keep the built board solvable", () => {
  const key = getDateKey(new Date(2026, 10, 3));
  for (let variant = 0; variant < 4; variant++) {
    const spec = { kind: "daily" as const, key, levelId: UNIQUE_LEVEL_IDS[0], variant, slot: 0 };
    for (const mirrored of [false, true]) {
      const built = buildChallengeLevel(spec, { mirrored });
      const mechanics = getLevelMechanics(built.level, built.solution);
      const rules = createMoveRules(built.level, mechanics);
      let path = [built.solution[0]];
      for (let i = 1; i < built.solution.length; i++) {
        const next = rules.step(path, built.solution[i]);
        assert.ok(next, `variant ${variant} mirrored=${mirrored} broke at step ${i}`);
        path = next!;
      }
      assert.equal(rules.isComplete(path), true);
    }
  }
});

test("the pace score is normalised against par so small and large boards compare", () => {
  assert.equal(challengeScore(30_000, 30_000), 1000);
  assert.ok(challengeScore(15_000, 30_000) > challengeScore(30_000, 30_000));
  assert.ok(challengeScore(60_000, 60_000) === challengeScore(30_000, 30_000));
  assert.equal(challengeScore(0, 30_000), 0);
});

test("par time reflects the solver's difficulty, not just the node count", () => {
  const spec = { kind: "daily" as const, key: "2026-11-03", levelId: 1, variant: 0, slot: 0 };
  const built = buildChallengeLevel(spec);
  assert.ok(built.difficulty >= 0 && built.difficulty <= 100);
  assert.ok(built.parMs >= challengeParMs(built.level.nodes.length));
  assert.equal(buildChallengeLevel(spec).difficulty, built.difficulty, "difficulty is deterministic");
  const hard = buildChallengeLevel({ ...spec, levelId: 80 });
  assert.ok(hard.parMs > built.parMs, "a larger board still has a longer par");
});

test("week keys parse without relying on the local clock", () => {
  assert.match(getWeekKey(new Date(2026, 10, 3)), /^\d{4}-W\d{2}$/);
  assert.ok(getChallengeSpec("weekly", "2026-W45").slot >= 0);
});
