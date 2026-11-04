import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  soundEnabled: boolean;
  /** Effect volume, 0..1. */
  soundVolume: number;
  hapticsEnabled: boolean;
  reducedMotion: boolean;
  showGhost: boolean;
  /** Okabe-Ito palette that stays distinguishable for every kind of colour blindness. */
  colorBlind: boolean;
  largeText: boolean;
  /** Opt-in aggregate diagnostics: off until the player switches it on. */
  telemetryEnabled: boolean;
  /** Off by default: three failed attempts no longer reset the campaign. */
  hardcore: boolean;
  /** Opt-in for platform interstitials on portal builds. */
  adsEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  setSoundVolume: (volume: number) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
  setShowGhost: (enabled: boolean) => void;
  setColorBlind: (enabled: boolean) => void;
  setLargeText: (enabled: boolean) => void;
  setTelemetryEnabled: (enabled: boolean) => void;
  setHardcore: (enabled: boolean) => void;
  setAdsEnabled: (enabled: boolean) => void;
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
      colorBlind: false,
      largeText: false,
      telemetryEnabled: false,
      hardcore: false,
      adsEnabled: false,
      setSoundEnabled: enabled => set({ soundEnabled: enabled }),
      setSoundVolume: volume => set({ soundVolume: Math.min(1, Math.max(0, volume)) }),
      setHapticsEnabled: enabled => set({ hapticsEnabled: enabled }),
      setReducedMotion: enabled => set({ reducedMotion: enabled }),
      setShowGhost: enabled => set({ showGhost: enabled }),
      setColorBlind: enabled => set({ colorBlind: enabled }),
      setLargeText: enabled => set({ largeText: enabled }),
      setTelemetryEnabled: enabled => set({ telemetryEnabled: enabled }),
      setHardcore: enabled => set({ hardcore: enabled }),
      setAdsEnabled: enabled => set({ adsEnabled: enabled }),
    }),
    { name: "neon-path-settings" },
  ),
);

export function applyTextPreference(largeText: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("large-text", largeText);
}

export function applyMotionPreference(reducedMotion: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("reduce-motion", reducedMotion);
}
