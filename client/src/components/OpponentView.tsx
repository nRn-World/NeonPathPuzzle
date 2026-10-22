import { useEffect, useRef } from "react";
import { Bot } from "lucide-react";
import type { Point } from "@shared/schema";
import { useThemeStore } from "@/hooks/use-theme";

interface OpponentViewProps {
  gridSize: number;
  nodes: Point[];
  /** The opponent's latest steps, oldest first. */
  tail: Point[];
  /** How many points of their line are done. */
  count: number;
  total: number;
  name: string;
  bot: boolean;
  /** Canvas side in CSS pixels. */
  size: number;
  className?: string;
}

/**
 * A small live view of the opponent: the board's nodes, a glowing trail of
 * their last steps and where their head is. The server only sends that short
 * tail, so it shows how they play without handing over a route to copy.
 */
export function OpponentView({ gridSize, nodes, tail, count, total, name, bot, size, className = "" }: OpponentViewProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const colors = useThemeStore(state => state.getThemeColors)();

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size, size);

    const cell = size / gridSize;
    const center = (point: Point) => [point.x * cell + cell / 2, point.y * cell + cell / 2] as const;

    context.fillStyle = "rgba(255,255,255,0.38)";
    nodes.forEach(node => {
      const [x, y] = center(node);
      context.beginPath();
      context.arc(x, y, Math.max(1.2, cell * 0.14), 0, Math.PI * 2);
      context.fill();
    });

    if (tail.length === 0) return;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = colors.secondary;
    context.shadowColor = colors.secondary;
    context.shadowBlur = 6;
    context.lineWidth = Math.max(2, cell * 0.3);
    context.beginPath();
    tail.forEach((point, index) => {
      const [x, y] = center(point);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();

    const [headX, headY] = center(tail[tail.length - 1]);
    context.shadowBlur = 8;
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(headX, headY, Math.max(2.5, cell * 0.36), 0, Math.PI * 2);
    context.fill();
  }, [colors.secondary, gridSize, nodes, size, tail]);

  return (
    <div className={`flex items-center gap-3 ${className}`} aria-label={`${name}: ${count}/${total}`}>
      <canvas
        ref={ref}
        style={{ width: size, height: size }}
        className="flex-shrink-0 border border-secondary/50 bg-black/60"
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-1 truncate font-orbitron text-xs font-bold text-secondary">
          {bot && <Bot className="h-3 w-3 flex-shrink-0" />}
          <span className="truncate">{name}</span>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">{count}/{total}</div>
        <div className="h-1 w-20 bg-white/10 md:w-24">
          <div className="h-full bg-secondary transition-[width] duration-200" style={{ width: `${Math.min(100, (count / Math.max(1, total)) * 100)}%` }} />
        </div>
      </div>
    </div>
  );
}
