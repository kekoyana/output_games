/** ゲームの状態 */
export type GameState = "title" | "aiming" | "shooting" | "turnEnd" | "gameOver";

/** 2Dベクトル */
export interface Vec2 {
  x: number;
  y: number;
}

/** ボール */
export interface Ball {
  pos: Vec2;
  vel: Vec2;
  active: boolean; // まだ画面内で動いているか
}

/** ブロック */
export interface Block {
  col: number;
  row: number; // 論理行（0が最上段、下に増える）
  hp: number;
  color: string;
}

/** ボール追加アイテム */
export interface BallItem {
  col: number;
  row: number;
  collected: boolean;
}

/** パーティクル */
export interface Particle {
  pos: Vec2;
  vel: Vec2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

/** ゲーム全体のデータ */
export interface GameData {
  state: GameState;
  turn: number;
  score: number;
  balls: Ball[];
  ballCount: number;
  blocks: Block[];
  items: BallItem[];
  particles: Particle[];
  launchPos: Vec2;       // ボール発射位置
  aimAngle: number;      // 発射角度（ラジアン）
  ballsLaunched: number; // 今ターンに発射済みのボール数
  launchTimer: number;   // 発射間隔タイマー
  nextLandX: number;     // 次のターンの発射X座標（最初に落ちたボールの位置）
  firstLanded: boolean;  // 最初のボールが着地したか
  fastForward: boolean;  // 早送り中か
  gridCols: number;
  gridRows: number;
  cellSize: number;
  offsetX: number;       // グリッド描画のX方向オフセット
  offsetY: number;       // グリッド描画のY方向オフセット
  deadlineY: number;     // デッドライン（これより下にブロックが来たらゲームオーバー）
  canvasW: number;
  canvasH: number;
  pointerPos: Vec2;      // 現在のポインタ位置
  pointerDown: boolean;
}
