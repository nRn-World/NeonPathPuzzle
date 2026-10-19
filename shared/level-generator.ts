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
  startCoverage: number;
  endCoverage: number;
}

/**
 * The visual component scales with gridSize, so difficulty can increase
 * without changing the canvas, controls, or screen layout.
 */
const DIFFICULTY_TIERS: DifficultyTier[] = [
  { from: 1, to: 3, gridSize: 3, startCoverage: 0.55, endCoverage: 0.78 },
  { from: 4, to: 9, gridSize: 4, startCoverage: 0.50, endCoverage: 0.68 },
  { from: 10, to: 12, gridSize: 4, startCoverage: 0.70, endCoverage: 0.82 },
  { from: 13, to: 20, gridSize: 5, startCoverage: 0.58, endCoverage: 0.76 },
  { from: 21, to: 23, gridSize: 5, startCoverage: 0.76, endCoverage: 0.82 },
  { from: 24, to: 29, gridSize: 6, startCoverage: 0.62, endCoverage: 0.78 },
  { from: 30, to: 39, gridSize: 6, startCoverage: 0.80, endCoverage: 0.88 },
  { from: 40, to: 50, gridSize: 7, startCoverage: 0.78, endCoverage: 0.88 },
  { from: 51, to: 75, gridSize: 8, startCoverage: 0.78, endCoverage: 0.88 },
  { from: 76, to: 100, gridSize: 8, startCoverage: 0.89, endCoverage: 0.95 },
  { from: 101, to: 125, gridSize: 9, startCoverage: 0.86, endCoverage: 0.93 },
  { from: 126, to: 150, gridSize: 9, startCoverage: 0.93, endCoverage: 0.97 },
  { from: 151, to: 175, gridSize: 10, startCoverage: 0.92, endCoverage: 0.97 },
  { from: 176, to: 200, gridSize: 10, startCoverage: 0.97, endCoverage: 0.99 },
];

function getLevelShape(levelId: number) {
  const tier = DIFFICULTY_TIERS.find(({ from, to }) => levelId >= from && levelId <= to);
  if (!tier) throw new RangeError(`No difficulty tier configured for Level ${levelId}`);

  const progress = tier.to === tier.from
    ? 1
    : (levelId - tier.from) / (tier.to - tier.from);
  const coverage = tier.startCoverage
    + (tier.endCoverage - tier.startCoverage) * progress;

  return {
    gridSize: tier.gridSize,
    targetLength: Math.max(
      3,
      Math.round(tier.gridSize * tier.gridSize * coverage),
    ),
  };
}

function key(point: Point) {
  return `${point.x},${point.y}`;
}

function neighbors(point: Point, size: number) {
  return [
    { x: point.x, y: point.y - 1 },
    { x: point.x, y: point.y + 1 },
    { x: point.x - 1, y: point.y },
    { x: point.x + 1, y: point.y },
  ].filter(({ x, y }) => x >= 0 && x < size && y >= 0 && y < size);
}

