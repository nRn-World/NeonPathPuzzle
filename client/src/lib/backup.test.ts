import assert from "node:assert/strict";
import test from "node:test";

import { applyBackup, BACKUP_APP, backupToJson, parseBackup, type BackupFile } from "./backup";
import { getProgress } from "./progress";

function useMemoryStorage(): Map<string, string> {
  const entries = new Map<string, string>();
  const storage = {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  } as Storage;
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  return entries;
}

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

test("restoring a backup replaces stores the file does not contain", () => {
  const storage = useMemoryStorage();
  storage.set("neon-path-theme", "newer-theme");
  storage.set("neon-path-settings", "newer-settings");
  storage.set("neon-path-achievements", "newer-achievements");

  const backup: BackupFile = {
    app: BACKUP_APP,
    version: 1,
    exportedAt: "2026-10-19T12:00:00.000Z",
    progress: { completed: [1, 2], records: {} },
    stores: { "neon-path-theme": "{\"state\":{\"currentTheme\":\"retro\"}}" },
  };

  const stats = applyBackup("player-1", backup);

  assert.equal(stats.completedLevels, 2);
  assert.equal(storage.get("neon-path-theme"), "{\"state\":{\"currentTheme\":\"retro\"}}");
  assert.equal(storage.has("neon-path-settings"), false);
  assert.equal(storage.has("neon-path-achievements"), false);
});

test("restoring a backup without stores clears the device stores", () => {
  const storage = useMemoryStorage();
  storage.set("neon-path-powerups", "newer-powerups");

  applyBackup("player-2", {
    app: BACKUP_APP,
    version: 1,
    exportedAt: "2026-10-19T12:00:00.000Z",
    progress: { completed: [] },
  });

  assert.equal(storage.has("neon-path-powerups"), false);
});

test("restoring a backup drops store values that are not valid JSON", () => {
  const storage = useMemoryStorage();
  storage.set("neon-path-settings", "older-settings");

  applyBackup("player-3", {
    app: BACKUP_APP,
    version: 1,
    exportedAt: "2026-10-19T12:00:00.000Z",
    progress: { completed: [] },
    stores: {
      "neon-path-settings": "not json",
      "neon-path-theme": "{\"state\":{\"currentTheme\":\"retro\"}}",
    },
  });

  assert.equal(storage.has("neon-path-settings"), false, "broken JSON would brick the store on reload");
  assert.equal(storage.get("neon-path-theme"), "{\"state\":{\"currentTheme\":\"retro\"}}");
});

test("restoring clamps negative stats from a hand-edited save", () => {
  useMemoryStorage();

  applyBackup("player-4", {
    app: BACKUP_APP,
    version: 1,
    exportedAt: "2026-10-19T12:00:00.000Z",
    progress: {
      completed: [1],
      records: {
        "1": {
          levelId: 1,
          completed: true,
          stars: 3,
          bestTimeMs: -500,
          bestMoves: -2,
          bestMistakes: -1,
          bestScore: -100,
          bestPath: null,
          hintsUsed: false,
          updatedAt: -5,
        },
      },
    },
  });

  const record = getProgress("player-4").records["1"];
  assert.equal(record.bestTimeMs, 0);
  assert.equal(record.bestMoves, 0);
  assert.equal(record.bestMistakes, 0);
  assert.equal(record.bestScore, 0);
  assert.equal(record.updatedAt, 0);
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
