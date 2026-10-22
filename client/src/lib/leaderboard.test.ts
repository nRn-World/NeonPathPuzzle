import assert from "node:assert/strict";
import test from "node:test";

import { isGeneratedName } from "@shared/names";
import { getBackupCode, getPlayer, rerollName, restoreFromBackupCode, setOnline } from "./leaderboard";

test("a new player gets a generated name and starts offline", () => {
  const player = getPlayer();
  assert.equal(isGeneratedName(player.name), true);
  assert.equal(player.online, false);
  assert.match(player.id, /^[0-9a-f]{32}$/);
});

test("the backup code restores the same identity", () => {
  const original = getPlayer().id;
  const code = getBackupCode();
  assert.match(code, /^([0-9A-F]{4}-){7}[0-9A-F]{4}$/);
  rerollName();
  assert.equal(restoreFromBackupCode("nonsense"), null);
  const restored = restoreFromBackupCode(code.toLowerCase().replace(/-/g, " "));
  assert.equal(restored?.id, original);
  assert.equal(setOnline(true).online, true);
});
