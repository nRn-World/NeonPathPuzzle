import { findCompletion } from "@shared/solver";
import type { LevelMechanics } from "@shared/mechanics";
import type { LevelResponse, Point } from "@shared/schema";

/**
 * Progressive, solver-based hints. Instead of flashing the whole answer, each
 * hint extends the player's *current* line by a few steps. The solver uses the
 * same move rules as the canvas, so a hint also works after a detour: it finds a
 * completion from where the player actually is, not from the canned solution.
 */

export const HINT_TIERS = [
  { steps: 1, tokenCost: 0, durationMs: 2_000 },
  { steps: 3, tokenCost: 1, durationMs: 3_000 },
  { steps: Number.POSITIVE_INFINITY, tokenCost: 2, durationMs: 5_000 },
] as const;

export const MAX_HINT_TIER = HINT_TIERS.length;

const pointKey = (point: Point) => `${point.x},${point.y}`;

export interface HintResult {
  /** Full line from the start up to the revealed step, for the canvas renderer. */
  path: Point[];
  tier: number;
  durationMs: number;
  tokenCost: number;
  /** True when the player's line has left every solvable continuation. */
  offTrack: boolean;
}

export function buildHint(
  level: LevelResponse,
  mechanics: LevelMechanics,
  currentPath: Point[],
  canonical: Point[],
  tierIndex: number,
): HintResult | null {
  const tier = Math.max(0, Math.min(MAX_HINT_TIER - 1, tierIndex));
  const { steps, tokenCost, durationMs } = HINT_TIERS[tier];
  const nodeKeys = new Set(level.nodes.map(pointKey));
  const walked = currentPath.filter(point => nodeKeys.has(pointKey(point)));

  const completion = findCompletion(level, mechanics, currentPath)
    ?? canonical.filter(point => nodeKeys.has(pointKey(point)));
  const completionNodes = completion.filter(point => nodeKeys.has(pointKey(point)));
  const matchesPrefix = walked.every((point, index) =>
    completionNodes[index] && pointKey(completionNodes[index]) === pointKey(point));
  const offTrack = !matchesPrefix;

  const rest = offTrack
    ? canonical.filter(point => nodeKeys.has(pointKey(point))).slice(walked.length)
    : completionNodes.slice(walked.length);
  const reveal = Number.isFinite(steps) ? Math.min(rest.length, steps) : rest.length;
  const path = [...(offTrack ? canonical.filter(point => nodeKeys.has(pointKey(point))).slice(0, walked.length) : walked), ...rest.slice(0, reveal)];

  if (path.length < 2) return null;
  return { path, tier, durationMs, tokenCost, offTrack };
}
