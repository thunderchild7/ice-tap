import "./styles.css";
import { CRITTERS } from "./critters";
import { createAudio } from "./audio";
import {
  DODGE_BONUS,
  FISH_IDS,
  HAZARD_PENALTY,
  HOLE_COUNT,
  SPECIES,
  STRIKE_LIMIT,
  createGame,
  formatClock,
  multiplier,
  type FishId,
  type RoundEvent,
  type Summary,
} from "./logic";
import { loadSave, writeSave } from "./storage";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const KEY_TO_HOLE: Record<string, number> = {
  Digit1: 0,
  Numpad1: 0,
  Digit2: 1,
  Numpad2: 1,
  Digit3: 2,
  Numpad3: 2,
  Digit4: 3,
  Numpad4: 3,
  Digit5: 4,
  Numpad5: 4,
  Digit6: 5,
  Numpad6: 5,
  Digit7: 6,
  Numpad7: 6,
  Digit8: 7,
  Numpad8: 7,
  Digit9: 8,
  Numpad9: 8,
};

const save = loadSave();
const game = createGame();
const audio = createAudio();
audio.setEnabled(save.sound);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let bestAtStart = save.bestScore;
let raf = 0;
let fxSerial = 0;
let calloutSerial = 0;
let deferred: BeforeInstallPromptEvent | null = null;

const scoreEl = must<HTMLElement>("score");
const timeEl = must<HTMLElement>("time");
const comboEl = must<HTMLElement>("combo");
const board = must<HTMLDivElement>("board");
const callout = must<HTMLElement>("callout");
const titleOverlay = must<HTMLElement>("title");
const resultsOverlay = must<HTMLElement>("results");
const timeLabel = must<HTMLElement>("time-label");
const strikesEl = must<HTMLElement>("strikes");
const pauseOverlay = must<HTMLElement>("pause");
const pauseCopy = must<HTMLElement>("pause-copy");
const resumeBtn = must<HTMLButtonElement>("resume");
const endRunBtn = must<HTMLButtonElement>("end-run");
const playBtn = must<HTMLButtonElement>("play");
const titleEndlessBtn = must<HTMLButtonElement>("title-endless");
const titleEndlessNote = must<HTMLElement>("title-endless-note");
const againBtn = must<HTMLButtonElement>("again");
const otherModeBtn = must<HTMLButtonElement>("other-mode");
const otherNote = must<HTMLElement>("other-note");
const titleRecord = must<HTMLElement>("title-record");
const finalScore = must<HTMLElement>("final-score");
const bestFlag = must<HTMLElement>("best-flag");
const recordLine = must<HTMLElement>("record-line");
const tally = must<HTMLElement>("tally");
const roundLine = must<HTMLElement>("round-line");
const dockBest = must<HTMLElement>("dock-best");
const soundBtn = must<HTMLButtonElement>("sound");
const hapticsBtn = must<HTMLButtonElement>("haptics");
const installBtn = must<HTMLButtonElement>("install");
const iosHint = must<HTMLElement>("ios-hint");
const dismissHint = must<HTMLButtonElement>("dismiss-hint");
const live = must<HTMLElement>("live");

const holes: HTMLButtonElement[] = [];
for (let i = 0; i < HOLE_COUNT; i += 1) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "hole";
  button.setAttribute("aria-label", `Hole ${i + 1}`);
  button.innerHTML =
    '<span class="rim"></span><span class="water"><span class="ripples"></span></span><span class="critter"></span><span class="floater"></span>';
  button.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button !== 0 || game.state.phase !== "playing") return;
      event.preventDefault();
      pressHole(i);
    },
    { passive: false },
  );
  button.addEventListener("contextmenu", (event) => event.preventDefault());
  board.append(button);
  holes.push(button);
}

for (const id of FISH_IDS) {
  const item = document.createElement("li");
  item.dataset.species = id;
  item.innerHTML = `${CRITTERS[id]}<span class="n" data-fish="${id}">0</span><span class="k">${SPECIES[id].name}</span>`;
  tally.append(item);
}

