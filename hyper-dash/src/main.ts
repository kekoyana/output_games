// エントリポイント: HYPER DASH!!

import type { GameState, GameStateInfo, Scene } from "./types";
import { createInitialState, startGame, update, handleMoveLane, handleJump } from "./game";
import { render } from "./renderer";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

let state: GameState = createInitialState();
let lastTime = 0;
let canvasW = window.innerWidth;
let canvasH = window.innerHeight;

function resize(): void {
  canvasW = window.innerWidth;
  canvasH = window.innerHeight;
  canvas.width = canvasW;
  canvas.height = canvasH;
}

window.addEventListener("resize", resize);
resize();

// ゲームループ
function loop(now: number): void {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  update(state, dt, canvasW, canvasH);
  render(ctx, state, canvasW, canvasH);

  requestAnimationFrame(loop);
}

requestAnimationFrame((now) => {
  lastTime = now;
  loop(now);
});

// ========================
// 入力ハンドリング
// ========================

// キーボード
const keysDown = new Set<string>();

window.addEventListener("keydown", (e) => {
  if (keysDown.has(e.code)) return;
  keysDown.add(e.code);

  if (state.scene === "title") {
    startGame(state);
    return;
  }
  if (state.scene === "gameover") {
    startGame(state);
    return;
  }

  switch (e.code) {
    case "ArrowLeft":
    case "KeyA":
      handleMoveLane(state, -1);
      break;
    case "ArrowRight":
    case "KeyD":
      handleMoveLane(state, 1);
      break;
    case "ArrowUp":
    case "KeyW":
    case "Space":
      e.preventDefault();
      handleJump(state);
      break;
  }
});

window.addEventListener("keyup", (e) => {
  keysDown.delete(e.code);
});

// ========================
// Pointer Events（マウス・タッチ共通）
// ========================

interface PointerData {
  startX: number;
  startY: number;
  moved: boolean;
}

const pointers = new Map<number, PointerData>();

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  pointers.set(e.pointerId, { startX: e.clientX, startY: e.clientY, moved: false });
});

canvas.addEventListener("pointermove", (e) => {
  e.preventDefault();
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.startX;
  const dy = e.clientY - p.startY;
  if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
    p.moved = true;
    handleSwipe(dx, dy, p);
    // スワイプ処理後は開始位置をリセットして連続スワイプを防ぐ
    p.startX = e.clientX;
    p.startY = e.clientY;
  }
});

canvas.addEventListener("pointerup", (e) => {
  e.preventDefault();
  const p = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (!p) return;

  if (!p.moved) {
    // タップ処理
    handleTap(e.clientX, e.clientY);
  }
});

canvas.addEventListener("pointercancel", (e) => {
  pointers.delete(e.pointerId);
});

function handleSwipe(dx: number, dy: number, _p: PointerData): void {
  if (state.scene === "title") {
    startGame(state);
    return;
  }
  if (state.scene === "gameover") {
    startGame(state);
    return;
  }

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDy > absDx && dy < -20) {
    // 上スワイプ: ジャンプ
    handleJump(state);
  } else if (absDx > absDy) {
    if (dx < -20) handleMoveLane(state, -1);
    else if (dx > 20) handleMoveLane(state, 1);
  }
}

function handleTap(x: number, y: number): void {
  if (state.scene === "title") {
    startGame(state);
    return;
  }
  if (state.scene === "gameover") {
    startGame(state);
    return;
  }

  if (state.scene !== "playing") return;

  // 画面3分割でタップ操作
  const third = canvasW / 3;
  if (x < third) {
    handleMoveLane(state, -1);
  } else if (x > third * 2) {
    handleMoveLane(state, 1);
  } else {
    handleJump(state);
  }
}

// ========================
// AIプレイテスト用グローバル関数
// ========================

declare global {
  interface Window {
    getGameState: () => GameStateInfo;
  }
}

window.getGameState = (): GameStateInfo => {
  return {
    scene: state.scene as Scene,
    score: state.score,
    highScore: state.highScore,
    combo: state.combo,
    distance: Math.floor(state.distance),
  };
};
