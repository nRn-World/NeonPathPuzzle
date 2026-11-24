import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { themes } from "@/lib/themes";

export function ThemeDemo() {
  const { t } = useI18n();
  const [selectedTheme, setSelectedTheme] = useState(themes[0]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t("themeDemoTitle")}</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {themes.map(theme => (
          <button
            key={theme.id}
            onClick={() => setSelectedTheme(theme)}
            className={`p-4 rounded-lg ${selectedTheme.id === theme.id ? "ring-2 ring-primary" : ""}`}
            style={{ backgroundColor: theme.colors.background }}
          >
            <div className="h-24 flex flex-col justify-between">
              <div className="text-lg font-bold" style={{ color: theme.colors.primary }}>{theme.name}</div>
              <div className="flex justify-between">
                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: theme.colors.primary }}></div>
                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: theme.colors.secondary }}></div>
                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: theme.colors.accent }}></div>
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="p-4 rounded-lg" style={{ backgroundColor: selectedTheme.colors.background }}>
        <div className="text-xl font-bold mb-4" style={{ color: selectedTheme.colors.primary }}>{t("themePreview")}</div>
        <div className="space-y-2">
          <div className="p-2 rounded" style={{ backgroundColor: selectedTheme.colors.primary, color: selectedTheme.colors.background }}>
            {t("primaryColorExample")}
          </div>
          <div className="p-2 rounded" style={{ backgroundColor: selectedTheme.colors.secondary, color: selectedTheme.colors.background }}>
            {t("secondaryColorExample")}
          </div>
          <div className="p-2 rounded" style={{ backgroundColor: selectedTheme.colors.accent, color: selectedTheme.colors.background }}>
            {t("accentColorExample")}
          </div>
        </div>
      </div>
    </div>
  );
}
