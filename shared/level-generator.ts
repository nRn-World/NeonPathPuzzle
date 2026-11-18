import { type Point } from "@shared/schema";

function mulberry32(seed: number) {
  return function random() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Layout families. Every level belongs to one of these silhouettes, and
 * neighbouring levels never share one, so the campaign keeps changing shape
 * instead of repeating the same blob with a different node count.
 */
export const LAYOUT_FAMILIES = [
  "serpentine",
  "column-serpentine",
  "reverse-serpentine",
  "spiral",
  "outward-spiral",
  "wander",
  "hug",
  "drift",
  "turn",
  "border",
  "corner",
  "weave",
] as const;

export type LayoutFamily = typeof LAYOUT_FAMILIES[number];
const FAMILY_COUNT = LAYOUT_FAMILIES.length;

/**
 * The endgame avoids the straight serpentine silhouettes. A long rectangular
 * band is fine once in a while, but a finale made of them looks like a wall;
 * these families keep the last fifty boards intricate and recognisable.
 */
const LATE_FAMILY_POOL: LayoutFamily[] = [
  "spiral",
  "outward-spiral",
  "wander",
  "drift",
  "turn",
  "border",
  "corner",
  "weave",
];
const LATE_FAMILY_FROM = 151;

export interface GeneratedLevel {
  id: number;
  gridSize: number;
  start: Point;
  nodes: Point[];
  solution: Point[];
  /** Which silhouette this layout belongs to. Neighbouring levels always differ. */
  family: LayoutFamily;
}

interface DifficultyTier {
  from: number;
  to: number;
  gridSize: number;
  /** Node count at the start and end of the tier; the ramp is linear. */
  startNodes: number;
  endNodes: number;
}

/**
 * The campaign grows in small, even steps. Boards stop at ~65% coverage so
 * there is room for large, readable holes and every level gets its own shape;
 * a nearly full board can only be rearranged in tiny, look-alike ways.
 * Grid sizes keep the cells readable while the node count climbs.
 */
const DIFFICULTY_TIERS: DifficultyTier[] = [
  { from: 1, to: 3, gridSize: 3, startNodes: 5, endNodes: 7 },
  { from: 4, to: 12, gridSize: 4, startNodes: 8, endNodes: 12 },
  { from: 13, to: 24, gridSize: 5, startNodes: 12, endNodes: 17 },
  { from: 25, to: 40, gridSize: 6, startNodes: 18, endNodes: 24 },
  { from: 41, to: 60, gridSize: 7, startNodes: 25, endNodes: 32 },
  { from: 61, to: 85, gridSize: 8, startNodes: 33, endNodes: 42 },
  { from: 86, to: 115, gridSize: 9, startNodes: 43, endNodes: 53 },
  { from: 116, to: 150, gridSize: 10, startNodes: 54, endNodes: 65 },
  { from: 151, to: 175, gridSize: 11, startNodes: 66, endNodes: 78 },
  { from: 176, to: 200, gridSize: 12, startNodes: 79, endNodes: 92 },
  // Expansion: difficulty now comes mostly from the new rules (sync nodes,
  // blackout), so the boards only grow a little and stay readable on a phone.
  { from: 201, to: 240, gridSize: 12, startNodes: 93, endNodes: 106 },
  { from: 241, to: 300, gridSize: 13, startNodes: 107, endNodes: 122 },
  // The Rift: a bonus sector after the campaign with its own rules (levels 301-330).
  { from: 301, to: 330, gridSize: 13, startNodes: 123, endNodes: 130 },
];

/** The campaign: crash rule, level codes and the 300-level achievement all stop here. */
export const MAX_LEVEL_ID = 300;
/** The Rift bonus sector extends the generator to here; it is outside the campaign run. */
export const GENERATOR_MAX_LEVEL_ID = 330;

/**
 * The difficulty every level aims for, as (level, score) anchors with straight
 * lines between them. Measured over all candidates, each level can reach a wide
 * band around this curve, so the search can pick the layout that lands on it:
 * level 20 can never be harder than level 50, and the whole campaign climbs in
 * one smooth line instead of wandering with the luck of each draw.
 *
 * The opening, the last stretch of the first 200 levels and the last ten levels
 * climb steeply and strictly (each level harder than the one before), so level 1
 * is the easiest board and level 300 the hardest.
 */
const DIFFICULTY_CURVE: [number, number][] = [
  [1, 5], [2, 6], [3, 7], [5, 11], [10, 17], [20, 26], [30, 38], [40, 50], [50, 60],
  [75, 86], [100, 112], [125, 138], [150, 164], [175, 190], [190, 206], [200, 236],
  // The planning rule makes the last boards harder than the original curve:
  // dense boards that strand a greedy walk score higher, so the finale climbs
  // to 364 instead of flattening out at 352.
  [250, 284], [290, 330], [300, 364], [330, 390],
];

export function targetDifficulty(levelId: number): number {
  for (let index = 1; index < DIFFICULTY_CURVE.length; index++) {
    const [toId, toScore] = DIFFICULTY_CURVE[index];
    if (levelId > toId) continue;
    const [fromId, fromScore] = DIFFICULTY_CURVE[index - 1];
    return fromScore + ((toScore - fromScore) * (levelId - fromId)) / (toId - fromId);
  }
  return DIFFICULTY_CURVE[DIFFICULTY_CURVE.length - 1][1];
}

/** Levels that must each be strictly harder than the one before. */
function isStrictLevel(levelId: number): boolean {
  return levelId <= 3 || (levelId >= 191 && levelId <= 200) || levelId >= 291;
}

/** How far from the curve a level may land. Strict stretches are tighter. */
function baseWindow(levelId: number): number {
  return isStrictLevel(levelId) ? 1 : 2;
}

/** Wider windows tried in turn when uniqueness leaves no layout on the curve. */
const WINDOW_STEPS = [0, 2, 5, 10, 20];
/** From this level on a layout must branch instead of being a forced corridor. */
const NON_CORRIDOR_FROM = 3;
const MIN_BRANCHING_EDGES = 3;

/** Upper bound on the variants searched for a single level. */
const VARIANT_LIMIT = 192;
/** Candidates kept per search before picking the best fit for the curve. */
const OPTION_LIMIT = 24;
/** How many times a single level may grow to clear the difficulty floor. */
const EXTRA_NODE_LIMIT = 5;
/**
 * No silhouette should carry more than a fifth of the campaign. The planning
 * rule pulls layouts towards the trap-rich families, so once the intended
 * rotation reaches this share the least-used family takes the next level.
 */
const FAMILY_SOFT_CAP = Math.ceil(MAX_LEVEL_ID * 0.18);
/** Absolute ceiling a single silhouette may reach in the campaign. */
const FAMILY_HARD_CAP = Math.ceil(MAX_LEVEL_ID * 0.22);

const MASK_WORDS = 6;

type Mask = number[];

/**
 * Most cells a layout may use. Mid-sized boards stay at 70% so the holes stay
 * large enough to read; the small tutorials and the big endgame boards can run
 * a little denser. The generator tests enforce the same coverage limits.
 */
function capacityFor(size: number) {
  const coverage = size >= 12 ? 0.78 : size >= 6 ? 0.7 : 0.8;
  return Math.floor(size * size * coverage);
}

function key(point: Point) {
  return `${point.x},${point.y}`;
}

function getLevelShape(levelId: number) {
  const tier = DIFFICULTY_TIERS.find(({ from, to }) => levelId >= from && levelId <= to);
  if (!tier) throw new RangeError(`No difficulty tier configured for Level ${levelId}`);

  const progress = tier.to === tier.from
    ? 1
    : (levelId - tier.from) / (tier.to - tier.from);
  const capacity = capacityFor(tier.gridSize);
  const targetLength = Math.min(
    capacity,
    Math.max(3, Math.round(tier.startNodes + (tier.endNodes - tier.startNodes) * progress)),
  );

  return { gridSize: tier.gridSize, targetLength };
}

function neighbors(point: Point, size: number) {
  return [
    { x: point.x, y: point.y - 1 },
    { x: point.x, y: point.y + 1 },
    { x: point.x - 1, y: point.y },
    { x: point.x + 1, y: point.y },
  ].filter(({ x, y }) => x >= 0 && x < size && y >= 0 && y < size);
}

/* ------------------------------------------------------------------ *
 * Deterministic silhouettes
 * ------------------------------------------------------------------ */

function fullSerpentine(size: number, vertical: boolean): Point[] {
  const path: Point[] = [];
  for (let line = 0; line < size; line++) {
    for (let step = 0; step < size; step++) {
      const forward = line % 2 === 0;
      const across = forward ? step : size - 1 - step;
      path.push(vertical ? { x: line, y: across } : { x: across, y: line });
    }
  }
  return path;
}

function fullSpiral(size: number, clockwise: boolean): Point[] {
  const path: Point[] = [];
  let left = 0;
  let right = size - 1;
  let top = 0;
  let bottom = size - 1;

  while (left <= right && top <= bottom) {
    if (clockwise) {
      for (let x = left; x <= right; x++) path.push({ x, y: top });
      for (let y = top + 1; y <= bottom; y++) path.push({ x: right, y });
      if (top < bottom) for (let x = right - 1; x >= left; x--) path.push({ x, y: bottom });
      if (left < right) for (let y = bottom - 1; y > top; y--) path.push({ x: left, y });
    } else {
      for (let y = top; y <= bottom; y++) path.push({ x: left, y });
      for (let x = left + 1; x <= right; x++) path.push({ x, y: bottom });
      if (left < right) for (let y = bottom - 1; y >= top; y--) path.push({ x: right, y });
      if (top < bottom) for (let x = right - 1; x > left; x--) path.push({ x, y: top });
    }
    left++;
    right--;
    top++;
    bottom--;
  }

  return path;
}

function slicePath(full: Point[], length: number, random: () => number): Point[] | null {
  if (length > full.length) return null;
  const offset = Math.floor(random() * (full.length - length + 1));
  return full.slice(offset, offset + length);
}

type Bias = "wander" | "hug" | "drift" | "turn" | "border" | "corner" | "weave";

/**
 * A bounded depth-first search for a self-avoiding path. The ordering bias is
 * what gives each family its character: `hug` curls along an edge, `drift`
 * keeps long straights, `turn` folds into switchbacks, and so on.
 */
function biasedPath(
  size: number,
  length: number,
  start: Point,
  random: () => number,
  bias: Bias,
  budget = 80_000,
): Point[] | null {
  const path: Point[] = [start];
  const visited = new Set([key(start)]);
  let remainingWork = budget;

  const score = (candidate: Point, current: Point, previous: Point | null) => {
    const onward = neighbors(candidate, size).filter(next => !visited.has(key(next))).length;
    const dx = current.x - (previous ?? current).x;
    const dy = current.y - (previous ?? current).y;
    const sameDirection = candidate.x - current.x === dx && candidate.y - current.y === dy;
    const edge = Math.min(candidate.x, candidate.y, size - 1 - candidate.x, size - 1 - candidate.y);
    const tie = random();

    switch (bias) {
      case "hug": return onward * 10 + tie;
      case "drift": return onward * 6 + (sameDirection ? 0 : 6) + tie;
      case "turn": return onward * 6 + (sameDirection ? 6 : 0) + tie;
      case "border": return onward * 6 + edge * 3 + tie;
      case "corner": return onward * 5 + (candidate.x + candidate.y) * 2 + tie;
      case "weave": return onward * 7 + (candidate.x + candidate.y) % 2 * 2 + tie;
      default: return tie;
    }
  };

  const extend = (current: Point): boolean => {
    if (path.length === length) return true;
    if (--remainingWork <= 0) return false;

    const previous = path.length > 1 ? path[path.length - 2] : null;
    const candidates = neighbors(current, size)
      .filter(point => !visited.has(key(point)))
      .map(point => ({ point, score: score(point, current, previous) }))
      .sort((a, b) => a.score - b.score);

    for (const { point } of candidates) {
      path.push(point);
      visited.add(key(point));
      if (extend(point)) return true;
      visited.delete(key(point));
      path.pop();
      if (remainingWork <= 0) break;
    }
    return false;
  };

  return extend(start) ? path : null;
}

function transform(point: Point, size: number, variant: number): Point {
  const max = size - 1;
  switch (variant % 8) {
    case 0: return point;
    case 1: return { x: max - point.y, y: point.x };
    case 2: return { x: max - point.x, y: max - point.y };
    case 3: return { x: point.y, y: max - point.x };
    case 4: return { x: max - point.x, y: point.y };
    case 5: return { x: point.x, y: max - point.y };
    case 6: return { x: point.y, y: point.x };
    default: return { x: max - point.y, y: max - point.x };
  }
}

function buildFamilyPath(
  family: LayoutFamily,
  size: number,
  length: number,
  random: () => number,
  sub: number,
): Point[] | null {
  switch (family) {
    case "serpentine":
      return slicePath(fullSerpentine(size, false), length, random);
    case "column-serpentine":
      return slicePath(fullSerpentine(size, true), length, random);
    case "reverse-serpentine":
      return slicePath([...fullSerpentine(size, false)].reverse(), length, random);
    case "spiral":
      return slicePath(fullSpiral(size, sub % 2 === 0), length, random);
    case "outward-spiral":
      return slicePath([...fullSpiral(size, sub % 2 === 0)].reverse(), length, random);
    default: {
      const start = {
        x: Math.floor(random() * size),
        y: Math.floor(random() * size),
      };
      return biasedPath(size, length, start, random, family as Bias);
    }
  }
}

/** A guaranteed fallback: a contiguous slice of a full serpentine. */
function fallbackPath(size: number, length: number, random: () => number): Point[] {
  return slicePath(fullSerpentine(size, false), length, random)
    ?? slicePath(fullSerpentine(size, true), length, random)!;
}

const levelCache = new Map<number, GeneratedLevel>();
/** Node sets already used, grouped by grid size, as bitmasks. */
const usedMasks = new Map<number, Mask[]>();
const familyUsage = new Map<LayoutFamily, number>();
/** Difficulty of the previous level (not the running maximum). */
let lastDifficulty = 0;
let lastNodes = 0;
let lastFamily: LayoutFamily | null = null;
/** Difficulty of every committed level, so the curve can never dip over time. */
const difficultyHistory: number[] = [];

/**
 * A level must never be easier than a level three steps before it. The
 * campaign may wobble by a point or two between neighbours, but the trend
 * always climbs and nothing late may be a softer board than level N-3.
 */
function difficultyFloor(levelId: number): number {
  let floor = 0;
  for (let index = 0; index <= levelId - 4; index++) {
    if (difficultyHistory[index] > floor) floor = difficultyHistory[index];
  }
  return floor;
}

/** Deterministic candidate used by the variant table below and by its tooling. */
export function createCandidate(levelId: number, variant: number, extraNodes = 0): GeneratedLevel {
  const shape = getLevelShape(levelId);
  const gridSize = shape.gridSize;
  const capacity = capacityFor(gridSize);
  const targetLength = Math.min(capacity, shape.targetLength + extraNodes);
  const random = mulberry32(levelId * 9973 + 12345 + variant * 0x9E3779B9);
  const family = LAYOUT_FAMILIES[variant % FAMILY_COUNT];
  const sub = Math.floor(variant / FAMILY_COUNT);

  let solution = buildFamilyPath(family, gridSize, targetLength, random, sub);
  solution ??= biasedPath(gridSize, targetLength, {
    x: Math.floor(random() * gridSize),
    y: Math.floor(random() * gridSize),
  }, random, "hug");
  solution ??= fallbackPath(gridSize, targetLength, random);

  const orientation = (variant * 5 + levelId) % 8;
  const oriented = solution.map(point => transform(point, gridSize, orientation));

  return {
    id: levelId,
    gridSize,
    start: oriented[0],
    nodes: [...oriented].sort((a, b) => (a.y - b.y) || (a.x - b.x)),
    solution: oriented,
    family,
  };
}

/* ------------------------------------------------------------------ *
 * Uniqueness
 * ------------------------------------------------------------------ */

function toMask(level: GeneratedLevel, variant: number): Mask {
  const mask = new Array<number>(MASK_WORDS).fill(0);
  for (const node of level.nodes) {
    const point = transform(node, level.gridSize, variant);
    const index = point.y * level.gridSize + point.x;
    mask[index >>> 5] |= 1 << (index & 31);
  }
  return mask;
}

function popcount(value: number) {
  let bits = value - ((value >>> 1) & 0x55555555);
  bits = (bits & 0x33333333) + ((bits >>> 2) & 0x33333333);
  bits = (bits + (bits >>> 4)) & 0x0f0f0f0f;
  return (bits * 0x01010101) >>> 24;
}

function maskDistance(a: Mask, b: Mask) {
  let distance = 0;
  for (let word = 0; word < MASK_WORDS; word++) {
    distance += popcount((a[word] ^ b[word]) >>> 0);
  }
  return distance;
}

/**
 * Smallest number of cells that differ between this layout and any level
 * already used on the same grid, measured over rotations and mirror images.
 */
function minLayoutDistance(level: GeneratedLevel, stored: Mask[] | undefined): number {
  if (!stored || stored.length === 0) return Infinity;

  let smallest = Infinity;
  for (let variant = 0; variant < 8; variant++) {
    const mask = toMask(level, variant);
    for (const other of stored) {
      const distance = maskDistance(mask, other);
      if (distance < smallest) {
        smallest = distance;
        if (smallest === 0) return 0;
      }
    }
  }
  return smallest;
}

/**
 * Visual separation that grows with the board. Even small tutorial boards must
 * differ by several cells, and the large endgame boards get a wide margin.
 */
function requiredDistance(nodeCount: number): number {
  // About a sixth of the nodes must differ from every earlier board on the same
  // grid. Dense late boards would otherwise read as the same block with the
  // holes shuffled by a cell or two.
  const cap = nodeCount > 106 ? 20 : 16;
  return Math.min(cap, Math.max(3, Math.round(nodeCount * 0.16)));
}

/**
 * Edges between adjacent nodes that are not consecutive steps of the solution.
 * These are the junctions where a player has a real choice.
 */
export function countBranchingEdges(path: Point[]): number {
  const cells = new Set(path.map(key));
  let edges = 0;

  for (const point of path) {
    if (cells.has(`${point.x + 1},${point.y}`)) edges++;
    if (cells.has(`${point.x},${point.y + 1}`)) edges++;
  }

  return Math.max(0, edges - (path.length - 1));
}

/**
 * How often a greedy Warnsdorff walker reaches the end of the board. This is a
 * cheap player model: layouts full of false corridors defeat it, while wide
 * open boards that can be solved by always taking the nearest step do not.
 */
const GREEDY_SAMPLE = 24;
const greedyCache = new WeakMap<GeneratedLevel, number>();

function greedySuccessRate(level: GeneratedLevel, runs = GREEDY_SAMPLE): number {
  const nodes = new Set(level.nodes.map(key));
  const total = level.nodes.length;
  let wins = 0;

  for (let run = 0; run < runs; run++) {
    const random = mulberry32(level.id * 8191 + run * 131 + level.gridSize * 17);
    const seen = new Set([key(level.start)]);
    let current = level.start;

    while (seen.size < total) {
      const candidates = neighbors(current, level.gridSize)
        .filter(point => nodes.has(key(point)) && !seen.has(key(point)))
        .map(point => ({
          point,
          onward: neighbors(point, level.gridSize)
            .filter(next => nodes.has(key(next)) && !seen.has(key(next))).length,
          tie: random(),
        }))
        .sort((a, b) => a.onward - b.onward || a.tie - b.tie);

      if (candidates.length === 0) break;
      current = candidates[0].point;
      seen.add(key(current));
    }

    if (seen.size === total) wins++;
  }

  return wins / runs;
}

/** Cached version: the same board is scored and rule-checked in one search step. */
function greedyRate(level: GeneratedLevel): number {
  const cached = greedyCache.get(level);
  if (cached !== undefined) return cached;
  const value = greedySuccessRate(level);
  greedyCache.set(level, value);
  return value;
}

/**
 * Fixed tie orders for the deterministic walker. The random walker above is
 * fine for scoring a board, but it is too luck-dependent to decide whether a
 * level is *easy*: the same board can be finished by one tie-break and stranded
 * by another. These orders make the answer repeatable.
 */
const GREEDY_DIRECTIONS: readonly (readonly Point[])[] = [
  [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }],
  [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }],
  [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }],
  [{ x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
  [{ x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }],
  [{ x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 0, y: -1 }],
  [{ x: 0, y: -1 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }],
  [{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 0 }],
];

/** Share of the board one "always take the fewest exits" walk clears. */
function greedyWalkDepth(level: GeneratedLevel, order: readonly Point[]): number {
  const nodes = new Set(level.nodes.map(key));
  const seen = new Set([key(level.start)]);
  let head = level.start;

  while (seen.size < level.nodes.length) {
    let best: Point | null = null;
    let bestOnward = Infinity;
    for (const direction of order) {
      const next = { x: head.x + direction.x, y: head.y + direction.y };
      if (!nodes.has(key(next)) || seen.has(key(next))) continue;
      const onward = GREEDY_DIRECTIONS[0].filter(({ x, y }) => {
        const neighbour = { x: next.x + x, y: next.y + y };
        return nodes.has(key(neighbour)) && !seen.has(key(neighbour));
      }).length;
      if (onward < bestOnward) {
        best = next;
        bestOnward = onward;
      }
    }
    if (!best) break;
    seen.add(key(best));
    head = best;
  }

  return seen.size / level.nodes.length;
}

const greedyDepthCache = new WeakMap<GeneratedLevel, number>();

/**
 * How much of a board local, unplanned play clears, averaged over the eight
 * deterministic tie orders. Near 1 means the line can be traced along the
 * obvious route (a snake, spiral or border hug); the lower it is, the earlier
 * the walk strands itself and the more the player has to think ahead.
 */
export function greedyDepth(level: GeneratedLevel): number {
  const cached = greedyDepthCache.get(level);
  if (cached !== undefined) return cached;
  const total = GREEDY_DIRECTIONS.reduce((sum, order) => sum + greedyWalkDepth(level, order), 0);
  const value = total / GREEDY_DIRECTIONS.length;
  greedyDepthCache.set(level, value);
  return value;
}

/**
 * Highest greedy depth a level may have. The opening may be traced freely — a
 * 4×4 board with twelve nodes has no room for a real trap — and from level 41
 * the allowance drops in steps, so a board that can still be walked along its
 * own outline, however dense it looks, is never the late "easy level" the
 * campaign must not contain.
 */
export function planningCeiling(levelId: number): number {
  if (levelId <= 40) return 1;
  if (levelId <= 150) return 0.96;
  return 0.94;
}

/** True when the layout is too easy to trace for its place in the campaign. */
function requiresPlanning(levelId: number, level: GeneratedLevel): boolean {
  return greedyDepth(level) <= planningCeiling(levelId);
}

/**
 * Structural difficulty: more nodes, more junctions, and more traps that a
 * greedy walker falls into all raise it. Node count alone made dense, nearly
 * full boards look hard while playing like a wide-open canvas.
 */
export function getLevelDifficulty(level: GeneratedLevel): number {
  return structuralDifficulty(level) + trapPressure(level);
}

/** The stable half of difficulty: board size and the number of real junctions. */
function structuralDifficulty(level: GeneratedLevel): number {
  return level.nodes.length + countBranchingEdges(level.solution) * 2;
}

function trapPressure(level: GeneratedLevel): number {
  // Small tutorial boards are not meaningfully harder just because one greedy
  // walk happens to fail; let trap pressure fade in as the boards get larger.
  const ramp = Math.min(1, Math.max(0, (level.id - 25) / 50));
  return Math.round((1 - greedyRate(level)) * 32 * ramp);
}

/**
 * A finished path is only usable as a ghost/record when it still matches the
 * current layout: it must start on the start node, visit every node exactly
 * once, and only take orthogonal steps.
 */
export function isValidSolutionPath(path: Point[], level: GeneratedLevel): boolean {
  if (path.length !== level.nodes.length) return false;
  if (path[0]?.x !== level.start.x || path[0]?.y !== level.start.y) return false;

  const nodes = new Set(level.nodes.map(key));
  const seen = new Set<string>();

  for (let index = 0; index < path.length; index++) {
    const point = path[index];
    const pointKey = key(point);
    if (!nodes.has(pointKey) || seen.has(pointKey)) return false;

    if (index > 0) {
      const previous = path[index - 1];
      if (Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y) !== 1) return false;
    }

    seen.add(pointKey);
  }

  return true;
}

