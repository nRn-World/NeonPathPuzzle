import assert from "node:assert/strict";
import test from "node:test";

import { patchWebmDuration } from "./solveClip";

/**
 * A MediaRecorder WebM header as Chrome writes it: the Info element holds only
 * TimecodeScale / MuxingApp / WritingApp and declares no Duration.
 */
function liveHeader(infoExtra: number[] = []): Uint8Array {
  const infoContent = [
    0x2a, 0xd7, 0xb1, 0x83, 0x0f, 0x42, 0x40, // TimecodeScale = 1ms
    0x4d, 0x80, 0x86, 0x43, 0x68, 0x72, 0x6f, 0x6d, 0x65, // MuxingApp "Chrome"
    0x57, 0x41, 0x86, 0x43, 0x68, 0x72, 0x6f, 0x6d, 0x65, // WritingApp "Chrome"
    ...infoExtra,
  ];
  return new Uint8Array([
    0x1a, 0x45, 0xdf, 0xa3, 0x84, 0x42, 0x86, 0x81, 0x01, // EBML header
    0x18, 0x53, 0x80, 0x67, // Segment
    0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, // unknown size
    0x15, 0x49, 0xa9, 0x66, // Info
    0x80 | infoContent.length,
    ...infoContent,
    0x16, 0x54, 0xae, 0x6b, 0x81, 0x00, // Tracks...
    0x1f, 0x43, 0xb6, 0x75, 0x81, 0x00, // Cluster...
  ]);
}

/** Reads the Info element the way a demuxer would. */
function locateInfo(bytes: Uint8Array) {
  for (let i = 0; i < bytes.length - 4; i += 1) {
    if (bytes[i] !== 0x15 || bytes[i + 1] !== 0x49 || bytes[i + 2] !== 0xa9 || bytes[i + 3] !== 0x66) continue;
    const sizeAt = i + 4;
    const first = bytes[sizeAt];
    let length = 1;
    while (length <= 8 && (first & (0x80 >> (length - 1))) === 0) length += 1;
    let value = first & (0xff >> length);
    for (let k = 1; k < length; k += 1) value = value * 256 + bytes[sizeAt + k];
    const contentStart = sizeAt + length;
    return { at: i, sizeAt, length, value, contentStart, contentEnd: contentStart + value };
  }
  throw new Error("no Info element in the fixture");
}

/** Every Duration element found inside Info, decoded from its own size field. */
function durationsIn(bytes: Uint8Array, info: ReturnType<typeof locateInfo>): number[] {
  const found: number[] = [];
  for (let i = info.contentStart; i < info.contentEnd - 2; i += 1) {
    if (bytes[i] !== 0x44 || bytes[i + 1] !== 0x89) continue;
    const size = bytes[i + 2];
    const width = (size & 0x80 ? 1 : size & 0x40 ? 2 : size & 0x20 ? 3 : 4);
    const length = size & (0xff >> width);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (length === 8) found.push(view.getFloat64(i + 2 + width, false));
    else if (length === 4) found.push(view.getFloat32(i + 2 + width, false));
  }
  return found;
}

test("a live WebM gets a real Duration so editors know its length", () => {
  const source = liveHeader();
  const patched = patchWebmDuration(source, 5_700);

  assert.equal(patched.length, source.length + 11, "one float64 Duration is grafted in");

  const info = locateInfo(patched);
  assert.equal(info.length, 1, "the size vint stays one byte");
  assert.equal(info.value, 36, "Info grows by the 11 bytes of the new element");
  assert.deepEqual(durationsIn(patched, info), [5_700], "and declares its length exactly once");

  // The rest of the file survives byte for byte.
  assert.deepEqual(
    [...patched.subarray(patched.length - 6)],
    [...source.subarray(source.length - 6)],
  );
});

test("an existing Duration is overwritten in place, not duplicated", () => {
  const extra = [0x44, 0x89, 0x88, 0, 0, 0, 0, 0, 0, 0, 0];
  const source = liveHeader(extra);
  const patched = patchWebmDuration(source, 4_200);

  assert.equal(patched.length, source.length, "the buffer is not grown");
  assert.deepEqual(durationsIn(patched, locateInfo(patched)), [4_200]);
});

test("a buffer without an Info element is returned untouched", () => {
  const junk = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(patchWebmDuration(junk, 1_000), junk);
});

test("a bad duration leaves the recording alone rather than writing NaN", () => {
  const source = liveHeader();
  assert.equal(patchWebmDuration(source, Number.NaN), source);
  assert.equal(patchWebmDuration(source, 0), source);
  assert.equal(patchWebmDuration(source, -5), source);
});
