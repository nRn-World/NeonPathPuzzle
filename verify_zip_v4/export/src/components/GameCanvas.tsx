import React, { useRef, useEffect, useState, useCallback } from "react";
import { type LevelResponse, type Point } from "@shared/schema";
import { motion } from "framer-motion";

interface GameCanvasProps {
  level: LevelResponse;
  onComplete: () => void;
  showHint: boolean;
  hintPath?: Point[];
}

export function GameCanvas({ level, onComplete, showHint, hintPath }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
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
    setOffset({ x: 0, y: 0 }); // Simplified centering logic for now
  }, [level.gridSize]);

  useEffect(() => {
    updateMetrics();
    window.addEventListener("resize", updateMetrics);
    return () => window.removeEventListener("resize", updateMetrics);
  }, [updateMetrics]);

  // Drawing Logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // Helper to get pixel coordinates
    const getPixel = (p: Point) => ({
      x: p.x * cellSize + cellSize / 2 + offset.x,
      y: p.y * cellSize + cellSize / 2 + offset.y,
    });

    // 1. Draw Grid Nodes (Empty/Walls vs Valid)
    // We only have a list of valid 'nodes'. Any grid cell NOT in 'nodes' is a wall.
    // However, for this visual style, let's draw faint markers for all grid cells 
    // and highlight the valid ones.
    
    for (let x = 0; x < level.gridSize; x++) {
      for (let y = 0; y < level.gridSize; y++) {
        const p = { x, y };
        const center = getPixel(p);
        
        // Check if valid node
        const isValid = level.nodes.some(n => n.x === x && n.y === y);
        
        if (isValid) {
          // Draw Valid Node
          ctx.beginPath();
          ctx.arc(center.x, center.y, cellSize * 0.15, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
          ctx.fill();
          
          // Outer Glow Ring
          ctx.beginPath();
          ctx.arc(center.x, center.y, cellSize * 0.18, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(0, 243, 255, 0.3)";
          ctx.lineWidth = 2;
          ctx.stroke();
        } 
      }
    }

    // 2. Draw Start Node
    if (level.start) {
      const startPixel = getPixel(level.start);
      ctx.beginPath();
      ctx.arc(startPixel.x, startPixel.y, cellSize * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = "#00f3ff"; // Neon Cyan
      ctx.shadowColor = "#00f3ff";
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0; // Reset
    }

    // 3. Draw Connected Path
    if (path.length > 1) {
      ctx.beginPath();
      const p0 = getPixel(path[0]);
      if (p0) {
        ctx.moveTo(p0.x, p0.y);
        
        for (let i = 1; i < path.length; i++) {
          const pi = getPixel(path[i]);
          if (pi) ctx.lineTo(pi.x, pi.y);
        }
        
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = cellSize * 0.15;
        ctx.strokeStyle = "#00f3ff";
        ctx.shadowColor = "#00f3ff";
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // 4. Draw Current Head
    if (path.length > 0) {
      const currentHead = path[path.length - 1];
      const headPixel = getPixel(currentHead);
      
      if (headPixel) {
        // Pulse animation for head
        const time = Date.now() / 500;
        const pulseSize = cellSize * 0.2 + Math.sin(time) * 2;
        
        ctx.beginPath();
        ctx.arc(headPixel.x, headPixel.y, pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
    }

    // 5. Draw Hints (if active)
    if (showHint && hintPath) {
      ctx.font = `bold ${cellSize * 0.4}px "Exo 2"`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#8a2be2"; // Purple hint text
      
      hintPath.forEach((pt, index) => {
        const pix = getPixel(pt);
        // Don't draw over start or current path if it's correct so far
        // Just draw simple numbers
        ctx.fillText(`${index + 1}`, pix.x, pix.y);
      });
    }

  }, [path, cellSize, level, showHint, hintPath, offset]);


  // Game Logic
  const getGridPos = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left) / (rect.width / level.gridSize));
    const y = Math.floor((clientY - rect.top) / (rect.height / level.gridSize));
    return { x, y };
  }, [level.gridSize]);

  const isAdjacent = useCallback((p1: Point, p2: Point) => {
    const dx = Math.abs(p1.x - p2.x);
    const dy = Math.abs(p1.y - p2.y);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  }, []);

  const handleInputStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // Prevent scrolling
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
        // Backtrack: Remove last node
        setPath(prev => prev.slice(0, -1));
        return;
      }
    }

    // Check 4: Have we already visited it? (Self-intersection)
    const alreadyVisited = path.some(p => p.x === pos.x && p.y === pos.y);
    if (alreadyVisited) return;

    // Valid move: Add to path
    const newPath = [...path, pos];
    setPath(newPath);

    // Check Win Condition immediately on move?
    if (newPath.length === level.nodes.length) {
      setIsDragging(false);
      onComplete();
    }
  }, [isDragging, path, level.nodes, level.gridSize, getGridPos, isAdjacent, onComplete]);

  const handleInputEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full flex items-center justify-center p-4 relative"
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
        className="touch-none cursor-crosshair"
      />
    </div>
  );
}
