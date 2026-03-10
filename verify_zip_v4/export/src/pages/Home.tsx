import { useLevels } from "@/hooks/use-game";
import { LevelCard } from "@/components/LevelCard";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { data: levels, isLoading, error } = useLevels();

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !levels) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background text-destructive gap-4">
        <h2 className="text-2xl font-bold">System Error</h2>
        <p>Failed to load level matrix.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-12 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-4 py-8">
          <h1 className="text-5xl md:text-7xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-br from-primary via-white to-secondary neon-text tracking-tighter">
            NEON PATH
          </h1>
          <p className="text-muted-foreground font-exo text-lg max-w-lg mx-auto">
            Connect the nodes. One continuous line. <br />
            <span className="text-primary">100 Levels</span> of cyber-logic puzzles.
          </p>
        </div>

        {/* Level Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-4">
          {levels.map((level, idx) => (
            <LevelCard 
              key={level.id}
              id={level.id}
              isLocked={level.isLocked}
              isCompleted={level.isCompleted}
              hintsUsed={level.hintsUsed}
              delay={idx % 20} // Stagger animation for visible items
            />
          ))}
        </div>
      </div>
    </div>
  );
}
