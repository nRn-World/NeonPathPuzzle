import { STEP_SCALE } from "./synth";

/** Coverage at which the bass and the pulse layers join the melody. */
export const BASS_FROM = 0.33;
export const PULSE_FROM = 0.66;

export interface Point {
  x: number;
  y: number;
}

export function layersFor(coverage: number): { bass: boolean; pulse: boolean } {
  return { bass: coverage >= BASS_FROM, pulse: coverage >= PULSE_FROM };
}

/** Mulberry32: a tiny seeded PRNG, so the same level always gets the same tune. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function levelSeed(nodes: readonly Point[]): number {
  let hash = 2166136261 ^ nodes.length;
  for (const node of nodes) {
    hash = Math.imul(hash ^ node.x, 16777619);
    hash = Math.imul(hash ^ node.y, 16777619);
  }
  return hash >>> 0;
}

/** One cache per node array, keyed by the scale so chapters cannot share a tune by accident. */
const cache = new WeakMap<readonly Point[], Map<string, number[]>>();

/**
 * One melody note per node, as semitone offsets from the step root. The tune
 * walks stepwise through the scale and resolves on the tonic at the end.
 */
export function melodyFor(nodes: readonly Point[], scale: readonly number[] = STEP_SCALE): number[] {
  const scaleKey = scale.join(",");
  let perScale = cache.get(nodes);
  if (!perScale) {
    perScale = new Map<string, number[]>();
    cache.set(nodes, perScale);
  }
  const cached = perScale.get(scaleKey);
  if (cached) return cached;

  const random = seededRandom(levelSeed(nodes));
  const moves = [-2, -1, -1, 0, 1, 1, 2];
  const topDegree = 7;
  let degree = 2 + Math.floor(random() * 3);
  const degrees: number[] = [];
  for (let index = 0; index < Math.max(1, nodes.length); index++) {
    degrees.push(degree);
    degree = Math.min(topDegree, Math.max(0, degree + moves[Math.floor(random() * moves.length)]));
  }
  degrees[degrees.length - 1] = 0;

  const melody = degrees.map(d => scale[d] ?? 0);
  perScale.set(scaleKey, melody);
  return melody;
}
