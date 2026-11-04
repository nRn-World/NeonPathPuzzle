// Playgama Bridge: loaded at runtime for portal builds only (see platform.ts).
// Missing on the web build and offline, so every call is guarded.
import { LANGUAGES, useLanguageStore } from "./i18n";
import { loadPlatformSdk, platform } from "./platform";
import { useSettingsStore } from "./settings";

type PlaygamaBridge = {
  initialize: () => Promise<unknown>;
  platform: {
    sendMessage: (message: string) => unknown;
    isAudioEnabled: boolean;
    language?: string;
    on: (event: string, handler: (value: boolean) => void) => void;
  };
  EVENT_NAME: { AUDIO_STATE_CHANGED: string; PAUSE_STATE_CHANGED: string };
  advertisement?: { showInterstitial: () => unknown };
};

declare global {
  interface Window {
    bridge?: PlaygamaBridge;
  }
}

let initPromise: Promise<void> | null = null;
let readySent = false;

/** Set by the platform: sound is off while the platform mutes audio or is paused. */
export let platformAudioOff = false;

const pauseListeners = new Set<(paused: boolean) => void>();
const LANGUAGE_KEY = "neon-path-language";
const AD_GAP_MS = 3 * 60_000;
const AD_EVERY_N_WINS = 5;
const AD_KEY = "neon-path-ad-history-v1";

export function onPlatformPause(listener: (paused: boolean) => void): () => void {
  pauseListeners.add(listener);
  return () => pauseListeners.delete(listener);
}

function applyPlatformLanguage(language: string | undefined) {
  if (!language || !LANGUAGES.some(item => item.code === language)) return;
  try {
    if (localStorage.getItem(LANGUAGE_KEY) !== null) return;
  } catch {
    return;
  }
  useLanguageStore.getState().setLanguage(language as (typeof LANGUAGES)[number]["code"]);
}

interface AdHistory {
  wins: number;
  lastAt: number;
}

function readAdHistory(): AdHistory {
  try {
    const parsed = JSON.parse(localStorage.getItem(AD_KEY) ?? "{}") as Partial<AdHistory>;
    return { wins: Number(parsed.wins) || 0, lastAt: Number(parsed.lastAt) || 0 };
  } catch {
    return { wins: 0, lastAt: 0 };
  }
}

function writeAdHistory(history: AdHistory): void {
  try {
    localStorage.setItem(AD_KEY, JSON.stringify(history));
  } catch {
    // Private browsing: ads simply stay off.
  }
}

/** Ads require consent, a minimum gap, and at most one every N clears. */
export function canShowInterstitial(now = Date.now()): boolean {
  if (platform() !== "playgama") return false;
  if (!useSettingsStore.getState().adsEnabled) return false;
  const history = readAdHistory();
  return now - history.lastAt >= AD_GAP_MS && (history.wins + 1) % AD_EVERY_N_WINS === 0;
}

export function initPlaygama(): Promise<void> {
  if (!initPromise) {
    initPromise = loadPlatformSdk().then(available => {
      const bridge = available ? window.bridge : undefined;
      if (!bridge) return;
      // The literal `window.bridge.initialize()` is deliberate: Playgama's
      // archive check looks for it, and a local alias would be minified away.
      return window.bridge!.initialize().then(() => {
        platformAudioOff = !bridge.platform.isAudioEnabled;
        applyPlatformLanguage(bridge.platform.language);
        bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, enabled => { platformAudioOff = !enabled; });
        bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, paused => {
          platformAudioOff = paused;
          pauseListeners.forEach(listener => listener(paused));
        });
      }).catch(err => console.warn("Bridge init failed", err));
    });
  }
  return initPromise;
}

// Called at natural pauses (level complete, game over). Bridge decides whether
// an ad actually shows; we count the win first so frequency stays predictable.
export function showInterstitial(): void {
  const history = readAdHistory();
  writeAdHistory({ ...history, wins: history.wins + 1 });
  if (!canShowInterstitial()) return;
  void initPlaygama().then(() => {
    if (!window.bridge?.advertisement) return;
    writeAdHistory({ wins: history.wins + 1, lastAt: Date.now() });
    window.bridge!.advertisement!.showInterstitial();
  }).catch(err => console.warn("Interstitial failed", err));
}

// Sent once, after initialize, when the first playable screen is up.
export function signalGameReady(): void {
  if (readySent) return;
  readySent = true;
  void initPlaygama().then(() => {
    if (window.bridge) window.bridge.platform.sendMessage("game_ready");
  });
}