const scoreLegend = must<HTMLElement>("score-legend");
for (const id of FISH_IDS) {
  const item = document.createElement("li");
  item.dataset.species = id;
  const points = SPECIES[id].points.toLocaleString("en-US");
  item.innerHTML = `${CRITTERS[id]}<span class="pts">${points}</span><span class="name">${SPECIES[id].name}</span>`;
  item.setAttribute("aria-label", `${SPECIES[id].name}, ${points} points`);
  scoreLegend.append(item);
}
const hazardItem = document.createElement("li");
hazardItem.className = "is-hazard";
hazardItem.innerHTML = `${CRITTERS.boot}<span class="pts">−${HAZARD_PENALTY}</span><span class="name">Hazard</span>`;
hazardItem.setAttribute("aria-label", `Hazard, minus ${HAZARD_PENALTY} points`);
scoreLegend.append(hazardItem);
const dodgeItem = document.createElement("li");
dodgeItem.className = "is-dodge";
dodgeItem.innerHTML = `<span class="dodge-mark" aria-hidden="true"></span><span class="pts">+${DODGE_BONUS}</span><span class="name">Dodge</span>`;
dodgeItem.setAttribute("aria-label", `Dodge, plus ${DODGE_BONUS} points`);
scoreLegend.append(dodgeItem);

paintToggles();
paintModes();
updateDock();
updateTitleRecord();
setOverlay("title");
sync();
playBtn.focus({ preventScroll: true });

playBtn.addEventListener("click", () => beginRound(false));
titleEndlessBtn.addEventListener("click", () => beginRound(true));
againBtn.addEventListener("click", () => beginRound(game.state.endless));
otherModeBtn.addEventListener("click", () => beginRound(otherModeBtn.dataset.endless === "true"));
resumeBtn.addEventListener("click", resumeRound);
endRunBtn.addEventListener("click", endRun);
pauseOverlay.addEventListener("click", (event) => {
  if (event.target === pauseOverlay) resumeRound();
});
soundBtn.addEventListener("click", () => {
  save.sound = !save.sound;
  audio.setEnabled(save.sound);
  if (save.sound) {
    audio.unlock();
    audio.blip();
  }
  writeSave(save);
  paintToggles();
});
hapticsBtn.addEventListener("click", () => {
  save.haptics = !save.haptics;
  writeSave(save);
  paintToggles();
  if (save.haptics) vibrate(16);
});
installBtn.addEventListener("click", () => {
  if (!deferred) return;
  const prompt = deferred;
  deferred = null;
  installBtn.hidden = true;
  void prompt.prompt().then(() => prompt.userChoice);
});
dismissHint.addEventListener("click", () => {
  save.hintDismissed = true;
  writeSave(save);
  iosHint.hidden = true;
});
document.addEventListener("keydown", onKey);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pauseRound();
});
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferred = event as BeforeInstallPromptEvent;
  installBtn.hidden = false;
});
window.addEventListener("appinstalled", () => {
  installBtn.hidden = true;
  deferred = null;
});

const appleTouch =
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
if (appleTouch && !standalone && !save.hintDismissed) iosHint.hidden = false;

void import("virtual:pwa-register").then(({ registerSW }) => {
  registerSW({ immediate: true });
});

function beginRound(endless = false): void {
  audio.unlock();
  clearFx();
  game.start(performance.now(), undefined, endless);
  bestAtStart = endless ? save.bestEndless : save.bestScore;
  audio.go();
  setOverlay("none");
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  live.textContent = endless ? "Endless run started." : "Round started.";
  updateDock();
  sync();
  startLoop();
}

function resumeRound(): void {
  if (game.state.phase !== "paused") return;
  audio.unlock();
  game.resume(performance.now());
  setOverlay("none");
  sync();
  startLoop();
}

function pauseRound(): void {
  if (game.state.phase !== "playing") return;
  game.pause(performance.now());
  stopLoop();
  pauseCopy.textContent = game.state.endless ? "The lake is holding." : "Timer frozen. Tap to resume.";
  endRunBtn.hidden = !game.state.endless;
  setOverlay("pause");
  sync();
}

function endRun(): void {
  if (!game.state.endless) return;
  if (game.state.phase !== "paused" && game.state.phase !== "playing") return;
  showResults(game.cashOut(performance.now()));
}

