import test from "node:test";
import assert from "node:assert/strict";

import {
  ROUND_MS,
  SPECIES,
  arm,
  chooseSpecies,
  createGame,
  formatClock,
  maxConcurrent,
  mulberry32,
  multiplier,
  phaseIndex,
  pickHole,
  spawnInterval,
  speciesTable,
  visibleWindow,
  type CatchTally,
  type Game,
  type SpeciesId,
} from "./logic";

test("multiplier steps every five catches and caps at five", () => {
  assert.equal(multiplier(1), 1);
  assert.equal(multiplier(4), 1);
  assert.equal(multiplier(5), 2);
  assert.equal(multiplier(9), 2);
  assert.equal(multiplier(10), 3);
  assert.equal(multiplier(14), 3);
  assert.equal(multiplier(15), 4);
  assert.equal(multiplier(19), 4);
  assert.equal(multiplier(20), 5);
  assert.equal(multiplier(40), 5);
});

test("the clock reads in minutes and rounds up the visible second", () => {
  assert.equal(formatClock(60_000), "1:00");
  assert.equal(formatClock(59_000), "0:59");
  assert.equal(formatClock(1_500), "0:02");
  assert.equal(formatClock(1), "0:01");
  assert.equal(formatClock(0), "0:00");
});

test("difficulty opens across the minute", () => {
  assert.equal(maxConcurrent(0), 1);
  assert.equal(maxConcurrent(11_999), 1);
  assert.equal(maxConcurrent(12_000), 2);
  assert.equal(maxConcurrent(31_999), 2);
  assert.equal(maxConcurrent(32_000), 3);
  assert.equal(maxConcurrent(47_999), 3);
  assert.equal(maxConcurrent(48_000), 4);
  assert.equal(phaseIndex(0), 0);
  assert.equal(phaseIndex(15_000), 1);
  assert.equal(phaseIndex(30_000), 2);
  assert.equal(phaseIndex(45_000), 3);

  const early = speciesTable(0).map((entry) => entry.id);
  assert.equal(early.includes("pike"), false);
  assert.equal(early.includes("char"), false);
  const late = speciesTable(3).map((entry) => entry.id);
  assert.equal(late.includes("pike"), true);
  assert.equal(late.includes("crack"), true);

  const open = visibleWindow("perch", 0);
  const close = visibleWindow("perch", ROUND_MS);
  assert.ok(open.rippleMs + open.activeMs > close.rippleMs + close.activeMs);
  assert.ok(spawnInterval(0, () => 0.5) > spawnInterval(ROUND_MS, () => 0.5));
});

test("the opening is perch only, and two live hazards block a third", () => {
  const rng = mulberry32(4);
  for (let i = 0; i < 12; i += 1) assert.equal(chooseSpecies(1_000, rng, 0), "perch");
  assert.equal(chooseSpecies(10_000, () => 0.999, 0), "boot");
  assert.equal(chooseSpecies(50_000, () => 0.999, 0), "crack");
  for (let i = 0; i < 30; i += 1) {
    const species = chooseSpecies(50_000, rng, 2);
    assert.equal(SPECIES[species].kind, "fish");
  }
});

test("spawn picks an open hole and skips a full lake", () => {
  const game = createGame(1);
  game.start(0);
  for (let i = 0; i < 9; i += 1) game.state.holes[i] = null;
  for (let i = 1; i < 9; i += 1) {
    game.state.holes[i] = {
      id: i,
      hole: i,
      species: "perch",
      kind: "fish",
      points: 100,
      bornAt: 0,
      breachAt: 10,
      hideAt: 500,
      resolved: false,
    };
  }
  assert.equal(pickHole(game.state, 1_000, mulberry32(1)), 0);

  game.state.holes = game.state.holes.map(() => null);
  assert.equal(pickHole(game.state, 1_000, mulberry32(1)) !== null, true);
  for (let i = 0; i < 9; i += 1) {
    game.state.holes[i] = {
      id: 100 + i,
      hole: i,
      species: "boot",
      kind: "hazard",
      points: 0,
      bornAt: 0,
      breachAt: 10,
      hideAt: 500,
      resolved: false,
    };
  }
  assert.equal(pickHole(game.state, 1_000, mulberry32(2)), null);
});

