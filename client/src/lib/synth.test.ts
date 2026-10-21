import assert from "node:assert/strict";
import test from "node:test";

import { STEP_SCALE, createSynth, stepFrequency } from "./synth";

type ParamEvent = { type: string; value: number; time: number };

class FakeParam {
  value = 0;
  events: ParamEvent[] = [];

  setValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: "set", value, time });
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: "exponential", value, time });
    return this;
  }

  linearRampToValueAtTime(value: number, time: number) {
    this.value = value;
    this.events.push({ type: "linear", value, time });
    return this;
  }

  setTargetAtTime(value: number, time: number, constant: number) {
    this.value = value;
    this.events.push({ type: "target", value, time });
    this.events.push({ type: "target-constant", value: constant, time });
    return this;
  }

  cancelScheduledValues(time: number) {
    this.events = this.events.filter(event => event.time < time);
    return this;
  }
}

class FakeNode {
  connections: unknown[] = [];
  disconnected = 0;

  constructor(public kind: string) {}

  connect(target: unknown) {
    this.connections.push(target);
    return target;
  }

  disconnect() {
    this.disconnected += 1;
    this.connections = [];
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam();

  constructor() {
    super("gain");
  }
}

class FakeOscillator extends FakeNode {
  type = "sine";
  frequency = new FakeParam();
  detune = new FakeParam();
  onended: (() => void) | null = null;
  startedAt: number | null = null;
  stoppedAt: number | null = null;

  constructor() {
    super("oscillator");
  }

  start(time = 0) {
    this.startedAt = time;
  }

  stop(time = 0) {
    this.stoppedAt = time;
  }
}

function createFakeContext() {
  const oscillators: FakeOscillator[] = [];
  const gains: FakeGain[] = [];
  let time = 0;

  const context = {
    get currentTime() {
      return time;
    },
    state: "running",
    destination: new FakeNode("destination"),
    resume: async () => undefined,
    createGain: () => {
      const gain = new FakeGain();
      gains.push(gain);
      return gain;
    },
    createOscillator: () => {
      const oscillator = new FakeOscillator();
      oscillators.push(oscillator);
      return oscillator;
    },
  };

  return {
    ctx: context as unknown as AudioContext,
    oscillators,
    gains,
  };
}

test("step pitch climbs with coverage and stays inside the scale", () => {
  const low = stepFrequency(0);
  const mid = stepFrequency(0.5);
  const high = stepFrequency(1);
  assert.ok(low < mid && mid < high, "pitch should rise with progress");
  assert.ok(Math.abs(low - 329.63) < 0.01, "a fresh level starts on the root note");
  const topSemitones = STEP_SCALE[STEP_SCALE.length - 1];
  assert.ok(high <= 329.63 * Math.pow(2, topSemitones / 12) + 0.01);
});

test("step pitch is clamped for out-of-range coverage", () => {
  assert.equal(stepFrequency(-4), stepFrequency(0));
  assert.equal(stepFrequency(9), stepFrequency(1));
  assert.equal(stepFrequency(Number.NaN), stepFrequency(0));
});

test("a move plays one soft, click-free triangle note", () => {
  const fake = createFakeContext();
  const synth = createSynth(fake.ctx, { volume: 0.5 });

  synth.playStep(0.5);

  const note = fake.oscillators.at(-1);
  assert.ok(note, "a note should be created");
  assert.equal(note.type, "triangle");
  assert.ok(note.stoppedAt !== null && note.startedAt !== null);
  assert.ok(note.stoppedAt! > note.startedAt!);

  const envelope = fake.gains.at(-1)!.gain.events;
  assert.equal(envelope[0].type, "set");
  assert.ok(envelope[0].value <= 0.001, "starts from near silence to avoid a click");
  assert.ok(envelope.some(event => event.type === "exponential" && event.value > 0.01));
  assert.ok(envelope.at(-1)!.value <= 0.001, "decays back to silence");
});

test("winning plays an ascending arpeggio", () => {
  const fake = createFakeContext();
  const synth = createSynth(fake.ctx);

  synth.playWin();

  const frequencies = fake.oscillators
    .filter(oscillator => oscillator.type === "triangle")
    .map(oscillator => oscillator.frequency.events[0].value);
  assert.equal(frequencies.length, 5);
  assert.deepEqual(frequencies, [...frequencies].sort((a, b) => a - b));
  assert.equal(new Set(frequencies).size, 5);
});

test("dispose releases the master bus", () => {
  const fake = createFakeContext();
  const synth = createSynth(fake.ctx);

  synth.dispose();

  assert.ok(fake.gains[0].disconnected > 0, "master gain is disconnected from the destination");
});

test("a crash falls in pitch and ends on a sub thud", () => {
  const fake = createFakeContext();
  const synth = createSynth(fake.ctx);

  synth.playCrash();

  const frequencies = fake.oscillators.map(oscillator => oscillator.frequency.events[0].value);
  const fall = frequencies.slice(0, -1);
  assert.deepEqual(fall, [...fall].sort((a, b) => b - a), "the sawtooth notes descend");
  assert.equal(frequencies.at(-1), 55);
});
