import { Link } from "wouter";
import { Check, Lock, Star } from "lucide-react";
import { motion } from "framer-motion";
import { formatDuration } from "@/lib/scoring";

interface LevelCardProps {
  id: number;
  isLocked: boolean;
  isCompleted: boolean;
  stars?: number;
  bestTimeMs?: number | null;
  bestScore?: number | null;
  hrefBase?: string;
  delay?: number;
}

export function LevelCard({
  id,
  isLocked,
  isCompleted,
  stars = 0,
  bestTimeMs = null,
  bestScore = null,
  hrefBase = "/play",
  delay = 0,
}: LevelCardProps) {
  if (isLocked) {
    return (
      <div className="aspect-square rounded-[4px] border border-white/5 bg-card/40 shadow-inner flex flex-col items-center justify-center gap-1 text-muted-foreground/25">
        <Lock className="h-5 w-5" />
        <span className="font-orbitron text-[10px]">{id}</span>
      </div>
    );
  }

  return (
    <Link href={`${hrefBase}/${id}`}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay * 0.03 }}
        title={bestTimeMs !== null
          ? `Best time ${formatDuration(bestTimeMs)}${bestScore ? ` · Best score ${bestScore.toLocaleString()}` : ""}`
          : undefined}
        className={`
          relative aspect-square rounded-[4px] cursor-pointer group overflow-hidden
          flex flex-col items-center justify-center gap-1.5
          border transition-all duration-300
          ${isCompleted
            ? "border-primary/25 bg-primary/5 hover:border-primary hover:shadow-[0_0_20px_rgba(0,243,255,0.2)]"
            : "border-white/10 bg-card hover:border-white/30 hover:bg-white/5"
          }
        `}
      >
        <span className={`font-orbitron text-xl font-bold leading-none ${isCompleted ? "text-primary" : "text-foreground"}`}>
          {id}
        </span>

        <div className="flex h-3 items-center gap-0.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <Star
              key={index}
              className={`h-2.5 w-2.5 ${
                index < Math.max(stars, isCompleted ? 1 : 0)
                  ? "fill-primary text-primary"
                  : "text-white/10"
              }`}
            />
          ))}
        </div>

        {isCompleted && (
          <div className="absolute right-1.5 top-1.5 text-primary/70">
            <Check className="h-3 w-3" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      </motion.div>
    </Link>
  );
}
