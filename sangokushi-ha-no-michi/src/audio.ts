/**
 * Web Audio API による BGM・効果音システム
 * 外部ファイル不使用、全てコードで合成
 */

export type SfxName =
  | 'dice_roll'
  | 'hit'
  | 'defend'
  | 'skill'
  | 'victory'
  | 'defeat'
  | 'click'
  | 'heal'
  | 'buff'
  | 'coin';

export type BgmTrack = 'title' | 'map' | 'battle';

// webkitAudioContext のブラウザ互換
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

// BGMのノード群をまとめる型
interface BgmNodes {
  gainNode: GainNode;
  oscillators: OscillatorNode[];
  intervalId: ReturnType<typeof setInterval> | null;
}

class AudioManager {
  private static _instance: AudioManager | null = null;

  private _ctx: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _bgmGain: GainNode | null = null;
  private _sfxGain: GainNode | null = null;

  private _masterVolume: number = 0.8;
  private _bgmVolume: number = 0.5;
  private _sfxVolume: number = 0.7;
  private _muted: boolean = false;

  private _currentTrack: BgmTrack | null = null;
  private _currentBgmNodes: BgmNodes | null = null;
  private _fadingOut: boolean = false;

  private constructor() {}

  static getInstance(): AudioManager {
    if (!AudioManager._instance) {
      AudioManager._instance = new AudioManager();
    }
    return AudioManager._instance;
  }

  /** ユーザー操作後に AudioContext を初期化 */
  init(): void {
    if (this._ctx) return;
    const AudioCtx = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioCtx) return;

    this._ctx = new AudioCtx();
    this._masterGain = this._ctx.createGain();
    this._bgmGain = this._ctx.createGain();
    this._sfxGain = this._ctx.createGain();

    this._bgmGain.connect(this._masterGain);
    this._sfxGain.connect(this._masterGain);
    this._masterGain.connect(this._ctx.destination);

