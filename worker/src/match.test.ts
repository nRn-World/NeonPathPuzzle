import assert from "node:assert/strict";
import test from "node:test";

import { generateLevel } from "../../shared/level-generator";
import {
  BETWEEN_ROUNDS_MS,
  COUNTDOWN_MS,
  eloDelta,
  HELP_WINDOW_MS,
  Match,
  MAX_ROUNDS,
  pickLevels,
  RECONNECT_MS,
  ROUND_LIMIT_MS,
  type Clock,
  type MatchResult,
  type ServerMessage,
} from "./match";

class FakeClock implements Clock {
  time = 0;
  private queue: { at: number; fn: () => void; live: boolean }[] = [];
  now() {
    return this.time;
  }
  after(ms: number, fn: () => void) {
    const entry = { at: this.time + ms, fn, live: true };
    this.queue.push(entry);
    return () => {
      entry.live = false;
    };
  }
  advance(ms: number) {
    const target = this.time + ms;
    for (;;) {
      const due = this.queue.filter(entry => entry.live && entry.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      due.live = false;
      this.time = due.at;
      due.fn();
    }
    this.time = target;
  }
}

const seeded = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};

function setup(vsBot: boolean, ratings: [number, number] = [1000, 1000]) {
  const clock = new FakeClock();
  const results: MatchResult[] = [];
  const humans = [
    { id: "a".repeat(32), name: "NeonFox42", rating: ratings[0] },
    { id: "b".repeat(32), name: "SwiftOwl11", rating: ratings[1] },
  ].slice(0, vsBot ? 1 : 2);
  const match = new Match(humans, vsBot, clock, seeded(7), result => results.push(result));
  const inbox: Record<string, ServerMessage[]> = {};
  humans.forEach(human => {
    inbox[human.id] = [];
    match.attach(human.id, message => inbox[human.id].push(message));
  });
  const last = (id: string, type: string) => [...inbox[id]].reverse().find(message => message.type === type);
  const solve = (id: string) => {
    const round = last(id, "round")!;
    match.receive(id, { type: "done", round: round.round as number, path: generateLevel(round.levelId as number).solution });
  };
  return { clock, match, results, inbox, humans, last, solve };
}

test("levels are distinct, in range and easier for lower ratings", () => {
  const easy = pickLevels(800, seeded(1));
  const hard = pickLevels(1600, seeded(1));
  assert.equal(new Set(easy).size, MAX_ROUNDS);
  assert.ok(Math.max(...easy) <= 60);
  assert.ok(Math.max(...hard) <= 140);
  assert.ok(Math.min(...hard) >= 12);
});

test("elo is symmetric and rewards the underdog more", () => {
  assert.equal(eloDelta(1000, 1000, 1), 16);
  assert.equal(eloDelta(1000, 1000, 0), -16);
  assert.ok(eloDelta(800, 1200, 1) > eloDelta(1200, 800, 1));
});

test("first to two rounds wins, with equal ratings moving 16 points", () => {
  const { clock, humans, results, inbox, last, solve } = setup(false);
  const [a, b] = humans;
  assert.equal(last(a.id, "round")?.round, 1);
  assert.equal(last(b.id, "match")?.type, "match");

  clock.advance(COUNTDOWN_MS + 8000);
  solve(a.id);
  assert.equal(last(b.id, "roundResult")?.winner, "opponent");
  assert.equal(last(a.id, "roundResult")?.winner, "you");

  clock.advance(HELP_WINDOW_MS);
  assert.equal(last(a.id, "round")?.round, 2);
  clock.advance(COUNTDOWN_MS + 5000);
  solve(b.id); // the second round goes to b: 1-1
  clock.advance(HELP_WINDOW_MS + COUNTDOWN_MS + 5000);
  solve(a.id);

  assert.equal(results.length, 1);
  assert.equal(results[0].winnerId, a.id);
  assert.deepEqual(results[0].players.map(player => player.delta), [16, -16]);
  assert.equal(last(a.id, "matchResult")?.winner, "you");
  assert.equal(last(b.id, "matchResult")?.winner, "opponent");
  assert.ok(inbox[a.id].length > 5);
});

test("early, wrong-round and invalid submissions are rejected without ending the round", () => {
  const { clock, match, humans, last, solve } = setup(false);
  const [a] = humans;
  const round = last(a.id, "round")!;
  solve(a.id); // still in the countdown
  assert.equal(last(a.id, "rejected")?.reason, "too early");

  clock.advance(COUNTDOWN_MS + 5000);
  match.receive(a.id, { type: "done", round: 2, path: generateLevel(round.levelId as number).solution });
  assert.equal(last(a.id, "roundResult"), undefined, "a wrong round number is ignored");
  match.receive(a.id, { type: "done", round: 1, path: generateLevel(round.levelId as number).solution.slice(0, 4) });
  assert.equal(last(a.id, "rejected")?.reason, "path does not solve the level");
  match.receive(a.id, { type: "done", round: 1, path: "nope" });
  assert.equal(last(a.id, "rejected")?.reason, "path required");
  solve(a.id);
  assert.equal(last(a.id, "roundResult")?.winner, "you");
});