interface Candidate {
  level: GeneratedLevel;
  /** Reporting score: structure plus trap pressure. */
  difficulty: number;
  /** Stable score used for the monotonic curve. */
  structural: number;
  traps: number;
  distance: number;
  variant: number;
  extraNodes: number;
}

/** True when a candidate's score fits this level's slot on the curve. */
function onCurve(levelId: number, difficulty: number, window: number): boolean {
  if (Math.abs(difficulty - targetDifficulty(levelId)) > window) return false;
  return !isStrictLevel(levelId) || levelId === 1 || difficulty > lastDifficulty;
}

/**
 * Every hard rule a finished layout has to satisfy, checked in one place so the
 * search, the baked table and the repair tooling can never disagree.
 */
/** Rift levels are separated by a smaller margin than the campaign: the grid is already crowded. */
const RIFT_MAX_SEPARATION = 12;

/**
 * The Rift (301+) leans on its new rules for difficulty, so it skips the
 * campaign's difficulty curve and strictly-rising node count. It still needs a
 * branching layout, a different silhouette from the previous level and a board
 * no earlier level on the grid looks like.
 */
function meetsRiftRules(level: GeneratedLevel): boolean {
  if (level.family === lastFamily) return false;
  if (countBranchingEdges(level.solution) < MIN_BRANCHING_EDGES) return false;
  const distance = minLayoutDistance(level, usedMasks.get(level.gridSize));
  return distance >= Math.min(RIFT_MAX_SEPARATION, requiredDistance(level.nodes.length));
}

