/**
 * Tiny procedural synth built on Web Audio.
 *
 * Deliberately free of React, Capacitor and localStorage: the game logic never
 * has to know whether audio exists, and the engine can be unit tested with a
 * fake AudioContext.
 */

/** Minor pentatonic, in semitones. Any two notes of it sound fine together. */
export const STEP_SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];

const WIN_NOTES = [523.25, 659.25, 783.99, 1046.5];

/** Web Audio treats zero as silence-in-the-past, so ramps use a tiny floor. */
const MIN_GAIN = 0.0001;

const STEP_ROOT_HZ = 329.63;

export interface SynthOptions {
  /** Master volume, 0..1. */
  volume?: number;
}

export interface SynthEngine {
  /** Rising note for each connected node; `progress` is 0..1 of the level solved. */
  playStep: (progress: number) => void;
  playUndo: () => void;
  playWin: () => void;
  playClick: () => void;
  dispose: () => void;
}

export function stepFrequency(progress: number, rootHz = STEP_ROOT_HZ): number {
  const clamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const index = Math.min(STEP_SCALE.length - 1, Math.round(clamped * (STEP_SCALE.length - 1)));
  return rootHz * Math.pow(2, STEP_SCALE[index] / 12);
}

interface VoiceOptions {
  frequency: number;
  type?: OscillatorType;
  duration?: number;
  peak?: number;
  attack?: number;
  delay?: number;
}

function playVoice(ctx: AudioContext, destination: AudioNode, options: VoiceOptions): OscillatorNode {
  const {
    frequency,
    type = "sine",
    duration = 0.2,
    peak = 0.18,
    attack = 0.008,
    delay = 0,
  } = options;

  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);

  // Short attack and a full exponential decay: no click at either end.
  gain.gain.setValueAtTime(MIN_GAIN, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(MIN_GAIN * 2, peak), start + attack);
  gain.gain.exponentialRampToValueAtTime(MIN_GAIN, start + duration);

  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
  oscillator.onended = () => {
    try {
      gain.disconnect();
    } catch {
      // The context may already be closed.
    }
  };

  return oscillator;
}

export function createSynth(ctx: AudioContext, options: SynthOptions = {}): SynthEngine {
  const master = ctx.createGain();
  master.gain.setValueAtTime(Math.min(1, Math.max(0, options.volume ?? 0.5)), ctx.currentTime);
  master.connect(ctx.destination);

  return {
    playStep: progress => {
      playVoice(ctx, master, {
        frequency: stepFrequency(progress),
        type: "triangle",
        duration: 0.16,
        peak: 0.13,
      });
    },
    playUndo: () => {
      playVoice(ctx, master, { frequency: 392, type: "triangle", duration: 0.14, peak: 0.12 });
      playVoice(ctx, master, { frequency: 294, duration: 0.16, peak: 0.1, delay: 0.06 });
    },
    playWin: () => {
      WIN_NOTES.forEach((note, index) => {
        playVoice(ctx, master, {
          frequency: note,
          type: "sine",
          duration: 0.6,
          peak: 0.16,
          delay: index * 0.09,
        });
      });
    },
    playClick: () => {
      playVoice(ctx, master, { frequency: 1200, type: "triangle", duration: 0.045, peak: 0.05 });
    },
    dispose: () => {
      try {
        master.disconnect();
      } catch {
        // Nothing to disconnect.
      }
    },
  };
}