test("leaving, or staying away for too long, forfeits the match", () => {
  const { clock, humans, results, last, match } = setup(false);
  const [a, b] = humans;
  clock.advance(COUNTDOWN_MS + 1000);
  match.detach(a.id);
  clock.advance(RECONNECT_MS - 1);
  assert.equal(results.length, 0, "a short drop can reconnect");
  let seen = 0;
  match.attach(a.id, () => seen++);
  assert.ok(seen >= 2, "reconnecting resends the match and the open round");
  clock.advance(RECONNECT_MS * 3);
  assert.equal(results.length, 0, "the reconnect cancelled the forfeit");

  match.detach(b.id);
  clock.advance(RECONNECT_MS);
  assert.equal(results.length, 1);
  assert.equal(results[0].forfeit, true);
  assert.equal(results[0].winnerId, a.id);
  assert.equal(last(b.id, "matchResult"), undefined, "the dropped player has no socket left");
});

test("a round nobody solves is void, and five void rounds draw without rating change", () => {
  const { clock, humans, results, last } = setup(false);
  for (let round = 0; round < MAX_ROUNDS; round++) {
    clock.advance(COUNTDOWN_MS + ROUND_LIMIT_MS);
    assert.equal(last(humans[0].id, "roundResult")?.winner, "none");
    clock.advance(BETWEEN_ROUNDS_MS);
  }
  assert.equal(results.length, 1);
  assert.equal(results[0].winnerId, null);
  assert.deepEqual(results[0].players.map(player => player.delta), [0, 0]);
  assert.equal(last(humans[0].id, "matchResult")?.winner, "draw");
});

test("a bot match pays a few points for a win and never costs points", () => {
  const win = setup(true);
  const human = win.humans[0];
  for (let round = 0; round < 2; round++) {
    win.clock.advance(COUNTDOWN_MS + 4000); // faster than any bot, slower than the minimum time
    win.solve(human.id);
    win.clock.advance(BETWEEN_ROUNDS_MS);
  }
  assert.equal(win.results.length, 1);
  assert.equal(win.results[0].vsBot, true);
  assert.equal(win.results[0].players[0].delta, 6);

  const loss = setup(true);
  for (let step = 0; step < 40 && loss.results.length === 0; step++) loss.clock.advance(20_000);
  assert.equal(loss.results.length, 1);
  assert.equal(loss.results[0].winnerId, null, "the bot took the match");
  assert.equal(loss.results[0].players[0].delta, 0);
});

test("a match nobody joins is cancelled with no result", () => {
  const clock = new FakeClock();
  const results: MatchResult[] = [];
  const match = new Match([{ id: "c".repeat(32), name: "SunnyOtter33", rating: 1000 }, { id: "d".repeat(32), name: "ZenLynx21", rating: 1000 }], false, clock, seeded(3), r => results.push(r));
  match.attach("c".repeat(32), () => undefined);
  clock.advance(60_000);
  assert.equal(results.length, 0);
});

test("the loser gets the winner's line only after the round, and may still finish it for practice", () => {
  const { clock, humans, inbox, last, solve, match } = setup(false);
  const [a, b] = humans;
  clock.advance(COUNTDOWN_MS + 5000);
  assert.equal(inbox[b.id].some(message => "opponentPath" in message), false, "nothing is shown during the race");
  solve(a.id);

  const help = last(b.id, "roundResult")!;
  assert.deepEqual(help.opponentPath, generateLevel(last(b.id, "round")!.levelId as number).solution);
  assert.equal(help.helpMs, HELP_WINDOW_MS);
  assert.equal("opponentPath" in last(a.id, "roundResult")!, false, "the winner gets no help");

  // The loser finishes after a while: no extra points, and the next round starts soon.
  clock.advance(6000);
  assert.equal(last(b.id, "round")?.round, 1);
  solve(b.id);
  assert.equal(last(b.id, "lateFinish")?.round, 1);
  assert.equal(last(b.id, "roundResult")?.score && (last(b.id, "roundResult")!.score as { you: number }).you, 0);
  clock.advance(2600);
  assert.equal(last(b.id, "round")?.round, 2, "the next round started after the short pause");
  match.receive(b.id, { type: "done", round: 1, path: [] });
});

test("without a late finish the next round starts after the help window", () => {
  const { clock, humans, last, solve } = setup(false);
  clock.advance(COUNTDOWN_MS + 5000);
  solve(humans[0].id);
  clock.advance(HELP_WINDOW_MS - 1);
  assert.equal(last(humans[1].id, "round")?.round, 1);
  clock.advance(2);
  assert.equal(last(humans[1].id, "round")?.round, 2);
});

test("a bot's win shows its line as help, and the final round shows no help", () => {
  const bot = setup(true);
  bot.clock.advance(60_000);
  const result = bot.last(bot.humans[0].id, "roundResult");
  assert.ok(result && (result.winner === "opponent" ? Array.isArray(result.opponentPath) : true));

  const duel = setup(false);
  for (let round = 0; round < 2; round++) {
    duel.clock.advance(COUNTDOWN_MS + 4000 + (round ? HELP_WINDOW_MS : 0));
    duel.solve(duel.humans[0].id);
  }
  assert.equal("opponentPath" in duel.last(duel.humans[1].id, "roundResult")!, false, "a decided match has no help round");
});

test("the other player is told when their opponent drops and comes back", () => {
  const { clock, match, humans, last } = setup(false);
  const [a, b] = humans;
  clock.advance(COUNTDOWN_MS + 1000);
  match.detach(a.id);
  assert.equal(last(b.id, "opponentAway")?.graceMs, RECONNECT_MS);
  match.attach(a.id, () => undefined);
  assert.equal(last(b.id, "opponentBack")?.type, "opponentBack");
});