function searchRiftLevel(levelId: number): Candidate {
  for (let extraNodes = 0; extraNodes <= EXTRA_NODE_LIMIT; extraNodes++) {
    for (const variant of variantOrder(levelId)) {
      const level = createCandidate(levelId, variant, extraNodes);
      if (!meetsRiftRules(level)) continue;
      return { level, difficulty: 0, structural: 0, traps: 0, distance: 0, variant, extraNodes };
    }
  }
  throw new Error(`Could not create a layout for Rift level ${levelId}`);
}

function meetsRules(levelId: number, level: GeneratedLevel): boolean {
  if (levelId > MAX_LEVEL_ID) return meetsRiftRules(level);
  if (level.nodes.length < lastNodes) return false;
  if (level.family === lastFamily) return false;
  if ((familyUsage.get(level.family) ?? 0) >= FAMILY_HARD_CAP) return false;
  if (levelId > NON_CORRIDOR_FROM && countBranchingEdges(level.solution) < MIN_BRANCHING_EDGES) return false;
  if (!requiresPlanning(levelId, level)) return false;
  const difficulty = getLevelDifficulty(level);
  if (difficulty < difficultyFloor(levelId)) return false;
  if (!onCurve(levelId, difficulty, baseWindow(levelId) + 1)) return false;

  const distance = minLayoutDistance(level, usedMasks.get(level.gridSize));
  return distance > 0 && distance >= requiredDistance(level.nodes.length);
}

