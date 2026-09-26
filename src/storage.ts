import { emptyCatches, FISH_IDS, type CatchTally } from "./logic";

const KEY = "ice-tap-v1";

export interface SaveData {
  bestScore: number;
  bestCombo: number;
  games: number;
  catches: CatchTally;
  sound: boolean;
  haptics: boolean;
  hintDismissed: boolean;
  bestEndless: number;
  endlessUnlocked: boolean;
}

let memory: SaveData | null = null;

export function defaultSave(): SaveData {
  return {
    bestScore: 0,
    bestCombo: 0,
    games: 0,
    catches: emptyCatches(),
    sound: true,
    haptics: true,
    hintDismissed: false,
    bestEndless: 0,
    endlessUnlocked: false,
  };
}

export function loadSave(): SaveData {
  if (memory) return clone(memory);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const save = defaultSave();
    save.bestScore = count(parsed.bestScore);
    save.bestCombo = count(parsed.bestCombo);
    save.games = count(parsed.games);
    save.bestEndless = count(parsed.bestEndless);
    save.endlessUnlocked = parsed.endlessUnlocked === true || save.games > 0;
    save.sound = typeof parsed.sound === "boolean" ? parsed.sound : true;
    save.haptics = typeof parsed.haptics === "boolean" ? parsed.haptics : true;
    save.hintDismissed = parsed.hintDismissed === true;
    const catches = parsed.catches;
    if (catches && typeof catches === "object") {
      for (const id of FISH_IDS) save.catches[id] = count(catches[id]);
    }
    return save;
  } catch {
    return memory ? clone(memory) : defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  memory = clone(data);
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Private browsing can reject storage. The in-memory copy still covers this session.
  }
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function clone(data: SaveData): SaveData {
  return {
    ...data,
    catches: { ...data.catches },
  };
}
