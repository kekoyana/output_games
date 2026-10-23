import { GAME_CONFIG } from "../game-config";

// 置き場所: src/assets/bgm/{opening,battle}.{ogg,mp3,m4a,wav}
// import.meta.glob で解決するため、ファイル未配置でもビルドは通る。
const bgmModules = import.meta.glob<{ default: string }>(
  "../assets/bgm/*.{ogg,mp3,m4a,wav}",
  { eager: true }
);
const bgmUrls: Record<string, string> = {};
for (const [path, mod] of Object.entries(bgmModules)) {
  const file = path.split("/").pop() ?? "";
  const name = file.replace(/\.(ogg|mp3|m4a|wav)$/i, "");
  if (name) bgmUrls[name] = mod.default;
}

export type BgmTrack = "opening" | "battle";

const VOLUME_KEY = `${GAME_CONFIG.saveKey}-bgm-volume`;
const MUTED_KEY = `${GAME_CONFIG.saveKey}-bgm-muted`;

let audio: HTMLAudioElement | null = null;
let currentTrack: BgmTrack | null = null;
let volume = loadVolume();
let muted = loadMuted();
let lastVolumeBeforeMute = volume > 0 ? volume : 0.3;
let started = false;

function loadVolume(): number {
  try {
    const v = localStorage.getItem(VOLUME_KEY);
    if (v !== null) return Math.max(0, Math.min(1, Number(v)));
  } catch { /* ignore */ }
  return 0.3;
}

function saveVolume(v: number): void {
  try {
    localStorage.setItem(VOLUME_KEY, String(v));
  } catch { /* ignore */ }
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch { /* ignore */ }
  return false;
}

function saveMuted(v: boolean): void {
  try {
    localStorage.setItem(MUTED_KEY, v ? "1" : "0");
  } catch { /* ignore */ }
}

function effectiveVolume(): number {
  return muted ? 0 : volume;
}

function applyVolume(): void {
  if (!audio) return;
  const v = effectiveVolume();
  audio.volume = v;
  // iOS Safari は audio.volume を無視するため muted も併用する。
  audio.muted = v === 0;
}

/**
 * Switch the active BGM track and start playing it.
 *
 * Must be called from a user-gesture handler (pointer/key) the FIRST time so
 * autoplay policy doesn't block playback. Re-calling with the same track is a
 * no-op while playing.
 */
export function playBgm(track: BgmTrack): void {
  if (currentTrack === track && started && audio && !audio.paused) return;
  const url = bgmUrls[track];
  if (!url) return;

  if (audio && currentTrack !== track) {
    // Hard-cut to the new track. (Cross-fade omitted to keep mobile audio paths
    // simple — the scene transitions already cover any silence.)
    audio.pause();
    audio.src = "";
    audio = null;
  }

  if (!audio) {
    audio = new Audio(url);
    audio.loop = true;
    applyVolume();
    currentTrack = track;
  }

  started = true;
  audio.play().catch(() => {
    // Autoplay blocked — will retry on next interaction
    started = false;
  });
}

/** Resume the current BGM track (no track switch). Used after tab visibility / scene returns. */
export function resumeBgm(): void {
  if (!started || !audio) return;
  if (audio.paused) {
    audio.play().catch(() => { /* ignore */ });
  }
}

/** Back-compat alias: the older API used `startBgm()` for the single global track. */
export function startBgm(track: BgmTrack = "opening"): void {
  playBgm(track);
}

export function getVolume(): number {
  return volume;
}

/** Set volume without remembering (runtime-only). */
export function setVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  if (volume > 0) lastVolumeBeforeMute = volume;
  applyVolume();
}

/** Set volume and persist to localStorage. Used by settings slider. */
export function setVolumeRemembered(v: number): void {
  setVolume(v);
  saveVolume(volume);
  // Adjusting the slider off zero clears mute state.
  if (volume > 0 && muted) {
    muted = false;
    saveMuted(false);
    applyVolume();
  }
}

export function isMuted(): boolean {
  return muted || volume === 0;
}

/** Toggle BGM mute state (persisted). */
export function toggleMute(): void {
  if (isMuted()) {
    muted = false;
    if (volume === 0) {
      volume = lastVolumeBeforeMute;
      saveVolume(volume);
    }
  } else {
    muted = true;
  }
  saveMuted(muted);
  applyVolume();
}