/**
 * Picks the layout for one level.
 *
 * Hard rules: never easier than the previous level, a different silhouette
 * from the previous level, strictly harder at the very start and in the closing
 * stretch, and visually distinct from every level already used on the same
 * grid. Among the valid candidates the least-used family and the smallest
 * difficulty step win, so the curve climbs smoothly and the families rotate.
 */
/** The family this level should use. Consecutive levels always differ. */
function targetFamily(levelId: number): LayoutFamily {
  const pool = levelId >= LATE_FAMILY_FROM ? LATE_FAMILY_POOL : LAYOUT_FAMILIES;
  const preferred = pool[((levelId - 1) * 5) % pool.length];
  if ((familyUsage.get(preferred) ?? 0) < FAMILY_SOFT_CAP) return preferred;
  // The intended family already carries its share, so hand the level to the
  // least-used one. The search still has every family available.
  const alternatives = pool
    .filter(family => family !== lastFamily)
    .sort((a, b) => (familyUsage.get(a) ?? 0) - (familyUsage.get(b) ?? 0));
  return alternatives[0] ?? preferred;
}

function familyAllowed(levelId: number, family: LayoutFamily): boolean {
  return levelId < LATE_FAMILY_FROM || LATE_FAMILY_POOL.includes(family);
}

/**
 * Variant visit order: the level's target family first, then everything else.
 * Keeping the target family cheap to find is what stops the search from
 * collapsing back into whichever blob happens to be easiest to generate.
 */
