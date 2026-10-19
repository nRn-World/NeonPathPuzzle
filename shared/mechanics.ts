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
    for (let index = 0; index < pairCount; index++) {
      const [from, to] = ranges[index];
      const first = solution[Math.floor(solution.length * from)];
      const second = solution[Math.floor(solution.length * to)];
      if (!first || !second || key(first) === key(second)) continue;
      if (pairs.some(pair => key(pair.first) === key(second))) continue;
      pairs.push({ first, second, color: PAIR_COLORS[index % PAIR_COLORS.length] });
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
