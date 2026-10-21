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
];

export const MAX_LEVEL_ID = 300;

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
  [250, 284], [290, 322], [300, 352],
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

const MASK_WORDS = 6;

type Mask = number[];

/** Most cells a layout may use; the large boards keep a little more air. */
function capacityFor(size: number) {
  return Math.floor(size * size * (size >= 12 ? 0.78 : 0.8));
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
    const center = Math.abs(candidate.x - (size - 1) / 2) + Math.abs(candidate.y - (size - 1) / 2);
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
function greedySuccessRate(level: GeneratedLevel, runs = 24): number {
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
  return Math.round((1 - greedySuccessRate(level)) * 32 * ramp);
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
function meetsRules(levelId: number, level: GeneratedLevel): boolean {
  if (level.nodes.length < lastNodes) return false;
  if (level.family === lastFamily) return false;
  if (levelId > NON_CORRIDOR_FROM && countBranchingEdges(level.solution) < MIN_BRANCHING_EDGES) return false;
  if (!onCurve(levelId, getLevelDifficulty(level), baseWindow(levelId) + 1)) return false;

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
  if (levelId >= LATE_FAMILY_FROM) {
    return LATE_FAMILY_POOL[((levelId - 1) * 5) % LATE_FAMILY_POOL.length];
  }
  return LAYOUT_FAMILIES[((levelId - 1) * 5) % FAMILY_COUNT];
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

function collectOptions(
  levelId: number,
  extraNodes: number,
  stored: Mask[],
  furthest: { current: Candidate | null },
  window: number,
  margin = 0,
): Candidate[] {
  const options: Candidate[] = [];
  const needed = Math.max(1, requiredDistance(createLevelLength(levelId, extraNodes)) - margin);

  for (const variant of variantOrder(levelId)) {
    const level = createCandidate(levelId, variant, extraNodes);
    if (level.nodes.length < lastNodes) continue;
    if (level.family === lastFamily) continue;

    const structural = structuralDifficulty(level);
    const traps = trapPressure(level);
    const difficulty = structural + traps;
    const distance = minLayoutDistance(level, stored);
    if (distance === 0) continue;
    if (levelId > NON_CORRIDOR_FROM && countBranchingEdges(level.solution) < MIN_BRANCHING_EDGES) continue;

    const candidate: Candidate = {
      level,
      difficulty,
      structural,
      traps,
      distance,
      variant,
      extraNodes,
    };
    if (!furthest.current || distance > furthest.current.distance) {
      furthest.current = candidate;
    }

    if (!onCurve(levelId, difficulty, window)) continue;
    if (distance < needed) continue;

    options.push(candidate);
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
    + (familyUsage.get(candidate.level.family) ?? 0) * 16
    + (candidate.level.family === family ? 0 : 40);

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
function searchLevel(levelId: number): Candidate {
  const { gridSize } = getLevelShape(levelId);
  const stored = usedMasks.get(gridSize) ?? [];
  const furthest: { current: Candidate | null } = { current: null };
  const base = baseWindow(levelId);

  for (const margin of [0, 2]) {
    for (const step of WINDOW_STEPS) {
      for (let extraNodes = 0; extraNodes <= EXTRA_NODE_LIMIT; extraNodes++) {
        const options = collectOptions(levelId, extraNodes, stored, furthest, base + step, margin);
        if (options.length > 0) return selectBest(options, levelId);
      }
    }
  }

  if (!furthest.current || furthest.current.distance === 0) {
    throw new Error(`Could not create a layout for level ${levelId}`);
  }
  // Keep the campaign playable even if one level cannot satisfy every rule.
  return furthest.current;
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
  832, 816, 1464, 376, 896, 760, 32, 240, 560, 96, 1424, 616, 208, 752, 48, 1272, 232, 1240, 832, 184,
  624, 536, 704, 944, 760, 640, 1296, 760, 1280, 616, 993, 617, 256, 1392, 520, 1200, 760, 1520, 432, 928,
  1089, 65, 809, 1120, 424, 1464, 376, 448, 144, 472, 1504, 752, 520, 368, 1104, 1384, 1080, 848, 832, 944,
  544, 240, 1288, 280, 808, 336, 80, 424, 1177, 809, 1528, 816, 904, 568, 200, 512, 376, 216, 736, 272,
  1120, 1040, 664, 1040, 1120, 784, 48, 568, 1248, 320, 1344, 432, 1240, 1384, 1488, 256, 568, 1200, 1024, 1232,
  832, 232, 1232, 376, 1424, 696, 128, 352, 1040, 360, 608, 1232, 376, 352, 136, 472, 1192, 352, 1088, 1328,
  1376, 40, 848, 264, 1312, 1384, 664, 1232, 184, 514, 810, 732, 453, 828, 1436, 1467, 762, 1378, 1193, 281,
  1176, 712, 1120, 520, 456, 520, 1041, 1216, 232, 633, 617, 161, 281, 1288, 256, 280, 944, 1048, 544, 696,
  760, 352, 617, 1337, 449, 472, 928, 1289, 1312, 1481, 345, 376, 1465, 1121, 848, 600, 1432, 1312, 713, 281,
  544, 560, 448, 1320, 344, 464, 64, 616, 64, 1336, 1384, 1216, 88, 616, 256, 88, 1120, 857, 616, 280,
  696, 472, 1464, 1136, 1384, 24, 1528, 1176, 184, 448, 40, 1144, 1504, 1528, 640, 464, 425, 362, 1025, 1338,
  258, 426, 1329, 185, 731, 331, 546, 1018, 1219, 379, 546, 474, 1314, 1290, 257, 715, 1051, 1027, 475, 523,
  68, 716, 827, 1339, 451, 861, 140, 380, 1508, 1148, 260, 1292, 1029, 477, 180, 1124, 189, 909, 1045, 925,
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
export function repairVariantTable(table: number[], through = MAX_LEVEL_ID): number[] {
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
  if (!Number.isInteger(levelId) || levelId < 1 || levelId > MAX_LEVEL_ID) {
    throw new RangeError(`Level id must be an integer from 1 to ${MAX_LEVEL_ID}. Received: ${levelId}`);
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
