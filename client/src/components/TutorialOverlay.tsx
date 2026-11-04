import { useState } from "react";
import { motion } from "framer-motion";
import { AnimatedBoard } from "@/components/MenuHero";
import { Button } from "@/components/ui/button";
import { HERO_BOARD } from "@/lib/heroBoard";
import { useI18n, upper, type TranslationKey } from "@/lib/i18n";
import { markTutorialSeen } from "@/lib/progress";
import { useSettingsStore } from "@/lib/settings";

/**
 * First-run onboarding. The old build had the translation keys and
 * `hasSeenTutorial`/`markTutorialSeen` but never actually showed a tutorial —
 * new players landed on a static "How to play" page behind a menu button.
 * This one teaches the drag with a live demo of the line drawing itself.
 */
const STEPS: [TranslationKey, TranslationKey][] = [
  ["tutLineTitle", "tutLineBody"],
  ["tutUndoTitle", "tutUndoBody"],
  ["tutStarsTitle", "tutStarsBody"],
];

export function TutorialOverlay({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const { t } = useI18n();
  const reducedMotion = useSettingsStore(state => state.reducedMotion);
  const [title, body] = STEPS[step];

  const finish = () => {
    markTutorialSeen(userId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 px-5 backdrop-blur-md">
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-none border border-primary/30 bg-[#0a0f1e] p-5 shadow-[0_0_40px_rgba(0,243,255,0.12)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-widest text-primary">
            {t("tutorialTitle")}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {t("tutorialStep", { n: step + 1, total: STEPS.length })}
          </span>
        </div>

        <div className="mx-auto mb-5 w-40">
          <AnimatedBoard board={HERO_BOARD} speed={16} />
        </div>

        <h2 id="tutorial-title" className="mb-2 font-orbitron text-xl font-bold text-foreground">
          {upper(t(title))}
        </h2>
        <p className="mb-6 min-h-[4.5rem] font-exo text-sm leading-relaxed text-muted-foreground">
          {t(body)}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={finish}
            className="font-exo text-xs uppercase tracking-wider text-muted-foreground underline hover:text-foreground"
          >
            {t("tutSkip")}
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} className="border-white/15">
                {t("tutBack")}
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => (step === STEPS.length - 1 ? finish() : setStep(step + 1))}
              className="bg-primary font-bold text-background hover:bg-primary/90"
            >
              {step === STEPS.length - 1 ? t("tutPlay") : t("tutNext")}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
