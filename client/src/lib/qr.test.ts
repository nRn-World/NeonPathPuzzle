import assert from "node:assert/strict";
import test from "node:test";

import { qrDataUrl } from "./qr";

test("share links become scannable PNG data URLs, generated locally", async () => {
  const first = await qrDataUrl("https://example.com/#/rival/Ab3_-x");
  const second = await qrDataUrl("https://example.com/#/rival/Ab3_-x");
  const different = await qrDataUrl("https://example.com/#/rival/Other1");
  assert.ok(first.startsWith("data:image/png;base64,"));
  assert.ok(first.length > 500, "a QR code is not an empty image");
  assert.equal(first, second, "the same link produces the same code");
  assert.notEqual(first, different, "a different link produces a different code");
});
