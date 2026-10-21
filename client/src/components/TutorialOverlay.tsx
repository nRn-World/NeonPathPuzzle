import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Hand, ShieldAlert, Sparkles, Star, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const steps: { icon: typeof Hand; title: TranslationKey; body: TranslationKey }[] = [
  { icon: Hand, title: "tutLineTitle", body: "tutLineBody" },
  { icon: Undo2, title: "tutUndoTitle", body: "tutUndoBody" },
  { icon: ShieldAlert, title: "tutAttemptsTitle", body: "tutAttemptsBody" },
  { icon: Star, title: "tutStarsTitle", body: "tutStarsBody" },
];

export function TutorialOverlay({ onDone }: { onDone: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const { t } = useI18n();
  const step = steps[stepIndex];
  const Icon = step.icon;
  const isLast = stepIndex === steps.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("howToPlay")}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-md overflow-hidden rounded-none border border-primary/30 bg-[#0a0f1e] shadow-[0_0_60px_rgba(0,243,255,0.15)]"
      >
        <div className="h-[3px] w-full bg-primary" />
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
              {t("tutSkip")}
            </button>
          </div>

          <div className="flex h-16 w-16 items-center justify-center rounded-none border border-primary/30 bg-primary/10">
            <Icon className="h-8 w-8 text-primary" />
          </div>

          <div className="space-y-2">
            <h2 className="font-orbitron text-2xl font-bold text-foreground">{t(step.title)}</h2>
            <p className="font-exo leading-relaxed text-muted-foreground">{t(step.body)}</p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => (isLast ? onDone() : setStepIndex(index => index + 1))}
              className="h-11 flex-1 bg-primary font-bold text-black hover:bg-primary/90"
            >
              {isLast ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {t("tutPlay")}
                </>
              ) : (
                <>
                  {t("tutNext")}
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
                {t("tutBack")}
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
