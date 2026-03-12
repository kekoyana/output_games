import {
  createField,
  createInitialState,
  startGame,
  update,
  dropBall,
  setGuideX,
  handleGameOverClick,
} from "./game";
import { drawFrame, drawTitle, drawGameOver } from "./renderer";
import { FieldConfig } from "./types";
import { GameState } from "./types";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

let canvasW = window.innerWidth;
let canvasH = window.innerHeight;
let field: FieldConfig;
let state: GameState;

function resize(): void {
  canvasW = window.innerWidth;
  canvasH = window.innerHeight;
  canvas.width = canvasW;
  canvas.height = canvasH;
  field = createField(canvasW, canvasH);
  if (!state) {
    state = createInitialState(field);
  } else {
    // Keep game state, only update field
  }
}

window.addEventListener("resize", resize);
resize();

// Input state
let pointerDown = false;
let lastPointerX = 0;

function getCanvasPos(e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

canvas.addEventListener("pointermove", (e: PointerEvent) => {
  const pos = getCanvasPos(e);
  lastPointerX = pos.x;
  if (state.phase === "playing" || state.phase === "danger") {
    setGuideX(state, field, pos.x);
  }
});

canvas.addEventListener("pointerdown", (e: PointerEvent) => {
  e.preventDefault();
  pointerDown = true;
  const pos = getCanvasPos(e);
  lastPointerX = pos.x;

  if (state.phase === "playing" || state.phase === "danger") {
    setGuideX(state, field, pos.x);
  }
});

canvas.addEventListener("pointerup", (e: PointerEvent) => {
  e.preventDefault();
  const pos = getCanvasPos(e);

  if (state.phase === "title") {
    startGame(state, field);
    return;
  }

  if (state.phase === "gameover") {
    if (handleGameOverClick(state, field, pos.x, pos.y)) {
      const hs = state.highScore;
      startGame(state, field);
      state.highScore = hs;
    }
    return;
  }

  if (state.phase === "playing" || state.phase === "danger") {
    setGuideX(state, field, pos.x);
    dropBall(state, field);
  }

  pointerDown = false;
});

canvas.addEventListener("pointermove", (e: PointerEvent) => {
  if (!pointerDown) return;
  const pos = getCanvasPos(e);
  lastPointerX = pos.x;
  if (state.phase === "playing" || state.phase === "danger") {
    setGuideX(state, field, pos.x);
  }
});

// Keyboard support
window.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (state.phase === "title") {
      startGame(state, field);
      return;
    }
    if (state.phase === "playing" || state.phase === "danger") {
      dropBall(state, field);
    }
  }
  if (e.code === "ArrowLeft") {
    setGuideX(state, field, state.guideX - 10);
  }
  if (e.code === "ArrowRight") {
    setGuideX(state, field, state.guideX + 10);
  }
});

// Game loop
let lastTime = 0;

function gameLoop(timestamp: number): void {
  const rawDt = (timestamp - lastTime) / 1000;
  const dt = Math.min(rawDt, 0.05); // cap at 50ms
  lastTime = timestamp;

  update(state, field, dt);

  if (state.phase === "title") {
    drawTitle(ctx, canvasW, canvasH);
  } else if (state.phase === "gameover") {
    drawFrame(ctx, state, field, canvasW, canvasH);
    drawGameOver(ctx, state, canvasW, canvasH, field);
  } else {
    drawFrame(ctx, state, field, canvasW, canvasH);
  }

  requestAnimationFrame(gameLoop);
}

// Expose game state for AI playtest
interface GameStateForPlaytest {
  scene: string;
  score: number;
  highScore: number;
  maxValue: number;
  ballCount: number;
  combo: number;
}

declare global {
  interface Window {
    getGameState: () => GameStateForPlaytest;
  }
}

window.getGameState = (): GameStateForPlaytest => ({
  scene: state.phase === "danger" ? "playing" : state.phase,
  score: state.score,
  highScore: state.highScore,
  maxValue: state.maxValue,
  ballCount: state.balls.length,
  combo: state.comboCount,
});

requestAnimationFrame((t) => {
  lastTime = t;
  requestAnimationFrame(gameLoop);
});
