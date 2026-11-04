import assert from "node:assert/strict";
import test from "node:test";

import { getLevelMessage } from "./levelMessages";
import { localizedLevelMessages } from "./levelMessages.localized";

test("every supported language has a non-empty message for every level", () => {
  for (let levelId = 1; levelId <= 300; levelId++) {
    for (const language of ["en", "sv", "tr", "es"] as const) {
      const message = getLevelMessage(levelId, language);
      assert.ok(message.length > 5, `${language} level ${levelId} has no message`);
    }
  }
});

test("non-English players no longer see the English affirmations", () => {
  for (const language of ["sv", "tr", "es"] as const) {
    const pack = localizedLevelMessages[language];
    assert.ok(pack.length >= 20);
    assert.ok(!getLevelMessage(1, language).startsWith("You "));
    assert.notEqual(getLevelMessage(1, language), getLevelMessage(2, language));
  }
});
