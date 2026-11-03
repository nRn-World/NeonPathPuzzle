import assert from "node:assert/strict";
import test from "node:test";

import { BASS_FROM, PULSE_FROM, layersFor, melodyFor } from "./melody";
import { STEP_SCALE } from "./synth";

const grid = (count: number, offset = 0) =>
  Array.from({ length: count }, (_, index) => ({ x: index + offset, y: (index * 3) % 5 }));

test("the same level always gets the same melody", () => {
  const nodes = grid(12);
  assert.deepEqual(melodyFor(nodes), melodyFor(grid(12)));
});

test("a different level gets a different melody", () => {
  assert.notDeepEqual(melodyFor(grid(12)), melodyFor(grid(12, 4)));
});

test("the melody has one note per node, stays in the scale and resolves on the tonic", () => {
  const nodes = grid(20);
  const melody = melodyFor(nodes);
  assert.equal(melody.length, nodes.length);
  for (const note of melody) assert.ok(STEP_SCALE.includes(note), `${note} is not in the scale`);
  assert.equal(melody.at(-1), 0);
});

test("the melody moves stepwise, never leaping more than a few scale degrees", () => {
  const melody = melodyFor(grid(40));
  for (let index = 1; index < melody.length - 1; index++) {
    const from = STEP_SCALE.indexOf(melody[index - 1]);
    const to = STEP_SCALE.indexOf(melody[index]);
    assert.ok(Math.abs(to - from) <= 2, `leap of ${Math.abs(to - from)} degrees at ${index}`);
  }
});

test("bass joins at 33 % coverage and pulse at 66 %", () => {
  assert.deepEqual(layersFor(0), { bass: false, pulse: false });
  assert.deepEqual(layersFor(BASS_FROM), { bass: true, pulse: false });
  assert.deepEqual(layersFor(PULSE_FROM), { bass: true, pulse: true });
});