function variantOrder(levelId: number): number[] {
  const target = LAYOUT_FAMILIES.indexOf(targetFamily(levelId));
  const limit = VARIANT_LIMIT;
  const order: number[] = [];
  for (let sub = 0; sub < limit / FAMILY_COUNT; sub++) {
    order.push(target + sub * FAMILY_COUNT);
  }
  for (let variant = 0; variant < limit; variant++) {
    if (order.includes(variant)) continue;
    if (!familyAllowed(levelId, LAYOUT_FAMILIES[variant % FAMILY_COUNT])) continue;
    order.push(variant);
  }
  return order;
}

/** Builds each candidate once per level; the search revisits the same ones. */
type CandidateFactory = (variant: number, extraNodes: number) => GeneratedLevel;

function collectOptions(
  levelId: number,
  extraNodes: number,
  stored: Mask[],
  furthest: { current: Candidate | null },
  window: number,
  margin: number,
  build: CandidateFactory,
): Candidate[] {
  const options: Candidate[] = [];
  const needed = Math.max(1, requiredDistance(createLevelLength(levelId, extraNodes)) - margin);

  const perFamily = new Map<LayoutFamily, number>();

  for (const variant of variantOrder(levelId)) {
    const level = build(variant, extraNodes);
    if (level.nodes.length < lastNodes) continue;
    if (level.family === lastFamily) continue;
    // A handful of options per silhouette so the final pick really has a
    // choice between families instead of twenty cuts of the same shape.
    if ((perFamily.get(level.family) ?? 0) >= 4) continue;
    // Cheap rules first: the layout comparison runs over every earlier board on
    // this grid, so a candidate that is too easy to trace never pays for it.
    if (levelId > NON_CORRIDOR_FROM && countBranchingEdges(level.solution) < MIN_BRANCHING_EDGES) continue;
    if ((familyUsage.get(level.family) ?? 0) >= FAMILY_HARD_CAP) continue;
    if (!requiresPlanning(levelId, level)) continue;

    const structural = structuralDifficulty(level);
    const traps = trapPressure(level);
    const difficulty = structural + traps;
    if (difficulty < difficultyFloor(levelId)) continue;
    const distance = minLayoutDistance(level, stored);
    if (distance === 0) continue;

    const candidate: Candidate = {
      level,
      difficulty,
      structural,
      traps,
      distance,
      variant,
      extraNodes,
    };
    // Kept before the curve filter: if a level has no layout on the difficulty
    // curve, the search still has a playable board to fall back on.
    if (!furthest.current || distance > furthest.current.distance) {
      furthest.current = candidate;
    }

    if (!onCurve(levelId, difficulty, window)) continue;
    if (distance < needed) continue;

    options.push(candidate);
    perFamily.set(level.family, (perFamily.get(level.family) ?? 0) + 1);
    if (options.length >= OPTION_LIMIT) break;
  }

  return options;
}

