export const ROUND_MS = 60_000;
export const HOLE_COUNT = 9;
export const HAZARD_PENALTY = 200;
export const DODGE_BONUS = 50;
export const STRIKE_LIMIT = 3;
const HITCH_MS = 400;

export const FISH_IDS = ["perch", "trout", "char", "pike"] as const;
export type FishId = (typeof FISH_IDS)[number];
export const HAZARD_IDS = ["boot", "seal", "crack"] as const;
export type HazardId = (typeof HAZARD_IDS)[number];
export type SpeciesId = FishId | HazardId;

export interface SpeciesInfo {
  kind: "fish" | "hazard";
  name: string;
  points: number;
}

export const SPECIES: Record<SpeciesId, SpeciesInfo> = {
  perch: { kind: "fish", name: "Perch", points: 100 },
  trout: { kind: "fish", name: "Trout", points: 250 },
  char: { kind: "fish", name: "Char", points: 500 },
  pike: { kind: "fish", name: "Pike", points: 1000 },
  boot: { kind: "hazard", name: "Boot", points: 0 },
  seal: { kind: "hazard", name: "Seal", points: 0 },
  crack: { kind: "hazard", name: "Crack", points: 0 },
};

export interface CatchTally {
  perch: number;
  trout: number;
  char: number;
  pike: number;
}

export interface Actor {
  id: number;
  hole: number;
  species: SpeciesId;
  kind: "fish" | "hazard";
  points: number;
  bornAt: number;
  breachAt: number;
  hideAt: number;
  resolved: boolean;
}

export type Phase = "title" | "playing" | "paused" | "over";

export interface State {
  phase: Phase;
  elapsedMs: number;
  score: number;
  combo: number;
  bestCombo: number;
  holes: (Actor | null)[];
  nextSpawnAt: number;
  catches: CatchTally;
  hazardsHit: number;
  escaped: number;
  dodged: number;
  actorSeq: number;
  lastUsed: number[];
  endless: boolean;
  strikes: number;
}

export interface Summary {
  score: number;
  bestCombo: number;
  catches: CatchTally;
  dodged: number;
  hazardsHit: number;
  escaped: number;
  endless: boolean;
  elapsedMs: number;
}

export type RoundEvent =
  | { type: "escape"; hole: number; species: SpeciesId; comboLost: number }
  | { type: "dodge"; hole: number; bonus: number }
  | { type: "over"; summary: Summary };

export type TapResult =
  | { type: "idle" }
  | { type: "whiff" }
  | { type: "catch"; species: FishId; points: number; combo: number; mult: number; total: number }
  | { type: "hazard"; species: HazardId; penalty: number; comboLost: number; score: number };

const TOTAL_MS: Record<SpeciesId, [number, number]> = {
  perch: [1200, 760],
  trout: [1080, 680],
  char: [980, 620],
  pike: [880, 540],
  boot: [1160, 800],
  seal: [1100, 740],
  crack: [1040, 700],
};

const RIPPLE_RATIO: Record<SpeciesId, number> = {
  perch: 0.28,
  trout: 0.3,
  char: 0.4,
  pike: 0.42,
  boot: 0.38,
  seal: 0.38,
  crack: 0.4,
};

const TABLES: { id: SpeciesId; weight: number }[][] = [
  [
    { id: "perch", weight: 68 },
    { id: "trout", weight: 22 },
    { id: "boot", weight: 10 },
  ],
  [
    { id: "perch", weight: 38 },
    { id: "trout", weight: 26 },
    { id: "char", weight: 12 },
    { id: "boot", weight: 14 },
    { id: "seal", weight: 10 },
  ],
  [
    { id: "perch", weight: 22 },
    { id: "trout", weight: 20 },
    { id: "char", weight: 16 },
    { id: "pike", weight: 8 },
    { id: "boot", weight: 12 },
    { id: "seal", weight: 12 },
    { id: "crack", weight: 10 },
  ],
  [
    { id: "perch", weight: 12 },
    { id: "trout", weight: 16 },
    { id: "char", weight: 18 },
    { id: "pike", weight: 16 },
    { id: "boot", weight: 13 },
    { id: "seal", weight: 13 },
    { id: "crack", weight: 12 },
  ],
];

