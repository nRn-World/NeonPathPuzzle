import { useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import { useUserProgress, useUserId } from "@/hooks/use-game";
import { themes, isThemeUnlocked } from "@/lib/themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Lock, Palette } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function ThemeSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const { currentTheme, setTheme } = useTheme();
  const { t } = useI18n();
  const userId = useUserId();
  const { data: progress } = useUserProgress(userId);
  const completedCount = progress?.completedCount ?? 0;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 gap-1.5 rounded-none border-white/15 px-3 font-mono text-[11px] uppercase tracking-wider text-foreground/80 hover:border-primary hover:bg-primary/10 hover:text-primary"
      >
        <Palette className="w-4 h-4" />
        <span>{t("theme")}</span>
      </Button>

      {isOpen && (
        <>
          <button
            aria-label="Close theme selector"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full mt-2 right-0 z-50">
            <Card className="w-[22rem] max-w-[calc(100vw-2rem)] bg-background/95 backdrop-blur-md border-border shadow-2xl">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-3">Choose Theme</h3>
                <div className="space-y-2">
                  {themes.map((theme) => {
                    const isActive = currentTheme === theme.id;
                    const unlocked = isThemeUnlocked(theme.id, completedCount);
                    return (
                      <button
                        key={theme.id}
                        disabled={!unlocked}
                        onClick={() => {
                          if (!unlocked) return;
                          setTheme(theme.id);
                          setIsOpen(false);
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isActive
                            ? "border-primary bg-primary/10"
                            : unlocked
                              ? "border-border hover:border-primary/50 hover:bg-accent"
                              : "border-white/5 opacity-55 cursor-not-allowed"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium">{theme.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {unlocked
                                ? theme.description
                                : `Complete ${theme.unlockAtLevels} levels to unlock`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex gap-1">
                              {theme.colors.neon.slice(0, 3).map((color, index) => (
                                <div
                                  key={index}
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                            {isActive
                              ? <Check className="w-4 h-4 text-primary" />
                              : !unlocked
                                ? <Lock className="w-4 h-4 text-muted-foreground" />
                                : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
