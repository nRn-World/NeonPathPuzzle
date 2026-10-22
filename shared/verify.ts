import { generateLevel } from "./level-generator";
import { createMoveRules, getLevelMechanics, mirrorLevel } from "./mechanics";
import type { LevelData, Point } from "./schema";

/** No honest run clears a node faster than this; it rejects scripted instant times. */
export const MIN_MS_PER_NODE = 40;

const isPoint = (value: unknown): value is Point =>
  typeof value === "object" && value !== null
  && Number.isInteger((value as Point).x) && Number.isInteger((value as Point).y);

/**
 * Replays a played line through the real move rules (walls, one-ways, pairs,
 * sync, phase, flip, portals), so only a line the game itself would accept
 * passes. Returns null when valid, otherwise a short reason.
 */
export function verifyPlayedPath(
  levelId: number,
  path: unknown,
  timeMs: number,
  options: { mirrored?: boolean } = {},
): string | null {
  if (!Array.isArray(path) || path.length < 2 || path.length > 800 || !path.every(isPoint)) return "path required";

  const generated = generateLevel(levelId);
  const base: LevelData = { id: generated.id, gridSize: generated.gridSize, start: generated.start, nodes: generated.nodes };
  const source = options.mirrored ? mirrorLevel(base, generated.solution) : { level: base, solution: generated.solution };
  const mechanics = getLevelMechanics(source.level, source.solution);
  const rules = createMoveRules(source.level, mechanics);

  if (path[0].x !== source.level.start.x || path[0].y !== source.level.start.y) return "wrong start";
  let current: Point[] = [path[0]];
  for (let index = 1; index < path.length; index++) {
    const next = rules.step(current, path[index]);
    if (!next) return "path does not follow the rules";
    // A portal pad appends its twin, which the recorded line must then contain.
    if (next.length === current.length + 2) {
      const twin = next[next.length - 1];
      const recorded = path[index + 1];
      if (!recorded || recorded.x !== twin.x || recorded.y !== twin.y) return "path does not follow the rules";
      index++;
    }
    current = next;
  }
  if (!rules.isComplete(current)) return "path does not solve the level";
  if (!Number.isFinite(timeMs) || timeMs < source.level.nodes.length * MIN_MS_PER_NODE) return "time too short";
  return null;
}
