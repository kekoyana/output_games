import { getNumber, setNumber, getBool, setBool } from "./storage";
import { getAudioContext } from "./sfx";

// AI 生成の OGG（src/assets/bgm/）をループ再生する。読み込めないときは WebAudio 合成 BGM に切り替える。
// トラック: "day"（通常）/ "night"（夜。S4 用）
// 音量・ミュートは SFX とは独立して保存される。

import dayUrl from "../assets/bgm/day.ogg";
import nightUrl from "../assets/bgm/night.ogg";

export type BgmTrack = "day" | "night";

const VOLUME_KEY = "bgm-volume";
const MUTED_KEY = "bgm-muted";
const MASTER_SCALE = 0.55;
const FILE_SCALE = 0.8;
const FILE_URLS: Record<BgmTrack, string> = { day: dayUrl, night: nightUrl };

let volume = getNumber(VOLUME_KEY, 0.3, 0, 1);
let muted = getBool(MUTED_KEY, false);
let lastVolumeBeforeMute = volume > 0 ? volume : 0.3;

let gain: GainNode | null = null;
let timer: number | null = null;
let currentTrack: BgmTrack | null = null;
let nextBeatTime = 0;
let beatIndex = 0;
const files: Partial<Record<BgmTrack, HTMLAudioElement>> = {};
const fileFailed: Partial<Record<BgmTrack, boolean>> = {};
let gestureHooked = false;

function fileFor(track: BgmTrack): HTMLAudioElement | null {
  if (fileFailed[track]) return null;
  let el = files[track];
  if (!el) {
    el = new Audio(FILE_URLS[track]);
    el.loop = true;
    el.preload = "auto";
    el.addEventListener("error", () => {
      fileFailed[track] = true;
      if (currentTrack === track) startSynth();
    });
    files[track] = el;
  }
  return el;
}

function hookGesture(): void {
  if (gestureHooked || typeof window === "undefined") return;
  gestureHooked = true;
  const retry = (): void => {
    if (currentTrack) playBgm(currentTrack);
  };
  for (const ev of ["pointerdown", "keydown", "touchend"]) window.addEventListener(ev, retry);
}

// 4 小節コード進行（C - Am - F - G）。値は半音オフセットのコード構成音（C4 基準）。
const CHORDS: number[][] = [
  [0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2],
];
const BASS: number[] = [-24, -27, -31, -29];
// 主旋律（ペンタトニック。8 分音符 x 16 = 2 小節 x 2、null は休符）
const MELODY: Array<number | null> = [
  12, null, 16, null, 19, null, 16, null, 14, null, 12, null, 7, null, null, null,
  9, null, 12, null, 16, null, 12, null, 11, null, 7, null, 14, null, null, null,
];

function midiFreq(semi: number, base: number): number {
  return base * Math.pow(2, semi / 12);
}

function applyVolume(): void {
  if (gain) gain.gain.value = muted ? 0 : volume * MASTER_SCALE;
  for (const el of Object.values(files)) el.volume = muted ? 0 : volume * FILE_SCALE;
}

function tone(
  c: AudioContext, out: AudioNode, freq: number, start: number, dur: number,
  type: OscillatorType, peak: number, attack: number,
): void {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g);
  g.connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function scheduleStep(c: AudioContext, out: AudioNode, step: number, t: number, spb: number): void {
  const night = currentTrack === "night";
  const base = night ? 196 : 261.63; // night は 4 度ほど低く
  const bar = Math.floor(step / 8) % 4;
  const inBar = step % 8;
  const eighth = spb / 2;
  if (inBar === 0) {
    for (const n of CHORDS[bar]) tone(c, out, midiFreq(n, base), t, spb * 4 * 0.95, "sine", 0.07, 0.25);
    tone(c, out, midiFreq(BASS[bar], base), t, spb * 2, "triangle", 0.13, 0.03);
  }
  if (inBar === 4) tone(c, out, midiFreq(BASS[bar], base), t, spb * 1.5, "triangle", 0.09, 0.03);
  const m = MELODY[step % MELODY.length];
  if (m !== null && !(night && step % 2 === 1)) {
    tone(c, out, midiFreq(m, base), t, eighth * 3, night ? "sine" : "triangle", night ? 0.06 : 0.07, 0.02);
  }
}

function tick(): void {
  const c = getAudioContext();
  if (!c || !gain) return;
  const bpm = currentTrack === "night" ? 66 : 84;
  const spb = 60 / bpm;
  if (nextBeatTime < c.currentTime - 0.2) nextBeatTime = c.currentTime + 0.05;
  while (nextBeatTime < c.currentTime + 0.4) {
    scheduleStep(c, gain, beatIndex, nextBeatTime, spb);
    beatIndex = (beatIndex + 1) % 32;
    nextBeatTime += spb / 2;
  }
}

function startSynth(): void {
  const c = getAudioContext();
  if (!c) return;
  if (!gain) {
    gain = c.createGain();
    gain.connect(c.destination);
    applyVolume();
  }
  if (timer === null) timer = window.setInterval(tick, 120);
  if (c.state === "suspended") c.resume().catch(() => { /* ignore */ });
}

function stopSynth(): void {
  if (timer !== null) window.clearInterval(timer);
  timer = null;
}

export function playBgm(track: BgmTrack = "day"): void {
  hookGesture();
  if (currentTrack !== track) {
    currentTrack = track;
    beatIndex = 0;
    const c = getAudioContext();
    if (c) nextBeatTime = c.currentTime + 0.05;
    for (const [k, el] of Object.entries(files)) if (k !== track) el.pause();
  }
  const el = fileFor(track);
  if (!el) {
    startSynth();
    return;
  }
  stopSynth();
  el.volume = muted ? 0 : volume * FILE_SCALE;
  if (el.paused) el.play().catch(() => { /* 操作前の自動再生ブロック。次の操作で再試行する */ });
}

export function stopBgm(): void {
  stopSynth();
  for (const el of Object.values(files)) el.pause();
}

export function startBgm(): void {
  playBgm(currentTrack ?? "day");
}

export function resumeBgm(): void {
  startBgm();
}

export function getVolume(): number {
  return volume;
}

export function setVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  if (volume > 0) lastVolumeBeforeMute = volume;
  applyVolume();
}

export function setVolumeRemembered(v: number): void {
  setVolume(v);
  setNumber(VOLUME_KEY, volume);
  if (volume > 0 && muted) {
    muted = false;
    setBool(MUTED_KEY, false);
    applyVolume();
  }
}

export function isMuted(): boolean {
  return muted || volume === 0;
}

export function toggleMute(): void {
  if (isMuted()) {
    muted = false;
    if (volume === 0) {
      volume = lastVolumeBeforeMute;
      setNumber(VOLUME_KEY, volume);
    }
  } else {
    muted = true;
  }
  setBool(MUTED_KEY, muted);
  applyVolume();
}
