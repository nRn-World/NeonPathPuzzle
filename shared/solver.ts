import { createMoveRules, type LevelMechanics } from "./mechanics";
import type { LevelData, Point } from "./schema";

/**
 * A real Hamiltonian-path solver, shared by the puzzle audit, the hint system
 * and (through `shared/verify.ts`) the online result checker.
 *
 * `createMoveRules.step` is the same function the canvas uses, so a line the
 * solver finds is always a line the game would accept.
 */

export interface SolutionCount {
  /** Number of solutions found (capped at `cap`). */
  count: number;
  /** True when the search was cut short by its node budget. */
  incomplete: boolean;
  /** DFS nodes expanded — a measure of how hard the board is to search. */
  expanded: number;
}

const key = (point: Point) => `${point.x},${point.y}`;
const NEIGHBOURS: readonly [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];

function adjacency(level: LevelData): { keys: string[]; index: Map<string, number>; edges: number[][] } {
  const keys = level.nodes.map(key);
  const index = new Map(keys.map((value, i) => [value, i]));
  const edges = keys.map(() => [] as number[]);
  keys.forEach((value, i) => {
    const [x, y] = value.split(",").map(Number);
    for (const [dx, dy] of NEIGHBOURS) {
      const neighbour = index.get(`${x + dx},${y + dy}`);
      if (neighbour !== undefined) edges[i].push(neighbour);
    }
  });
  return { keys, index, edges };
}

/**
 * Counts complete single-line solutions from the fixed start. Connectivity
 * pruning makes this cheap enough to run over all 300 boards in an audit:
 * if an unvisited node can no longer be reached from the head, that branch is
 * dead regardless of what happens next.
 */
export function countSolutions(
  level: LevelData,
  options: { cap?: number; budget?: number } = {},
): SolutionCount {
  const cap = options.cap ?? 2;
  const budget = options.budget ?? 300_000;
  const { keys, index, edges } = adjacency(level);
  const start = index.get(key(level.start));
  if (start === undefined || keys.length === 0) return { count: 0, incomplete: false, expanded: 0 };

  const visited = new Uint8Array(keys.length);
  visited[start] = 1;
  let count = 0;
  let expanded = 0;
  let incomplete = false;

  const connectedFromHead = (head: number): boolean => {
    const seen = new Uint8Array(keys.length);
    const queue = [head];
    seen[head] = 1;
    while (queue.length) {
      const current = queue.pop()!;
      for (const next of edges[current]) {
        if (!visited[next] && !seen[next]) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    return keys.every((_, i) => visited[i] || seen[i]);
  };

  const walk = (head: number, depth: number): void => {
    if (count >= cap || incomplete) return;
    if (++expanded > budget) {
      incomplete = true;
      return;
    }
    if (depth === keys.length) {
      count += 1;
      return;
    }
    if (!connectedFromHead(head)) return;
    const options = edges[head].filter(next => !visited[next]);
    // Warnsdorff ordering: try the most constrained next node first.
    options.sort((a, b) =>
      edges[a].filter(next => !visited[next]).length - edges[b].filter(next => !visited[next]).length);
    for (const next of options) {
      visited[next] = 1;
      walk(next, depth + 1);
      visited[next] = 0;
      if (count >= cap || incomplete) return;
    }
  };

  walk(start, 1);
  return { count, incomplete, expanded };
}

/** A board with exactly one solution is a "real" puzzle; the rest are open. */
export function hasUniqueSolution(level: LevelData): boolean {
  const result = countSolutions(level, { cap: 2 });
  return result.count === 1 && !result.incomplete;
}

/**
 * Completes a line the player has already drawn. Unlike a canned solution this
 * respects the current position, so hints work after a detour or an alternative
 * route. Returns the whole path (including the part already played), or null.
 */
export function findCompletion(
  level: LevelData,
  mechanics: LevelMechanics,
  path: Point[],
  budget = 60_000,
): Point[] | null {
  if (path.length === 0) return null;
  const rules = createMoveRules(level, mechanics);
  if (rules.isComplete(path)) return path;

  let expanded = 0;
  const walk = (current: Point[]): Point[] | null => {
    if (++expanded > budget) return null;
    if (rules.isComplete(current)) return current;
    const head = current[current.length - 1];
    const candidates: Point[][] = [];
    for (const [dx, dy] of NEIGHBOURS) {
      const next = rules.step(current, { x: head.x + dx, y: head.y + dy });
      if (next) candidates.push(next);
    }
    // Fewest onward options first: fail fast on dead ends.
    candidates.sort((a, b) => {
      const onward = (line: Point[]) => {
        const h = line[line.length - 1];
        return NEIGHBOURS.filter(([dx, dy]) => rules.step(line, { x: h.x + dx, y: h.y + dy })).length;
      };
      return onward(a) - onward(b);
    });
    for (const candidate of candidates) {
      const found = walk(candidate);
      if (found) return found;
    }
    return null;
  };
  return walk(path);
}

/** Search effort is a solver-based difficulty signal for level design reports. */
export function solveStats(level: LevelData): SolutionCount {
  return countSolutions(level, { cap: 2, budget: 200_000 });
}
