import type { Point } from "@shared/schema";

/**
 * The board's object art. Every node is drawn as a solid "neon cell": a
 * recessed socket, a bevelled rim and a glass core with a single specular
 * glint. It is all procedural canvas work, so the game ships no third-party
 * models and needs no asset licence or attribution.
 */
export interface NodePalette {
  primary: string;
  secondary: string;
  accent: string;
}

export interface NodeModelOptions {
  /** The line has already been through this node. */
  visited: boolean;
  /** 0..1 breathing phase for unvisited nodes. */
  breathe?: number;
  /** Shadow-blur helper from the renderer (0 on low-quality devices). */
  glow?: (amount: number) => number;
  /** Milliseconds, used by the slow rotation of the start collar. */
  time?: number;
  reducedMotion?: boolean;
  /** Draw the hexagonal start collar around this node. */
  start?: boolean;
}

/** Radius of the outer rim, as a fraction of a cell. */
export const NODE_RIM = 0.255;

/**
 * Painter's order for one node. The caller is responsible for save/restore and
 * for any pop scale; this only draws at the given centre.
 */
export function drawNodeModel(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  cell: number,
  colors: NodePalette,
  options: NodeModelOptions,
) {
  const { visited, breathe = 0.5, start = false } = options;
  const glow = options.glow ?? (() => 0);
  const time = options.time ?? 0;
  const reducedMotion = options.reducedMotion ?? false;
  const rim = cell * NODE_RIM;
  const core = cell * 0.125;

  // Socket: a dark disc so the node sits inside the board instead of on top of it.
  context.beginPath();
  context.arc(centerX, centerY, rim * 1.14, 0, Math.PI * 2);
  context.fillStyle = "rgba(2,7,18,0.62)";
  context.fill();

  // Rim: theme colour, charged once the line has been through the node.
  context.beginPath();
  context.arc(centerX, centerY, rim, 0, Math.PI * 2);
  context.strokeStyle = visited ? colors.primary : `${colors.primary}70`;
  context.lineWidth = Math.max(1.5, cell * 0.028);
  if (visited) {
    context.shadowColor = colors.primary;
    context.shadowBlur = glow(12);
  }
  context.stroke();
  context.shadowBlur = 0;

  // Bevel: lit top-left edge, shadowed bottom-right edge. This is what makes
  // the ring read as a physical object rather than a flat outline.
  // Both arcs sit on the rim itself, so the rim looks lit from above instead
  // of carrying a second, floating ring inside it.
  context.lineWidth = Math.max(1, cell * 0.02);
  context.strokeStyle = visited ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)";
  context.beginPath();
  context.arc(centerX, centerY, rim, Math.PI * 1.06, Math.PI * 1.72);
  context.stroke();
  context.strokeStyle = "rgba(0,0,12,0.55)";
  context.beginPath();
  context.arc(centerX, centerY, rim, Math.PI * 0.1, Math.PI * 0.76);
  context.stroke();

  // Core: a glass bead. Charged and bright when visited, dim while waiting.
  const coreRadius = core * (visited ? 1 : 0.82 + breathe * 0.18);
  const bead = context.createRadialGradient(
    centerX - coreRadius * 0.36,
    centerY - coreRadius * 0.42,
    coreRadius * 0.08,
    centerX,
    centerY,
    coreRadius * 1.18,
  );
  if (visited) {
    bead.addColorStop(0, "#ffffff");
    bead.addColorStop(0.42, colors.primary);
    bead.addColorStop(1, `${colors.secondary}dd`);
  } else {
    bead.addColorStop(0, "rgba(255,255,255,0.5)");
    bead.addColorStop(0.58, `${colors.primary}66`);
    bead.addColorStop(1, `${colors.primary}1f`);
  }
  context.beginPath();
  context.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
  context.fillStyle = bead;
  if (visited) {
    context.shadowColor = colors.primary;
    context.shadowBlur = glow(18);
  }
  context.fill();
  context.shadowBlur = 0;

  // Specular glint: one crisp highlight sells the glass.
  context.beginPath();
  context.arc(
    centerX - coreRadius * 0.36,
    centerY - coreRadius * 0.44,
    Math.max(0.8, coreRadius * (visited ? 0.26 : 0.2)),
    0,
    Math.PI * 2,
  );
  context.fillStyle = `rgba(255,255,255,${visited ? 0.92 : 0.4})`;
  context.fill();

  // Start collar: a slowly rotating hexagon that marks where the line begins.
  if (start) {
    context.save();
    context.beginPath();
    const collarRadius = rim * 1.46;
    for (let corner = 0; corner < 6; corner++) {
      const angle = Math.PI / 6 + corner * Math.PI / 3;
      const x = centerX + Math.cos(angle) * collarRadius;
      const y = centerY + Math.sin(angle) * collarRadius;
      if (corner === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.strokeStyle = `${colors.accent}${visited ? "88" : "b3"}`;
    context.lineWidth = Math.max(1, cell * 0.018);
    context.setLineDash([cell * 0.075, cell * 0.06]);
    context.lineDashOffset = reducedMotion ? 0 : -time / 55;
    context.shadowColor = colors.accent;
    context.shadowBlur = glow(10);
    context.stroke();
    context.restore();
  }
}

/**
 * The head of the line: a directional chevron inside the glow, pointing where
 * the line is travelling. A portal hop has no direction, so it fades out.
 */
export function drawHeadChevron(
  context: CanvasRenderingContext2D,
  head: Point,
  previous: Point | null,
  centerX: number,
  centerY: number,
  cell: number,
  color: string,
) {
  if (!previous) return;
  const dx = Math.sign(head.x - previous.x);
  const dy = Math.sign(head.y - previous.y);
  // Diagonal jumps are portal hops; there is no meaningful direction.
  if (Math.abs(head.x - previous.x) + Math.abs(head.y - previous.y) !== 1) return;

  // A small arrow just ahead of the core, inside the orbiting head ring. It
  // must not cover the bead itself, so the offset stays outside the rim.
  const reach = cell * 0.33;
  const arrowX = centerX + dx * reach;
  const arrowY = centerY + dy * reach;
  const tip = cell * 0.085;
  const base = cell * 0.045;
  context.save();
  context.beginPath();
  context.moveTo(arrowX + dx * tip, arrowY + dy * tip);
  context.lineTo(arrowX - dx * base - dy * base, arrowY - dy * base + dx * base);
  context.lineTo(arrowX - dx * base + dy * base, arrowY - dy * base - dx * base);
  context.closePath();
  context.fillStyle = color;
  context.strokeStyle = "rgba(0,0,10,0.45)";
  context.lineWidth = Math.max(1, cell * 0.012);
  context.fill();
  context.stroke();
  context.restore();
}