function pressHole(index: number): void {
  const hole = holes[index];
  hole.classList.add("is-tap");
  window.setTimeout(() => hole.classList.remove("is-tap"), 120);

  const result = game.tap(index, performance.now());
  if (result.type === "catch") {
    const rare = result.species === "char" || result.species === "pike";
    floatAt(hole, `+${formatScore(result.total)}`, rare || result.mult > 1 ? "rare" : "catch");
    splash(hole, rare ? "rare" : "fish");
    punch(hole, "is-pop");
    audio.catch(result.species);
    vibrate(buzzFor(result.species));
    if (result.mult > multiplier(result.combo - 1)) {
      showCallout(`×${result.mult}`);
      audio.milestone();
      vibrate(16);
    }
  } else if (result.type === "hazard") {
    floatAt(hole, result.penalty > 0 ? `−${result.penalty}` : "Snap", "bad");
    splash(hole, "hazard");
    punch(hole, "is-hurt");
    if (!reduceMotion) {
      board.classList.remove("shake");
      void board.offsetWidth;
      board.classList.add("shake");
      window.setTimeout(() => board.classList.remove("shake"), 180);
    }
    audio.hazard();
    vibrate(40);
    if (game.state.phase === "over") {
      const summary = game.summary();
      if (summary) showResults(summary);
      return;
    }
  }
  sync();
}

function applyEvents(events: RoundEvent[]): void {
  let broke = 0;
  for (const event of events) {
    if (event.type === "dodge") {
      floatAt(holes[event.hole], `+${event.bonus}`, "dodge");
      audio.dodge();
    } else if (event.type === "escape") {
      broke = Math.max(broke, event.comboLost);
    } else {
      showResults(event.summary);
    }
  }
  if (broke >= 3) {
    comboEl.classList.add("break");
    window.setTimeout(() => comboEl.classList.remove("break"), 240);
    if (broke >= 5) audio.escape();
  }
}

function showResults(summary: Summary): void {
  stopLoop();
  const previous = summary.endless ? save.bestEndless : save.bestScore;
  const isNew = summary.score > previous;
  if (summary.endless) save.bestEndless = Math.max(save.bestEndless, summary.score);
  else save.bestScore = Math.max(save.bestScore, summary.score);
  save.bestCombo = Math.max(save.bestCombo, summary.bestCombo);
  save.games += 1;
  save.endlessUnlocked = true;
  for (const id of FISH_IDS) save.catches[id] += summary.catches[id];
  writeSave(save);

  finalScore.textContent = formatScore(summary.score);
  bestFlag.hidden = !isNew;
  recordLine.textContent = summary.endless
    ? save.bestEndless > 0
      ? `Endless best ${formatScore(save.bestEndless)}`
      : "No endless record yet"
    : `Best ${formatScore(save.bestScore)}`;
  for (const id of FISH_IDS) {
    const count = tally.querySelector(`[data-fish="${id}"]`);
    if (!(count instanceof HTMLElement)) continue;
    count.textContent = String(summary.catches[id]);
    count.parentElement?.classList.toggle("is-zero", summary.catches[id] === 0);
  }
  const stats = `Combo ${summary.bestCombo} · Dodged ${summary.dodged} · Snagged ${summary.hazardsHit}`;
  roundLine.textContent = summary.endless ? `${formatClock(summary.elapsedMs)} · ${stats}` : stats;
  otherModeBtn.textContent = summary.endless ? "60-second cast" : "Endless";
  otherModeBtn.dataset.endless = summary.endless ? "false" : "true";
  otherNote.hidden = summary.endless;
  paintModes();
  setOverlay("results");
  updateDock();
  updateTitleRecord();
  callout.classList.remove("show");
  live.textContent = isNew
    ? `Time. Score ${formatScore(summary.score)}. New best.`
    : `Time. Score ${formatScore(summary.score)}.`;
  audio.over();
  sync();
  againBtn.focus({ preventScroll: true });
}