/** Bounded, deterministic search for a long self-avoiding path. */
function findPath(
  size: number,
  targetLength: number,
  start: Point,
  random: () => number,
): Point[] | null {
  const path: Point[] = [start];
  const visited = new Set([key(start)]);
  let remainingWork = 20_000;

  const extend = (current: Point): boolean => {
    if (path.length === targetLength) return true;
    if (--remainingWork <= 0) return false;

    const candidates = neighbors(current, size)
      .filter(point => !visited.has(key(point)))
      .map(point => ({
        point,
        onward: neighbors(point, size).filter(next => !visited.has(key(next))).length,
        tieBreaker: random(),
      }))
      .sort((a, b) => a.onward - b.onward || a.tieBreaker - b.tieBreaker);

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

function makeSnake(size: number): Point[] {
  const path: Point[] = [];
  for (let y = 0; y < size; y++) {
    if (y % 2 === 0) {
      for (let x = 0; x < size; x++) path.push({ x, y });
    } else {
      for (let x = size - 1; x >= 0; x--) path.push({ x, y });
    }
  }
  return path;
}

function makeEvenGridCycle(size: number): Point[] {
  const cycle: Point[] = [{ x: 0, y: 0 }];
  for (let x = 1; x < size; x++) cycle.push({ x, y: 0 });
  for (let x = size - 1; x >= 1; x--) {
    if ((size - 1 - x) % 2 === 0) {
      for (let y = 1; y < size; y++) cycle.push({ x, y });
    } else {
      for (let y = size - 1; y >= 1; y--) cycle.push({ x, y });
    }
  }
  for (let y = size - 1; y >= 1; y--) cycle.push({ x: 0, y });
  return cycle;
}

/** Always returns an adjacent, non-repeating path in bounded time. */
function makeConstructivePath(size: number, length: number, levelId: number): Point[] {
  if (size % 2 === 0) {
    let cycle = makeEvenGridCycle(size);
    cycle = cycle.map(point => transform(point, size, Math.floor(levelId / size) % 8));
    if (levelId % 2 === 0) cycle.reverse();
    const offset = (levelId * 17 + Math.floor(levelId / 8) * 11) % cycle.length;
    return Array.from({ length }, (_, index) => cycle[(offset + index) % cycle.length]);
  }

  let snake = makeSnake(size).map(point => transform(point, size, levelId % 8));
  if (levelId % 2 === 0) snake.reverse();
  const maxOffset = snake.length - length;
  const offset = maxOffset > 0 ? (levelId * 7) % (maxOffset + 1) : 0;
  return snake.slice(offset, offset + length);
}

/**
 * Precomputed candidate variant for every level. The variants were selected
 * offline so that structured difficulty (node count + extra branches between
 * non-consecutive path cells) never decreases from one level to the next.
 * Without this, a random candidate could be a wide-open corridor and feel much
 * easier than an earlier, smaller level. See getLevelDifficulty().
 */
const SELECTED_VARIANTS = [
  0, 0, 1, 0, 1, 0, 2, 4, 1, 2, 0, 0, 1, 0, 102, 29, 44, 13, 27, 0,
  34, 0, 0, 3, 5, 11, 6, 40, 69, 5, 9, 2, 1, 9, 59, 9, 8, 0, 0, 30,
  1, 26, 42, 15, 9, 11, 2, 5, 0, 8, 31, 14, 0, 5, 1, 9, 3, 7, 7, 1,
  16, 13, 22, 7, 12, 22, 3, 16, 2, 2, 4, 0, 208, 67, 4, 9, 9, 0, 2, 0,
  4, 9, 3, 14, 9, 1, 0, 17, 10, 77, 34, 0, 0, 4, 90, 13, 156, 129, 230, 0,
  13, 105, 103, 8, 18, 8, 19, 0, 96, 18, 18, 1, 4, 44, 9, 3, 3, 39, 15, 0,
  0, 18, 1, 3, 3, 48, 103, 0, 0, 2, 0, 2, 1, 73, 0, 0, 5, 0, 4, 0,
  15, 1, 7, 0, 0, 0, 1, 0, 0, 0, 9, 1, 0, 16, 42, 7, 23, 15, 13, 43,
  26, 15, 11, 15, 8, 18, 6, 110, 15, 55, 5, 73, 1, 0, 0, 0, 0, 0, 1, 1,
  1, 121, 121, 6, 92, 32, 59, 142, 56, 197, 1, 0, 0, 2, 1, 0, 2, 2, 3, 6,
];

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

const levelCache = new Map<number, GeneratedLevel>();
const usedLayouts = new Set<string>();
let lastDifficulty = 0;

function createCandidate(levelId: number, variant: number): GeneratedLevel {
  const { gridSize, targetLength } = getLevelShape(levelId);
  const random = mulberry32(levelId * 9973 + 12345 + variant * 0x9E3779B9);
  let solution: Point[] | null = null;

  for (let attempt = 0; attempt < 4 && !solution; attempt++) {
    const start = {
      x: Math.floor(random() * gridSize),
      y: Math.floor(random() * gridSize),
    };
    solution = findPath(gridSize, targetLength, start, random);
  }

  solution ??= makeConstructivePath(gridSize, targetLength, levelId + variant * 211);

  return {
    id: levelId,
    gridSize,
    start: solution[0],
    nodes: [...solution].sort((a, b) => (a.y - b.y) || (a.x - b.x)),
    solution,
  };
}

/** Treat rotations and mirror images as the same visual layout. */
function layoutSignature(level: GeneratedLevel) {
  const signatures = Array.from({ length: 8 }, (_, variant) => {
    const transformed = level.nodes
      .map(node => transform(node, level.gridSize, variant))
      .sort((a, b) => (a.y - b.y) || (a.x - b.x));
    return `${level.gridSize}|${transformed.map(node => `${node.x},${node.y}`).join(";")}`;
  });

  return signatures.sort()[0];
}

function generateThrough(targetLevelId: number) {
  for (let id = levelCache.size + 1; id <= targetLevelId; id++) {
    let uniqueLevel = createCandidate(id, SELECTED_VARIANTS[id - 1] ?? 0);

    // The selected variant is unique by construction, but keep a deterministic
    // fallback so a future tier edit cannot break generation.
    if (usedLayouts.has(layoutSignature(uniqueLevel))) {
      let fallback: GeneratedLevel | undefined;
      let fallbackDifficulty = -1;
      let fallbackAboveLast: GeneratedLevel | undefined;

      for (let variant = 0; variant < 256; variant++) {
        const candidate = createCandidate(id, variant);
        if (usedLayouts.has(layoutSignature(candidate))) continue;
        const difficulty = getLevelDifficulty(candidate);
        if (difficulty > fallbackDifficulty) {
          fallback = candidate;
          fallbackDifficulty = difficulty;
        }
        if (difficulty >= lastDifficulty && !fallbackAboveLast) {
          fallbackAboveLast = candidate;
        }
      }

      if (!fallback) throw new Error(`Could not create a unique layout for level ${id}`);
      uniqueLevel = fallbackAboveLast ?? fallback;
    }

    usedLayouts.add(layoutSignature(uniqueLevel));
    levelCache.set(id, uniqueLevel);
    lastDifficulty = Math.max(lastDifficulty, getLevelDifficulty(uniqueLevel));
  }
}

export function generateLevel(levelId: number): GeneratedLevel {
  if (!Number.isInteger(levelId) || levelId < 1 || levelId > 200) {
    throw new RangeError(`Level id must be an integer from 1 to 200. Received: ${levelId}`);
  }
  generateThrough(levelId);
  return levelCache.get(levelId)!;
}
