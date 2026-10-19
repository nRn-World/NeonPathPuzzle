import assert from "node:assert/strict";
import test from "node:test";

import { BACKUP_APP, backupToJson, parseBackup, type BackupFile } from "./backup";

function validBackup(): BackupFile {
  return {
    app: BACKUP_APP,
    version: 1,
    exportedAt: "2026-10-19T12:00:00.000Z",
    progress: { completed: [1, 2, 3], stars: {} },
    stores: {
      "neon-path-theme": "{\"state\":{\"currentTheme\":\"retro\"}}",
      "unrelated-key": "should be dropped",
    },
  };
}

test("a real backup round-trips through JSON", () => {
  const parsed = parseBackup(backupToJson(validBackup()));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  assert.equal(parsed.backup.app, BACKUP_APP);
  assert.deepEqual((parsed.backup.progress as { completed: number[] }).completed, [1, 2, 3]);
  assert.equal(parsed.backup.stores?.["neon-path-theme"]?.includes("retro"), true);
  assert.equal(parsed.backup.stores?.["unrelated-key"], undefined);
});

test("malformed or foreign files are rejected with a readable error", () => {
  const cases = [
    ["not json", "This file is not valid JSON."],
    [JSON.stringify({ app: "other-game", version: 1, progress: { completed: [] } }), "This backup belongs to a different game."],
    [JSON.stringify({ app: BACKUP_APP, version: 99, progress: { completed: [] } }), "This backup was made by a newer version of the game."],
    [JSON.stringify({ app: BACKUP_APP, version: 1 }), "This backup has no progress data."],
    [JSON.stringify({ app: BACKUP_APP, version: 1, progress: {} }), "This backup has no level progress."],
  ] as const;

  for (const [input, error] of cases) {
    const parsed = parseBackup(input);
    assert.equal(parsed.ok, false);
    if (!parsed.ok) assert.equal(parsed.error, error);
  }
});
