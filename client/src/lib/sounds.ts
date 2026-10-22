import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { useSettingsStore } from "./settings";
import { createSynth, type SynthEngine } from "./synth";

let audioCtx: AudioContext | null = null;
let engine: SynthEngine | null = null;
let audioInitialized = false;
let lastMoveSoundAt = 0;
let lastBacktrackSoundAt = 0;

function audioAllowed() {
  return useSettingsStore.getState().soundEnabled;
}

function getAudioContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    return null;
  }
  return audioCtx;
}

function getEngine(): SynthEngine | null {
  if (engine) return engine;
  const ctx = getAudioContext();
  if (!ctx) return null;
  engine = createSynth(ctx, { volume: useSettingsStore.getState().soundVolume });
  return engine;
}

/** Browsers without the native plugin (Android Chrome, installed web app) fall back to a vibration pattern. */
function nativeHaptic(action: () => Promise<void>, webPattern: number | number[] = 12) {
  if (!useSettingsStore.getState().hapticsEnabled) return;
  if (Capacitor.isNativePlatform()) void action().catch(() => undefined);
  else if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(webPattern);
}

/** A short screen shake; the CSS is switched off by the reduce-motion setting. */
function shakeScreen(heavy = false) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const className = heavy ? "screen-shake-heavy" : "screen-shake";
  root.classList.remove("screen-shake", "screen-shake-heavy");
  void root.offsetWidth;
  root.classList.add(className);
  window.setTimeout(() => root.classList.remove(className), 500);
}

const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

function resumeIfSuspended(ctx: AudioContext) {
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
}

export function initAudio() {
  audioInitialized = true;
  const ctx = getAudioContext();
  if (ctx) resumeIfSuspended(ctx);
}

export function suspendAudio() {
  if (audioCtx?.state === "running") void audioCtx.suspend().catch(() => undefined);
}

export function resumeAudio() {
  if (audioInitialized && audioCtx?.state === "suspended") {
    void audioCtx.resume().catch(() => undefined);
  }
}

export function playMoveSound(progress = 0) {
  const now = Date.now();
  if (now - lastMoveSoundAt < 25) return;
  lastMoveSoundAt = now;
  if (audioAllowed()) {
    const ctx = getAudioContext();
    if (ctx) resumeIfSuspended(ctx);
    getEngine()?.playStep(progress);
  }
  nativeHaptic(() => Haptics.impact({ style: ImpactStyle.Light }), 8);
}

/** A firmer double tap when the line passes 25 / 50 / 75 % of the board. */
export function playMilestoneHaptic() {
  nativeHaptic(async () => {
    await Haptics.impact({ style: ImpactStyle.Heavy });
    await wait(70);
    await Haptics.impact({ style: ImpactStyle.Medium });
  }, [25, 50, 25]);
}

export function playBacktrackSound() {
  const now = Date.now();
  if (now - lastBacktrackSoundAt < 60) return;
  lastBacktrackSoundAt = now;
  if (audioAllowed()) {
    const ctx = getAudioContext();
    if (ctx) resumeIfSuspended(ctx);
    getEngine()?.playUndo();
  }
  nativeHaptic(() => Haptics.impact({ style: ImpactStyle.Medium }), 14);
}

export function playLoseLifeSound() {
  if (audioAllowed()) getEngine()?.playUndo();
  shakeScreen();
  nativeHaptic(() => Haptics.notification({ type: NotificationType.Error }), [40, 40, 40]);
}

export function playWinSound() {
  if (audioAllowed()) getEngine()?.playWin();
  // A rising run of taps that ends on the success buzz, like a heartbeat speeding up.
  nativeHaptic(async () => {
    for (const delay of [110, 90, 70]) {
      await Haptics.impact({ style: ImpactStyle.Light });
      await wait(delay);
    }
    await Haptics.notification({ type: NotificationType.Success });
  }, [15, 100, 20, 80, 25, 60, 60]);
}

export function playClickSound() {
  if (audioAllowed()) getEngine()?.playClick();
  nativeHaptic(() => Haptics.selectionStart().then(() => Haptics.selectionEnd()), 6);
}

export function playDeadEndSound() {
  if (audioAllowed()) getEngine()?.playAlert();
  shakeScreen();
  nativeHaptic(() => Haptics.notification({ type: NotificationType.Warning }), [60, 40, 60]);
}

export function playCrashSound() {
  if (audioAllowed()) getEngine()?.playCrash();
  shakeScreen(true);
  nativeHaptic(async () => {
    await Haptics.impact({ style: ImpactStyle.Heavy });
    await wait(90);
    await Haptics.impact({ style: ImpactStyle.Heavy });
    await wait(90);
    await Haptics.notification({ type: NotificationType.Error });
  }, [120, 60, 120, 60, 200]);
}

/** Keeps the live synth in step with the volume setting. */
useSettingsStore.subscribe((state, previous) => {
  if (state.soundVolume !== previous.soundVolume) engine?.setVolume(state.soundVolume);
});

/** A short blip at the new volume, so the slider can be judged by ear. */
export function previewVolume() {
  if (audioAllowed()) getEngine()?.playStep(0.5);
}
