import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { type LevelResponse, type Point } from "@shared/schema";
import { createMoveRules, EMPTY_MECHANICS, type LevelMechanics } from "@shared/mechanics";
import { motion } from "framer-motion";
import { playMoveSound, playBacktrackSound, playMilestoneHaptic, playWinSound } from "@/lib/sounds";
import { useTheme } from "@/hooks/use-theme";
import { useSettingsStore } from "@/lib/settings";
import { useI18n } from "@/lib/i18n";
import { undoLastStep } from "@/lib/undoPath";

export const MAX_BACKTRACKS = 3;

export interface GameCanvasHandle {
  undo: () => void;
  restart: () => void;
}

export interface GameCanvasProps {
  level: LevelResponse;
  onComplete: (moves: number, path: Point[]) => void;
  showHint: boolean;
  hintPath?: Point[];
  onBacktrack: () => boolean;
  onPathChange?: (visitedNodes: number, pathLength: number) => void;
  reducedMotion?: boolean;
  paused?: boolean;
  mechanics?: LevelMechanics;
  ghostPath?: Point[] | null;
  showGhost?: boolean;
  disableUndo?: boolean;
  gridLabel?: string;
  statusText?: string;
  /** Fires with true when the line has no legal forward move left. */
  onStuckChange?: (stuck: boolean) => void;
  /** Draws the board larger than the viewport and follows the line's head. */
  zoom?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface Metrics {
  cellSize: number;
  dpr: number;
  size: number;
  /** Board pixels hidden to the left/top of the viewport while zoomed in. */
  offsetX: number;
  offsetY: number;
}

const pointKey = (point: Point) => `${point.x},${point.y}`;

const SYNC_COLOR = "#00e5a0";
const PHASE_COLOR = "#ff9f43";
const FLIP_COLOR = "#e056fd";

/** One or two small dots: 1 = odd positions, 2 = even positions. */
function drawParityDots(context: CanvasRenderingContext2D, x: number, y: number, parity: 0 | 1, radius: number, color: string) {
  const count = parity === 0 ? 2 : 1;
  context.fillStyle = color;
  for (let index = 0; index < count; index++) {
    context.beginPath();
    context.arc(x + (index - (count - 1) / 2) * radius * 2.6, y, radius, 0, Math.PI * 2);
    context.fill();
  }
}

function drawArrow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  dx: number,
  dy: number,
  cell: number,
  color: string,
  dashed: boolean,
) {
  const length = cell * 0.24;
  const tipX = x + dx * length;
  const tipY = y + dy * length;
  context.save();
  context.strokeStyle = color;
  context.lineWidth = Math.max(1.5, cell * 0.04);
  context.lineCap = "round";
  if (dashed) context.setLineDash([cell * 0.04, cell * 0.04]);
  context.beginPath();
  context.moveTo(x + dx * cell * 0.06, y + dy * cell * 0.06);
  context.lineTo(tipX, tipY);
  context.moveTo(tipX, tipY);
  context.lineTo(tipX - dx * cell * 0.09 - dy * cell * 0.07, tipY - dy * cell * 0.09 + dx * cell * 0.07);
  context.moveTo(tipX, tipY);
  context.lineTo(tipX - dx * cell * 0.09 + dy * cell * 0.07, tipY - dy * cell * 0.09 - dx * cell * 0.07);
  context.stroke();
  context.restore();
}
/** Cells around the head that stay lit on blackout boards. */
const BLACKOUT_RADIUS = 2.6;
/** How long a hint takes to draw itself. */
const HINT_DRAW_MS = 650;
/** A hint that has to send the line backwards uses its own colour. */
const HINT_REWIND_COLOR = "#ffb020";
/** Ghost race pace: milliseconds per grid step, plus the pause before it laps. */
const GHOST_MS_PER_CELL = 220;
const GHOST_HOLD_MS = 1200;

