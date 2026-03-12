// ゲーム全体の型定義

export type Scene = "title" | "playing" | "gameover";
export type Lane = -1 | 0 | 1;

export interface Player {
  lane: Lane;
  targetLane: Lane;
  laneProgress: number; // 0~1 (現在レーンから目標レーンへの補間)
  y: number;           // ジャンプ用の垂直オフセット（通常0）
  vy: number;          // 垂直速度
  isJumping: boolean;
  shielded: boolean;
  shieldTimer: number;
  magnetActive: boolean;
  magnetTimer: number;
  runFrame: number;    // 走りアニメフレーム
  frameTimer: number;
}

export interface Coin {
  lane: Lane;
  depth: number;  // 奥行き 0(遠)~1(手前)
  collected: boolean;
}

export type ObstacleType = "barricade" | "saw";

export interface Obstacle {
  lane: Lane;
  depth: number;
  type: ObstacleType;
  angle: number;   // のこぎり用回転角度
}

export type ItemType = "magnet" | "shield";

export interface Item {
  lane: Lane;
  depth: number;
  type: ItemType;
  angle: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;    // 0~1
  color: string;
  size: number;
}

export interface SpeedLine {
  x: number;
  y: number;
  length: number;
  alpha: number;
}

export interface Milestone {
  text: string;
  timer: number;
  scale: number;
  color: string;
}

export interface GameState {
  scene: Scene;
  score: number;
  highScore: number;
  combo: number;
  maxCombo: number;
  distance: number;
  speed: number;
  comboTimer: number;
  flashRed: number;   // ゲームオーバーフラッシュ 0~1
  flashWhite: number; // コイン収集フラッシュ 0~1
  player: Player;
  coins: Coin[];
  obstacles: Obstacle[];
  items: Item[];
  particles: Particle[];
  speedLines: SpeedLine[];
  gridOffset: number;
  spawnTimer: number;
  nearMissTimer: number;
  level: number;
  nextLevelDist: number;
  milestone: Milestone | null;
  totalCoins: number;
  nearMissCount: number;
  screenShake: number;
}

export interface GameStateInfo {
  scene: Scene;
  score: number;
  highScore: number;
  combo: number;
  distance: number;
}
