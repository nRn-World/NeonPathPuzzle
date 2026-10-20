import type { PortalPair } from "@shared/mechanics";
import type { Point } from "@shared/schema";

const pointKey = (point: Point) => `${point.x},${point.y}`;

/**
 * One undo must remove one player action. A portal step stores both the pad the
 * line stepped on and the pad it teleported to, so both points are dropped
 * together instead of needing a second undo.
 */
export function undoLastStep(path: Point[], portals: PortalPair[]): Point[] {
  if (path.length <= 1) return path;

  const removed = path[path.length - 1];
  const next = path.slice(0, -1);
  const last = next[next.length - 1];
  if (!last) return next;

  const isPortalHop = portals.some(pair =>
    (pointKey(pair.a) === pointKey(last) && pointKey(pair.b) === pointKey(removed))
    || (pointKey(pair.b) === pointKey(last) && pointKey(pair.a) === pointKey(removed)),
  );

  if (isPortalHop) next.pop();
  return next;
}