export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(function GameCanvas(
  {
    level,
    onComplete,
    showHint,
    hintPath,
    onBacktrack,
    onPathChange,
    reducedMotion = false,
    paused = false,
    mechanics = EMPTY_MECHANICS,
    ghostPath = null,
    showGhost = true,
    disableUndo = false,
    gridLabel,
    statusText,
    onStuckChange,
    zoom = 1,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getThemeColors, currentTheme } = useTheme();
  const { t } = useI18n();
  const colorBlind = useSettingsStore(state => state.colorBlind);

  const [path, setPath] = useState<Point[]>([level.start]);
  const pathRef = useRef<Point[]>([level.start]);
  const [isDragging, setIsDragging] = useState(false);

  const metricsRef = useRef<Metrics>({ cellSize: 0, dpr: 1, size: 0, offsetX: 0, offsetY: 0 });
  const lastPointerRef = useRef<Point | null>(null);
  const wonRef = useRef(false);
  const particlesRef = useRef<Particle[]>([]);
  const lastFrameRef = useRef(0);
  /** When the current hint started drawing; null while no hint is shown. */
  const hintStartRef = useRef<number | null>(null);
  /** Glow shadows are the costly part of a frame; they switch off on slow devices. */
  const lowQualityRef = useRef(false);
  const slowFramesRef = useRef(0);
  const previousPathLengthRef = useRef(1);
  const celebrateAtRef = useRef<number | null>(null);

  const callbacksRef = useRef({ onComplete, onBacktrack, onPathChange, onStuckChange });
  callbacksRef.current = { onComplete, onBacktrack, onPathChange, onStuckChange };

  const nodeKeys = useMemo(() => new Set(level.nodes.map(pointKey)), [level.nodes]);
  const oneWayMap = useMemo(
    () => new Map(mechanics.oneWays.map(rule => [pointKey(rule.point), rule])),
    [mechanics.oneWays],
  );
  const pairMap = useMemo(() => {
    const map = new Map<string, { order: 1 | 2; partner: string; color: string }>();
    mechanics.pairs.forEach(pair => {
      map.set(pointKey(pair.first), { order: 1, partner: pointKey(pair.second), color: pair.color });
      map.set(pointKey(pair.second), { order: 2, partner: pointKey(pair.first), color: pair.color });
    });
    return map;
  }, [mechanics.pairs]);

  const phaseMap = useMemo(
    () => new Map(mechanics.phaseNodes.map(node => [pointKey(node.point), node.parity])),
    [mechanics.phaseNodes],
  );
  const flipMap = useMemo(
    () => new Map(mechanics.flipArrows.map(rule => [pointKey(rule.point), rule])),
    [mechanics.flipArrows],
  );

  const rules = useMemo(() => createMoveRules(level, mechanics), [level, mechanics]);
  const syncMap = useMemo(
    () => new Map(mechanics.syncNodes.map(node => [pointKey(node.point), node.step])),
    [mechanics.syncNodes],
  );

  const countVisitedNodes = useCallback(
    (points: Point[]) => points.filter(point => nodeKeys.has(pointKey(point))).length,
    [nodeKeys],
  );

  // Depend on the coordinates rather than the object: a background refetch
  // returns a new level object with the same board, and that must not wipe the
  // player's line mid-run.
  const startX = level.start.x;
  const startY = level.start.y;
  const resetPath = useCallback(() => {
    const initial = [{ x: startX, y: startY }];
    pathRef.current = initial;
    setPath(initial);
    setIsDragging(false);
    wonRef.current = false;
    lastPointerRef.current = null;
    particlesRef.current = [];
    previousPathLengthRef.current = 1;
    celebrateAtRef.current = null;
    callbacksRef.current.onPathChange?.(1, 1);
    callbacksRef.current.onStuckChange?.(false);
  }, [startX, startY]);

  useEffect(() => {
    resetPath();
  }, [resetPath]);

  // Arrow keys work straight away: the board takes focus when a level opens.
  useEffect(() => {
    containerRef.current?.focus({ preventScroll: true });
  }, []);

  const updateMetrics = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const size = Math.max(0, Math.min(rect.width, rect.height) * 0.96);
    if (size === 0) return;

    // Crisp on retina, but cap at 2x to keep large grids cheap to fill.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Assigning the same size still clears the canvas and reallocates its
    // buffer, so the mount-time observer callback must not repeat the work.
    const pixelSize = Math.round(size * dpr);
    if (canvas.width !== pixelSize || canvas.height !== pixelSize) {
      canvas.width = pixelSize;
      canvas.height = pixelSize;
    }
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const cell = (size * zoom) / level.gridSize;
    metricsRef.current = { ...metricsRef.current, cellSize: cell, dpr, size };
  }, [level.gridSize, zoom]);

  useEffect(() => {
    updateMetrics();
    const container = containerRef.current;
    const observer = typeof ResizeObserver !== "undefined" && container
      ? new ResizeObserver(updateMetrics)
      : null;
    if (observer && container) observer.observe(container);
    window.addEventListener("resize", updateMetrics);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateMetrics);
    };
  }, [updateMetrics]);

  // Spawn sparks when the line reaches a new node.
  useEffect(() => {
    const previousLength = previousPathLengthRef.current;
    previousPathLengthRef.current = path.length;

    if (reducedMotion || path.length <= previousLength || path.length < 2) return;
    const { cellSize: cell } = metricsRef.current;
    if (!cell) return;

    const colors = getThemeColors();
    const head = path[path.length - 1];
    const x = head.x * cell + cell / 2;
    const y = head.y * cell + cell / 2;

    for (let index = 0; index < 7; index++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.6 + Math.random() * 1.8;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 380 + Math.random() * 320,
        maxLife: 700,
        size: 1.5 + Math.random() * 2.5,
        color: index % 3 === 0 ? colors.secondary : colors.primary,
      });
    }
  }, [path, reducedMotion, getThemeColors]);

  const render = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const { cellSize: cell, dpr, size } = metricsRef.current;
    if (!cell || !size) return;

    const colors = getThemeColors();
    const glow = (amount: number) => (lowQualityRef.current ? 0 : amount);
    const currentPath = path;
    const visited = new Set(currentPath.map(pointKey));
    const head = currentPath[currentPath.length - 1];

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size, size);

    // Zoomed in, the board is wider than the viewport: the view slides with the
    // head and clamps at the board's edges, so the line never leaves the screen.
    const maxOffset = Math.max(0, level.gridSize * cell - size);
    const headCenterX = (head?.x ?? 0) * cell + cell / 2;
    const headCenterY = (head?.y ?? 0) * cell + cell / 2;
    const offsetX = Math.min(Math.max(headCenterX - size / 2, 0), maxOffset);
    const offsetY = Math.min(Math.max(headCenterY - size / 2, 0), maxOffset);
    metricsRef.current = { ...metricsRef.current, offsetX, offsetY };
    if (offsetX !== 0 || offsetY !== 0) context.translate(-offsetX, -offsetY);

    // Board plate: a glassy panel so the grid reads as a device, not a void.
    const boardSize = level.gridSize * cell;
    const plate = context.createLinearGradient(0, 0, boardSize, boardSize);
    plate.addColorStop(0, `${colors.primary}12`);
    plate.addColorStop(0.5, "rgba(255,255,255,0.025)");
    plate.addColorStop(1, `${colors.secondary}16`);
    context.beginPath();
    context.roundRect(1, 1, boardSize - 2, boardSize - 2, Math.min(cell * 0.18, 8));
    context.fillStyle = plate;
    context.fill();
    context.strokeStyle = `${colors.primary}33`;
    context.lineWidth = 1.5;
    context.stroke();

    // Blackout: the board is dark except for a pool of light around the head.
    const lightX = (head?.x ?? 0) * cell + cell / 2;
    const lightY = (head?.y ?? 0) * cell + cell / 2;
    const lightRadius = cell * BLACKOUT_RADIUS;
    if (mechanics.blackout) {
      const shade = context.createRadialGradient(lightX, lightY, lightRadius * 0.6, lightX, lightY, lightRadius * 1.6);
      shade.addColorStop(0, "rgba(0,0,0,0)");
      shade.addColorStop(1, "rgba(0,0,8,0.55)");
      context.fillStyle = shade;
      context.fillRect(0, 0, boardSize, boardSize);
    }
    /** How visible an unvisited cell is under blackout (1 = fully lit). */
    const visibility = (point: Point) => {
      if (!mechanics.blackout || visited.has(pointKey(point))) return 1;
      const distance = Math.hypot(point.x * cell + cell / 2 - lightX, point.y * cell + cell / 2 - lightY);
      return Math.max(0.07, Math.min(1, 1 - (distance - lightRadius) / (cell * 1.4)));
    };

    // Grid: faint lines, brighter crosses at the intersections.
    context.strokeStyle = "rgba(255,255,255,0.04)";
    context.lineWidth = 1;
    for (let index = 1; index < level.gridSize; index++) {
      const position = index * cell;
      context.beginPath();
      context.moveTo(position, cell * 0.1);
      context.lineTo(position, boardSize - cell * 0.1);
      context.stroke();
      context.beginPath();
      context.moveTo(cell * 0.1, position);
      context.lineTo(boardSize - cell * 0.1, position);
      context.stroke();
    }
    context.fillStyle = "rgba(255,255,255,0.14)";
    for (let gx = 1; gx < level.gridSize; gx++) {
      for (let gy = 1; gy < level.gridSize; gy++) {
        context.fillRect(gx * cell - 1, gy * cell - 1, 2, 2);
      }
    }

    // Walls: decorative blocked cells inside the bounding grid.
    mechanics.walls.forEach(wall => {
      context.globalAlpha = visibility(wall);
      const x = wall.x * cell + cell * 0.12;
      const y = wall.y * cell + cell * 0.12;
      const size = cell * 0.76;
      context.fillStyle = "rgba(255,255,255,0.035)";
      context.strokeStyle = "rgba(255,255,255,0.10)";
      context.lineWidth = 1;
      context.beginPath();
      context.roundRect(x, y, size, size, cell * 0.12);
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(x + size * 0.2, y + size * 0.8);
      context.lineTo(x + size * 0.8, y + size * 0.2);
      context.stroke();
      context.globalAlpha = 1;
    });

    // Portal pads: stepping on one teleports the line to its twin.
    mechanics.portals.forEach(pair => {
      [pair.a, pair.b].forEach((pad, index) => {
        const centerX = pad.x * cell + cell / 2;
        const centerY = pad.y * cell + cell / 2;
        const used = visited.has(pointKey(pad));
        context.save();
        context.globalAlpha = (used ? 0.35 : 0.9) * visibility(pad);
        context.strokeStyle = colors.secondary;
        context.lineWidth = Math.max(1.5, cell * 0.04);
        context.setLineDash([cell * 0.09, cell * 0.07]);
        context.beginPath();
        context.arc(centerX, centerY, cell * 0.22, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
        context.beginPath();
        context.arc(centerX, centerY, cell * 0.07, 0, Math.PI * 2);
        context.fillStyle = colors.secondary;
        context.fill();
        context.fillStyle = colors.secondary;
        context.font = `${Math.max(8, cell * 0.12)}px 'Exo 2', Arial, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(index === 0 ? "A" : "B", centerX, centerY - cell * 0.3);
        context.restore();
      });
    });

    // Nodes
    const visitedNodes = currentPath.filter(point => nodeKeys.has(pointKey(point))).length;
    level.nodes.forEach(node => {
      const isVisited = visited.has(pointKey(node));
      const centerX = node.x * cell + cell / 2;
      const centerY = node.y * cell + cell / 2;
      context.save();
      context.globalAlpha = visibility(node);

      // Unvisited nodes breathe out of phase; visited ones light up solid.
      const breathe = reducedMotion ? 0.5 : (Math.sin(time / 520 + node.x * 0.9 + node.y * 1.3) + 1) / 2;
      context.save();
      if (isVisited) {
        context.shadowColor = colors.primary;
        context.shadowBlur = glow(14);
        context.beginPath();
        context.arc(centerX, centerY, cell * 0.12, 0, Math.PI * 2);
        context.fillStyle = colors.primary;
        context.fill();
        context.shadowBlur = 0;
        context.beginPath();
        context.arc(centerX, centerY, cell * 0.19, 0, Math.PI * 2);
        context.strokeStyle = `${colors.primary}cc`;
        context.lineWidth = 2;
        context.stroke();
      } else {
        context.shadowColor = colors.primary;
        context.shadowBlur = glow(6 + breathe * 10);
        context.beginPath();
        context.arc(centerX, centerY, cell * 0.17, 0, Math.PI * 2);
        context.strokeStyle = `${colors.primary}${Math.round(70 + breathe * 100).toString(16).padStart(2, "0")}`;
        context.lineWidth = 2;
        context.stroke();
        context.shadowBlur = 0;
        context.beginPath();
        context.arc(centerX, centerY, cell * (0.055 + breathe * 0.02), 0, Math.PI * 2);
        context.fillStyle = `${colors.primary}aa`;
        context.fill();
      }
      context.restore();

      const pair = pairMap.get(pointKey(node));
      if (pair) {
        context.beginPath();
        context.arc(centerX, centerY, cell * 0.26, 0, Math.PI * 2);
        context.strokeStyle = pair.color;
        context.lineWidth = Math.max(1.5, cell * 0.035);
        if (pair.order === 2) context.setLineDash([cell * 0.06, cell * 0.05]);
        context.stroke();
        context.setLineDash([]);
        context.fillStyle = pair.color;
        context.font = `${Math.max(7, cell * 0.11)}px 'Exo 2', Arial, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(String(pair.order), centerX, centerY + cell * 0.31);
      }

      const oneWay = oneWayMap.get(pointKey(node));
      if (oneWay) {
        const arrowLength = cell * 0.22;
        const tipX = centerX + oneWay.dx * arrowLength;
        const tipY = centerY + oneWay.dy * arrowLength;
        context.beginPath();
        context.moveTo(centerX - oneWay.dx * cell * 0.05, centerY - oneWay.dy * cell * 0.05);
        context.lineTo(tipX, tipY);
        context.strokeStyle = "rgba(255,255,255,0.55)";
        context.lineWidth = Math.max(1, cell * 0.035);
        context.stroke();
        const perpX = -oneWay.dy;
        const perpY = oneWay.dx;
        context.beginPath();
        context.moveTo(tipX, tipY);
        context.lineTo(tipX - oneWay.dx * cell * 0.08 + perpX * cell * 0.06, tipY - oneWay.dy * cell * 0.08 + perpY * cell * 0.06);
        context.moveTo(tipX, tipY);
        context.lineTo(tipX - oneWay.dx * cell * 0.08 - perpX * cell * 0.06, tipY - oneWay.dy * cell * 0.08 - perpY * cell * 0.06);
        context.stroke();
      }

      // Sync node: a hexagon that must be reached as the Nth node of the line.
      const syncStep = syncMap.get(pointKey(node));
      if (syncStep !== undefined) {
        const isNext = !isVisited && visitedNodes === syncStep;
        const missed = !isVisited && visitedNodes > syncStep;
        const color = missed ? "#ff4d6d" : SYNC_COLOR;
        const radius = cell * (0.3 + (isNext && !reducedMotion ? Math.sin(time / 160) * 0.025 : 0));
        context.beginPath();
        for (let corner = 0; corner < 6; corner++) {
          const angle = Math.PI / 6 + corner * Math.PI / 3;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          if (corner === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.closePath();
        context.strokeStyle = color;
        context.lineWidth = Math.max(1.5, cell * (isNext ? 0.05 : 0.035));
        if (isNext || isVisited) {
          context.shadowColor = color;
          context.shadowBlur = glow(12);
        }
        context.stroke();
        context.shadowBlur = 0;
        const badgeX = centerX + cell * 0.27;
        const badgeY = centerY - cell * 0.27;
        const label = String(syncStep + 1);
        const badgeRadius = Math.max(6, cell * (label.length > 2 ? 0.15 : 0.13));
        context.beginPath();
        context.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
        context.fillStyle = isVisited ? color : "#05110d";
        context.fill();
        context.strokeStyle = color;
        context.lineWidth = 1.2;
        context.stroke();
        context.fillStyle = isVisited ? "#05110d" : color;
        context.font = `bold ${Math.max(7, badgeRadius * (label.length > 2 ? 0.95 : 1.15))}px 'Exo 2', Arial, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(label, badgeX, badgeY + 0.5);
      }

      // Rift rule: a diamond that only opens on even (two dots) or odd (one dot) positions.
      const phaseParity = phaseMap.get(pointKey(node));
      if (phaseParity !== undefined) {
        const open = !isVisited && (visitedNodes + 1) % 2 === phaseParity;
        const radius = cell * (0.3 + (open && !reducedMotion ? Math.sin(time / 170) * 0.02 : 0));
        context.beginPath();
        context.moveTo(centerX, centerY - radius);
        context.lineTo(centerX + radius, centerY);
        context.lineTo(centerX, centerY + radius);
        context.lineTo(centerX - radius, centerY);
        context.closePath();
        context.strokeStyle = PHASE_COLOR;
        context.globalAlpha *= isVisited || open ? 1 : 0.45;
        context.lineWidth = Math.max(1.5, cell * (open ? 0.05 : 0.035));
        if (open) {
          context.shadowColor = PHASE_COLOR;
          context.shadowBlur = glow(12);
        }
        context.stroke();
        context.shadowBlur = 0;
        drawParityDots(context, centerX, centerY - cell * 0.4, phaseParity, Math.max(1.5, cell * 0.035), PHASE_COLOR);
      }

      // Rift rule: an arrow that reverses depending on the line's current position.
      const flip = flipMap.get(pointKey(node));
      if (flip) {
        const isHeadHere = head !== undefined && head.x === node.x && head.y === node.y;
        const activeSign = visitedNodes % 2 === flip.parity ? 1 : -1;
        const sign = isHeadHere ? activeSign : 1;
        drawArrow(context, centerX, centerY, flip.dx * sign, flip.dy * sign, cell, FLIP_COLOR, false);
        drawArrow(context, centerX, centerY, -flip.dx * sign, -flip.dy * sign, cell, `${FLIP_COLOR}66`, true);
        drawParityDots(context, centerX, centerY + cell * 0.4, flip.parity, Math.max(1.5, cell * 0.035), FLIP_COLOR);
      }
      context.restore();
    });

    // Personal-best ghost. It runs the saved route at a steady pace, so it
    // reads as a rival racing the line instead of a static overlay.
    if (showGhost && ghostPath && ghostPath.length > 1) {
      const total = ghostPath.length - 1;
      const ghostX = (index: number) => ghostPath[index].x * cell + cell / 2;
      const ghostY = (index: number) => ghostPath[index].y * cell + cell / 2;

      // Reduced motion parks the ghost at the finish; everyone else watches it run.
      const lap = total * GHOST_MS_PER_CELL;
      const phase = reducedMotion ? lap : time % (lap + GHOST_HOLD_MS);
      const progress = Math.min(total, phase / GHOST_MS_PER_CELL);
      const whole = Math.min(total, Math.floor(progress));
      const part = progress - whole;

      context.save();
      context.lineCap = "round";
      context.lineJoin = "round";

      // The stretch the ghost has not reached yet stays faint and dashed.
      if (whole < total) {
        context.globalAlpha = 0.16;
        context.strokeStyle = colors.accent;
        context.lineWidth = Math.min(4, Math.max(1.5, cell * 0.04));
        context.setLineDash([cell * 0.12, cell * 0.1]);
        context.beginPath();
        context.moveTo(ghostX(whole), ghostY(whole));
        for (let index = whole + 1; index <= total; index++) context.lineTo(ghostX(index), ghostY(index));
        context.stroke();
        context.setLineDash([]);
      }

      // The part already run, brighter so the ghost has a visible tail.
      if (whole > 0 || part > 0) {
        context.globalAlpha = 0.5;
        context.strokeStyle = colors.accent;
        context.shadowColor = colors.accent;
        context.shadowBlur = glow(10);
        context.lineWidth = Math.min(5, Math.max(2, cell * 0.055));
        context.beginPath();
        context.moveTo(ghostX(0), ghostY(0));
        for (let index = 1; index <= whole; index++) context.lineTo(ghostX(index), ghostY(index));
        if (whole < total) {
          context.lineTo(ghostX(whole) + (ghostX(whole + 1) - ghostX(whole)) * part, ghostY(whole) + (ghostY(whole + 1) - ghostY(whole)) * part);
        }
        context.stroke();
        context.shadowBlur = 0;
      }
      context.restore();

      // A hollow head, so the ghost never hides the live line when they overlap.
      if (!reducedMotion && whole < total) {
        const headX = ghostX(whole) + (ghostX(whole + 1) - ghostX(whole)) * part;
        const headY = ghostY(whole) + (ghostY(whole + 1) - ghostY(whole)) * part;
        context.save();
        context.globalAlpha = 0.8;
        context.strokeStyle = colors.accent;
        context.lineWidth = Math.max(1.5, cell * 0.045);
        context.setLineDash([cell * 0.07, cell * 0.06]);
        context.lineDashOffset = -time / 30;
        context.beginPath();
        context.arc(headX, headY, cell * 0.21, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }
    }

    // Start marker
    const startX = level.start.x * cell + cell / 2;
    const startY = level.start.y * cell + cell / 2;
    context.beginPath();
    context.arc(startX, startY, cell * 0.25, 0, Math.PI * 2);
    context.strokeStyle = `${colors.primary}aa`;
    context.lineWidth = 2;
    context.setLineDash([cell * 0.08, cell * 0.07]);
    context.stroke();
    context.setLineDash([]);

    // Trail
    if (currentPath.length > 1) {
      const trace = () => {
        context.beginPath();
        currentPath.forEach((point, index) => {
          const x = point.x * cell + cell / 2;
          const y = point.y * cell + cell / 2;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
      };

      context.save();
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = `${colors.primary}40`;
      context.lineWidth = Math.min(cell * 0.34, 46);
      trace();
      context.stroke();
      context.strokeStyle = colors.primary;
      context.shadowColor = colors.primary;
      context.shadowBlur = glow(26);
      context.lineWidth = Math.min(cell * 0.17, 24);
      trace();
      context.stroke();
      context.shadowBlur = 0;

      context.strokeStyle = "rgba(255,255,255,0.72)";
      context.lineWidth = Math.max(1, cell * 0.04);
      if (!reducedMotion) {
        context.setLineDash([cell * 0.35, cell * 0.28]);
        context.lineDashOffset = -time / 32;
      }
      trace();
      context.stroke();
      context.setLineDash([]);
      context.restore();
    }

    // Head glow
    if (head) {
      const headX = head.x * cell + cell / 2;
      const headY = head.y * cell + cell / 2;
      const pulse = reducedMotion ? 0 : Math.sin(time / 180) * cell * 0.03;
      const gradient = context.createRadialGradient(
        headX,
        headY,
        0,
        headX,
        headY,
        cell * 0.32 + pulse,
      );
      gradient.addColorStop(0, "rgba(255,255,255,0.95)");
      gradient.addColorStop(0.35, colors.accent);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      context.beginPath();
      context.arc(headX, headY, cell * 0.3 + pulse, 0, Math.PI * 2);
      context.fillStyle = gradient;
      context.fill();
      if (!reducedMotion && !wonRef.current) {
        context.save();
        context.strokeStyle = `${colors.accent}aa`;
        context.lineWidth = 1.5;
        context.setLineDash([cell * 0.1, cell * 0.14]);
        context.lineDashOffset = time / 40;
        context.beginPath();
        context.arc(headX, headY, cell * 0.4, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }
    }

    // Hint: only the stretch still ahead of the line, not the whole solution.
    // When the line has already left the solution, the hint sends it back to
    // the last shared step instead of pretending everything is fine.
    if (showHint && hintPath && hintPath.length > 1) {
      if (hintStartRef.current === null) hintStartRef.current = time;
      const reveal = reducedMotion
        ? 1
        : Math.min(1, (time - hintStartRef.current) / HINT_DRAW_MS);

      // Compare grid nodes only: portal hops and rewind history add cells that
      // the solution does not contain, and they must not look like a detour.
      const walked = currentPath.filter(point => nodeKeys.has(pointKey(point)));
      let shared = 0;
      while (
        shared < walked.length
        && shared < hintPath.length
        && walked[shared].x === hintPath[shared].x
        && walked[shared].y === hintPath[shared].y
      ) shared += 1;
      const offTrack = shared < walked.length;
      const resume = offTrack ? Math.max(0, shared - 1) : Math.max(0, walked.length - 1);
      const remaining = hintPath.slice(resume);
      const accentColor = offTrack ? HINT_REWIND_COLOR : colors.secondary;
      const center = (point: Point) => [point.x * cell + cell / 2, point.y * cell + cell / 2] as const;

      const reached = reveal * (remaining.length - 1);
      const whole = Math.floor(reached);
      const part = reached - whole;

      context.save();
      context.globalAlpha = 0.6;
      context.strokeStyle = accentColor;
      context.lineWidth = Math.min(6, Math.max(2, cell * 0.06));
      context.lineCap = "round";
      context.setLineDash([cell * 0.18, cell * 0.12]);
      context.beginPath();
      remaining.slice(0, whole + 1).forEach((point, index) => {
        const [x, y] = center(point);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      if (whole < remaining.length - 1) {
        const [fromX, fromY] = center(remaining[whole]);
        const [toX, toY] = center(remaining[whole + 1]);
        context.lineTo(fromX + (toX - fromX) * part, fromY + (toY - fromY) * part);
      }
      context.stroke();
      context.setLineDash([]);

      // Step numbers are relative to the head, so "1" is always the next move.
      context.font = `${Math.max(9, cell * 0.14)}px 'Exo 2', Arial, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = accentColor;
      remaining.forEach((point, index) => {
        if (index === 0 || index > whole) return;
        const [x, y] = center(point);
        context.fillText(String(index), x, y);
      });
      context.restore();

      // The next move pulses so it never has to be counted out.
      const nextPoint = remaining[1];
      if (nextPoint && !offTrack) {
        const [x, y] = center(nextPoint);
        const pulse = reducedMotion ? 0.5 : (Math.sin(time / 220) + 1) / 2;
        context.save();
        context.globalAlpha = 0.5 + pulse * 0.45;
        context.strokeStyle = colors.secondary;
        context.lineWidth = Math.max(2, cell * 0.045);
        context.beginPath();
        context.arc(x, y, cell * (0.26 + pulse * 0.09), 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }

      // Off the solution: the head is the problem, and the number is how many
      // steps must be undone before the hint makes sense again.
      if (offTrack && head) {
        const [x, y] = center(head);
        const stepsBack = Math.max(1, walked.length - 1 - resume);
        const pulse = reducedMotion ? 0.6 : (Math.sin(time / 200) + 1) / 2;
        context.save();
        context.strokeStyle = HINT_REWIND_COLOR;
        context.fillStyle = HINT_REWIND_COLOR;
        context.lineWidth = Math.max(2, cell * 0.05);
        context.globalAlpha = 0.65 + pulse * 0.35;
        context.beginPath();
        context.arc(x, y, cell * (0.3 + pulse * 0.07), 0, Math.PI * 2);
        context.stroke();
        context.font = `bold ${Math.max(10, cell * 0.2)}px 'Exo 2', Arial, sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(`\u21b6${stepsBack}`, x, y);
        context.restore();
      }
    } else {
      hintStartRef.current = null;
    }

    // Win celebration rings
    if (celebrateAtRef.current !== null) {
      const elapsed = time - celebrateAtRef.current;
      // A white pulse runs down the finished line from start to end.
      if (!reducedMotion && elapsed < 1400) {
        const wave = (elapsed / 700) * currentPath.length;
        currentPath.forEach((point, index) => {
          const distance = Math.abs(index - wave);
          if (distance > 3) return;
          context.beginPath();
          context.arc(point.x * cell + cell / 2, point.y * cell + cell / 2, cell * (0.12 + (1 - distance / 3) * 0.14), 0, Math.PI * 2);
          context.fillStyle = `rgba(255,255,255,${(1 - distance / 3) * 0.85})`;
          context.fill();
        });
      }
      if (elapsed < 1500) {
        const last = currentPath[currentPath.length - 1];
        if (last) {
          for (let ring = 0; ring < 3; ring++) {
            const ringProgress = (elapsed - ring * 140) / 700;
            if (ringProgress <= 0 || ringProgress >= 1) continue;
            context.beginPath();
            context.arc(
              last.x * cell + cell / 2,
              last.y * cell + cell / 2,
              cell * (0.25 + ringProgress * 1.4),
              0,
              Math.PI * 2,
            );
            context.strokeStyle = `${colors.primary}${Math.floor((1 - ringProgress) * 160).toString(16).padStart(2, "0")}`;
            context.lineWidth = 2;
            context.stroke();
          }
        }
      }
    }

    // Particles
    if (!reducedMotion && particlesRef.current.length > 0) {
      context.globalCompositeOperation = "lighter";
      const delta = lastFrameRef.current ? Math.min(50, time - lastFrameRef.current) : 16;
      lastFrameRef.current = time;
      particlesRef.current = particlesRef.current.filter(particle => {
        particle.life -= delta;
        if (particle.life <= 0) return false;
        particle.x += particle.vx * (delta / 16);
        particle.y += particle.vy * (delta / 16);
        particle.vy += 0.01;
        const alpha = Math.max(0, particle.life / particle.maxLife);
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fillStyle = particle.color;
        context.globalAlpha = alpha;
        context.fill();
        context.globalAlpha = 1;
        return true;
      });
      context.globalCompositeOperation = "source-over";
    }
  }, [
    level.gridSize,
    level.nodes,
    level.start,
    path,
    showHint,
    hintPath,
    reducedMotion,
    getThemeColors,
    currentTheme,
    colorBlind,
    mechanics.walls,
    mechanics.portals,
    ghostPath,
    showGhost,
    oneWayMap,
    pairMap,
    syncMap,
    phaseMap,
    flipMap,
    nodeKeys,
    mechanics.blackout,
  ]);

  useEffect(() => {
    // No animation work while the game is paused or the tab is hidden.
    if (reducedMotion || paused) {
      render(performance.now());
      return;
    }

    let frame = 0;
    let previous = 0;
    const tick = (time: number) => {
      // Thirty frames in a row slower than ~24 ms (under 40 fps) drop the glow.
      if (previous && !lowQualityRef.current) {
        slowFramesRef.current = time - previous > 24 ? slowFramesRef.current + 1 : 0;
        if (slowFramesRef.current >= 30) lowQualityRef.current = true;
      }
      previous = time;
      render(time);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [render, reducedMotion, paused, zoom]);

  const getGridPos = useCallback((clientX: number, clientY: number): Point | null => {
    const canvas = canvasRef.current;
    // The pointer has to be mapped through the zoom camera, not the raw viewport.
    const { cellSize: cell, offsetX, offsetY } = metricsRef.current;
    if (!canvas || !cell) return null;
    const rect = canvas.getBoundingClientRect();
    const gridX = Math.floor((clientX - rect.left + offsetX) / cell);
    const gridY = Math.floor((clientY - rect.top + offsetY) / cell);

    if (gridX < 0 || gridY < 0 || gridX >= level.gridSize || gridY >= level.gridSize) {
      return null;
    }
    return { x: gridX, y: gridY };
  }, [level.gridSize]);

  const notifyPathChange = (nextPath: Point[]) => {
    callbacksRef.current.onPathChange?.(countVisitedNodes(nextPath), nextPath.length);
    callbacksRef.current.onStuckChange?.(rules.isStuck(nextPath));
  };

  const undoPath = useCallback((): boolean => {
    if (disableUndo) return false;
    const current = pathRef.current;
    if (current.length <= 1) return false;
    if (!callbacksRef.current.onBacktrack()) return false;

    // Undo a portal hop as a single action instead of leaving the pad behind.
    const next = undoLastStep(current, mechanics.portals);
    pathRef.current = next;
    setPath(next);
    notifyPathChange(next);
    playBacktrackSound();
    return true;
  }, [countVisitedNodes, disableUndo, mechanics.portals, rules]);

  useImperativeHandle(ref, () => ({
    undo: () => {
      if (paused || disableUndo) return;
      undoPath();
    },
    restart: () => resetPath(),
  }), [disableUndo, paused, resetPath, undoPath]);

  const tryMove = useCallback((target: Point): boolean => {
    if (paused || wonRef.current) return false;

    const current = pathRef.current;
    const head = current[current.length - 1];
    if (!head || (target.x === head.x && target.y === head.y)) return false;

    if (current.length > 1) {
      const previous = current[current.length - 2];
      if (previous.x === target.x && previous.y === target.y) {
        if (disableUndo) return false;
        return undoPath();
      }
    }

    const next = rules.step(current, target);
    if (!next) return false;

    pathRef.current = next;
    setPath(next);
    notifyPathChange(next);

    // Pitch climbs with the level's coverage, so the melody itself shows progress.
    const visited = new Set(next.map(pointKey));
    const covered = level.nodes.filter(node => visited.has(pointKey(node))).length;
    const coverage = level.nodes.length > 0 ? covered / level.nodes.length : 0;
    playMoveSound(coverage);
    const quarter = (value: number) => Math.floor(value * 4);
    const before = level.nodes.length > 0
      ? (covered - 1) / level.nodes.length
      : 0;
    if (coverage < 1 && quarter(coverage) > quarter(before)) playMilestoneHaptic();

    if (level.nodes.every(node => visited.has(pointKey(node)))) {
      wonRef.current = true;
      setIsDragging(false);
      celebrateAtRef.current = performance.now();
      if (!reducedMotion) {
        const colors = getThemeColors();
        const cell = metricsRef.current.cellSize;
        const end = next[next.length - 1];
        for (let index = 0; index < 70; index++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1 + Math.random() * 4;
          particlesRef.current.push({
            x: end.x * cell + cell / 2,
            y: end.y * cell + cell / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 700 + Math.random() * 600,
            maxLife: 1300,
            size: 1.5 + Math.random() * 3,
            color: [colors.primary, colors.secondary, colors.accent][index % 3],
          });
        }
      }
      playWinSound();
      callbacksRef.current.onComplete(next.length - 1, next);
    }

    return true;
  }, [disableUndo, getThemeColors, level.nodes, paused, reducedMotion, rules, undoPath]);

  const handleInputStart = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (paused) return;
    event.preventDefault();
    containerRef.current?.focus({ preventScroll: true });

    const touch = "touches" in event ? event.touches[0] : null;
    const clientX = touch ? touch.clientX : (event as React.MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (event as React.MouseEvent).clientY;
    const position = getGridPos(clientX, clientY);
    if (!position) return;

    const head = pathRef.current[pathRef.current.length - 1];
    if (head && position.x === head.x && position.y === head.y) {
      setIsDragging(true);
      lastPointerRef.current = position;
    }
  }, [getGridPos, paused]);

  const handleInputMove = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || paused) return;
    event.preventDefault();

    const touch = "touches" in event ? event.touches[0] : null;
    const clientX = touch ? touch.clientX : (event as React.MouseEvent).clientX;
    const clientY = touch ? touch.clientY : (event as React.MouseEvent).clientY;
    const target = getGridPos(clientX, clientY);
    if (!target) return;

    const start = lastPointerRef.current ?? pathRef.current[pathRef.current.length - 1];
    if (!start || (target.x === start.x && target.y === start.y)) return;

    // Fill every cell between pointer samples so fast swipes never skip a node.
    // A sample that lands diagonally (a fast corner cut) can be reached by two
    // L-shaped routes, so each step tries both axes and takes the one the rules
    // allow, preferring the axis with more distance left. Stepping back onto the
    // previous node is an undo, so it is only the last resort.
    const cursor = { ...start };
    let lastReached = { ...start };
    let guard = level.gridSize * level.gridSize;
    while ((cursor.x !== target.x || cursor.y !== target.y) && guard-- > 0) {
      const dx = target.x - cursor.x;
      const dy = target.y - cursor.y;
      const current = pathRef.current;
      const previous = current[current.length - 2];
      const isBack = (point: Point) => Boolean(previous && previous.x === point.x && previous.y === point.y);
      const steps: { point: Point; remaining: number }[] = [];
      if (dx !== 0) steps.push({ point: { x: cursor.x + Math.sign(dx), y: cursor.y }, remaining: Math.abs(dx) });
      if (dy !== 0) steps.push({ point: { x: cursor.x, y: cursor.y + Math.sign(dy) }, remaining: Math.abs(dy) });
      steps.sort((first, second) =>
        Number(isBack(first.point)) - Number(isBack(second.point)) || second.remaining - first.remaining);

      const moved = steps.find(step => tryMove(step.point));
      const head = pathRef.current[pathRef.current.length - 1];
      if (!moved || !head) {
        // The real head, not the pointer cell: a portal hop or a refused move
        // leaves the line somewhere else.
        lastReached = head ?? lastReached;
        break;
      }
      cursor.x = head.x;
      cursor.y = head.y;
      lastReached = { ...head };
    }

    lastPointerRef.current = lastReached;
  }, [getGridPos, isDragging, paused, tryMove]);

  const handleInputEnd = useCallback(() => {
    setIsDragging(false);
    lastPointerRef.current = null;
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (paused) return;

    if (event.key === "Backspace" || event.key === "Delete"
      || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z")) {
      event.preventDefault();
      undoPath();
      return;
    }

    const directions: Record<string, Point> = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
    };
    const direction = directions[event.key];
    if (!direction) return;

    event.preventDefault();
    const head = pathRef.current[pathRef.current.length - 1];
    if (!head) return;
    tryMove({ x: head.x + direction.x, y: head.y + direction.y });
  }, [paused, tryMove, undoPath]);

  // Gamepad: D-pad or left stick steers the head, B undoes. Repeats while held.
  useEffect(() => {
    if (paused || typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return;
    let frame = 0;
    let heldKey: string | null = null;
    let lastMoveAt = 0;
    let undoHeld = false;

    const poll = (time: number) => {
      const pad = Array.from(navigator.getGamepads()).find(Boolean);
      if (pad) {
        const pressed = (index: number) => Boolean(pad.buttons[index]?.pressed);
        const [axisX = 0, axisY = 0] = pad.axes;
        let direction: Point | null = null;
        if (pressed(12) || axisY < -0.6) direction = { x: 0, y: -1 };
        else if (pressed(13) || axisY > 0.6) direction = { x: 0, y: 1 };
        else if (pressed(14) || axisX < -0.6) direction = { x: -1, y: 0 };
        else if (pressed(15) || axisX > 0.6) direction = { x: 1, y: 0 };

        const directionKey = direction ? `${direction.x},${direction.y}` : null;
        if (direction && (directionKey !== heldKey || time - lastMoveAt > 140)) {
          const head = pathRef.current[pathRef.current.length - 1];
          if (head) tryMove({ x: head.x + direction.x, y: head.y + direction.y });
          lastMoveAt = time;
        }
        heldKey = directionKey;

        const undo = pressed(1);
        if (undo && !undoHeld) undoPath();
        undoHeld = undo;
      }
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, [paused, tryMove, undoPath]);

  const visitedCount = countVisitedNodes(path);

  return (
    <div
      ref={containerRef}
      role="application"
      tabIndex={0}
      aria-label={gridLabel ?? `Puzzle grid, ${level.gridSize} by ${level.gridSize}. Drag from the glowing start node through every node, or use the arrow keys.`}
      onKeyDown={handleKeyDown}
      className="relative flex h-full w-full select-none items-center justify-center p-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 md:p-4"
      style={{
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        touchAction: "none",
        overscrollBehavior: "contain",
      } as React.CSSProperties}
    >
      <span className="sr-only" aria-live="polite" role="status">
        {t("nodesVisitedLive", { count: visitedCount, total: level.nodes.length })}
      </span>
      <motion.canvas
        ref={canvasRef}
        initial={reducedMotion ? false : { opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.35 }}
        onMouseDown={handleInputStart}
        onMouseMove={handleInputMove}
        onMouseUp={handleInputEnd}
        onMouseLeave={handleInputEnd}
        onTouchStart={handleInputStart}
        onTouchMove={handleInputMove}
        onTouchEnd={handleInputEnd}
        onTouchCancel={handleInputEnd}
        onContextMenu={event => event.preventDefault()}
        className="max-h-full max-w-full cursor-crosshair touch-none"
        style={{
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
          WebkitUserDrag: "none",
          touchAction: "none",
          WebkitFontSmoothing: "antialiased",
        } as React.CSSProperties}
      />
      <div className="sr-only" aria-live="polite">
        {statusText ?? `${path.length} of ${level.nodes.length} nodes connected.`}
      </div>
    </div>
  );
});
