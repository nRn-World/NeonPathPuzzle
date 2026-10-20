import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Hand, Sparkles, Star, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: Hand,
    title: "Draw one continuous line",
    body: "Start on the glowing node and drag through every node. You can move up, down, left and right — never diagonally, and never across your own line.",
  },
  {
    icon: Undo2,
    title: "Three backtracks per level",
    body: "Drag backwards, press Backspace, or use the undo button — up to three times per level. A backtrack costs a star, never a life. Keyboard arrows work too.",
  },
  {
    icon: Star,
    title: "Chase three stars",
    body: "Finish without hints, without backtracks, and under par time to earn all three. Replay any level to improve your best time.",
  },
];

export function TutorialOverlay({ onDone }: { onDone: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const Icon = step.icon;
  const isLast = stepIndex === steps.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How to play"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-primary/30 bg-[#0a0f1e] shadow-[0_0_60px_rgba(0,243,255,0.15)]"
      >
        <div className="h-1 w-full bg-gradient-to-r from-primary to-secondary" />
        <div className="space-y-6 p-7">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {steps.map((_, index) => (
                <span
                  key={index}
                  className={`h-1.5 rounded-full transition-all ${
                    index === stepIndex ? "w-6 bg-primary" : "w-1.5 bg-white/20"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={onDone}
              className="text-xs font-exo text-muted-foreground transition-colors hover:text-primary"
            >
              Skip
            </button>
          </div>

          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
            <Icon className="h-8 w-8 text-primary" />
          </div>

          <div className="space-y-2">
            <h2 className="font-orbitron text-2xl font-bold text-foreground">{step.title}</h2>
            <p className="font-exo leading-relaxed text-muted-foreground">{step.body}</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => (isLast ? onDone() : setStepIndex(index => index + 1))}
              className="h-11 flex-1 bg-primary font-bold text-black hover:bg-primary/90"
            >
              {isLast ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Let&apos;s play
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            {stepIndex > 0 && (
              <Button
                variant="outline"
                onClick={() => setStepIndex(index => index - 1)}
                className="h-11 border-white/15"
              >
                Back
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
