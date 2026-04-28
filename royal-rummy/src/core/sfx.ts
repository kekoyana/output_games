import { GAME_CONFIG } from "../game-config";

// Synthesized SE via WebAudio — no external assets (per project rule).

const STORAGE_KEY = `${GAME_CONFIG.saveKey}-sfx-volume`;
const MUTE_KEY = `${GAME_CONFIG.saveKey}-sfx-muted`;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let volume = loadVolume();
let muted = loadMuted();

function loadVolume(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v !== null) return Math.max(0, Math.min(1, Number(v)));
  } catch { /* ignore */ }
  return 0.5;
}

function saveVolume(v: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
  } catch { /* ignore */ }
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch { /* ignore */ }
  return false;
}

function saveMuted(m: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch { /* ignore */ }
}

function ensureCtx(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : volume;
    masterGain.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Call from a user-gesture handler (pointer down) to unlock audio on iOS. */
export function unlockSfx(): void {
  const c = ensureCtx();
  if (c && c.state === "suspended") {
    c.resume().catch(() => { /* ignore */ });
  }
}

export function getSfxVolume(): number {
  return volume;
}

export function setSfxVolume(v: number): void {
  volume = Math.max(0, Math.min(1, v));
  if (masterGain) masterGain.gain.value = muted ? 0 : volume;
  saveVolume(volume);
}

export function isSfxMuted(): boolean {
  return muted;
}

export function setSfxMuted(m: boolean): void {
  muted = m;
  if (masterGain) masterGain.gain.value = muted ? 0 : volume;
  saveMuted(muted);
}

export function toggleSfxMute(): void {
  setSfxMuted(!muted);
}

interface ToneSpec {
  freq: number;
  endFreq?: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  attack?: number;
}

function playTone(spec: ToneSpec): void {
  const c = ensureCtx();
  if (!c || !masterGain || muted || volume <= 0) return;
  const start = c.currentTime + (spec.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = spec.type ?? "sine";
  osc.frequency.setValueAtTime(spec.freq, start);
  if (spec.endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, spec.endFreq),
      start + spec.duration
    );
  }
  const peak = spec.gain ?? 0.3;
  const attack = spec.attack ?? 0.005;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + spec.duration);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(start);
  osc.stop(start + spec.duration + 0.02);
}

/** Soft UI click — buttons, close, minor taps. */
export function playClick(): void {
  playTone({ freq: 1000, endFreq: 500, duration: 0.05, type: "square", gain: 0.08 });
}

/** Slightly brighter select chime — menu item selection. */
export function playSelect(): void {
  playTone({ freq: 620, endFreq: 920, duration: 0.09, type: "triangle", gain: 0.18 });
}

/** Confirm / OK — two-note rise. */
export function playConfirm(): void {
  playTone({ freq: 660, duration: 0.12, type: "sine", gain: 0.22 });
  playTone({ freq: 990, duration: 0.2, type: "sine", gain: 0.22, delay: 0.06 });
}

/** Card drawn from stock or discard pile — quick descending swoosh. */
export function playCardDraw(): void {
  playTone({ freq: 720, endFreq: 320, duration: 0.08, type: "triangle", gain: 0.14 });
}

/** Card placed on discard pile — short low thunk. */
export function playCardDiscard(): void {
  playTone({ freq: 220, endFreq: 110, duration: 0.07, type: "square", gain: 0.16 });
}

/** A new meld (coven / cascade) just formed in the player's hand — bright chime. */
export function playMeld(): void {
  playTone({ freq: 880, duration: 0.18, type: "sine", gain: 0.22 });
  playTone({ freq: 1320, duration: 0.22, type: "sine", gain: 0.16, delay: 0.04 });
  playTone({ freq: 1760, duration: 0.26, type: "sine", gain: 0.10, delay: 0.09 });
}

/** Cast (knock) confirmed — magical rising sweep. */
export function playCast(): void {
  playTone({ freq: 220, endFreq: 1320, duration: 0.32, type: "sawtooth", gain: 0.18 });
  playTone({ freq: 660, endFreq: 1980, duration: 0.36, type: "triangle", gain: 0.14, delay: 0.04 });
}

/** Projectile / orb impact — bass boom. */
export function playImpact(): void {
  playTone({ freq: 140, endFreq: 50, duration: 0.18, type: "sawtooth", gain: 0.28 });
  playTone({ freq: 80, endFreq: 30, duration: 0.22, type: "sine", gain: 0.22, delay: 0.01 });
}

/** Player won the hand — major triad arpeggio. */
export function playRoundWin(): void {
  playTone({ freq: 523, duration: 0.18, type: "sine", gain: 0.22 });
  playTone({ freq: 659, duration: 0.18, type: "sine", gain: 0.22, delay: 0.08 });
  playTone({ freq: 784, duration: 0.32, type: "sine", gain: 0.26, delay: 0.16 });
}

/** Player lost the hand — minor descend. */
export function playRoundLose(): void {
  playTone({ freq: 392, duration: 0.18, type: "triangle", gain: 0.22 });
  playTone({ freq: 311, duration: 0.18, type: "triangle", gain: 0.22, delay: 0.08 });
  playTone({ freq: 233, duration: 0.36, type: "triangle", gain: 0.24, delay: 0.16 });
}

/**
 * Soft breath / vocal swell used as an "あ…ん…" stand-in for the post-reward
 * intimate skits. Two slightly detuned sine layers with a small upward bend
 * approximate a warm sigh without sounding alarm-like. Pitch is lightly
 * randomized so consecutive lines don't sound mechanical.
 */
export function playMoan(): void {
  // Fundamental in vocal range (A3-D4-ish). Keep variation small so the tone
  // family remains recognisable across repeated lines.
  const base = 220 + Math.random() * 60;
  playTone({
    freq: base,
    endFreq: base * 1.18,
    duration: 0.55,
    type: "sine",
    gain: 0.18,
    attack: 0.08,
  });
  // Faint upper layer for breathiness.
  playTone({
    freq: base * 2.04,
    endFreq: base * 2.18,
    duration: 0.45,
    type: "sine",
    gain: 0.06,
    attack: 0.10,
    delay: 0.04,
  });
}
