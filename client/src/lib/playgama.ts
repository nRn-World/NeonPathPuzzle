// Playgama Bridge: loaded from <script> in index.html. Missing when offline or run locally, so every call is guarded.
import { LANGUAGES, useLanguageStore } from "./i18n";

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

// Set by the platform: sound is off while the platform mutes audio or the game is paused there.
export let platformAudioOff = false;

const pauseListeners = new Set<(paused: boolean) => void>();

/** Called when the platform pauses or resumes the game (tab hidden, ad overlay, etc.). */
export function onPlatformPause(listener: (paused: boolean) => void): () => void {
  pauseListeners.add(listener);
  return () => pauseListeners.delete(listener);
}

// The language store is persisted, so a saved value means the player already chose one.
const LANGUAGE_KEY = "neon-path-language";

function applyPlatformLanguage(language: string | undefined) {
  if (!language || !LANGUAGES.some(item => item.code === language)) return;
  try {
    if (localStorage.getItem(LANGUAGE_KEY) !== null) return;
  } catch {
    return;
  }
  useLanguageStore.getState().setLanguage(language as (typeof LANGUAGES)[number]["code"]);
}

export function initPlaygama(): Promise<void> {
  if (!initPromise) {
    const bridge = window.bridge;
    // The literal `window.bridge.initialize()` is deliberate: Playgama's archive check looks for it, and a local alias would be minified away.
    initPromise = bridge
      ? window.bridge!.initialize().then(() => {
        platformAudioOff = !bridge.platform.isAudioEnabled;
        applyPlatformLanguage(bridge.platform.language);
        bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, enabled => { platformAudioOff = !enabled; });
        bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, paused => {
          platformAudioOff = paused;
          pauseListeners.forEach(listener => listener(paused));
        });
      }).catch(err => console.warn('Bridge init failed', err))
      : Promise.resolve();
  }
  return initPromise;
}

// Called at natural pauses (level complete, game over). Bridge decides whether an ad actually shows.
export function showInterstitial(): void {
  void initPlaygama().then(() => {
    window.bridge?.advertisement?.showInterstitial();
  }).catch(err => console.warn('Interstitial failed', err));
}

// Sent once, after initialize, when the first playable screen is up.
export function signalGameReady(): void {
  if (readySent) return;
  readySent = true;
  void initPlaygama().then(() => {
    if (window.bridge) window.bridge.platform.sendMessage('game_ready');
  });
}