/** Deterministic node count for a level, used when relaxing the separation rule. */
function createLevelLength(levelId: number, extraNodes: number): number {
  const shape = getLevelShape(levelId);
  return Math.min(capacityFor(shape.gridSize), shape.targetLength + extraNodes);
}

function selectBest(options: Candidate[], levelId: number): Candidate {
  const target = targetDifficulty(levelId);
  const family = targetFamily(levelId);
  const score = (candidate: Candidate) =>
    Math.abs(candidate.difficulty - target) * 3
    + (familyUsage.get(candidate.level.family) ?? 0) * 200
    + (candidate.level.family === family ? 0 : 120);

  return options.sort((a, b) =>
    score(a) - score(b)
    || b.distance - a.distance
    || a.variant - b.variant,
  )[0];
}

/**
 * Full search for a level: the layout closest to the difficulty curve wins.
 * When uniqueness leaves nothing inside the window, the window widens step by
 * step and extra nodes are tried, so the campaign always stays complete.
 */
/** Every candidate for this level, built once and reused by each search pass. */
function candidateFactory(levelId: number): CandidateFactory {
  const cache = new Map<number, GeneratedLevel>();
  return (variant, extraNodes) => {
    const cacheKey = variant * 16 + extraNodes;
    let level = cache.get(cacheKey);
    if (!level) {
      level = createCandidate(levelId, variant, extraNodes);
      cache.set(cacheKey, level);
    }
    return level;
  };
}