export function isFish(id: SpeciesId): id is FishId {
  return SPECIES[id].kind === "fish";
}

export function emptyCatches(): CatchTally {
  return { perch: 0, trout: 0, char: 0, pike: 0 };
}

export function multiplier(combo: number): number {
  if (combo >= 20) return 5;
  if (combo >= 15) return 4;
  if (combo >= 10) return 3;
  if (combo >= 5) return 2;
  return 1;
}

export function formatClock(remainingMs: number): string {
  const secs = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(secs / 60);
  const rest = secs % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export function phaseIndex(elapsedMs: number, durationMs = ROUND_MS): 0 | 1 | 2 | 3 {
  if (elapsedMs * 4 < durationMs) return 0;
  if (elapsedMs * 2 < durationMs) return 1;
  if (elapsedMs * 4 < durationMs * 3) return 2;
  return 3;
}

export function speciesTable(phase: 0 | 1 | 2 | 3): { id: SpeciesId; weight: number }[] {
  return TABLES[phase];
}

export function maxConcurrent(elapsedMs: number, durationMs = ROUND_MS): number {
  if (elapsedMs * 60 < durationMs * 12) return 1;
  if (elapsedMs * 60 < durationMs * 32) return 2;
  if (elapsedMs * 60 < durationMs * 48) return 3;
  return 4;
}

export function visibleWindow(
  species: SpeciesId,
  elapsedMs: number,
  durationMs = ROUND_MS,
): { rippleMs: number; activeMs: number } {
  const t = clamp(elapsedMs / durationMs, 0, 1);
  const [open, close] = TOTAL_MS[species];
  const total = Math.round(lerp(open, close, t));
  const rippleMs = Math.max(80, Math.round(total * RIPPLE_RATIO[species]));
  const activeMs = Math.max(80, total - rippleMs);
  return { rippleMs, activeMs };
}

export function spawnInterval(elapsedMs: number, rng: () => number, durationMs = ROUND_MS): number {
  const t = clamp(elapsedMs / durationMs, 0, 1);
  const base = lerp(1400, 560, t * t);
  const jitter = lerp(160, 70, t) * (rng() * 2 - 1);
  return Math.max(280, Math.round(base + jitter));
}

export function chooseSpecies(
  elapsedMs: number,
  rng: () => number,
  activeHazards: number,
  durationMs = ROUND_MS,
): SpeciesId {
  // Opening beats are perch only, so the first taps teach the loop before hazards show up.
  if (elapsedMs * 10 < durationMs) return "perch";
  const fishOnly = activeHazards >= 2;
  const table = speciesTable(phaseIndex(elapsedMs, durationMs)).filter((entry) => !fishOnly || isFish(entry.id));
  if (table.length === 0) return "perch";
  return pickWeighted(
    table.map((entry) => ({ item: entry.id, weight: entry.weight })),
    rng,
  );
}

export function pickHole(state: State, elapsedMs: number, rng: () => number): number | null {
  const table: { item: number; weight: number }[] = [];
  for (let i = 0; i < HOLE_COUNT; i += 1) {
    if (state.holes[i]) continue;
    const idle = Math.max(0, elapsedMs - state.lastUsed[i]);
    table.push({ item: i, weight: 1 + idle });
  }
  if (table.length === 0) return null;
  return pickWeighted(table, rng);
}

export function arm(
  state: State,
  hole: number,
  species: SpeciesId,
  elapsedMs: number,
  durationMs = ROUND_MS,
  curveElapsed = elapsedMs,
): Actor {
  const spec = SPECIES[species];
  const window = visibleWindow(species, curveElapsed, durationMs);
  const actor: Actor = {
    id: state.actorSeq,
    hole,
    species,
    kind: spec.kind,
    points: spec.points,
    bornAt: elapsedMs,
    breachAt: elapsedMs + window.rippleMs,
    hideAt: elapsedMs + window.rippleMs + window.activeMs,
    resolved: false,
  };
  state.actorSeq += 1;
  state.holes[hole] = actor;
  return actor;
}

export function applyTap(state: State, hole: number, elapsedMs: number): TapResult {
  if (state.phase !== "playing") return { type: "idle" };
  const actor = state.holes[hole];
  if (!actor || actor.resolved || elapsedMs < actor.bornAt || elapsedMs >= actor.hideAt) return { type: "whiff" };

  actor.resolved = true;
  state.holes[hole] = null;
  state.lastUsed[hole] = elapsedMs;

  if (actor.kind === "hazard") {
    const comboLost = state.combo;
    state.combo = 0;
    const penalty = Math.min(HAZARD_PENALTY, state.score);
    state.score -= penalty;
    state.hazardsHit += 1;
    return { type: "hazard", species: actor.species as HazardId, penalty, comboLost, score: state.score };
  }

  const combo = state.combo + 1;
  const mult = multiplier(combo);
  const total = actor.points * mult;
  state.combo = combo;
  if (combo > state.bestCombo) state.bestCombo = combo;
  state.score += total;
  const fish = actor.species as FishId;
  state.catches[fish] += 1;
  return { type: "catch", species: fish, points: actor.points, combo, mult, total };
}

export function pickWeighted<T>(items: { item: T; weight: number }[], rng: () => number): T {
  let total = 0;
  for (const entry of items) total += entry.weight;
  let roll = rng() * total;
  for (const entry of items) {
    roll -= entry.weight;
    if (roll < 0) return entry.item;
  }
  return items[items.length - 1].item;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function freshState(): State {
  return {
    phase: "title",
    elapsedMs: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    holes: Array.from({ length: HOLE_COUNT }, () => null),
    nextSpawnAt: 0,
    catches: emptyCatches(),
    hazardsHit: 0,
    escaped: 0,
    dodged: 0,
    actorSeq: 1,
    lastUsed: Array.from({ length: HOLE_COUNT }, () => -10_000),
    endless: false,
    strikes: 0,
  };
}

function occupied(state: State): number {
  let count = 0;
  for (const hole of state.holes) if (hole) count += 1;
  return count;
}

function hazardCount(state: State): number {
  let count = 0;
  for (const hole of state.holes) if (hole?.kind === "hazard") count += 1;
  return count;
}

export class Game {
  readonly durationMs: number;
  state: State;
  private seed: number;
  private readonly randomStarts: boolean;
  private rng: () => number;
  private startedAt = 0;
  private pausedAccum = 0;
  private pauseAt: number | null = null;
  private lastSummary: Summary | null = null;

  constructor(seed: number | undefined, durationMs: number) {
    this.durationMs = durationMs;
    this.randomStarts = seed === undefined;
    this.seed = (seed ?? 1) >>> 0;
    this.rng = mulberry32(this.seed);
    this.state = freshState();
  }

  start(now: number, seed?: number, endless = false): void {
    if (seed !== undefined) this.seed = seed >>> 0;
    else if (this.randomStarts) this.seed = (Math.random() * 0x7fffffff) >>> 0;
    this.rng = mulberry32(this.seed);
    this.startedAt = now;
    this.pausedAccum = 0;
    this.pauseAt = null;
    this.lastSummary = null;
    this.state = freshState();
    this.state.endless = endless;
    this.state.phase = "playing";
    const ramp = this.rampMs();
    this.state.nextSpawnAt = Math.max(16, Math.round(ramp * 0.004));
  }

  summary(): Summary | null {
    return this.lastSummary;
  }

  cashOut(now: number): Summary {
    if (this.state.phase === "paused") this.resume(now);
    if (this.state.phase === "playing") {
      this.state.elapsedMs = this.compute(now);
      this.finish([]);
    }
    return this.lastSummary ?? emptySummary();
  }

  pause(now: number): void {
    if (this.state.phase !== "playing") return;
    this.pauseAt = now;
    this.state.phase = "paused";
  }

  resume(now: number): void {
    if (this.state.phase !== "paused" || this.pauseAt === null) return;
    this.pausedAccum += Math.max(0, now - this.pauseAt);
    this.pauseAt = null;
    this.state.phase = "playing";
  }

  tap(hole: number, now: number): TapResult {
    if (hole < 0 || hole >= HOLE_COUNT) return { type: "whiff" };
    const elapsed = this.compute(now);
    const result = applyTap(this.state, hole, elapsed);
    if (result.type === "hazard" && this.state.endless && this.state.phase === "playing") {
      this.state.strikes += 1;
      if (this.state.strikes >= STRIKE_LIMIT) {
        this.state.elapsedMs = elapsed;
        this.finish([]);
      }
    }
    return result;
  }

  tick(now: number): RoundEvent[] {
    if (this.state.phase !== "playing") return [];

    let elapsed = this.compute(now);
    const gap = elapsed - this.state.elapsedMs;
    // A stalled frame must not burn the round or dump every queued spawn at once.
    if (gap > HITCH_MS) {
      this.pausedAccum += gap - 16;
      elapsed = this.compute(now);
    }

    const events: RoundEvent[] = [];
    const capped = this.state.endless ? elapsed : Math.min(elapsed, this.durationMs);
    this.expire(capped, events);

    if (!this.state.endless && capped >= this.durationMs) {
      this.state.elapsedMs = this.durationMs;
      this.finish(events);
      return events;
    }

    const ramp = this.rampMs();
    if (capped >= this.state.nextSpawnAt) {
      const spawned = this.trySpawn(capped);
      const wait = spawned ? spawnInterval(this.paceAt(capped), this.rng, ramp) : 100;
      this.state.nextSpawnAt = capped + wait;
    }

    this.state.elapsedMs = capped;
    return events;
  }

  private compute(now: number): number {
    const pending = this.pauseAt === null ? 0 : Math.max(0, now - this.pauseAt);
    return Math.max(0, now - this.startedAt - this.pausedAccum - pending);
  }

  private rampMs(): number {
    return this.state.endless ? ROUND_MS : this.durationMs;
  }

  // Endless holds the opening pace for the whole run. The timed cast still speeds up.
  private paceAt(elapsed: number): number {
    return this.state.endless ? 0 : elapsed;
  }

  private trySpawn(elapsed: number): boolean {
    const ramp = this.rampMs();
    const pace = this.paceAt(elapsed);
    if (occupied(this.state) >= maxConcurrent(pace, ramp)) return false;
    // Two hazards are already up: the next visitor is a fish, so the lake cannot become a wall of traps.
    const species = chooseSpecies(elapsed, this.rng, hazardCount(this.state), ramp);
    const hole = pickHole(this.state, elapsed, this.rng);
    if (hole === null) return false;
    arm(this.state, hole, species, elapsed, ramp, pace);
    return true;
  }

  private expire(elapsed: number, events: RoundEvent[]): void {
    for (let i = 0; i < HOLE_COUNT; i += 1) {
      const actor = this.state.holes[i];
      if (!actor || elapsed < actor.hideAt) continue;
      this.state.holes[i] = null;
      this.state.lastUsed[i] = elapsed;
      actor.resolved = true;
      if (actor.kind === "fish") {
        const comboLost = this.state.combo;
        this.state.combo = 0;
        this.state.escaped += 1;
        events.push({ type: "escape", hole: i, species: actor.species, comboLost });
      } else {
        this.state.dodged += 1;
        this.state.score += DODGE_BONUS;
        events.push({ type: "dodge", hole: i, bonus: DODGE_BONUS });
      }
    }
  }

  private finish(events: RoundEvent[]): void {
    if (this.state.phase === "over") return;
    for (let i = 0; i < HOLE_COUNT; i += 1) this.state.holes[i] = null;
    this.state.phase = "over";
    const summary: Summary = {
      score: this.state.score,
      bestCombo: this.state.bestCombo,
      catches: { ...this.state.catches },
      dodged: this.state.dodged,
      hazardsHit: this.state.hazardsHit,
      escaped: this.state.escaped,
      endless: this.state.endless,
      elapsedMs: this.state.elapsedMs,
    };
    this.lastSummary = summary;
    events.push({ type: "over", summary });
  }
}

function emptySummary(): Summary {
  return {
    score: 0,
    bestCombo: 0,
    catches: emptyCatches(),
    dodged: 0,
    hazardsHit: 0,
    escaped: 0,
    endless: false,
    elapsedMs: 0,
  };
}

export function createGame(seed?: number, durationMs = ROUND_MS): Game {
  return new Game(seed, durationMs);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
