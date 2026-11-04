import assert from "node:assert/strict";
import test from "node:test";

import {
  CHALLENGE_AUDIO,
  CHAPTER_AUDIO,
  chapterAccentForLevel,
  chapterAudioForLevel,
  chapterNameForLevel,
} from "./chapterAudio";
import { chapters } from "./chapters";

test("all twelve chapters have their own musical identity", () => {
  assert.equal(CHAPTER_AUDIO.length, chapters.length);
  assert.deepEqual(CHAPTER_AUDIO.map(item => item.id), chapters.map(chapter => chapter.id));
  const roots = new Set(CHAPTER_AUDIO.map(item => item.rootHz));
  assert.equal(roots.size, chapters.length, "every chapter modulates to a new root");
  const sounds = new Set(CHAPTER_AUDIO.map(item => `${item.rootHz}:${item.scale.join(",")}:${item.chord.join(",")}:${item.phraseSeconds}`));
  assert.equal(sounds.size, chapters.length, "no two chapters share the same full profile");
});

test("scales, chords and phrase lengths stay inside playable ranges", () => {
  for (const profile of CHAPTER_AUDIO) {
    assert.ok(profile.rootHz > 100 && profile.rootHz < 1000);
    assert.equal(profile.scale[0], 0, "a scale starts on its root");
    assert.equal(profile.scale.length, 11, "the melody generator indexes eleven degrees");
    assert.deepEqual([...profile.scale], [...profile.scale].sort((a, b) => a - b), "semitones ascend");
    assert.equal(new Set(profile.scale).size, profile.scale.length, "no duplicated degrees");
    assert.equal(profile.chord.length, 4);
    assert.ok(profile.phraseSeconds >= 0.8 && profile.phraseSeconds <= 1.6);
  }
});

test("chapter boundaries map to the right profile and accent", () => {
  assert.equal(chapterAudioForLevel(1).id, 1);
  assert.equal(chapterAudioForLevel(25).id, 1);
  assert.equal(chapterAudioForLevel(26).id, 2);
  assert.equal(chapterAudioForLevel(300).id, 12);
  assert.equal(chapterAccentForLevel(26), "#8a2be2");
  assert.equal(chapterNameForLevel(1), "Boot Sequence");
});

test("non-campaign modes fall back to the neutral challenge profile", () => {
  for (const id of [0, -1, 301, Number.NaN, Infinity]) {
    assert.equal(chapterAudioForLevel(id), CHALLENGE_AUDIO);
    assert.equal(chapterAccentForLevel(id), "#00f3ff");
  }
});