test("the fifth catch pays double and a hazard snaps the chain without going negative", () => {
  const game = createGame(1);
  game.start(0);
  game.state.nextSpawnAt = 1_000_000;
  game.state.combo = 4;
  arm(game.state, 0, "perch", 0);
  const caught = game.tap(0, 100);
  assert.equal(caught.type, "catch");
  if (caught.type !== "catch") return;
  assert.equal(caught.mult, 2);
  assert.equal(caught.total, 200);
  assert.equal(caught.combo, 5);
  assert.equal(game.state.score, 200);
  assert.equal(game.state.bestCombo, 5);

  arm(game.state, 1, "boot", 0);
  const snag = game.tap(1, 150);
  assert.equal(snag.type, "hazard");
  if (snag.type !== "hazard") return;
  assert.equal(snag.penalty, 200);
  assert.equal(game.state.score, 0);
  assert.equal(game.state.combo, 0);
  assert.equal(game.state.bestCombo, 5);
  assert.equal(game.tap(1, 160).type, "whiff");

  game.state.score = 40;
  arm(game.state, 2, "crack", 0);
  const tiny = game.tap(2, 180);
  assert.equal(tiny.type, "hazard");
  if (tiny.type === "hazard") assert.equal(tiny.penalty, 40);
  assert.equal(game.state.score, 0);
});

test("letting a hazard sink pays the dodge and keeps the combo", () => {
  const game = createGame(1);
  game.start(0);
  game.state.nextSpawnAt = 1_000_000;
  game.state.combo = 4;
  game.state.score = 500;
  const actor = arm(game.state, 3, "seal", 0);
  for (let t = 50; t <= actor.hideAt + 100; t += 50) game.tick(t);
  assert.equal(game.state.dodged, 1);
  assert.equal(game.state.score, 550);
  assert.equal(game.state.combo, 4);
  assert.equal(game.state.holes[3], null);
  assert.equal(game.state.hazardsHit, 0);
});

test("a missed fish breaks the combo", () => {
  const game = createGame(1);
  game.start(0);
  game.state.nextSpawnAt = 1_000_000;
  game.state.combo = 6;
  game.state.bestCombo = 6;
  const actor = arm(game.state, 4, "trout", 0);
  for (let t = 50; t <= actor.hideAt + 80; t += 50) game.tick(t);
  assert.equal(game.state.escaped, 1);
  assert.equal(game.state.combo, 0);
  assert.equal(game.state.bestCombo, 6);
});

test("pausing freezes the holes and the clock", () => {
  const game = createGame(1);
  game.start(0);
  game.state.nextSpawnAt = 1_000_000;
  const actor = arm(game.state, 0, "trout", 0);
  game.state.combo = 6;
  for (let t = 100; t <= 400; t += 100) game.tick(t);
  assert.equal(game.state.elapsedMs, 400);
  assert.equal(game.state.holes[0]?.id, actor.id);
  game.pause(400);
  game.tick(3_000);
  assert.equal(game.state.phase, "paused");
  assert.equal(game.state.elapsedMs, 400);
  assert.equal(game.state.holes[0]?.id, actor.id);
  game.resume(3_000);
  for (let t = 3_100; t <= 4_000; t += 100) game.tick(t);
  assert.equal(game.state.phase, "playing");
  assert.equal(game.state.elapsedMs, 1_400);
  assert.equal(game.state.escaped, 1);
  assert.equal(game.state.combo, 0);
});

test("a stalled frame does not burn the round", () => {
  const game = createGame(1);
  game.start(0);
  game.tick(20);
  assert.equal(game.state.elapsedMs, 20);
  game.tick(2_000);
  assert.ok(game.state.elapsedMs < 80);
  assert.equal(game.state.phase, "playing");
});

test("endless holds the opening pace", () => {
  const game = createGame(5);
  game.start(0, 5, true);
  const seen = new Map<number, { at: number; life: number; species: SpeciesId }>();
  let maxSeen = 0;
  for (let t = 50; t <= 75_000; t += 50) {
    game.tick(t);
    let active = 0;
    for (const hole of game.state.holes) {
      if (!hole) continue;
      active += 1;
      seen.set(hole.id, { at: hole.bornAt, life: hole.hideAt - hole.bornAt, species: hole.species });
    }
    if (active > maxSeen) maxSeen = active;
  }
  assert.equal(game.state.phase, "playing");
  assert.equal(maxSeen, 1);
  const late = [...seen.values()].filter((entry) => entry.at >= 65_000).sort((a, b) => a.at - b.at);
  assert.ok(late.length >= 2);
  const gap = late[1].at - late[0].at;
  assert.ok(gap >= 1_100 && gap <= 1_700, `gap ${gap}`);
  const opening = visibleWindow(late[0].species, 0);
  assert.equal(late[0].life, opening.rippleMs + opening.activeMs);
});