function sync(): void {
  const state = game.state;
  const endlessLive = state.endless && (state.phase === "playing" || state.phase === "paused");
  const remaining = Math.max(0, game.durationMs - state.elapsedMs);
  scoreEl.textContent = formatScore(state.score);
  if (state.phase === "title") {
    timeLabel.textContent = "Time";
    timeEl.textContent = formatClock(game.durationMs);
  } else if (state.endless) {
    timeLabel.textContent = "Time";
    timeEl.textContent = formatClock(state.elapsedMs);
  } else {
    timeLabel.textContent = "Time";
    timeEl.textContent = formatClock(remaining);
  }
  timeEl.classList.toggle("warn", !state.endless && state.phase === "playing" && remaining <= 10_000 && remaining > 5_000);
  timeEl.classList.toggle("danger", !state.endless && state.phase === "playing" && remaining <= 5_000 && remaining > 0);
  strikesEl.hidden = !endlessLive;
  if (endlessLive) {
    const left = Math.max(0, STRIKE_LIMIT - state.strikes);
    strikesEl.setAttribute("aria-label", `${left} snags left`);
    [...strikesEl.children].forEach((pip, index) => {
      pip.classList.toggle("is-spent", index < state.strikes);
    });
  }
  const mult = multiplier(state.combo);
  comboEl.textContent = state.combo >= 2 ? (mult > 1 ? `${state.combo} ×${mult}` : String(state.combo)) : "—";
  scoreEl.classList.toggle("hot", state.phase === "playing" && bestAtStart > 0 && state.score > bestAtStart);
  syncHoles();
}

function syncHoles(): void {
  const elapsed = game.state.elapsedMs;
  for (let i = 0; i < HOLE_COUNT; i += 1) {
    const hole = holes[i];
    if (hole.dataset.fx) continue;
    const actor = game.state.holes[i];
    const critter = hole.querySelector(".critter");
    if (!(critter instanceof HTMLElement)) continue;
    if (!actor) {
      if (hole.dataset.actor) {
        delete hole.dataset.actor;
        delete hole.dataset.sig;
        critter.replaceChildren();
        hole.className = "hole";
        hole.setAttribute("aria-label", `Hole ${i + 1}`);
      }
      continue;
    }
    const phase = elapsed < actor.breachAt ? "ripple" : "up";
    const sig = `${actor.id}:${phase}`;
    if (hole.dataset.sig === sig) continue;
    hole.dataset.sig = sig;
    if (hole.dataset.actor !== String(actor.id)) {
      hole.dataset.actor = String(actor.id);
      critter.innerHTML = CRITTERS[actor.species];
    }
    hole.className = `hole is-${phase} is-${actor.kind} is-${actor.species}`;
    const name = actor.kind === "hazard" ? "hazard" : SPECIES[actor.species].name;
    hole.setAttribute("aria-label", `Hole ${i + 1}, ${name}`);
  }
}

function loop(now: number): void {
  const events = game.tick(now);
  applyEvents(events);
  sync();
  if (game.state.phase === "playing") raf = requestAnimationFrame(loop);
}

function startLoop(): void {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(loop);
}

function stopLoop(): void {
  cancelAnimationFrame(raf);
}

function setOverlay(which: "title" | "results" | "pause" | "none"): void {
  titleOverlay.hidden = which !== "title";
  resultsOverlay.hidden = which !== "results";
  pauseOverlay.hidden = which !== "pause";
  board.classList.toggle("ambient", which === "title");
}

function onKey(event: KeyboardEvent): void {
  if (event.repeat) return;
  const hole = KEY_TO_HOLE[event.code];
  if (hole !== undefined) {
    if (game.state.phase !== "playing") return;
    event.preventDefault();
    pressHole(hole);
    return;
  }
  if (event.key !== "Enter" && event.key !== " ") return;
  if (event.target instanceof HTMLButtonElement) return;
  if (game.state.phase === "title") {
    event.preventDefault();
    beginRound(false);
  } else if (game.state.phase === "over") {
    event.preventDefault();
    beginRound(game.state.endless);
  } else if (game.state.phase === "paused") {
    event.preventDefault();
    resumeRound();
  }
}

function floatAt(hole: HTMLElement, text: string, kind: string): void {
  const floater = hole.querySelector(".floater");
  if (!(floater instanceof HTMLElement)) return;
  const token = String(++fxSerial);
  floater.dataset.token = token;
  floater.textContent = text;
  floater.className = "floater";
  void floater.offsetWidth;
  floater.className = `floater show ${kind}`;
  window.setTimeout(() => {
    if (floater.dataset.token !== token) return;
    floater.className = "floater";
    floater.textContent = "";
  }, 680);
}

