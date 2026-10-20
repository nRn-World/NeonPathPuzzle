import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Hexagon, MoonStar, Orbit, Repeat2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n, type TranslationKey } from "@/lib/i18n";

/** The first level where each rule appears, and how it is introduced. */
export const MECHANIC_INTROS: Record<number, { icon: typeof Hexagon; title: TranslationKey; body: TranslationKey; color: string }> = {
  51: { icon: ArrowRight, title: "introOneWay", body: "symbolOneWay", color: "#ffffff" },
  76: { icon: Repeat2, title: "introPairs", body: "symbolPairs", color: "#ff6ec7" },
  101: { icon: Orbit, title: "introPortals", body: "symbolPortals", color: "#8a2be2" },
  201: { icon: Hexagon, title: "introSync", body: "symbolSync", color: "#00e5a0" },
  251: { icon: MoonStar, title: "introBlackout", body: "symbolBlackout", color: "#7b8cff" },
};

const SEEN_KEY = "neon_path_intros_seen";

/** Per-device convenience only: losing it just shows an intro again. */
export function hasSeenIntro(levelId: number): boolean {
  try {
    return (JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as number[]).includes(levelId);
  } catch {
    return false;
  }
}

export function markIntroSeen(levelId: number) {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as number[];
    if (!seen.includes(levelId)) localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, levelId]));
  } catch {
    // Storage blocked: the intro simply shows again next time.
  }
}

export function MechanicIntro({ levelId, onClose }: { levelId: number | null; onClose: () => void }) {
  const { t } = useI18n();
  const intro = levelId !== null ? MECHANIC_INTROS[levelId] : undefined;
  const Icon = intro?.icon ?? Sparkles;

  return (
    <AnimatePresence>
      {intro && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-40 flex items-center justify-center bg-background/75 px-6 backdrop-blur-md"
          role="dialog"
          aria-labelledby="mechanic-intro-title"
        >
          <motion.div
            initial={{ y: 20, scale: 0.94 }}
            animate={{ y: 0, scale: 1 }}
            className="w-full max-w-sm space-y-4 overflow-hidden rounded-2xl border bg-background/95 p-6 text-center"
            style={{ borderColor: `${intro.color}66`, boxShadow: `0 0 50px ${intro.color}33` }}
          >
            <p className="font-mono text-[10px] tracking-[0.3em]" style={{ color: intro.color }}>{t("newMechanic")}</p>
            <motion.div
              initial={{ rotate: -90, scale: 0.4 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 160, damping: 12 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border"
              style={{ borderColor: `${intro.color}66`, background: `${intro.color}14` }}
            >
              <Icon className="h-8 w-8" style={{ color: intro.color }} />
            </motion.div>
            <h2 id="mechanic-intro-title" className="font-orbitron text-xl font-bold">{t(intro.title)}</h2>
            <p className="font-exo text-sm leading-relaxed text-muted-foreground">{t(intro.body)}</p>
            <Button onClick={onClose} className="w-full font-bold text-background" style={{ background: intro.color }}>
              {t("gotIt")}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
