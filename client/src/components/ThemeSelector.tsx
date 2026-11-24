import { useState } from "react";
import { Check, Lock, Palette } from "lucide-react";
import { content } from "@/lib/contentText";
import { useTheme } from "@/hooks/use-theme";
import { useUserProgress, useUserId } from "@/hooks/use-game";
import { themes, isThemeUnlocked } from "@/lib/themes";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n";

/**
 * Theme picker. A popover keeps itself inside the screen (it flips upward near
 * the bottom edge and scrolls when it is taller than the space it has).
 */
export function ThemeSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const { currentTheme, setTheme } = useTheme();
  const { t } = useI18n();
  const userId = useUserId();
  const { data: progress } = useUserProgress(userId);
  const completedCount = progress?.completedCount ?? 0;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 rounded-none border-white/15 px-3 font-mono text-[11px] uppercase tracking-wider text-foreground/80 hover:border-primary hover:bg-primary/10 hover:text-primary"
        >
          <Palette className="h-4 w-4" />
          <span>{t("theme")}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        collisionPadding={12}
        className="max-h-[var(--radix-popover-content-available-height)] w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-none border-white/15 bg-background/95 p-4 backdrop-blur-md"
      >
        <h3 className="mb-3 font-orbitron text-sm font-bold uppercase tracking-wider">{t("chooseTheme")}</h3>
        <div className="space-y-2">
          {themes.map(theme => {
            const isActive = currentTheme === theme.id;
            const unlocked = isThemeUnlocked(theme.id, completedCount);
            const text = content.theme(theme);
            return (
              <button
                key={theme.id}
                disabled={!unlocked}
                onClick={() => {
                  setTheme(theme.id);
                  setIsOpen(false);
                }}
                className={`w-full border p-3 text-left transition-colors ${
                  isActive
                    ? "border-primary bg-primary/10"
                    : unlocked
                      ? "border-white/10 hover:border-primary/60 hover:bg-white/5"
                      : "cursor-not-allowed border-white/5 opacity-55"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{text.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {unlocked
                        ? text.description
                        : theme.seasonId ? t("themeSeasonLocked") : t("themeLocked", { count: theme.unlockAtLevels })}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <div className="flex gap-1">
                      {theme.colors.neon.slice(0, 3).map((color, index) => (
                        <div key={index} className="h-3 w-3" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                    {isActive
                      ? <Check className="h-4 w-4 text-primary" />
                      : !unlocked
                        ? <Lock className="h-4 w-4 text-muted-foreground" />
                        : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
