import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  soundEnabled: boolean;
  /** Effect volume, 0..1. */
  soundVolume: number;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  showGhost: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  setSoundVolume: (volume: number) => void;
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
      soundVolume: 0.6,
      hapticsEnabled: true,
      reducedMotion: prefersReducedMotion(),
      showGhost: true,
      setSoundEnabled: enabled => set({ soundEnabled: enabled }),
      setSoundVolume: volume => set({ soundVolume: Math.min(1, Math.max(0, volume)) }),
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
