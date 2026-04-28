import { GAME_CONFIG } from "../game-config";

export interface StageClearData {
  /** Cleared round indices (e.g. [0, 1] = both rounds cleared) */
  clearedRounds: number[];
}

type SaveState = Record<string, StageClearData>;

function getKey(): string {
  return GAME_CONFIG.saveKey;
}

function load(): SaveState {
  try {
    const raw = localStorage.getItem(getKey());
    if (raw) return JSON.parse(raw) as SaveState;
  } catch {
    // corrupted data — reset
  }
  return {};
}

function save(state: SaveState): void {
  localStorage.setItem(getKey(), JSON.stringify(state));
}

export function markStageCleared(stageId: string, roundIndex: number): void {
  const state = load();
  const entry = state[stageId] ?? { clearedRounds: [] };
  if (!entry.clearedRounds.includes(roundIndex)) {
    entry.clearedRounds.push(roundIndex);
  }
  state[stageId] = entry;
  save(state);
}

export function getStageClearData(stageId: string): StageClearData | undefined {
  return load()[stageId];
}

export function isStageCleared(stageId: string): boolean {
  const data = load()[stageId];
  return data !== undefined && data.clearedRounds.length > 0;
}

export function getAllClearData(): SaveState {
  return load();
}

/** True when at least one stage has any clear progress. Used to decide whether
 * to surface the "continue" button on the title screen. */
export function hasAnyClear(): boolean {
  const state = load();
  for (const id of Object.keys(state)) {
    if ((state[id]?.clearedRounds.length ?? 0) > 0) return true;
  }
  return false;
}

/** Wipe all stage clear progress (used by the "start over" button). */
export function clearAllProgress(): void {
  try {
    localStorage.removeItem(getKey());
  } catch {
    // ignore
  }
}
