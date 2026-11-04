import { chapters, getChapterForLevel } from "./chapters";
import { STEP_SCALE } from "./synth";

/**
 * One musical identity per campaign chapter. The 12 chapters already have 12
 * different visual atmospheres (ChapterAtmosphere); until now they all shared
 * the same synth scale, so chapter 12 sounded exactly like chapter 1.
 *
 * Every scale here is pentatonic: any note played over any other stays
 * consonant, which matters because the melody is generated from the board and
 * the player chooses the order. Roots move through the circle of fifths so
 * successive chapters feel like a modulation rather than a random jump.
 */

export interface ChapterAudio {
  id: number;
  /** Root of the scale, in Hz. */
  rootHz: number;
  /** Semitone offsets from the root, ascending. */
  scale: readonly number[];
  /** Resolve chord played when the final node connects. */
  chord: readonly number[];
  /** Length of the win phrase in seconds. */
  phraseSeconds: number;
}

const MINOR_PENTATONIC = STEP_SCALE;
const MAJOR_PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const SUSPENDED_PENTATONIC = [0, 2, 5, 7, 10, 12, 14, 17, 19, 22, 24];
const KUMOI = [0, 2, 3, 7, 9, 12, 14, 15, 19, 21, 24];

export const CHAPTER_AUDIO: readonly ChapterAudio[] = [
  { id: 1, rootHz: 329.63, scale: MINOR_PENTATONIC, chord: [0, 7, 12, 19], phraseSeconds: 1.2 },
  { id: 2, rootHz: 293.66, scale: MAJOR_PENTATONIC, chord: [0, 4, 7, 16], phraseSeconds: 1.15 },
  { id: 3, rootHz: 261.63, scale: SUSPENDED_PENTATONIC, chord: [0, 5, 12, 17], phraseSeconds: 1.1 },
  { id: 4, rootHz: 349.23, scale: KUMOI, chord: [0, 3, 7, 15], phraseSeconds: 1.3 },
  { id: 5, rootHz: 392.0, scale: MINOR_PENTATONIC, chord: [0, 7, 10, 19], phraseSeconds: 0.95 },
  { id: 6, rootHz: 246.94, scale: MAJOR_PENTATONIC, chord: [0, 4, 9, 16], phraseSeconds: 1.4 },
  { id: 7, rootHz: 220.0, scale: KUMOI, chord: [0, 3, 7, 12], phraseSeconds: 1.0 },
  { id: 8, rootHz: 415.3, scale: SUSPENDED_PENTATONIC, chord: [0, 5, 10, 17], phraseSeconds: 1.25 },
  { id: 9, rootHz: 311.13, scale: MINOR_PENTATONIC, chord: [0, 7, 12, 15], phraseSeconds: 1.05 },
  { id: 10, rootHz: 233.08, scale: MAJOR_PENTATONIC, chord: [0, 4, 7, 12], phraseSeconds: 0.9 },
  { id: 11, rootHz: 277.18, scale: KUMOI, chord: [0, 2, 7, 15], phraseSeconds: 1.45 },
  { id: 12, rootHz: 523.25, scale: SUSPENDED_PENTATONIC, chord: [0, 5, 12, 19], phraseSeconds: 1.5 },
];

/** Fallback for non-campaign modes: a calm, neutral version of chapter 1. */
export const CHALLENGE_AUDIO: ChapterAudio = {
  id: 0,
  rootHz: 329.63,
  scale: MINOR_PENTATONIC,
  chord: [0, 7, 12, 19],
  phraseSeconds: 1.2,
};

export function chapterAudioForLevel(levelId: number): ChapterAudio {
  if (!Number.isFinite(levelId) || levelId < 1 || levelId > 300) return CHALLENGE_AUDIO;
  return CHAPTER_AUDIO.find(item => item.id === getChapterForLevel(levelId).id) ?? CHALLENGE_AUDIO;
}

export function chapterAccentForLevel(levelId: number): string {
  if (!Number.isFinite(levelId) || levelId < 1 || levelId > 300) return "#00f3ff";
  return getChapterForLevel(levelId).accent;
}

export function chapterNameForLevel(levelId: number): string {
  return chapters.find(chapter => levelId >= chapter.from && levelId <= chapter.to)?.name ?? "Neon Path Puzzle";
}
