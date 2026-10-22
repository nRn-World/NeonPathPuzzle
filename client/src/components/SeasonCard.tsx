import { Check, Gift } from "lucide-react";
import { useI18n, upper, type TranslationKey } from "@/lib/i18n";
import { getActiveSeason, readSeasonState } from "@/lib/seasons";

const NAME_KEYS: Record<string, TranslationKey> = {
  spring: "seasonSpring",
  summer: "seasonSummer",
  halloween: "seasonHalloween",
  winter: "seasonWinter",
};

/** The running seasonal event, or nothing between events. */
export function SeasonCard() {
  const { t } = useI18n();
  const active = getActiveSeason();
  if (!active) return null;

  const { season } = active;
  const state = readSeasonState();
  const earned = state.claimed.includes(season.id);
  const done = earned ? season.goal : Math.min(season.goal, (state.progress[active.key] ?? []).length);

  return (
    <div
      className="relative overflow-hidden rounded-none border border-white/10 border-l-[3px] bg-white/[0.03] p-4 text-left md:col-span-2"
      style={{ borderLeftColor: season.accent }}
    >
      <div className="flex items-center gap-4">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center border"
          style={{ borderColor: `${season.accent}66`, background: `${season.accent}1a` }}
        >
          {earned ? <Check className="h-5 w-5" style={{ color: season.accent }} /> : <Gift className="h-5 w-5" style={{ color: season.accent }} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-orbitron text-[13px] font-bold leading-tight sm:text-sm" style={{ color: season.accent }}>
              {upper(t(NAME_KEYS[season.id]))}
            </h3>
            <span className="font-mono text-[10px] text-muted-foreground">{t("seasonDaysLeft", { count: active.daysLeft })}</span>
          </div>
          <p className="font-exo text-xs text-muted-foreground">
            {earned
              ? t("seasonRewardEarned")
              : t("seasonGoal", { goal: season.goal, tokens: season.rewardTokens })}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-1.5 flex-1 bg-white/10">
              <div className="h-full" style={{ width: `${(done / season.goal) * 100}%`, background: season.accent }} />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">{done}/{season.goal}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
