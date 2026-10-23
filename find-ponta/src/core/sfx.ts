import { getNumber, setNumber, getBool, setBool } from "./storage";

// Synthesized SE via WebAudio — no external assets required.

const VOLUME_KEY = "sfx-volume";
const MUTED_KEY = "sfx-muted";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let volume = getNumber(VOLUME_KEY, 0.5, 0, 1);
let muted = getBool(MUTED_KEY, false);

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

/** BGM など他の合成音声が共有する AudioContext（未対応環境では null）。 */
export function getAudioContext(): AudioContext | null {
  return ensureCtx();
}

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
  setNumber(VOLUME_KEY, volume);
}

export function isSfxMuted(): boolean {
  return muted;
}

export function setSfxMuted(m: boolean): void {
  muted = m;
  if (masterGain) masterGain.gain.value = muted ? 0 : volume;
  setBool(MUTED_KEY, muted);
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
      start + spec.duration,
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

/** Damage / hit — short noisy thud. */
export function playHit(): void {
  playTone({ freq: 220, endFreq: 80, duration: 0.12, type: "sawtooth", gain: 0.14 });
}

/** Pickup gold — quick rising blip. */
export function playPickup(): void {
  playTone({ freq: 800, endFreq: 1200, duration: 0.08, type: "sine", gain: 0.1 });
}

// ============================================================
// Find Ponta! 専用 SFX（9種、すべて WebAudio 合成）
// ============================================================

/** ui_click */
export function playUiClick(): void {
  playClick();
}

/** tap_miss — 何もない場所をタップ。短い低音ポフ。 */
export function playTapMiss(): void {
  playTone({ freq: 260, endFreq: 150, duration: 0.14, type: "triangle", gain: 0.2 });
}

/** tap_wrong_mob — モブをタップ。ブブッ。 */
export function playTapWrongMob(): void {
  playTone({ freq: 200, endFreq: 140, duration: 0.12, type: "square", gain: 0.12 });
  playTone({ freq: 200, endFreq: 120, duration: 0.14, type: "square", gain: 0.12, delay: 0.14 });
}

/** tap_wrong_decoy — デコイをタップ。惜しい下降音。 */
export function playTapWrongDecoy(): void {
  playTone({ freq: 520, endFreq: 380, duration: 0.14, type: "sawtooth", gain: 0.13 });
  playTone({ freq: 380, endFreq: 190, duration: 0.3, type: "sawtooth", gain: 0.15, delay: 0.14 });
}

/** hint — きらきら上昇。 */
export function playHint(): void {
  [880, 1175, 1568].forEach((f, i) => {
    playTone({ freq: f, duration: 0.22, type: "sine", gain: 0.14, delay: i * 0.08 });
  });
}

/** bonus_found — 軽快な2音。 */
export function playBonusFound(): void {
  playTone({ freq: 784, duration: 0.1, type: "triangle", gain: 0.2 });
  playTone({ freq: 1047, duration: 0.1, type: "triangle", gain: 0.2, delay: 0.08 });
  playTone({ freq: 1568, duration: 0.25, type: "sine", gain: 0.16, delay: 0.16 });
}

/** found_fanfare — ポンタ発見。短いファンファーレ。 */
export function playFoundFanfare(): void {
  const notes = [523, 659, 784, 1047, 784, 1047, 1319];
  const times = [0, 0.1, 0.2, 0.3, 0.46, 0.56, 0.68];
  notes.forEach((f, i) => {
    playTone({ freq: f, duration: i === notes.length - 1 ? 0.7 : 0.18, type: "triangle", gain: 0.22, delay: times[i] });
  });
  playTone({ freq: 262, duration: 0.9, type: "sine", gain: 0.15, delay: 0.68 });
}

/** timer_tick — 残り10秒以下の秒ごと。 */
export function playTimerTick(): void {
  playTone({ freq: 1500, endFreq: 1200, duration: 0.05, type: "square", gain: 0.08 });
}

/** fail — タイムアップ。下降音。 */
export function playFail(): void {
  [392, 330, 262, 196].forEach((f, i) => {
    playTone({ freq: f, duration: 0.3, type: "triangle", gain: 0.2, delay: i * 0.2 });
  });
}
