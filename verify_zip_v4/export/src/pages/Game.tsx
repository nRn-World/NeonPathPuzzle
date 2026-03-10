import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import confetti from "canvas-confetti";
import { 
  useLevel, 
  useSolution, 
  useUpdateProgress, 
  useUserId 
} from "@/hooks/use-game";
import { Header } from "@/components/Header";
import { GameCanvas } from "@/components/GameCanvas";
import { WinModal } from "@/components/WinModal";
import { Loader2 } from "lucide-react";

export default function Game() {
  const [, params] = useRoute("/play/:id");
  const [, setLocation] = useLocation();
  const levelId = parseInt(params?.id || "1");
  const userId = useUserId();

  // Queries
  const { data: level, isLoading, error } = useLevel(levelId);
  const { data: solution, refetch: fetchHint, isFetching: isHintLoading } = useSolution(levelId);
  const updateProgress = useUpdateProgress();

  // Local State
  const [showHint, setShowHint] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [key, setKey] = useState(0); // Used to reset the canvas

  // Reset state when level ID changes
  useEffect(() => {
    setShowHint(false);
    setHasWon(false);
    setKey(prev => prev + 1);
  }, [levelId]);

  const handleWin = () => {
    if (hasWon) return; // Prevent double trigger
    if (!userId) return; // Wait for userId to be ready
    
    setHasWon(true);
    
    // Celebration effect
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00f3ff', '#8a2be2', '#ffffff']
    });

    // Save progress
    updateProgress.mutate({
      userId,
      levelId,
      completed: true,
      hintsUsed: showHint,
    });
  };

  const handleHint = async () => {
    if (showHint) return;
    await fetchHint();
    setShowHint(true);
  };

  const handleReset = () => {
    setKey(prev => prev + 1); // Remount canvas to reset
    setShowHint(false);
  };

  const handleNext = () => {
    if (levelId < 100) {
      setLocation(`/play/${levelId + 1}`);
    } else {
      setLocation("/");
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !level) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-background text-destructive gap-4">
        <h2 className="text-2xl font-bold">Level Load Failed</h2>
        <button onClick={() => window.location.reload()} className="underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
      <Header 
        levelId={levelId}
        onReset={handleReset}
        onHint={handleHint}
        hintsUsed={showHint}
        isHintLoading={isHintLoading}
      />
      
      <main className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Background ambient effect */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
        
        <div className="w-full max-w-2xl aspect-square p-4">
          <GameCanvas 
            key={key} // Force remount on reset
            level={level}
            onComplete={handleWin}
            showHint={showHint}
            hintPath={solution?.path}
          />
        </div>
      </main>

      <WinModal 
        isOpen={hasWon}
        levelId={levelId}
        onNext={handleNext}
        onReplay={() => {
          setHasWon(false);
          handleReset();
        }}
      />
    </div>
  );
}
