import type { Point } from "./schema";

/**
 * Kedjan: the line the player drew becomes walls on the next board. The board
 * is a random self-avoiding walk that avoids those walls, so the walk itself is
 * the solution and every board is solvable by construction.
 */

export const CHAIN_MIN_GRID = 4;
export const CHAIN_MAX_GRID = 7;
/** Walls never cover more than this share of the grid. */
export const CHAIN_MAX_WALL_SHARE = 0.22;
/** Share of the grid that the line has to visit. */
const NODE_SHARE = 0.55;
/** Free undo steps per board. */
export const CHAIN_UNDOS = 3;
const WALK_BUDGET = 4000;
const WALK_TRIES = 12;

const DIRS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export interface ChainBoard {
  gridSize: number;
  start: Point;
  /** Cells the line must visit. */
  nodes: Point[];
  /** Blocked cells, left over from the previous line. Never nodes. */
  walls: Point[];
  /** A line that visits every node once: proof the board can be solved. */
  solution: Point[];
  /** Walls the previous line asked for that were dropped to keep the board solvable. */
  droppedWalls: number;
}

export interface PreviousLine {
  path: Point[];
  gridSize: number;
}

const keyOf = (point: Point) => `${point.x},${point.y}`;
const inBounds = (point: Point, size: number) =>
  point.x >= 0 && point.y >= 0 && point.x < size && point.y < size;

/** Grows slowly: 4x4 for the first chains, 7x7 from chain 10 on. */
export function gridSizeForChain(chain: number): number {
  const safe = Number.isFinite(chain) ? Math.max(1, Math.floor(chain)) : 1;
  return Math.min(CHAIN_MAX_GRID, CHAIN_MIN_GRID + Math.floor((safe - 1) / 3));
}

export function nodeCountFor(gridSize: number): number {
  return Math.round(gridSize * gridSize * NODE_SHARE);
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** Walls from the previous line: its turns first, then every third cell. Moved into the new grid. */
export function pickWalls(previous: PreviousLine, gridSize: number, random: () => number): Point[] {
  const cap = Math.floor(gridSize * gridSize * CHAIN_MAX_WALL_SHARE);
  const { path } = previous;
  const offset = Math.max(0, Math.floor((gridSize - previous.gridSize) / 2));
  const turns: number[] = [];
  const spaced: number[] = [];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1];
    const b = path[i];
    const c = path[i + 1];
    const turn = b.x - a.x !== c.x - b.x || b.y - a.y !== c.y - b.y;
    if (turn) turns.push(i);
    else if (i % 3 === 0) spaced.push(i);
  }
  const chosen = [...shuffle(turns, random), ...shuffle(spaced, random)].slice(0, cap);
  return chosen
    .map(i => ({ x: path[i].x + offset, y: path[i].y + offset }))
    .filter(point => inBounds(point, gridSize));
}

/** Depth-first search for a self-avoiding walk of exact length. Bounded, so it always returns. */
function findWalk(
  size: number,
  start: Point,
  blocked: Set<string>,
  length: number,
  random: () => number,
): Point[] | null {
  const path: Point[] = [start];
  const used = new Set([keyOf(start)]);
  const open = (point: Point) =>
    shuffle(
      DIRS.map(d => ({ x: point.x + d.x, y: point.y + d.y })).filter(
        next => inBounds(next, size) && !blocked.has(keyOf(next)) && !used.has(keyOf(next)),
      ),
      random,
    );
  const options: Point[][] = [open(start)];
  let steps = 0;

  while (path.length > 0) {
    if (path.length === length) return path;
    if (++steps > WALK_BUDGET) return null;
    const next = options[options.length - 1].pop();
    if (!next) {
      options.pop();
      used.delete(keyOf(path.pop()!));
      continue;
    }
    path.push(next);
    used.add(keyOf(next));
    options.push(open(next));
  }
  return null;
}

/** Last resort with no walls at all: a boustrophedon line from the corner. */
function snakePath(size: number, length: number): Point[] {
  const cells: Point[] = [];
  for (let y = 0; y < size; y++) {
    for (let i = 0; i < size; i++) {
      cells.push({ x: y % 2 === 0 ? i : size - 1 - i, y });
    }
  }
  return cells.slice(0, length);
}

/**
 * Builds the next board. Walls come from the previous line. If no walk fits
 * them, the walls are dropped one at a time until one does, and the snake
 * fallback guarantees the function always returns.
 */
export function generateChainBoard(
  chain: number,
  previous: PreviousLine | null,
  random: () => number = Math.random,
): ChainBoard {
  const gridSize = gridSizeForChain(chain);
  const length = nodeCountFor(gridSize);
  const requested = previous ? pickWalls(previous, gridSize, random) : [];
  let walls = requested;

  for (;;) {
    const blocked = new Set(walls.map(keyOf));
    const free: Point[] = [];
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        if (!blocked.has(keyOf({ x, y }))) free.push({ x, y });
      }
    }
    for (let attempt = 0; attempt < WALK_TRIES; attempt++) {
      const start = free[Math.floor(random() * free.length)];
      const walk = findWalk(gridSize, start, blocked, length, random);
      if (walk) {
        return { gridSize, start, nodes: walk, walls, solution: walk, droppedWalls: requested.length - walls.length };
      }
    }
    if (walls.length === 0) break;
    walls = walls.slice(0, -1);
  }

  const snake = snakePath(gridSize, length);
  return { gridSize, start: snake[0], nodes: snake, walls: [], solution: snake, droppedWalls: requested.length };
}

/** Checks a board: solution is a single line over every node, starting at start, avoiding walls. */
export function isValidChainBoard(board: ChainBoard): boolean {
  const { gridSize, start, nodes, walls, solution } = board;
  const nodeKeys = new Set(nodes.map(keyOf));
  const wallKeys = new Set(walls.map(keyOf));
  if (nodeKeys.size !== nodes.length || solution.length !== nodes.length) return false;
  if (nodes.some(p => !inBounds(p, gridSize) || wallKeys.has(keyOf(p)))) return false;
  if (walls.some(p => !inBounds(p, gridSize))) return false;
  if (solution[0]?.x !== start.x || solution[0]?.y !== start.y) return false;
  const seen = new Set<string>();
  for (let i = 0; i < solution.length; i++) {
    const point = solution[i];
    if (!nodeKeys.has(keyOf(point)) || seen.has(keyOf(point))) return false;
    seen.add(keyOf(point));
    if (i > 0) {
      const prev = solution[i - 1];
      if (Math.abs(point.x - prev.x) + Math.abs(point.y - prev.y) !== 1) return false;
    }
  }
  return true;
}
