// Hex Tower - エントリポイント

import { GameState, DebugGameState } from "./types";
import {
  createInitialState,
  startGame,
  dropBlock,
  update,
  render,
  getDebugState,
  setCanvasSize,
} from "./game";

// Canvas型拡張
declare global {
  interface Window {
    getGameState: () => DebugGameState;
  }
}

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

let state: GameState = createInitialState();

function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  setCanvasSize(canvas.width, canvas.height);
}

window.addEventListener("resize", resize);
resize();

// 入力処理（Pointer Events でPC/スマホ両対応）
canvas.addEventListener("pointerdown", (e: PointerEvent) => {
  e.preventDefault();
  handleInput();
});

window.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.code === "Space") {
    e.preventDefault();
    handleInput();
  }
});

function handleInput(): void {
  switch (state.scene) {
    case "title":
      startGame(state);
      break;
    case "playing":
      dropBlock(state);
      break;
    case "gameover":
      if (state.gameOverTimer > 600) {
        state = createInitialState();
        startGame(state);
      }
      break;
  }
}

// ゲームループ
let lastTimestamp = 0;

function gameLoop(timestamp: number): void {
  const dt = lastTimestamp === 0 ? 16 : timestamp - lastTimestamp;
  lastTimestamp = timestamp;

  update(state, dt);
  render(ctx, state);

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

// デバッグAPI（AIプレイテスト用）
window.getGameState = () => getDebugState(state);
