import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Theme, themes, getTheme } from '@/lib/themes';

interface ThemeStore {
  currentTheme: string;
  setTheme: (themeId: string) => void;
  getThemeColors: () => Theme['colors'];
  getThemeEffects: () => Theme['effects'];
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      currentTheme: 'cyberpunk',
      setTheme: (themeId: string) => {
        set({ currentTheme: themeId });
        // Apply theme to CSS variables
        const theme = getTheme(themeId);
        const root = document.documentElement;
        
        Object.entries(theme.colors).forEach(([key, value]) => {
          const cssValue = Array.isArray(value) ? value.join(",") : value;
          root.style.setProperty(`--theme-${key}`, cssValue);
        });
        
        // Update CSS for neon effects
        root.style.setProperty('--theme-glow', theme.effects.glow);
      },
      getThemeColors: () => {
        const theme = getTheme(get().currentTheme);
        return theme.colors;
      },
      getThemeEffects: () => {
        const theme = getTheme(get().currentTheme);
        return theme.effects;
      }
    }),
    {
      name: 'neon-path-theme'
    }
  )
);

export const useTheme = () => useThemeStore();
