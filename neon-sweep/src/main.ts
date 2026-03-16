import { InputState, Direction, DebugInfo } from './types';
import {
  createGameState, update, render, computeLayout, computeVirtualControls,
  renderVirtualControls, getDebugInfo, RenderContext, VirtualControls,
  handleLangButtonClick,
} from './game';

// ---- Canvas Setup ----

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener('resize', resize);

// ---- State ----

const state = createGameState();
let isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

const input: InputState = {
  up: false, down: false, left: false, right: false,
  action: false, actionConsumed: false, moveConsumed: false,
  pointerDown: false, pointerStartX: 0, pointerStartY: 0, swipeDir: null,
};

// ---- Keyboard Input ----

const keyMap: Record<string, keyof Pick<InputState, 'up' | 'down' | 'left' | 'right'>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

const actionKeys = new Set(['Space', 'KeyZ', 'Enter']);

window.addEventListener('keydown', (e) => {
  const dir = keyMap[e.key];
  if (dir) {
    input[dir] = true;
    input.moveConsumed = false;
    e.preventDefault();
  }
  if (actionKeys.has(e.code)) {
    input.action = true;
    input.actionConsumed = false;
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  const dir = keyMap[e.key];
  if (dir) {
    input[dir] = false;
  }
  if (actionKeys.has(e.code)) {
    input.action = false;
    input.actionConsumed = false;
  }
});

// ---- Pointer / Touch Input ----

let vc: VirtualControls = computeVirtualControls(canvas);
let moveRepeatTimer = 0;
const MOVE_REPEAT_INTERVAL = 0.15;

let activeDpadDir: Direction | null = null;
let activeDpadPointerId: number | null = null;
let activeActionPointerId: number | null = null;

function getDpadDir(px: number, py: number): Direction | null {
  const dx = px - vc.dpadCenterX;
  const dy = py - vc.dpadCenterY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < vc.dpadRadius * 0.4 || dist > vc.dpadRadius * 2.2) return null;
  const angle = Math.atan2(dy, dx);
  if (angle > -Math.PI * 0.75 && angle <= -Math.PI * 0.25) return 'up';
  if (angle > Math.PI * 0.25 && angle <= Math.PI * 0.75) return 'down';
  if (angle > Math.PI * 0.75 || angle <= -Math.PI * 0.75) return 'left';
  return 'right';
}

function isInActionButton(px: number, py: number): boolean {
  const dx = px - vc.actionX;
  const dy = py - vc.actionY;
  return Math.sqrt(dx * dx + dy * dy) <= vc.actionRadius * 1.3;
}

canvas.addEventListener('pointerdown', (e) => {
  isMobile = true;
  vc = computeVirtualControls(canvas);
  const px = e.clientX;
  const py = e.clientY;

  // Language toggle button
  if (handleLangButtonClick(canvas, px, py)) return;

  if (state.scene === 'title' || state.scene === 'gameOver') {
    input.action = true;
    input.actionConsumed = false;
    return;
  }

  // Check d-pad
  const dDir = getDpadDir(px, py);
  if (dDir) {
    activeDpadDir = dDir;
    activeDpadPointerId = e.pointerId;
    setDirInput(dDir);
    moveRepeatTimer = 0;
    return;
  }

  // Check action button
  if (isInActionButton(px, py)) {
    activeActionPointerId = e.pointerId;
    input.action = true;
    input.actionConsumed = false;
    return;
  }

  // Swipe gesture for anywhere else on screen
  input.pointerDown = true;
  input.pointerStartX = px;
  input.pointerStartY = py;
});

canvas.addEventListener('pointermove', (e) => {
  if (activeDpadPointerId === e.pointerId) {
    const dDir = getDpadDir(e.clientX, e.clientY);
    if (dDir && dDir !== activeDpadDir) {
      clearDirInput();
      activeDpadDir = dDir;
      setDirInput(dDir);
      moveRepeatTimer = 0;
    }
  }

  if (input.pointerDown && activeDpadPointerId === null) {
    const dx = e.clientX - input.pointerStartX;
    const dy = e.clientY - input.pointerStartY;
    const threshold = 30;
    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      let dir: Direction;
      if (Math.abs(dx) > Math.abs(dy)) {
        dir = dx > 0 ? 'right' : 'left';
      } else {
        dir = dy > 0 ? 'down' : 'up';
      }
      clearDirInput();
      setDirInput(dir);
      input.pointerStartX = e.clientX;
      input.pointerStartY = e.clientY;
    }
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (activeDpadPointerId === e.pointerId) {
    clearDirInput();
    activeDpadDir = null;
    activeDpadPointerId = null;
  }
  if (activeActionPointerId === e.pointerId) {
    input.action = false;
    activeActionPointerId = null;
  }
  input.pointerDown = false;
});

canvas.addEventListener('pointercancel', (e) => {
  if (activeDpadPointerId === e.pointerId) {
    clearDirInput();
    activeDpadDir = null;
    activeDpadPointerId = null;
  }
  if (activeActionPointerId === e.pointerId) {
    input.action = false;
    activeActionPointerId = null;
  }
  input.pointerDown = false;
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function setDirInput(dir: Direction): void {
  input[dir] = true;
  input.moveConsumed = false;
}

function clearDirInput(): void {
  input.up = false;
  input.down = false;
  input.left = false;
  input.right = false;
}

// ---- Game Loop ----

let lastTime = 0;
let gameTime = 0;

function gameLoop(timestamp: number): void {
  const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
  lastTime = timestamp;
  gameTime += dt;

  // Handle mobile d-pad repeat
  if (activeDpadDir && isMobile) {
    moveRepeatTimer += dt;
    if (moveRepeatTimer >= MOVE_REPEAT_INTERVAL) {
      moveRepeatTimer -= MOVE_REPEAT_INTERVAL;
      input.moveConsumed = false;
    }
  }

  // Update
  update(state, dt, input);

  // Recompute layout
  const layout = computeLayout(canvas, state);
  vc = computeVirtualControls(canvas);

  // Render
  const rc: RenderContext = {
    ctx,
    canvas,
    cellSize: layout.cellSize,
    gridOffsetX: layout.gridOffsetX,
    gridOffsetY: layout.gridOffsetY,
    time: gameTime,
  };

  render(rc, state);
  renderVirtualControls(ctx, vc, isMobile);

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame((timestamp) => {
  lastTime = timestamp;
  gameLoop(timestamp);
});

// ---- Debug API ----

interface GameWindow extends Window {
  getGameState: () => DebugInfo;
}

(window as unknown as GameWindow).getGameState = () => getDebugInfo(state);

// Expose full state for testing
interface FullWindow extends Window {
  _gameState: typeof state;
}
(window as unknown as FullWindow)._gameState = state;
