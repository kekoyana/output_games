import { createGame, resizeGame, update, render, handlePointerDown, handlePointerMove, handlePointerUp, getDebugState } from "./game";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener("resize", resize);
resize();

// ゲーム初期化
const game = createGame(canvas.width, canvas.height);

// リサイズ対応
window.addEventListener("resize", () => {
  resize();
  resizeGame(game, canvas.width, canvas.height);
});

// Pointer Events で入力を処理（マウス・タッチ両対応）
canvas.addEventListener("pointerdown", (e: PointerEvent) => {
  e.preventDefault();
  handlePointerDown(game, e.clientX, e.clientY);
});

canvas.addEventListener("pointermove", (e: PointerEvent) => {
  e.preventDefault();
  handlePointerMove(game, e.clientX, e.clientY);
});

canvas.addEventListener("pointerup", (e: PointerEvent) => {
  e.preventDefault();
  handlePointerUp(game, e.clientX, e.clientY);
});

// タッチのデフォルト動作を防止
canvas.addEventListener("touchstart", (e: TouchEvent) => {
  e.preventDefault();
}, { passive: false });

canvas.addEventListener("touchmove", (e: TouchEvent) => {
  e.preventDefault();
}, { passive: false });

// ゲームループ
let lastTime = 0;

function gameLoop(timestamp: number): void {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // 最大50ms
  lastTime = timestamp;

  update(game, dt);
  render(game, ctx);

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame((timestamp) => {
  lastTime = timestamp;
  requestAnimationFrame(gameLoop);
});

// デバッグAPI: Playwrightからゲーム状態を取得するため
interface GameWindow extends Window {
  getGameState: () => ReturnType<typeof getDebugState>;
}
(window as unknown as GameWindow).getGameState = () => getDebugState(game);
