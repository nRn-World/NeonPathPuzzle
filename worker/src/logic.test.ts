import assert from "node:assert/strict";
import test from "node:test";

import { getDailyLevelId } from "../../client/src/lib/daily";
import { generateLevel } from "../../shared/level-generator";
import { handleSubmit, handleTop, sanitizeName, type Order, type Store } from "./logic";

function memoryStore(): Store {
  const rows = new Map<string, { board: string; playerId: string; name: string; value: number; at: number }>();
  const sorted = (board: string, order: Order) =>
    [...rows.values()].filter(row => row.board === board).sort((a, b) => (order === "low" ? a.value - b.value : b.value - a.value) || a.at - b.at);
  return {
    async upsert(board, playerId, name, value, order, now) {
      const key = `${board}|${playerId}`;
      const old = rows.get(key);
      const keep = old && (order === "low" ? old.value <= value : old.value >= value);
      rows.set(key, { board, playerId, name, value: keep ? old.value : value, at: now });
    },
    async top(board, order, limit) {
      return sorted(board, order).slice(0, limit);
    },
    async rank(board, playerId, order) {
      const list = sorted(board, order);
      const index = list.findIndex(row => row.playerId === playerId);
      return index < 0 ? null : { rank: index + 1, value: list[index].value };
    },
  };
}

const NOW = new Date(Date.UTC(2026, 9, 22, 12));
const DATE_KEY = "2026-10-22";
const PLAYER = "0123456789abcdef0123";

test("names are trimmed, length-limited and filtered", () => {
  assert.equal(sanitizeName("  Neo  Runner "), "Neo Runner");
  assert.equal(sanitizeName("ab"), null);
  assert.equal(sanitizeName("a".repeat(17)), null);
  assert.equal(sanitizeName("http://x.se"), null);
  assert.equal(sanitizeName("Hitler fan"), null);
  assert.equal(sanitizeName("Åsa_Öberg"), "Åsa_Öberg");
});

test("a real solution is accepted, a fake one is not", async () => {
  const store = memoryStore();
  const solution = generateLevel(getDailyLevelId(DATE_KEY)).solution;
  const good = await handleSubmit({ kind: "daily", dateKey: DATE_KEY, playerId: PLAYER, name: "Neo", value: 90_000, path: solution }, store, NOW);
  assert.equal(good.status, 200);
  const cut = await handleSubmit({ kind: "daily", dateKey: DATE_KEY, playerId: PLAYER, name: "Neo", value: 90_000, path: solution.slice(0, 5) }, store, NOW);
  assert.equal(cut.status, 422);
  const instant = await handleSubmit({ kind: "daily", dateKey: DATE_KEY, playerId: PLAYER, name: "Neo", value: 10, path: solution }, store, NOW);
  assert.equal(instant.status, 422);
  const wrongDay = await handleSubmit({ kind: "daily", dateKey: "2026-09-01", playerId: PLAYER, name: "Neo", value: 90_000, path: solution }, store, NOW);
  assert.equal(wrongDay.status, 400);
});

test("only the best time is kept and the board is ranked", async () => {
  const store = memoryStore();
  const solution = generateLevel(getDailyLevelId(DATE_KEY)).solution;
  const submit = (playerId: string, name: string, value: number) =>
    handleSubmit({ kind: "daily", dateKey: DATE_KEY, playerId, name, value, path: solution }, store, NOW);
  await submit(PLAYER, "Neo", 80_000);
  await submit(PLAYER, "Neo", 95_000);
  await submit("fedcba9876543210fedc", "Trin", 70_000);

  const top = (await handleTop("daily", PLAYER, DATE_KEY, store, NOW)).body as {
    entries: { rank: number; name: string; value: number; you: boolean }[];
    you: { rank: number; value: number };
  };
  assert.deepEqual(top.entries.map(entry => [entry.rank, entry.name, entry.value]), [[1, "Trin", 70_000], [2, "Neo", 80_000]]);
  assert.deepEqual(top.you, { rank: 2, value: 80_000 });
  assert.equal(top.entries[1].you, true);
});

test("star totals rank high to low and reject impossible values", async () => {
  const store = memoryStore();
  assert.equal((await handleSubmit({ kind: "stars", playerId: PLAYER, name: "Neo", value: 123 }, store, NOW)).status, 200);
  assert.equal((await handleSubmit({ kind: "stars", playerId: PLAYER, name: "Neo", value: 5000 }, store, NOW)).status, 400);
  assert.equal((await handleSubmit({ kind: "nope", playerId: PLAYER, name: "Neo", value: 1 }, store, NOW)).status, 400);
  const top = (await handleTop("stars", null, null, store, NOW)).body as { entries: unknown[] };
  assert.equal(top.entries.length, 1);
});
