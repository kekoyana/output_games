// Slime Grow - エントリポイント

import { createTitleState, updateGame, onPointerMove, onTap } from './game';
import { render } from './renderer';
import type { GameState } from './types';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

let W = window.innerWidth;
let H = window.innerHeight;

function resize(): void {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
}

resize();
window.addEventListener('resize', resize);

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
  onPointerMove(state, e.clientX, e.clientY);
});

canvas.addEventListener('pointerdown', (e: PointerEvent) => {
  onPointerMove(state, e.clientX, e.clientY);
  const prevScreen = state.screen;
  state = onTap(state);
  if (prevScreen !== state.screen && state.screen === 'playing') {
    // ゲーム開始時にポインタ位置をキャンバス中央へ
    onPointerMove(state, W / 2, H / 2);
  }
  // ベストステージ保存
  saveBest(state.bestStage);
});

canvas.addEventListener('pointerup', () => {
  // タッチ終了後もポインタ追従を維持（何もしない）
});

// ゲームループ
function loop(): void {
  state = updateGame(state, W, H);
  render(ctx, state, W, H);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