/**
 * Last resort when the rules leave no layout: a playable, visually distinct
 * board that ignores the difficulty curve and the family cap. Only reached if
 * a level cannot satisfy every rule at once.
 */
function fallbackCandidate(levelId: number, build: CandidateFactory, extraLimit: number): Candidate {
  const { gridSize } = getLevelShape(levelId);
  const stored = usedMasks.get(gridSize) ?? [];
  const floor = difficultyFloor(levelId);
  let best: Candidate | null = null;
  let bestAboveFloor: Candidate | null = null;
  let bestPlanned: Candidate | null = null;
  let bestAboveFloorPlanned: Candidate | null = null;

  for (let extraNodes = 0; extraNodes <= extraLimit; extraNodes++) {
    for (const variant of variantOrder(levelId)) {
      const level = build(variant, extraNodes);
      if (level.nodes.length < lastNodes) continue;
      if (level.family === lastFamily) continue;
      if (levelId > NON_CORRIDOR_FROM && countBranchingEdges(level.solution) < MIN_BRANCHING_EDGES) continue;
      const distance = minLayoutDistance(level, stored);
      if (distance === 0) continue;
      const candidate: Candidate = {
        level,
        difficulty: getLevelDifficulty(level),
        structural: structuralDifficulty(level),
        traps: trapPressure(level),
        distance,
        variant,
        extraNodes,
      };
      if (!best || candidate.distance > best.distance) best = candidate;
      const planned = requiresPlanning(levelId, level);
      if (planned
        && (!bestPlanned || candidate.distance > bestPlanned.distance)) {
        bestPlanned = candidate;
      }
      // The campaign must still climb: prefer a board that clears the floor
      // over a slightly more distinct one that would make a later level easier.
      if (candidate.difficulty >= floor
        && (!bestAboveFloor || candidate.distance > bestAboveFloor.distance)) {
        bestAboveFloor = candidate;
      }
      if (planned && candidate.difficulty >= floor
        && (!bestAboveFloorPlanned || candidate.distance > bestAboveFloorPlanned.distance)) {
        bestAboveFloorPlanned = candidate;
      }
    }
  }

  // A board the player can still walk through is the one thing a late level
  // may never fall back to, so the planning rule outranks everything else.
  if (bestAboveFloorPlanned) return bestAboveFloorPlanned;
  if (bestPlanned) return bestPlanned;
  if (bestAboveFloor) return bestAboveFloor;
  if (best) return best;
  throw new Error(`Could not create a layout for level ${levelId}`);
}

function searchLevel(levelId: number): Candidate {
  if (levelId > MAX_LEVEL_ID) return searchRiftLevel(levelId);
  const { gridSize } = getLevelShape(levelId);
  const stored = usedMasks.get(gridSize) ?? [];
  const furthest: { current: Candidate | null } = { current: null };
  const base = baseWindow(levelId);
  const build = candidateFactory(levelId);
  // Seven is the most a packed table entry can carry (three bits); the largest
  // boards may use it so a new rule never leaves them without a layout.
  const extraLimit = levelId >= 241 ? 7 : EXTRA_NODE_LIMIT;

  for (const margin of [0, 2, 4]) {
    for (const step of WINDOW_STEPS) {
      for (let extraNodes = 0; extraNodes <= extraLimit; extraNodes++) {
        const options = collectOptions(levelId, extraNodes, stored, furthest, base + step, margin, build);
        if (options.length > 0) return selectBest(options, levelId);
      }
    }
  }

  // Keep the campaign playable even if no layout satisfies every rule at once.
  return furthest.current ?? fallbackCandidate(levelId, build, extraLimit);
}

/**
 * One packed entry per level: `variant * 8 + extraNodes`.
 *
 * The variants were chosen offline so that every layout stays visually
 * distinct, difficulty never drops, the families rotate and the first and last
 * levels sit at the ends of the curve. Picking them at runtime would cost
 * seconds on a phone, so they are baked in and verified by the generator tests.
 */
