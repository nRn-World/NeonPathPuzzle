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

/** A node that must be the `step`-th node of the line (0 = start). */
export interface SyncNode {
  point: Point;
  step: number;
}

/**
 * The Rift rules. A line's "position" counts its nodes with the start as 1.
 * A phase node may only be entered at an even (parity 0) or odd (parity 1) position.
 */
export interface PhaseNode {
  point: Point;
  parity: 0 | 1;
}

/** An arrow that points `dx,dy` while the line's head has this parity, and the opposite way otherwise. */
export interface FlipArrow {
  point: Point;
  dx: number;
  dy: number;
  parity: 0 | 1;
}

export interface LevelMechanics {
  isBoss: boolean;
  syncNodes: SyncNode[];
  phaseNodes: PhaseNode[];
  flipArrows: FlipArrow[];
  /** Unvisited nodes far from the line's head are dimmed. */
  blackout: boolean;
  walls: Point[];
  oneWays: OneWayNode[];
  pairs: ColorPair[];
  portals: PortalPair[];
  parMultiplier: number;
}

export const EMPTY_MECHANICS: LevelMechanics = {
  isBoss: false,
  syncNodes: [],
  phaseNodes: [],
  flipArrows: [],
  blackout: false,
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

  // Sync nodes sit on solution steps no other rule has claimed, so every badge
  // is readable and the canonical solution satisfies all of them at once.
  const syncNodes: SyncNode[] = [];
  if (levelId >= 201 && solution.length > 12) {
    const claimed = new Set([
      ...oneWays.map(rule => key(rule.point)),
      ...pairs.flatMap(pair => [key(pair.first), key(pair.second)]),
    ]);
    const count = levelId >= 276 ? 4 : levelId >= 226 ? 3 : 2;
    for (let index = 0; index < count; index++) {
      let step = Math.floor(solution.length * (index + 1) / (count + 1));
      while (step < solution.length - 1 && claimed.has(key(solution[step]))) step++;
      if (step < 1 || claimed.has(key(solution[step]))) continue;
      claimed.add(key(solution[step]));
      syncNodes.push({ point: solution[step], step });
    }
  }

  // The Rift (levels 301-330): parity rules, derived from the same solution so it stays valid.
  const phaseNodes: PhaseNode[] = [];
  const flipArrows: FlipArrow[] = [];
  if (levelId >= 301 && solution.length > 12) {
    const claimed = new Set([
      ...oneWays.map(rule => key(rule.point)),
      ...pairs.flatMap(pair => [key(pair.first), key(pair.second)]),
      ...syncNodes.map(node => key(node.point)),
    ]);
    const free = (step: number) => step >= 1 && step < solution.length - 1 && !claimed.has(key(solution[step]));
    const place = (target: number) => {
      let step = Math.floor(target);
      while (step < solution.length - 1 && !free(step)) step++;
      return free(step) ? step : null;
    };

    const phaseCount = 3 + Math.floor((levelId - 301) / 8);
    for (let index = 0; index < phaseCount; index++) {
      const step = place(solution.length * (index + 0.5) / phaseCount);
      if (step === null) continue;
      claimed.add(key(solution[step]));
      phaseNodes.push({ point: solution[step], parity: ((step + 1) % 2) as 0 | 1 });
    }

    if (levelId >= 316) {
      const flipCount = 3 + Math.floor((levelId - 316) / 5);
      for (let index = 0; index < flipCount; index++) {
        const step = place(solution.length * (index + 0.25) / flipCount);
        if (step === null) continue;
        const point = solution[step];
        const next = solution[step + 1];
        const dx = Math.sign(next.x - point.x);
        const dy = Math.sign(next.y - point.y);
        if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
        claimed.add(key(point));
        flipArrows.push({ point, dx, dy, parity: ((step + 1) % 2) as 0 | 1 });
      }
    }
  }

  return {
    isBoss,
    syncNodes,
    phaseNodes,
    flipArrows,
    // The first half of the Rift introduces the new rules on a lit board.
    blackout: levelId >= 251 && !(levelId >= 301 && levelId <= 315),
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

/**
 * The move rules of the game, shared by the canvas and the solvability tests so
 * the two can never disagree. `step` returns the extended path, or null when
 * the move is illegal. Stepping back onto the previous point (undo) is the
 * caller's business and is reported as illegal here.
 */
export function createMoveRules(level: LevelData, mechanics: LevelMechanics) {
  const nodeKeys = new Set(level.nodes.map(key));
  const portals = new Map<string, Point>();
  mechanics.portals.forEach(pair => {
    portals.set(key(pair.a), pair.b);
    portals.set(key(pair.b), pair.a);
  });
  const oneWays = new Map(mechanics.oneWays.map(rule => [key(rule.point), rule]));
  const secondOfPair = new Map(mechanics.pairs.map(pair => [key(pair.second), key(pair.first)]));
  const syncSteps = new Map(mechanics.syncNodes.map(node => [key(node.point), node.step]));
  const phases = new Map(mechanics.phaseNodes.map(node => [key(node.point), node.parity]));
  const flips = new Map(mechanics.flipArrows.map(rule => [key(rule.point), rule]));

  const visitedNodeCount = (path: Point[]) => path.filter(point => nodeKeys.has(key(point))).length;

  const step = (path: Point[], target: Point): Point[] | null => {
    const head = path[path.length - 1];
    if (!head) return null;
    if (Math.abs(target.x - head.x) + Math.abs(target.y - head.y) !== 1) return null;

    const targetKey = key(target);
    const twin = portals.get(targetKey);
    if (!nodeKeys.has(targetKey) && !twin) return null;
    if (path.some(point => key(point) === targetKey)) return null;

    const oneWay = oneWays.get(key(head));
    if (oneWay && (target.x - head.x !== oneWay.dx || target.y - head.y !== oneWay.dy)) return null;

    const flip = flips.get(key(head));
    if (flip) {
      const sign = visitedNodeCount(path) % 2 === flip.parity ? 1 : -1;
      if (target.x - head.x !== flip.dx * sign || target.y - head.y !== flip.dy * sign) return null;
    }

    const partner = secondOfPair.get(targetKey);
    if (partner && !path.some(point => key(point) === partner)) return null;

    const sync = syncSteps.get(targetKey);
    if (sync !== undefined && visitedNodeCount(path) !== sync) return null;

    const phase = phases.get(targetKey);
    if (phase !== undefined && (visitedNodeCount(path) + 1) % 2 !== phase) return null;

    const next = [...path, target];
    if (twin && !next.some(point => key(point) === key(twin))) next.push({ ...twin });
    return next;
  };

  const isComplete = (path: Point[]) => visitedNodeCount(path) === nodeKeys.size;

  /** True when the head has no legal forward move and the board is unfinished. */
  const isStuck = (path: Point[]) => {
    if (isComplete(path)) return false;
    const head = path[path.length - 1];
    if (!head) return false;
    return [[0, -1], [0, 1], [-1, 0], [1, 0]]
      .every(([dx, dy]) => step(path, { x: head.x + dx, y: head.y + dy }) === null);
  };

  return { step, isComplete, isStuck, visitedNodeCount };
}
