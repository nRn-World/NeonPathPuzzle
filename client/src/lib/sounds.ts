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
  engine = createSynth(ctx, { volume: 0.5 });
  return engine;
}

function nativeHaptic(action: () => Promise<void>) {
  if (!useSettingsStore.getState().hapticsEnabled) return;
  if (Capacitor.isNativePlatform()) void action().catch(() => undefined);
}

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
  nativeHaptic(() => Haptics.impact({ style: ImpactStyle.Light }));
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
  nativeHaptic(() => Haptics.impact({ style: ImpactStyle.Medium }));
}

export function playLoseLifeSound() {
  if (audioAllowed()) getEngine()?.playUndo();
  nativeHaptic(() => Haptics.notification({ type: NotificationType.Error }));
}

export function playWinSound() {
  if (audioAllowed()) getEngine()?.playWin();
  nativeHaptic(() => Haptics.notification({ type: NotificationType.Success }));
}

export function playClickSound() {
  if (audioAllowed()) getEngine()?.playClick();
  nativeHaptic(() => Haptics.selectionStart().then(() => Haptics.selectionEnd()));
}

export function playDeadEndSound() {
  if (audioAllowed()) getEngine()?.playAlert();
  nativeHaptic(() => Haptics.notification({ type: NotificationType.Warning }));
}

export function playCrashSound() {
  if (audioAllowed()) getEngine()?.playCrash();
  nativeHaptic(() => Haptics.notification({ type: NotificationType.Error }));
}