const VARIANT_TABLE: number[] = [
  672, 520, 464, 312, 160, 200, 16, 136, 1088, 152, 1504, 328, 192, 144, 848, 120, 832, 456, 328, 832,
  32, 1208, 1528, 504, 88, 1200, 272, 1176, 928, 40, 1008, 856, 1328, 800, 776, 208, 912, 712, 32, 856,
  464, 816, 280, 712, 816, 1216, 32, 240, 808, 736, 730, 138, 653, 1196, 956, 1483, 531, 1195, 834, 234,
  353, 537, 704, 328, 760, 640, 1296, 760, 944, 616, 1025, 617, 256, 1392, 232, 1200, 760, 544, 432, 928,
  1193, 802, 147, 922, 1530, 337, 993, 138, 1218, 914, 898, 186, 546, 153, 1097, 545, 1201, 929, 1193, 1432,
  544, 40, 65, 281, 808, 336, 1048, 424, 131, 155, 354, 618, 155, 906, 803, 338, 474, 225, 737, 1049,
  1120, 184, 120, 640, 176, 1376, 48, 568, 944, 320, 1120, 432, 1240, 1384, 184, 256, 568, 1200, 1024, 1528,
  832, 232, 240, 376, 1424, 832, 432, 352, 1144, 712, 608, 280, 40, 352, 136, 472, 1192, 352, 1088, 1328,
  1376, 40, 1240, 264, 1312, 1384, 664, 928, 1048, 514, 810, 732, 453, 828, 1436, 1379, 762, 1378, 1193, 353,
  616, 856, 1120, 520, 1048, 520, 473, 1216, 232, 633, 617, 1120, 187, 1026, 618, 953, 1314, 1465, 833, 696,
  760, 352, 617, 1337, 449, 472, 928, 1289, 1144, 1312, 328, 376, 1465, 1121, 184, 928, 1432, 1312, 713, 281,
  544, 40, 633, 1504, 280, 1216, 266, 282, 1386, 65, 1305, 546, 233, 545, 329, 88, 713, 1505, 616, 280,
  696, 472, 1464, 472, 25, 1145, 1312, 696, 184, 64, 265, 1137, 641, 369, 640, 1528, 425, 545, 185, 1217,
  251, 1435, 450, 1146, 923, 1003, 546, 1007, 743, 351, 574, 1487, 1535, 1127, 1487, 1343, 911, 1055, 142, 286,
  622, 735, 622, 382, 1198, 1343, 142, 383, 335, 735, 910, 1214, 1391, 1431, 1247, 831, 607, 1239, 863, 1527,
  64, 32, 80, 152, 216, 32, 40, 88, 64, 992, 80, 248, 984, 40, 56, 88, 160, 40, 80, 56,
  64, 56, 40, 88, 64, 88, 176, 56, 64, 56,
];

/**
 * Recomputes the packed table from scratch, searching every level. Used by
 * script/level-table.ts; the sequential order matters, so it cannot be parallel.
 */
export function buildVariantTable(): number[] {
  return repairVariantTable([]);
}

function selectLevel(levelId: number): Candidate {
  const packed = VARIANT_TABLE[levelId - 1];
  if (packed === undefined) return searchLevel(levelId);

  const variant = packed >> 3;
  const extraNodes = packed & 7;
  return {
    level: createCandidate(levelId, variant, extraNodes),
    difficulty: 0,
    structural: 0,
    traps: 0,
    distance: 0,
    variant,
    extraNodes,
  };
}

function resetGenerator() {
  levelCache.clear();
  usedMasks.clear();
  familyUsage.clear();
  difficultyHistory.length = 0;
  lastDifficulty = 0;
  lastNodes = 0;
  lastFamily = null;
}

function commitLevel(id: number, candidate: Candidate) {
  const level = candidate.level;
  usedMasks.set(level.gridSize, [...(usedMasks.get(level.gridSize) ?? []), toMask(level, 0)]);
  levelCache.set(id, level);
  familyUsage.set(level.family, (familyUsage.get(level.family) ?? 0) + 1);
  lastDifficulty = getLevelDifficulty(level);
  difficultyHistory[id - 1] = lastDifficulty;
  lastNodes = Math.max(lastNodes, level.nodes.length);
  lastFamily = level.family;
}

function generateThrough(targetLevelId: number) {
  for (let id = levelCache.size + 1; id <= targetLevelId; id++) {
    commitLevel(id, selectLevel(id));
  }
}

/**
 * Re-checks a baked table against the current rules and re-searches only the
 * levels that no longer satisfy them, so a rule change can patch the table
 * instead of paying for a full offline rebuild.
 */
export function repairVariantTable(table: number[], through = GENERATOR_MAX_LEVEL_ID): number[] {
  const repaired = [...table];
  resetGenerator();

  for (let id = 1; id <= through; id++) {
    const packed = repaired[id - 1];
    let stored: Candidate | null = null;

    if (packed !== undefined) {
      const variant = packed >> 3;
      const extraNodes = packed & 7;
      const level = createCandidate(id, variant, extraNodes);
      if (meetsRules(id, level)) {
        stored = { level, difficulty: 0, structural: 0, traps: 0, distance: 0, variant, extraNodes };
      }
    }

    const candidate = stored ?? searchLevel(id);
    repaired[id - 1] = candidate.variant * 8 + candidate.extraNodes;
    commitLevel(id, candidate);
  }

  resetGenerator();
  return repaired;
}

/** Baked levels built on demand; they depend only on their own table entry. */
const directCache = new Map<number, GeneratedLevel>();

export function generateLevel(levelId: number): GeneratedLevel {
  if (!Number.isInteger(levelId) || levelId < 1 || levelId > GENERATOR_MAX_LEVEL_ID) {
    throw new RangeError(`Level id must be an integer from 1 to ${GENERATOR_MAX_LEVEL_ID}. Received: ${levelId}`);
  }
  // A baked level is exactly createCandidate(id, variant, extra), so opening
  // level 300 on a phone does not have to build the 299 levels before it.
  const packed = VARIANT_TABLE[levelId - 1];
  if (packed !== undefined) {
    let level = directCache.get(levelId);
    if (!level) {
      level = createCandidate(levelId, packed >> 3, packed & 7);
      directCache.set(levelId, level);
    }
    return level;
  }
  generateThrough(levelId);
  return levelCache.get(levelId)!;
}
