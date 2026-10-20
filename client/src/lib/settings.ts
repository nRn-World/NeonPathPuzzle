import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  soundEnabled: boolean;
  musicEnabled: boolean;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  showGhost: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  setMusicEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setShowGhost: (enabled: boolean) => void;
}

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined"
      && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    set => ({
      soundEnabled: true,
      musicEnabled: true,
      hapticsEnabled: true,
      reducedMotion: prefersReducedMotion(),
      showGhost: true,
      setSoundEnabled: enabled => set({ soundEnabled: enabled }),
      setMusicEnabled: enabled => set({ musicEnabled: enabled }),
      setHapticsEnabled: enabled => set({ hapticsEnabled: enabled }),
      setReducedMotion: enabled => set({ reducedMotion: enabled }),
      setShowGhost: enabled => set({ showGhost: enabled }),
    }),
    { name: "neon-path-settings" },
  ),
);

export function applyMotionPreference(reducedMotion: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("reduce-motion", reducedMotion);
}