function punch(hole: HTMLButtonElement, className: string): void {
  const token = String(++fxSerial);
  hole.dataset.fx = token;
  hole.classList.add(className);
  window.setTimeout(() => {
    if (hole.dataset.fx !== token) return;
    hole.classList.remove(className);
    delete hole.dataset.fx;
    syncHoles();
  }, 200);
}

function splash(hole: HTMLElement, kind: "fish" | "rare" | "hazard"): void {
  if (reduceMotion) return;
  for (let i = 0; i < 6; i += 1) {
    const drop = document.createElement("i");
    drop.className = `drop ${kind}`;
    drop.style.setProperty("--a", `${i * 60 + Math.random() * 16}deg`);
    drop.style.setProperty("--d", `${16 + Math.random() * 18}px`);
    hole.append(drop);
    drop.addEventListener("animationend", () => drop.remove());
  }
}

function showCallout(text: string): void {
  calloutSerial += 1;
  const token = calloutSerial;
  callout.textContent = text;
  callout.classList.remove("show");
  void callout.offsetWidth;
  callout.classList.add("show");
  window.setTimeout(() => {
    if (token === calloutSerial) callout.classList.remove("show");
  }, 720);
}

function clearFx(): void {
  fxSerial += 1;
  calloutSerial += 1;
  callout.classList.remove("show");
  board.classList.remove("shake");
  comboEl.classList.remove("break");
  for (const hole of holes) {
    delete hole.dataset.fx;
    delete hole.dataset.actor;
    delete hole.dataset.sig;
    hole.className = "hole";
    hole.setAttribute("aria-label", `Hole ${holeIndex(hole) + 1}`);
    hole.querySelector(".critter")?.replaceChildren();
    const floater = hole.querySelector(".floater");
    if (floater instanceof HTMLElement) {
      floater.className = "floater";
      floater.textContent = "";
    }
    hole.querySelectorAll(".drop").forEach((drop) => drop.remove());
  }
}

function holeIndex(hole: HTMLButtonElement): number {
  const index = holes.indexOf(hole);
  return index < 0 ? 0 : index;
}

function paintToggles(): void {
  soundBtn.setAttribute("aria-pressed", String(save.sound));
  soundBtn.setAttribute("aria-label", save.sound ? "Sound on" : "Sound off");
  hapticsBtn.setAttribute("aria-pressed", String(save.haptics));
  hapticsBtn.setAttribute("aria-label", save.haptics ? "Haptics on" : "Haptics off");
}

function paintModes(): void {
  const unlocked = save.endlessUnlocked;
  titleEndlessBtn.hidden = !unlocked;
  titleEndlessNote.hidden = !unlocked;
}

function updateDock(): void {
  const endless = game.state.endless && game.state.phase !== "title";
  const best = endless ? save.bestEndless : save.bestScore;
  const label = endless ? "Endless best" : "Best";
  dockBest.textContent = best > 0 ? `${label} ${formatScore(best)}` : endless ? "No endless record" : "No record yet";
}

function updateTitleRecord(): void {
  const total = FISH_IDS.reduce((sum, id) => sum + save.catches[id], 0);
  if (save.games === 0 && save.bestScore <= 0 && save.bestEndless <= 0) {
    titleRecord.hidden = true;
    return;
  }
  titleRecord.hidden = false;
  const parts: string[] = [];
  if (save.bestScore > 0 || total > 0) {
    parts.push(total > 0 ? `Best ${formatScore(save.bestScore)} · ${total} fish` : `Best ${formatScore(save.bestScore)}`);
  }
  if (save.bestEndless > 0) parts.push(`Endless ${formatScore(save.bestEndless)}`);
  titleRecord.textContent = parts.join(" · ");
}

function formatScore(score: number): string {
  return score.toLocaleString("en-US");
}

function vibrate(pattern: number | number[]): void {
  if (!save.haptics || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(pattern);
}

function buzzFor(species: FishId): number | number[] {
  if (species === "pike") return [12, 24, 14, 24, 20];
  if (species === "char") return [10, 28, 16];
  return 12;
}

function must<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!(node instanceof HTMLElement)) throw new Error(`Missing #${id}`);
  return node as T;
}
