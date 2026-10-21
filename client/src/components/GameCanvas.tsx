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
import { playMoveSound, playBacktrackSound, playWinSound } from "@/lib/sounds";
import { useTheme } from "@/hooks/use-theme";
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
}

const pointKey = (point: Point) => `${point.x},${point.y}`;

const SYNC_COLOR = "#00e5a0";
/** Cells around the head that stay lit on blackout boards. */
const BLACKOUT_RADIUS = 2.6;

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
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getThemeColors, currentTheme } = useTheme();

  const [path, setPath] = useState<Point[]>([level.start]);
  const pathRef = useRef<Point[]>([level.start]);
  const [isDragging, setIsDragging] = useState(false);
  const [cellSize, setCellSize] = useState(0);

  const metricsRef = useRef<Metrics>({ cellSize: 0, dpr: 1, size: 0 });
  const lastPointerRef = useRef<Point | null>(null);
  const wonRef = useRef(false);
  const particlesRef = useRef<Particle[]>([]);
  const lastFrameRef = useRef(0);
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

  const updateMetrics = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const size = Math.max(0, Math.min(rect.width, rect.height) * 0.96);
    if (size === 0) return;

    // Crisp on retina, but cap at 2x to keep large grids cheap to fill.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const cell = size / level.gridSize;
    metricsRef.current = { cellSize: cell, dpr, size };
    setCellSize(cell);
  }, [level.gridSize]);

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
    const currentPath = path;
    const visited = new Set(currentPath.map(pointKey));
    const head = currentPath[currentPath.length - 1];

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size, size);

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
        context.shadowBlur = 14;
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
        context.shadowBlur = 6 + breathe * 10;
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
          context.shadowBlur = 12;
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
      context.restore();
    });

    // Personal-best ghost, kept faint so the live line stays dominant.
    if (showGhost && ghostPath && ghostPath.length > 1) {
      context.save();
      context.globalAlpha = 0.22;
      context.strokeStyle = colors.accent;
      context.lineWidth = Math.max(1, cell * 0.08);
      context.lineCap = "round";
      context.lineJoin = "round";
      context.setLineDash([cell * 0.12, cell * 0.1]);
      context.beginPath();
      ghostPath.forEach((point, index) => {
        const x = point.x * cell + cell / 2;
        const y = point.y * cell + cell / 2;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
      context.restore();
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
      context.lineWidth = cell * 0.34;
      trace();
      context.stroke();
      context.strokeStyle = colors.primary;
      context.shadowColor = colors.primary;
      context.shadowBlur = 26;
      context.lineWidth = cell * 0.17;
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

    // Hint
    if (showHint && hintPath && hintPath.length > 1) {
      context.save();
      context.globalAlpha = 0.55;
      context.strokeStyle = colors.secondary;
      context.lineWidth = Math.max(2, cell * 0.08);
      context.setLineDash([cell * 0.18, cell * 0.12]);
      context.beginPath();
      hintPath.forEach((point, index) => {
        const x = point.x * cell + cell / 2;
        const y = point.y * cell + cell / 2;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
      context.setLineDash([]);
      context.font = `${Math.max(9, cell * 0.14)}px 'Exo 2', Arial, sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = colors.secondary;
      hintPath.forEach((point, index) => {
        if (index === 0) return;
        context.fillText(String(index), point.x * cell + cell / 2, point.y * cell + cell / 2);
      });
      context.restore();
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
    mechanics.walls,
    mechanics.portals,
    ghostPath,
    showGhost,
    oneWayMap,
    pairMap,
    syncMap,
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
    const tick = (time: number) => {
      render(time);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [render, reducedMotion, paused]);

  const getGridPos = useCallback((clientX: number, clientY: number): Point | null => {
    const canvas = canvasRef.current;
    const cell = metricsRef.current.cellSize;
    if (!canvas || !cell) return null;
    const rect = canvas.getBoundingClientRect();
    const gridX = Math.floor((clientX - rect.left) / cell);
    const gridY = Math.floor((clientY - rect.top) / cell);

    if (gridX < 0 || gridY < 0 || gridX >= level.gridSize || gridY >= level.gridSize) {
      return null;
    }
    return { x: gridX, y: gridY };
  }, [level.gridSize]);

  const isAdjacent = (first: Point, second: Point) => {
    const dx = Math.abs(first.x - second.x);
    const dy = Math.abs(first.y - second.y);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  };

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
    playMoveSound(level.nodes.length > 0 ? covered / level.nodes.length : 0);

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
    const cursor = { ...start };
    let lastReached = { ...start };
    while (cursor.x !== target.x || cursor.y !== target.y) {
      if (cursor.x !== target.x) {
        cursor.x += Math.sign(target.x - cursor.x);
      } else {
        cursor.y += Math.sign(target.y - cursor.y);
      }

      if (tryMove({ x: cursor.x, y: cursor.y })) {
        // A portal hop moves the head to the twin pad, not to the cell under the
        // pointer. Continue the drag from the real head or the swipe stalls.
        lastReached = pathRef.current[pathRef.current.length - 1] ?? { ...cursor };
      } else {
        lastReached = pathRef.current[pathRef.current.length - 1] ?? lastReached;
        break;
      }
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
