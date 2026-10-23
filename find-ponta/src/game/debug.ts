// テスト/デバッグ用フックの橋渡し（Phaser 非依存）。
// GameScene が create 時に api を登録し、shutdown 時に解除する。

export interface WorldPoint {
  x: number;
  y: number;
}

export interface GameApi {
  getState: () => Record<string, unknown>;
  getPontaWorldPos: () => WorldPoint;
  getDecoyWorldPositions: () => Array<WorldPoint & { tex: string }>;
  getMobWorldPositions: () => Array<WorldPoint & { tex: string }>;
  getBonusWorldPositions: () => Array<WorldPoint & { tex: string; found: boolean }>;
  tapWorld: (x: number, y: number) => string;
  setView: (zoom: number, worldX: number, worldY: number) => void;
  skipIntro: () => void;
  worldToPage: (x: number, y: number) => WorldPoint;
  /** HUD ボタンの矩形（ゲーム座標の中心とサイズ） */
  getHudButtons: () => Array<{ scene: string; label: string; x: number; y: number; w: number; h: number }>;
}

let api: GameApi | null = null;
let lastResult: Record<string, unknown> | null = null;

export function registerGameApi(a: GameApi | null): void {
  api = a;
}

export function getGameApi(): GameApi | null {
  return api;
}

export function setLastResult(r: Record<string, unknown> | null): void {
  lastResult = r;
}

export function getLastResult(): Record<string, unknown> | null {
  return lastResult;
}
