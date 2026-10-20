import type { LevelData, Point } from "./schema";

/**
 * Additive level mechanics. Every rule is derived from the canonical solution,
 * so the original solution always stays valid. Walls and portals are optional
 * decoration/shortcuts and can never make a level unsolvable.
 */
export interface OneWayNode {
  point: Point;
  dx: number;
  dy: number;
}

export interface ColorPair {
  first: Point;
  second: Point;
  color: string;
}

export interface PortalPair {
  a: Point;
  b: Point;
}

export interface LevelMechanics {
  isBoss: boolean;
  walls: Point[];
  oneWays: OneWayNode[];
  pairs: ColorPair[];
  portals: PortalPair[];
  parMultiplier: number;
}

export const EMPTY_MECHANICS: LevelMechanics = {
  isBoss: false,
  walls: [],
  oneWays: [],
  pairs: [],
  portals: [],
  parMultiplier: 1,
};

const PAIR_COLORS = ["#ff6ec7", "#ffd700"];

const key = (point: Point) => `${point.x},${point.y}`;

function seededRandom(seed: number) {
  let state = (seed * 2654435761) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function emptyCells(level: LevelData, solution: Point[]): Point[] {
  const blocked = new Set([...level.nodes, ...solution].map(key));
  const cells: Point[] = [];
  for (let y = 0; y < level.gridSize; y++) {
    for (let x = 0; x < level.gridSize; x++) {
      const point = { x, y };
      if (!blocked.has(key(point))) cells.push(point);
    }
  }
  return cells;
}

export function getLevelMechanics(level: LevelData, solution: Point[]): LevelMechanics {
  const levelId = level.id;
  const isBoss = levelId % 25 === 0;
  const random = seededRandom(levelId * 97 + 13);
  const empty = emptyCells(level, solution);

  const walls: Point[] = [];
  if (levelId >= 11) {
    const wallCount = Math.min(empty.length, isBoss ? 6 : 4, 3 + Math.floor(levelId / 50));
    const pool = [...empty];
    while (walls.length < wallCount && pool.length > 0) {
      const index = Math.floor(random() * pool.length);
      walls.push(pool.splice(index, 1)[0]);
    }
  }

  const oneWays: OneWayNode[] = [];
  if (levelId >= 51 && solution.length > 4) {
    const fractions = levelId >= 126 ? [0.22, 0.48, 0.74] : [0.3, 0.62];
    fractions.forEach((fraction, index) => {
      if (index > 0 && levelId < 101) return;
      const pathIndex = Math.min(solution.length - 2, Math.max(1, Math.floor(solution.length * fraction)));
      const point = solution[pathIndex];
      const next = solution[pathIndex + 1];
      if (!point || !next) return;
      const dx = Math.sign(next.x - point.x);
      const dy = Math.sign(next.y - point.y);
      if (Math.abs(dx) + Math.abs(dy) !== 1) return;
      if (oneWays.some(entry => entry.point.x === point.x && entry.point.y === point.y)) return;
      oneWays.push({ point, dx, dy });
    });
  }

  const pairs: ColorPair[] = [];
  if (levelId >= 76 && solution.length > 8) {
    const pairCount = levelId >= 126 ? 2 : 1;
    const ranges = [
      [0.2, 0.65],
      [0.45, 0.9],
    ];
    const paired = new Set<string>();
    for (let index = 0; index < pairCount; index++) {
      const [from, to] = ranges[index];
      const first = solution[Math.floor(solution.length * from)];
      const second = solution[Math.floor(solution.length * to)];
      if (!first || !second || key(first) === key(second)) continue;
      // One node can only carry one ring: overlapping pairs would overwrite each
      // other in the render map and make the visible order contradict the rules.
      if (paired.has(key(first)) || paired.has(key(second))) continue;
      pairs.push({ first, second, color: PAIR_COLORS[index % PAIR_COLORS.length] });
      paired.add(key(first));
      paired.add(key(second));
    }
  }

  const portals: PortalPair[] = [];
  if (levelId >= 101 && empty.length >= 2) {
    const usedWalls = new Set(walls.map(key));
    const pool = empty.filter(cell => !usedWalls.has(key(cell)));
    const adjacentToNode = (cell: Point) => level.nodes.some(node =>
      Math.abs(node.x - cell.x) + Math.abs(node.y - cell.y) === 1,
    );
    const candidates = pool.filter(adjacentToNode);
    if (candidates.length >= 2) {
      const firstIndex = Math.floor(random() * candidates.length);
      const a = candidates.splice(firstIndex, 1)[0];
      const secondIndex = Math.floor(random() * candidates.length);
      const b = candidates[secondIndex];
      if (a && b) portals.push({ a, b });
    }
  }

  return {
    isBoss,
    walls,
    oneWays,
    pairs,
    portals,
    parMultiplier: isBoss ? 1.15 : 1,
  };
}

/**
 * Validate a path that was actually played, rather than the canonical solution.
 * Played paths can contain portal pads: stepping onto one appends both the pad
 * and its twin, so the node-only checker would reject every portal run and the
 * personal-best ghost would silently disappear after a reload.
 */
export function isValidPlayerPath(
  path: Point[],
  level: LevelData,
  mechanics: LevelMechanics,
): boolean {
  if (!Array.isArray(path) || path.length === 0) return false;
  if (path[0]?.x !== level.start.x || path[0]?.y !== level.start.y) return false;

  const nodes = new Set(level.nodes.map(key));
  if (!nodes.has(key(level.start))) return false;

  // Walls are decorative in the current rules, so a played path may cross them.
  const portals = new Map<string, Point>();
  mechanics.portals.forEach(pair => {
    portals.set(key(pair.a), pair.b);
    portals.set(key(pair.b), pair.a);
  });

  const seen = new Set<string>([key(path[0])]);
  const visitedNodes = new Set<string>([key(path[0])]);
  let head = path[0];

  for (let index = 1; index < path.length; index++) {
    const point = path[index];
    if (!Number.isInteger(point?.x) || !Number.isInteger(point?.y)) return false;

    const pointKey = key(point);
    if (seen.has(pointKey)) return false;
    if (Math.abs(point.x - head.x) + Math.abs(point.y - head.y) !== 1) return false;

    const twin = portals.get(pointKey);
    if (twin && !seen.has(key(twin))) {
      // A step onto an unused pad teleports immediately, so the recorded path
      // must contain the twin as the very next point.
      const hop = path[index + 1];
      if (!hop || hop.x !== twin.x || hop.y !== twin.y) return false;
      if (nodes.has(pointKey) || nodes.has(key(hop))) return false;
      seen.add(pointKey);
      seen.add(key(hop));
      head = hop;
      index += 1;
      continue;
    }

    if (!nodes.has(pointKey) && !portals.has(pointKey)) return false;
    seen.add(pointKey);
    if (nodes.has(pointKey)) visitedNodes.add(pointKey);
    head = point;
  }

  return visitedNodes.size === nodes.size;
}

/** Mirror a level horizontally for the weekly "mirror" modifier. */
export function mirrorLevel<T extends LevelData>(level: T, solution: Point[]): { level: T; solution: Point[] } {
  const flip = (point: Point): Point => ({ x: level.gridSize - 1 - point.x, y: point.y });
  return {
    level: {
      ...level,
      start: flip(level.start),
      nodes: level.nodes.map(flip),
    },
    solution: solution.map(flip),
  };
}