    this._applyVolumes();
  }

  private _applyVolumes(): void {
    if (!this._masterGain || !this._bgmGain || !this._sfxGain) return;
    const now = this._ctx!.currentTime;
    const masterVal = this._muted ? 0 : this._masterVolume;
    this._masterGain.gain.setTargetAtTime(masterVal, now, 0.01);
    this._bgmGain.gain.setTargetAtTime(this._bgmVolume, now, 0.01);
    this._sfxGain.gain.setTargetAtTime(this._sfxVolume, now, 0.01);
  }

  setMasterVolume(v: number): void {
    this._masterVolume = Math.max(0, Math.min(1, v));
    this._applyVolumes();
  }

  /** ミュートをトグル。戻り値: ミュート後の状態（true=ミュート中） */
  toggleMute(): boolean {
    this._muted = !this._muted;
    this._applyVolumes();
    return this._muted;
  }

  get isMuted(): boolean {
    return this._muted;
  }

  // ================================================================
  // BGM
  // ================================================================

  playBgm(track: BgmTrack): void {
    if (!this._ctx || !this._bgmGain) return;
    if (this._currentTrack === track && this._currentBgmNodes) return;

    if (this._currentBgmNodes) {
      this._fadeOutBgm(() => {
        this._startBgm(track);
      });
    } else {
      this._startBgm(track);
    }
  }

  stopBgm(): void {
    if (!this._currentBgmNodes) return;
    this._fadeOutBgm(() => {});
    this._currentTrack = null;
  }

  private _fadeOutBgm(callback: () => void): void {
    if (!this._ctx || !this._currentBgmNodes || this._fadingOut) {
      callback();
      return;
    }
    this._fadingOut = true;
    const nodes = this._currentBgmNodes;
    const gain = nodes.gainNode;
    const now = this._ctx.currentTime;
    gain.gain.setTargetAtTime(0, now, 0.3);

    setTimeout(() => {
      this._stopBgmNodes(nodes);
      this._currentBgmNodes = null;
      this._fadingOut = false;
      callback();
    }, 1200);
  }

  private _stopBgmNodes(nodes: BgmNodes): void {
    if (nodes.intervalId !== null) clearInterval(nodes.intervalId);
    for (const osc of nodes.oscillators) {
      try { osc.stop(); } catch { /* already stopped */ }
      osc.disconnect();
    }
    nodes.gainNode.disconnect();
  }

  private _startBgm(track: BgmTrack): void {
    if (!this._ctx || !this._bgmGain) return;
    this._currentTrack = track;

    const gainNode = this._ctx.createGain();
    gainNode.gain.setValueAtTime(0, this._ctx.currentTime);
    gainNode.gain.setTargetAtTime(1.0, this._ctx.currentTime, 0.5);
    gainNode.connect(this._bgmGain);

    const nodes: BgmNodes = { gainNode, oscillators: [], intervalId: null };
    this._currentBgmNodes = nodes;

    if (track === 'title') {
      this._playBgmTitle(nodes);
    } else if (track === 'map') {
      this._playBgmMap(nodes);
    } else if (track === 'battle') {
      this._playBgmBattle(nodes);
    }
  }

  /**
   * title BGM: 荘厳・勇壮。低いドローン + 和風メロディ。テンポ遅め。
   * 五音音階 D: D3, F#3, A3, B3, C#4, D4...
   */
  private _playBgmTitle(nodes: BgmNodes): void {
    const ctx = this._ctx!;

    // ドローン音（低音持続）
    const droneFreqs = [73.4, 110.0, 146.8]; // D2, A2, D3
    for (const freq of droneFreqs) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      g.gain.value = 0.04;
      osc.connect(g);
      g.connect(nodes.gainNode);
      osc.start();
      nodes.oscillators.push(osc);
    }

    // メロディパターン（D ペンタトニックメジャー: D E F# A B）
    const melodyNotes = [
      293.66, 329.63, 369.99, 440.00, 493.88,  // D4 E4 F#4 A4 B4
      440.00, 369.99, 329.63, 293.66, 246.94,  // A4 F#4 E4 D4 B3
      293.66, 369.99, 440.00, 493.88, 440.00,  // D4 F#4 A4 B4 A4
      369.99, 293.66, 246.94, 220.00, 293.66,  // F#4 D4 B3 A3 D4
    ];
    const tempo = 0.6; // 1音あたり秒数（遅め）

    let step = 0;
    const playNext = (): void => {
      if (!this._currentBgmNodes || this._currentBgmNodes !== nodes) return;
      const freq = melodyNotes[step % melodyNotes.length];
      if (freq !== undefined) {
        this._playMelodyNote(ctx, nodes, freq, tempo * 0.85, 0.06, 'triangle');
      }
      step++;
    };

    playNext();
    nodes.intervalId = setInterval(playNext, tempo * 1000);
  }

  /**
   * map BGM: 穏やか・冒険的。ペンタトニックを活用。中テンポ。
   * G ペンタトニックマイナー: G3, A#3, C4, D4, F4
   */
  private _playBgmMap(nodes: BgmNodes): void {
    const ctx = this._ctx!;

    // 低音伴奏（ベース）
    const bassFreqs = [98.0, 130.81]; // G2, C3
    for (const freq of bassFreqs) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.value = 0.035;
      osc.connect(g);
      g.connect(nodes.gainNode);
      osc.start();
      nodes.oscillators.push(osc);
    }

    // メロディ: G ペンタトニックマイナー
    const melodyNotes = [
      392.00, 466.16, 523.25, 587.33, 349.23,  // G4 A#4 C5 D5 F4
      523.25, 466.16, 392.00, 349.23, 392.00,  // C5 A#4 G4 F4 G4
      466.16, 523.25, 587.33, 523.25, 466.16,  // A#4 C5 D5 C5 A#4
      392.00, 349.23, 392.00, 466.16, 392.00,  // G4 F4 G4 A#4 G4
    ];
    const tempo = 0.45; // 中テンポ

    let step = 0;
    const playNext = (): void => {
      if (!this._currentBgmNodes || this._currentBgmNodes !== nodes) return;
      const freq = melodyNotes[step % melodyNotes.length];
      if (freq !== undefined) {
        this._playMelodyNote(ctx, nodes, freq, tempo * 0.8, 0.055, 'sine');
      }
      step++;
    };

    playNext();
    nodes.intervalId = setInterval(playNext, tempo * 1000);
  }

  /**
   * battle BGM: 緊張感のある戦闘曲。テンポ早め、打楽器的リズム。
   * E フリジアン: E3, F3, G3, A3, B3, C4, D4
   */
  private _playBgmBattle(nodes: BgmNodes): void {
    const ctx = this._ctx!;

    // 低音ベース（重厚感）
    const osc0 = ctx.createOscillator();
    const g0 = ctx.createGain();
    osc0.type = 'sawtooth';
    osc0.frequency.value = 164.81; // E3
    g0.gain.value = 0.05;
    osc0.connect(g0);
    g0.connect(nodes.gainNode);
    osc0.start();
    nodes.oscillators.push(osc0);

    // リズムパターン（打楽器的: 短いバースト）
    const rhythmFreqs = [
      164.81, 174.61, 196.00, 220.00, 174.61,  // E3 F3 G3 A3 F3
      164.81, 196.00, 220.00, 246.94, 220.00,  // E3 G3 A3 B3 A3
      164.81, 174.61, 196.00, 164.81, 261.63,  // E3 F3 G3 E3 C4
      246.94, 220.00, 196.00, 174.61, 164.81,  // B3 A3 G3 F3 E3
    ];
    const tempo = 0.22; // 早め

    let step = 0;
    const playNext = (): void => {
      if (!this._currentBgmNodes || this._currentBgmNodes !== nodes) return;
      const freq = rhythmFreqs[step % rhythmFreqs.length];
      if (freq !== undefined) {
        this._playMelodyNote(ctx, nodes, freq, tempo * 0.6, 0.07, 'square');
      }
      step++;
    };

    playNext();
    nodes.intervalId = setInterval(playNext, tempo * 1000);
  }

  /** メロディ1音を鳴らすヘルパー */
  private _playMelodyNote(
    ctx: AudioContext,
    nodes: BgmNodes,
    freq: number,
    duration: number,
    peakGain: number,
    type: OscillatorType
  ): void {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0, ctx.currentTime);
    env.gain.linearRampToValueAtTime(peakGain, ctx.currentTime + 0.02);
    env.gain.setTargetAtTime(0, ctx.currentTime + duration * 0.6, duration * 0.15);
    osc.connect(env);
    env.connect(nodes.gainNode);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.1);

    // 停止後に自動解放
    osc.onended = (): void => {
      osc.disconnect();
      env.disconnect();
      // oscillators 配列から除去
      const idx = nodes.oscillators.indexOf(osc);
      if (idx >= 0) nodes.oscillators.splice(idx, 1);
    };
    nodes.oscillators.push(osc);
  }

  // ================================================================
  // SFX
  // ================================================================

  playSfx(name: SfxName): void {
    if (!this._ctx || !this._sfxGain) return;
    const ctx = this._ctx;
    const out = this._sfxGain;

    switch (name) {
      case 'dice_roll':    this._sfxDiceRoll(ctx, out); break;
      case 'hit':          this._sfxHit(ctx, out); break;
      case 'defend':       this._sfxDefend(ctx, out); break;
      case 'skill':        this._sfxSkill(ctx, out); break;
      case 'victory':      this._sfxVictory(ctx, out); break;
      case 'defeat':       this._sfxDefeat(ctx, out); break;
      case 'click':        this._sfxClick(ctx, out); break;
      case 'heal':         this._sfxHeal(ctx, out); break;
      case 'buff':         this._sfxBuff(ctx, out); break;
      case 'coin':         this._sfxCoin(ctx, out); break;
    }
  }

  /** ダイスが転がる音: 短いノイズ+クリック音の連続 */
  private _sfxDiceRoll(ctx: AudioContext, out: AudioNode): void {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const t = ctx.currentTime + i * 0.07;
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < data.length; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (data.length * 0.3));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.25, t);
      g.gain.linearRampToValueAtTime(0, t + 0.04);
      src.connect(g);
      g.connect(out);
      src.start(t);
    }
  }

  /** 攻撃ヒット: 短い低周波パルス */
  private _sfxHit(ctx: AudioContext, out: AudioNode): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.1);
    g.gain.setValueAtTime(0.5, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(g);
    g.connect(out);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  /** 防御成功: 金属的なブロック音 */
  private _sfxDefend(ctx: AudioContext, out: AudioNode): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(g);
    g.connect(out);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);

    // メタリックな倍音を追加
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1600, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.08);
    g2.gain.setValueAtTime(0.15, ctx.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc2.connect(g2);
    g2.connect(out);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.12);
  }

  /** スキル発動: 上昇音 + キラキラ */
  private _sfxSkill(ctx: AudioContext, out: AudioNode): void {
    // メイン上昇音
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.3);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.setTargetAtTime(0, ctx.currentTime + 0.25, 0.05);
    osc.connect(g);
    g.connect(out);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);

    // キラキラ（高音短音 x3）
    const sparkFreqs = [1200, 1500, 1800];
    sparkFreqs.forEach((freq, i) => {
      const t = ctx.currentTime + 0.2 + i * 0.06;
      const o = ctx.createOscillator();
      const eg = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      eg.gain.setValueAtTime(0.15, t);
      eg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o.connect(eg);
      eg.connect(out);
      o.start(t);
      o.stop(t + 0.1);
    });
  }

  /** 勝利ファンファーレ: 短い上昇メロディ */
  private _sfxVictory(ctx: AudioContext, out: AudioNode): void {
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5 E5 G5 C6
    const dur = 0.15;
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * (dur * 0.9);
      const o = ctx.createOscillator();
      const eg = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      eg.gain.setValueAtTime(0.35, t);
      eg.gain.setTargetAtTime(0, t + dur * 0.7, 0.04);
      o.connect(eg);
      eg.connect(out);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  }

  /** 敗北: 下降する暗い音 */
  private _sfxDefeat(ctx: AudioContext, out: AudioNode): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.5);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.setTargetAtTime(0, ctx.currentTime + 0.3, 0.1);
    osc.connect(g);
    g.connect(out);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.7);

    // 暗い低音
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(110, ctx.currentTime + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.6);
    g2.gain.setValueAtTime(0.2, ctx.currentTime + 0.1);
    g2.gain.setTargetAtTime(0, ctx.currentTime + 0.4, 0.1);
    osc2.connect(g2);
    g2.connect(out);
    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.8);
  }

  /** UI操作音: 短いクリック */
  private _sfxClick(ctx: AudioContext, out: AudioNode): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.03);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(g);
    g.connect(out);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  }

  /** 回復音: 柔らかい上昇音 */
  private _sfxHeal(ctx: AudioContext, out: AudioNode): void {
    const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.1;
      const o = ctx.createOscillator();
      const eg = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq * 0.8, t);
      o.frequency.linearRampToValueAtTime(freq, t + 0.05);
      eg.gain.setValueAtTime(0.25, t);
      eg.gain.setTargetAtTime(0, t + 0.15, 0.05);
      o.connect(eg);
      eg.connect(out);
      o.start(t);
      o.stop(t + 0.3);
    });
  }

  /** バフ: パワーアップ音 */
  private _sfxBuff(ctx: AudioContext, out: AudioNode): void {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2);
    osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.35);
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    g.gain.setTargetAtTime(0, ctx.currentTime + 0.3, 0.06);
    osc.connect(g);
    g.connect(out);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.45);
  }

  /** ゴールド取得: チャリンという音 */
  private _sfxCoin(ctx: AudioContext, out: AudioNode): void {
    const freqs = [1200, 1500, 1800];
    freqs.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.05;
      const o = ctx.createOscillator();
      const eg = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * 1.2, t + 0.03);
      eg.gain.setValueAtTime(0.25, t);
      eg.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(eg);
      eg.connect(out);
      o.start(t);
      o.stop(t + 0.18);
    });
  }
}

// ================================================================
// シングルトンインスタンス
// ================================================================

export const audioManager: AudioManager = AudioManager.getInstance();

/** ユーザー操作時に呼ぶ（AudioContext初期化） */
export function initAudio(): void {
  audioManager.init();
}

export function playBgm(track: BgmTrack): void {
  audioManager.playBgm(track);
}

export function stopBgm(): void {
  audioManager.stopBgm();
}

export function playSfx(name: SfxName): void {
  audioManager.playSfx(name);
}

export function setMasterVolume(v: number): void {
  audioManager.setMasterVolume(v);
}

/** ミュートをトグル。戻り値: ミュート後の状態（true=ミュート中） */
export function toggleMute(): boolean {
  return audioManager.toggleMute();
}