test("endless keeps going until the third snag", () => {
  const game = createGame(2);
  game.start(0, 2, true);
  game.state.nextSpawnAt = 1_000_000;
  for (let t = 100; t <= 70_000; t += 100) game.tick(t);
  assert.equal(game.state.phase, "playing");
  assert.equal(game.state.elapsedMs, 70_000);
  assert.equal(game.state.strikes, 0);

  const dodge = arm(game.state, 4, "seal", 70_000);
  for (let t = 70_100; t <= dodge.hideAt + 50; t += 50) game.tick(t);
  assert.equal(game.state.strikes, 0);
  assert.equal(game.state.phase, "playing");

  for (let n = 0; n < 2; n += 1) {
    const snagAt: number = game.state.elapsedMs;
    arm(game.state, n, "boot", snagAt);
    assert.equal(game.tap(n, snagAt).type, "hazard");
    assert.equal(game.state.phase, "playing");
  }
  const lastAt: number = game.state.elapsedMs;
  arm(game.state, 2, "crack", lastAt);
  assert.equal(game.tap(2, lastAt).type, "hazard");
  assert.equal(game.state.strikes, 3);
  assert.equal(game.state.phase, "over");
  assert.equal(game.summary()?.endless, true);
});

test("cashing out an endless run keeps the score", () => {
  const game = createGame(1);
  game.start(0, 1, true);
  game.state.nextSpawnAt = 1_000_000;
  arm(game.state, 0, "pike", 0);
  assert.equal(game.tap(0, 100).type, "catch");
  game.pause(400);
  const summary = game.cashOut(900);
  assert.equal(summary.endless, true);
  assert.equal(summary.score, 1000);
  assert.equal(summary.elapsedMs, 400);
  assert.equal(game.state.phase, "over");
});

test("the round ends on the clock", () => {
  const game = createGame(2, 1_000);
  game.start(0);
  for (let t = 50; t <= 1_500; t += 50) game.tick(t);
  assert.equal(game.state.phase, "over");
  assert.equal(game.state.elapsedMs, 1_000);
});

test("reading the lake beats mashing, and the same seed replays", () => {
  let calmTotal = 0;
  let slowTotal = 0;
  let mashTotal = 0;
  let sawHazardGap = false;
  let seed7: { score: number; catches: CatchTally } | null = null;

  for (let seed = 1; seed <= 12; seed += 1) {
    const calm = play(seed, "calm");
    const slow = play(seed, "slow");
    const mash = play(seed, "mash");
    assert.equal(calm.phase, "over");
    assert.equal(slow.phase, "over");
    assert.equal(mash.phase, "over");
    assert.ok(calm.score >= slow.score, `seed ${seed} calm ${calm.score} slow ${slow.score}`);
    assert.ok(calm.score >= mash.score, `seed ${seed} calm ${calm.score} mash ${mash.score}`);
    assert.ok(mash.score >= 0);
    calmTotal += calm.score;
    slowTotal += slow.score;
    mashTotal += mash.score;
    if (mash.hazardsHit > 0 && calm.score > mash.score) sawHazardGap = true;
    if (seed === 7) seed7 = { score: calm.score, catches: calm.catches };
  }

  assert.ok(calmTotal > slowTotal);
  assert.ok(calmTotal > mashTotal);
  assert.ok(sawHazardGap);
  assert.ok(calmTotal > 12_000);
  assert.ok(calmTotal < 5_000_000);
  assert.ok(seed7);
  const replay = play(7, "calm");
  assert.equal(replay.score, seed7?.score);
  assert.deepEqual(replay.catches, seed7?.catches);
});

type Style = "calm" | "slow" | "mash";

function play(seed: number, style: Style): {
  score: number;
  phase: Game["state"]["phase"];
  hazardsHit: number;
  catches: CatchTally;
} {
  const game = createGame(seed);
  game.start(0);
  for (let t = 50; t <= ROUND_MS + 200; t += 50) {
    game.tick(t);
    if (game.state.phase !== "playing") break;
    for (let hole = 0; hole < 9; hole += 1) {
      const actor = game.state.holes[hole];
      if (!actor) continue;
      if (actor.kind === "hazard") {
        if (style === "mash") game.tap(hole, t);
        continue;
      }
      if (style === "slow" && t < actor.bornAt + 700) continue;
      game.tap(hole, t);
    }
  }
  return {
    score: game.state.score,
    phase: game.state.phase,
    hazardsHit: game.state.hazardsHit,
    catches: { ...game.state.catches },
  };
}
