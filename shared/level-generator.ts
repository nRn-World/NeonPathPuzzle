import { type Point } from "@shared/schema";

function mulberry32(seed: number) {
  return function random() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export interface GeneratedLevel {
  id: number;
  gridSize: number;
  start: Point;
  nodes: Point[];
  solution: Point[];
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
 * Difficulty is driven by how many nodes a level has, not by how full the
 * board is. Near-full boards all look the same and leave no room for the
 * layouts to differ, so the last tier stops well short of coverage 1.
 * Grid sizes grow so the board keeps filling the same visual area.
 */
const DIFFICULTY_TIERS: DifficultyTier[] = [
  { from: 1, to: 3, gridSize: 3, startNodes: 5, endNodes: 7 },
  { from: 4, to: 9, gridSize: 4, startNodes: 8, endNodes: 11 },
  { from: 10, to: 12, gridSize: 4, startNodes: 12, endNodes: 13 },
  { from: 13, to: 20, gridSize: 5, startNodes: 14, endNodes: 19 },
  { from: 21, to: 23, gridSize: 5, startNodes: 20, endNodes: 21 },
  { from: 24, to: 29, gridSize: 6, startNodes: 21, endNodes: 25 },
  { from: 30, to: 39, gridSize: 6, startNodes: 26, endNodes: 31 },
  { from: 40, to: 50, gridSize: 7, startNodes: 32, endNodes: 40 },
  { from: 51, to: 75, gridSize: 8, startNodes: 41, endNodes: 48 },
  { from: 76, to: 100, gridSize: 8, startNodes: 49, endNodes: 53 },
  { from: 101, to: 125, gridSize: 9, startNodes: 54, endNodes: 62 },
  { from: 126, to: 150, gridSize: 9, startNodes: 63, endNodes: 68 },
  { from: 151, to: 190, gridSize: 10, startNodes: 69, endNodes: 79 },
  // The closing ten levels add one node each, so the final climb is real.
  { from: 191, to: 200, gridSize: 10, startNodes: 80, endNodes: 89 },
];

const MAX_LEVEL_ID = 200;

/** The final levels must be strictly harder than each other, so the last one is the hardest. */
const STRICT_TAIL_FROM = 191;
/** The first levels must be strictly harder than each other, so level 1 is the easiest. */
const STRICT_OPENING_THROUGH = 3;
/** From this level on a layout must branch instead of being a forced corridor. */
const NON_CORRIDOR_FROM = 3;
const MIN_BRANCHING_EDGES = 3;

/** Upper bound on the variants searched for a single level. */
const VARIANT_LIMIT = 96;

const MASK_WORDS = 4;

type Mask = number[];

function key(point: Point) {
  return `${point.x},${point.y}`;
}

function getLevelShape(levelId: number) {
  const tier = DIFFICULTY_TIERS.find(({ from, to }) => levelId >= from && levelId <= to);
  if (!tier) throw new RangeError(`No difficulty tier configured for Level ${levelId}`);

  const progress = tier.to === tier.from
    ? 1
    : (levelId - tier.from) / (tier.to - tier.from);
  // Never fill a board: a nearly full grid has almost no free cells left for two
  // levels to look different, and long paths get much harder to find.
  const capacity = Math.floor(tier.gridSize * tier.gridSize * 0.9);
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

/**
 * Bounded, deterministic search for a long self-avoiding path.
 *
 * Two orderings are used because they produce very different shapes: the
 * Warnsdorff order hugs the edges and fills compactly, while the shuffled order
 * wanders. Mixing them keeps small boards from collapsing into a handful of
 * repeating layouts.
 */
function findPath(
  size: number,
  targetLength: number,
  start: Point,
  random: () => number,
  wander: boolean,
  budget = 20_000,
): Point[] | null {
  const path: Point[] = [start];
  const visited = new Set([key(start)]);
  let remainingWork = budget;

  const extend = (current: Point): boolean => {
    if (path.length === targetLength) return true;
    if (--remainingWork <= 0) return false;

    const candidates = neighbors(current, size)
      .filter(point => !visited.has(key(point)))
      .map(point => ({
        point,
        onward: neighbors(point, size).filter(next => !visited.has(key(next))).length,
        tieBreaker: random(),
      }));

    if (wander) {
      candidates.sort((a, b) => a.tieBreaker - b.tieBreaker);
    } else {
      candidates.sort((a, b) => a.onward - b.onward || a.tieBreaker - b.tieBreaker);
    }

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

/** A guaranteed fallback: serpentine rows in a shuffled order, cut to length. */
function makeConstructivePath(size: number, length: number, random: () => number): Point[] {
  const rows = Array.from({ length: size }, (_, index) => index);
  for (let index = rows.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [rows[index], rows[swap]] = [rows[swap], rows[index]];
  }

  const path: Point[] = [];
  rows.forEach((row, position) => {
    const leftToRight = position % 2 === 0;
    for (let step = 0; step < size; step++) {
      path.push({ x: leftToRight ? step : size - 1 - step, y: row });
    }
  });

  const offset = Math.floor(random() * Math.max(1, path.length - length + 1));
  return path.slice(offset, offset + length);
}

const levelCache = new Map<number, GeneratedLevel>();
/** Node sets already used, grouped by grid size, as bitmasks. */
const usedMasks = new Map<number, Mask[]>();
let lastDifficulty = 0;
let lastNodes = 0;

/** Deterministic candidate used by the variant table below and by its tooling. */
export function createCandidate(levelId: number, variant: number, extraNodes = 0): GeneratedLevel {
  const shape = getLevelShape(levelId);
  const gridSize = shape.gridSize;
  const capacity = Math.floor(gridSize * gridSize * 0.9);
  const targetLength = Math.min(capacity, shape.targetLength + extraNodes);
  const random = mulberry32(levelId * 9973 + 12345 + variant * 0x9E3779B9);
  let solution: Point[] | null = null;

  // A couple of different starts and both orderings, because one unlucky start
  // can exhaust the budget on a long path even when the grid has plenty of room.
  for (let attempt = 0; attempt < 4 && !solution; attempt++) {
    const start = {
      x: Math.floor(random() * gridSize),
      y: Math.floor(random() * gridSize),
    };
    // Half of the variants wander instead of hugging edges, so shapes vary.
    solution = findPath(gridSize, targetLength, start, random, (variant + attempt) % 2 === 1);
  }

  solution ??= makeConstructivePath(gridSize, targetLength, random);

  return {
    id: levelId,
    gridSize,
    start: solution[0],
    nodes: [...solution].sort((a, b) => (a.y - b.y) || (a.x - b.x)),
    solution,
  };
}

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
 * Two boards that differ by only a cell or two look like the same puzzle.
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
 * Visual separation that grows with the board. The floor of three cells keeps
 * even the tutorial boards from looking like a one-node edit of each other.
 */
function requiredDistance(nodeCount: number): number {
  return Math.min(10, Math.max(3, Math.round(nodeCount * 0.18)));
}

/**
 * Edges between adjacent nodes that are not consecutive steps of the solution.
 * These are the junctions where a player has a real choice, so more of them
 * means a more demanding layout. A corridor has zero. This value is stable for
 * replay and does not depend on how the player solves the level.
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

/** Structural difficulty: more nodes and more junctions both raise it. */
export function getLevelDifficulty(level: GeneratedLevel): number {
  return level.nodes.length + countBranchingEdges(level.solution);
}

/**
 * A finished path is only usable as a ghost/record when it still matches the
 * current layout: it must start on the start node, visit every node exactly
 * once, and only take orthogonal steps. This also hides old ghosts after a
 * level layout update.
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
  difficulty: number;
  distance: number;
  variant: number;
  extraNodes: number;
}

/** Difficulty the next level has to reach; the opening and closing stay strict. */
function difficultyFloor(levelId: number): number {
  if (levelId === 1) return 0;
  const strict = levelId <= STRICT_OPENING_THROUGH || levelId >= STRICT_TAIL_FROM;
  return lastDifficulty + (strict ? 1 : 0);
}

/**
 * Every hard rule a finished layout has to satisfy, checked in one place so the
 * search, the baked table and the repair tooling can never disagree.
 */
function meetsRules(levelId: number, level: GeneratedLevel): boolean {
  if (level.nodes.length < lastNodes) return false;
  if (getLevelDifficulty(level) < difficultyFloor(levelId)) return false;
  if (levelId > NON_CORRIDOR_FROM && countBranchingEdges(level.solution) < MIN_BRANCHING_EDGES) return false;

  const distance = minLayoutDistance(level, usedMasks.get(level.gridSize));
  return distance > 0 && distance >= requiredDistance(level.nodes.length);
}

/**
 * Picks the layout for one level.
 *
 * Hard rules: never easier than the previous level, strictly harder at the very
 * start and in the closing stretch, and visually distinct from every level
 * already used on the same grid. Within those rules the smallest step that
 * still fits the tier is preferred, so the curve climbs gradually instead of
 * burning its headroom early.
 */
function collectOptions(
  levelId: number,
  extraNodes: number,
  floor: number,
  stored: Mask[],
  furthest: { current: Candidate | null },
): Candidate[] {
  const options: Candidate[] = [];

  for (let variant = 0; variant < VARIANT_LIMIT; variant++) {
    const level = createCandidate(levelId, variant, extraNodes);
    if (level.nodes.length < lastNodes) continue;
    const difficulty = getLevelDifficulty(level);
    const distance = minLayoutDistance(level, stored);
    if (distance === 0) continue;

    // After the hand-held opening a level must offer real choices, otherwise it
    // is just a corridor with nodes laid along it.
    if (levelId > NON_CORRIDOR_FROM && countBranchingEdges(level.solution) < MIN_BRANCHING_EDGES) continue;

    const candidate: Candidate = { level, difficulty, distance, variant, extraNodes };
    if (!furthest.current || distance > furthest.current.distance) {
      furthest.current = candidate;
    }
    if (difficulty < floor) continue;
    if (distance < requiredDistance(level.nodes.length)) continue;

    options.push(candidate);
    if (options.length >= 4) break;
  }

  return options;
}

/**
 * Full search for a level: tries the tier's variants, escalating by one node
 * when the layout cannot climb above the previous level.
 *
 * This is the slow path. It is used to build VARIANT_TABLE offline and as a
 * runtime fallback if the table ever falls out of sync with the tiers.
 */
function searchLevel(levelId: number): Candidate {
  const { gridSize } = getLevelShape(levelId);
  const stored = usedMasks.get(gridSize) ?? [];
  const floor = difficultyFloor(levelId);
  const furthest: { current: Candidate | null } = { current: null };

  // A level that cannot climb above the previous one takes an extra node: more
  // nodes is what actually makes it harder, and the tiers keep enough headroom
  // for that to stay below a nearly full board.
  for (let extraNodes = 0; extraNodes <= 3; extraNodes++) {
    const options = collectOptions(levelId, extraNodes, floor, stored, furthest);
    if (options.length === 0) continue;
    options.sort((a, b) => a.difficulty - b.difficulty || b.distance - a.distance);
    return options[0];
  }

  if (!furthest.current) throw new Error(`Could not create a layout for level ${levelId}`);
  return furthest.current;
}

/**
 * One packed entry per level: `variant * 4 + extraNodes`.
 *
 * The variants were chosen offline so that every layout stays visually
 * distinct, difficulty never drops, and the first and last levels sit at the
 * ends of the curve. Picking them at runtime would cost seconds on a phone, so
 * they are baked in and verified by the generator tests instead.
 */
const VARIANT_TABLE: number[] = [
  0, 12, 68, 0, 20, 108, 228, 28, 16, 4, 36, 4, 24, 0, 28, 4, 12, 4, 16, 4,
  8, 36, 4, 16, 20, 8, 12, 8, 32, 16, 4, 36, 4, 104, 36, 56, 20, 68, 124, 4,
  0, 12, 0, 4, 20, 20, 12, 12, 4, 12, 20, 8, 8, 48, 88, 88, 52, 56, 12, 16,
  96, 200, 60, 244, 168, 24, 68, 52, 132, 16, 32, 12, 264, 164, 28, 4, 28, 4, 0, 60,
  56, 52, 4, 44, 120, 48, 20, 100, 68, 12, 280, 116, 144, 188, 84, 236, 116, 4, 212, 88,
  4, 24, 80, 92, 64, 120, 160, 84, 172, 16, 204, 44, 108, 112, 100, 32, 52, 24, 4, 16,
  12, 0, 52, 4, 16, 28, 28, 4, 52, 8, 12, 36, 20, 32, 8, 12, 40, 12, 56, 8,
  116, 104, 44, 56, 300, 136, 276, 364, 260, 276, 8, 64, 188, 40, 0, 64, 16, 184, 184, 216,
  76, 72, 76, 208, 80, 64, 92, 12, 40, 64, 56, 104, 84, 80, 0, 280, 348, 128, 344, 52,
  80, 348, 47, 115, 82, 62, 30, 94, 145, 57, 4, 104, 72, 332, 176, 12, 96, 68, 76, 36,
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

  const variant = packed >> 2;
  const extraNodes = packed & 3;
  return {
    level: createCandidate(levelId, variant, extraNodes),
    difficulty: 0,
    distance: 0,
    variant,
    extraNodes,
  };
}

function resetGenerator() {
  levelCache.clear();
  usedMasks.clear();
  lastDifficulty = 0;
  lastNodes = 0;
}

function commitLevel(id: number, candidate: Candidate) {
  const level = candidate.level;
  usedMasks.set(level.gridSize, [...(usedMasks.get(level.gridSize) ?? []), toMask(level, 0)]);
  levelCache.set(id, level);
  lastDifficulty = Math.max(lastDifficulty, getLevelDifficulty(level));
  lastNodes = Math.max(lastNodes, level.nodes.length);
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
      const variant = packed >> 2;
      const extraNodes = packed & 3;
      const level = createCandidate(id, variant, extraNodes);
      if (meetsRules(id, level)) stored = { level, difficulty: 0, distance: 0, variant, extraNodes };
    }

    const candidate = stored ?? searchLevel(id);
    repaired[id - 1] = candidate.variant * 4 + candidate.extraNodes;
    commitLevel(id, candidate);
  }

  resetGenerator();
  return repaired;
}

export function generateLevel(levelId: number): GeneratedLevel {
  if (!Number.isInteger(levelId) || levelId < 1 || levelId > MAX_LEVEL_ID) {
    throw new RangeError(`Level id must be an integer from 1 to ${MAX_LEVEL_ID}. Received: ${levelId}`);
  }
  generateThrough(levelId);
  return levelCache.get(levelId)!;
}
