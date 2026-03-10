import { Link } from "wouter";
import { Lock, Check, Lightbulb } from "lucide-react";
import { motion } from "framer-motion";

interface LevelCardProps {
  id: number;
  isLocked: boolean;
  isCompleted: boolean;
  hintsUsed?: boolean;
  delay?: number;
}

export function LevelCard({ id, isLocked, isCompleted, hintsUsed = false, delay = 0 }: LevelCardProps) {
  if (isLocked) {
    return (
      <div className="aspect-square rounded-xl bg-card/40 border border-white/5 flex items-center justify-center text-muted-foreground/30 shadow-inner">
        <Lock className="w-6 h-6" />
      </div>
    );
  }

  return (
    <Link href={`/play/${id}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay * 0.05 }}
        className={`
          relative aspect-square rounded-xl cursor-pointer group overflow-hidden
          flex flex-col items-center justify-center gap-2
          border transition-all duration-300
          ${isCompleted 
            ? 'bg-primary/5 border-primary/20 hover:border-primary hover:shadow-[0_0_20px_rgba(0,243,255,0.2)]' 
            : 'bg-card border-white/10 hover:border-white/30 hover:bg-white/5'
          }
        `}
      >
        <span className={`text-2xl font-orbitron font-bold ${isCompleted ? 'text-primary' : 'text-foreground'}`}>
          {id}
        </span>
        
        {isCompleted && (
          <div className="absolute top-2 right-2 text-primary">
            <Check className="w-4 h-4" />
          </div>
        )}

        {hintsUsed && !isCompleted && (
          <div className="absolute top-2 right-2 text-secondary/70">
            <Lightbulb className="w-3 h-3" />
          </div>
        )}
        
        {/* Hover Effect Layer */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </motion.div>
    </Link>
  );
}
