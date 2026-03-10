import React, { useRef, useEffect, useState, useCallback } from "react";
import { type LevelResponse, type Point } from "@shared/schema";
import { motion } from "framer-motion";
import { playMoveSound, playBacktrackSound, playLoseLifeSound, playWinSound } from "@/lib/sounds";
import { useTheme } from "@/hooks/use-theme";

interface GameCanvasProps {
  level: LevelResponse;
  onComplete: () => void;
  showHint: boolean;
  hintPath?: Point[];
  onBacktrack: () => void;
  onLoseLife: () => void;
  onWin: () => void;
}

export function GameCanvas({ level, onComplete, showHint, hintPath, onBacktrack, onLoseLife, onWin }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getThemeColors } = useTheme();

  // Game State
  const [path, setPath] = useState<Point[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [cellSize, setCellSize] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Initialize path with start node
  useEffect(() => {
    setPath([level.start]);
  }, [level]);

  // Handle Resize
  const updateMetrics = useCallback(() => {
    if (!containerRef.current || !canvasRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const size = Math.min(width, height);

    // Make canvas slightly smaller than container padding
    const displaySize = size * 0.95;

    // Support high DPI screens
    const dpr = window.devicePixelRatio || 1;
    canvasRef.current.width = displaySize * dpr;
    canvasRef.current.height = displaySize * dpr;
    canvasRef.current.style.width = `${displaySize}px`;
    canvasRef.current.style.height = `${displaySize}px`;

    const context = canvasRef.current.getContext("2d");
    if (context) context.scale(dpr, dpr);

    setCellSize(displaySize / level.gridSize);

    // Center grid in canvas if non-square
    setOffset({ x: 0, y: 0 });
  }, [level.gridSize]);

  useEffect(() => {
    updateMetrics();
    window.addEventListener("resize", updateMetrics);
    return () => window.removeEventListener("resize", updateMetrics);
  }, [updateMetrics]);

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const colors = getThemeColors();

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= level.gridSize; i++) {
      const pos = i * cellSize;
      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, level.gridSize * cellSize);
      ctx.stroke();
      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(level.gridSize * cellSize, pos);
      ctx.stroke();
    }

    // Draw nodes
    level.nodes.forEach((node) => {
      const center = {
        x: node.x * cellSize + cellSize / 2,
        y: node.y * cellSize + cellSize / 2
      };

      // Node background
      ctx.beginPath();
      ctx.arc(center.x, center.y, cellSize * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fill();

      // Node border
      ctx.beginPath();
      ctx.arc(center.x, center.y, cellSize * 0.18, 0, Math.PI * 2);
      ctx.strokeStyle = colors.primary + "4d"; // Add transparency
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw start node
    const startPixel = {
      x: level.start.x * cellSize + cellSize / 2,
      y: level.start.y * cellSize + cellSize / 2
    };
    ctx.beginPath();
    ctx.arc(startPixel.x, startPixel.y, cellSize * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = colors.primary;
    ctx.shadowColor = colors.primary;
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw path
    if (path.length > 1) {
      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = cellSize * 0.15;
      ctx.strokeStyle = colors.primary;
      ctx.shadowColor = colors.primary;
      ctx.shadowBlur = 20;

      path.forEach((point, index) => {
        const pixel = {
          x: point.x * cellSize + cellSize / 2,
          y: point.y * cellSize + cellSize / 2
        };
        if (index === 0) {
          ctx.moveTo(pixel.x, pixel.y);
        } else {
          ctx.lineTo(pixel.x, pixel.y);
        }
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw path head with pulse
      const headPixel = {
        x: path[path.length - 1].x * cellSize + cellSize / 2,
        y: path[path.length - 1].y * cellSize + cellSize / 2
      };
      const time = Date.now() / 1000;
      const pulseSize = cellSize * 0.12 + Math.sin(time * 4) * cellSize * 0.03;
      ctx.beginPath();
      ctx.arc(headPixel.x, headPixel.y, pulseSize, 0, Math.PI * 2);
      ctx.fillStyle = colors.accent;
      ctx.fill();
    }

    // Draw hint path
    if (showHint && hintPath && hintPath.length > 0) {
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = colors.secondary;
      ctx.lineWidth = cellSize * 0.1;
      ctx.setLineDash([cellSize * 0.2, cellSize * 0.1]);

      ctx.beginPath();
      hintPath.forEach((pt, index) => {
        const pixel = {
          x: pt.x * cellSize + cellSize / 2,
          y: pt.y * cellSize + cellSize / 2
        };
        if (index === 0) {
          ctx.moveTo(pixel.x, pixel.y);
        } else {
          ctx.lineTo(pixel.x, pixel.y);
        }
      });
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Hint text
      ctx.font = `${cellSize * 0.12}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = colors.secondary;

      hintPath.forEach((pt, index) => {
        if (index === 0) return; // Skip start node
        const pixel = {
          x: pt.x * cellSize + cellSize / 2,
          y: pt.y * cellSize + cellSize / 2
        };
        ctx.fillText((index).toString(), pixel.x, pixel.y);
      });
    }
  }, [level, cellSize, path, showHint, hintPath, getThemeColors]);

  useEffect(() => {
    draw();
  }, [path, cellSize, level, showHint, hintPath, offset, draw]);


  // Game Logic
  const getGridPos = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current || cellSize === 0) return null;
    const rect = canvasRef.current.getBoundingClientRect();

    // Simple calculation based on canvas display size
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;

    const gridX = Math.floor(relX / cellSize);
    const gridY = Math.floor(relY / cellSize);

    // Validate grid boundaries
    if (gridX < 0 || gridY < 0 || gridX >= level.gridSize || gridY >= level.gridSize) {
      return null;
    }

    return { x: gridX, y: gridY };
  }, [cellSize, level.gridSize]);

  const isAdjacent = useCallback((p1: Point, p2: Point) => {
    const dx = Math.abs(p1.x - p2.x);
    const dy = Math.abs(p1.y - p2.y);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  }, []);

  const handleInputStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const pos = getGridPos(clientX, clientY);
    if (!pos) return;

    // Must start dragging from the current head of the path
    const currentHead = path[path.length - 1];
    if (pos.x === currentHead.x && pos.y === currentHead.y) {
      setIsDragging(true);
    } else if (pos.x === level.start.x && pos.y === level.start.y) {
      // Allow resetting by clicking start
      setPath([level.start]);
      setIsDragging(true);
    }
  }, [path, level.start, getGridPos]);

  const handleInputMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const pos = getGridPos(clientX, clientY);
    if (!pos) return;

    const currentHead = path[path.length - 1];

    // Optimization: Don't process if we haven't moved grid cells
    if (pos.x === currentHead.x && pos.y === currentHead.y) return;

    // Check 1: Is it a valid node in the level?
    const isValidNode = level.nodes.some(n => n.x === pos.x && n.y === pos.y);
    if (!isValidNode) return;

    // Check 2: Is it adjacent?
    if (!isAdjacent(currentHead, pos)) return;

    // Check 3: Is it backtracking? (Moving to the previous node)
    if (path.length > 1) {
      const prevNode = path[path.length - 2];
      if (prevNode.x === pos.x && prevNode.y === pos.y) {
        // Backtrack: Remove last node and notify
        setPath(prev => prev.slice(0, -1));
        playBacktrackSound();
        onBacktrack();
        return;
      }
    }

    // Check 4: Have we already visited it? (Self-intersection)
    const alreadyVisited = path.some(p => p.x === pos.x && p.y === pos.y);
    if (alreadyVisited) return;

    // Valid move: Add to path
    const newPath = [...path, pos];
    setPath(newPath);
    playMoveSound();

    // Check Win Condition immediately on move?
    if (newPath.length === level.nodes.length) {
      setIsDragging(false);
      playWinSound();
      onComplete();
    }
  }, [isDragging, path, level.nodes, level.start, getGridPos, isAdjacent, onComplete]);

  const handleInputEnd = useCallback(() => {
    if (isDragging && path.length < level.nodes.length && path.length > 1) {
      // Player let go before finishing - lose a life
      playLoseLifeSound();
      onLoseLife();
      setPath([level.start]);
    }
    setIsDragging(false);
  }, [isDragging, path, level.nodes, level.start, onLoseLife]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center p-2 md:p-4 relative select-none"
      style={{
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        touchAction: "none",
        overscrollBehavior: "contain"
      } as any}
    >
      <motion.canvas
        ref={canvasRef}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        onMouseDown={handleInputStart}
        onMouseMove={handleInputMove}
        onMouseUp={handleInputEnd}
        onMouseLeave={handleInputEnd}
        onTouchStart={handleInputStart}
        onTouchMove={handleInputMove}
        onTouchEnd={handleInputEnd}
        onTouchCancel={handleInputEnd}
        className="touch-none cursor-crosshair max-w-full max-h-full"
        style={{
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          userSelect: "none",
          WebkitUserDrag: "none",
          touchAction: "none",
          WebkitFontSmoothing: "antialiased",
          imageRendering: "pixelated"
        } as any}
      />
    </div>
  );
}
