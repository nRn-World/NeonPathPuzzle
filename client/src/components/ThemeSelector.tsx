import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettingsStore } from "@/lib/settings";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Palette } from "lucide-react";

const neonThemes = [
  { id: "default", name: "Default", colors: { primary: "#00f0ff", secondary: "#ff00f0", background: "#0a0a1a" } },
  { id: "cyberpunk", name: "Cyberpunk", colors: { primary: "#00ff9d", secondary: "#ff00f7", background: "#1a0a1a" } },
  { id: "electric", name: "Electric", colors: { primary: "#ff00ff", secondary: "#00ffff", background: "#0a1a0a" } },
  { id: "neon", name: "Neon", colors: { primary: "#ff0000", secondary: "#00ff00", background: "#0a0a1a" } },
  { id: "vibrant", name: "Vibrant", colors: { primary: "#ff00aa", secondary: "#00aaff", background: "#1a1a1a" } },
];

export function ThemeSelector() {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const { theme, setTheme } = useSettingsStore();

  useEffect(() => {
    const root = document.documentElement;
    const selectedTheme = neonThemes.find(t => t.id === theme) || neonThemes[0];

    root.style.setProperty('--color-primary', selectedTheme.colors.primary);
    root.style.setProperty('--color-secondary', selectedTheme.colors.secondary);
    root.style.setProperty('--color-background', selectedTheme.colors.background);
  }, [theme]);

  const toggleSelector = () => setIsOpen(!isOpen);

  const handleThemeChange = (themeId: string) => {
    setTheme(themeId);
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        onClick={toggleSelector}
        className="rounded-full p-3 shadow-lg bg-primary text-background hover:bg-primary/90"
        aria-label={t("themeSelector")}
      >
        <Palette className="h-5 w-5" />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute bottom-16 right-0 w-64 bg-background border border-primary/20 rounded-lg shadow-xl p-4"
          >
            <h3 className="font-orbitron text-lg font-bold mb-3 text-primary">{t("selectTheme")}</h3>
            <div className="grid grid-cols-2 gap-2">
              {neonThemes.map((theme) => (
                <Button
                  key={theme.id}
                  onClick={() => handleThemeChange(theme.id)}
                  className={`h-12 flex items-center justify-center rounded-md ${theme.id === theme ? 'ring-2 ring-primary' : ''}`}
                  style={{
                    backgroundColor: theme.colors.background,
                    border: `1px solid ${theme.colors.primary}`,
                  }}
                >
                  <div className="flex flex-col items-center">
                    <div
                      className="w-6 h-6 rounded-full mb-1"
                      style={{ backgroundColor: theme.colors.primary }}
                    />
                    <span className="text-xs font-exo" style={{ color: theme.colors.primary }}>
                      {theme.name}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
