// ゲーム状態の型定義

export type Scene = "title" | "playing" | "gameover";

export interface HexBlock {
  x: number;        // 中心X
  y: number;        // 中心Y
  width: number;    // ブロックの幅（六角形の横幅）
  height: number;   // ブロックの高さ
  color: string;    // ネオンカラー
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;     // 0〜1
  color: string;
  size: number;
}

export interface PerfectEffect {
  timer: number;    // 残りフレーム
  x: number;
  y: number;
}

export interface SwingBlock {
  x: number;
  width: number;
  angle: number;     // 振り子の角度（ラジアン）
  speed: number;     // 振り子の速度
  falling: boolean;
  fallY: number;     // 落下中のY座標
  color: string;
}

export interface GameState {
  scene: Scene;
  score: number;
  highScore: number;
  level: number;           // 積み上げた段数
  combo: number;           // 連続PERFECT回数
  tower: HexBlock[];       // 積み上がったタワー
  current: SwingBlock;     // 現在揺れているブロック
  particles: Particle[];
  perfectEffect: PerfectEffect | null;
  cameraY: number;         // カメラのY位置（タワーが高くなると上に移動）
  gameOverTimer: number;   // ゲームオーバー演出用タイマー
  lastTime: number;
}

// デバッグAPI用
export interface DebugGameState {
  scene: Scene;
  score: number;
  highScore: number;
  level: number;
  combo: number;
  towerHeight: number;
  currentBlockWidth: number;
  currentBlockX: number;
}
