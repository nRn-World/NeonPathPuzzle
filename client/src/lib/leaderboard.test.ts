import assert from "node:assert/strict";
import test from "node:test";

import { isGeneratedName } from "@shared/names";
import { getBackupCode, getPlayer, MAX_NAME_CHANGES, nameChangesLeft, rerollName, restoreFromBackupCode, setOnline } from "./leaderboard";

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

test("a device can change its name only ten times, even after restoring a backup", () => {
  const code = getBackupCode();
  const before = nameChangesLeft(getPlayer());
  for (let index = 0; index < 20; index++) rerollName();
  assert.equal(nameChangesLeft(getPlayer()), 0);
  const frozen = getPlayer().name;
  assert.equal(rerollName().name, frozen, "no change once the limit is used");
  restoreFromBackupCode(code);
  assert.equal(nameChangesLeft(getPlayer()), 0, "restoring does not hand the changes back");
  assert.ok(before <= MAX_NAME_CHANGES);
});
