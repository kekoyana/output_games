// Slime Grow - エントリポイント

import { createTitleState, updateGame, onPointerMove, onTap } from './game';
import { render } from './renderer';
import type { GameState } from './types';
import { GAME_W, GAME_H } from './utils';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

let W = window.innerWidth;
let H = window.innerHeight;
let scale = 1;
let offsetX = 0;
let offsetY = 0;

function updateLayout(): void {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
  // レターボックス付きでゲーム領域をフィット
  scale = Math.min(W / GAME_W, H / GAME_H);
  offsetX = (W - GAME_W * scale) / 2;
  offsetY = (H - GAME_H * scale) / 2;
}

updateLayout();
window.addEventListener('resize', updateLayout);

// スクリーン座標 → 論理座標変換
function toLogical(screenX: number, screenY: number): [number, number] {
  return [
    (screenX - offsetX) / scale,
    (screenY - offsetY) / scale,
  ];
}

// セーブデータ（ベストステージ）
const SAVE_KEY = 'slimegrow_best';
function loadBest(): number {
  try {
    const v = localStorage.getItem(SAVE_KEY);
    if (v === null) return 1;
    const n = parseInt(v, 10);
    return isNaN(n) ? 1 : n;
  } catch {
    return 1;
  }
}
function saveBest(stage: number): void {
  try {
    localStorage.setItem(SAVE_KEY, String(stage));
  } catch {
    // ignore
  }
}

let state: GameState = createTitleState(loadBest());

// Pointer Events（マウス・タッチ統一）
canvas.addEventListener('pointermove', (e: PointerEvent) => {
  const [lx, ly] = toLogical(e.clientX, e.clientY);
  onPointerMove(state, lx, ly);
});

canvas.addEventListener('pointerdown', (e: PointerEvent) => {
  const [lx, ly] = toLogical(e.clientX, e.clientY);
  onPointerMove(state, lx, ly);
  const prevScreen = state.screen;
  state = onTap(state);
  if (prevScreen !== state.screen && state.screen === 'playing') {
    // ゲーム開始時にポインタ位置をキャンバス中央へ
    onPointerMove(state, GAME_W / 2, GAME_H / 2);
  }
  // ベストステージ保存
  saveBest(state.bestStage);
});

canvas.addEventListener('pointerup', () => {
  // タッチ終了後もポインタ追従を維持（何もしない）
});

// ゲームループ
function loop(): void {
  // ゲームロジックは常に固定解像度で実行
  state = updateGame(state, GAME_W, GAME_H);

  // 画面全体をクリア（レターボックス部分含む）
  ctx.clearRect(0, 0, W, H);
  // レターボックス背景
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);

  // 論理座標 → スクリーン座標にスケーリングして描画
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  render(ctx, state, GAME_W, GAME_H);
  ctx.restore();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
