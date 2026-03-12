import {
  GameState,
  FieldConfig,
  Ball,
  Particle,
  FloatingScore,
} from "./types";
import { getRadius, getNextValue, generateId, clamp, getBallColor, VALUES } from "./utils";
import { stepPhysics, createMergedBall } from "./physics";

const DANGER_TIMEOUT = 3.0;
const DROP_COOLDOWN = 0.5;
const COMBO_RESET_TIME = 1.5;

export function createField(canvasW: number, canvasH: number): FieldConfig {
  const fieldW = Math.min(canvasW * 0.55, 320);
  const fieldH = Math.min(canvasH * 0.82, 640);
  const fieldX = (canvasW - fieldW) / 2 - canvasW * 0.05;
  const fieldY = (canvasH - fieldH) / 2 + 20;
  const dangerY = fieldY + fieldH * 0.25;
  return {
    x: fieldX,
    y: fieldY,
    width: fieldW,
    height: fieldH,
    dangerY,
  };
}

export function createInitialState(field: FieldConfig, score: number = 0): GameState {
  const currentValue = getNextValue(score);
  const nextValue = getNextValue(score);
  return {
    phase: "title",
    balls: [],
    particles: [],
    floatingScores: [],
    comboIndicator: null,
    score: 0,
    highScore: 0,
    maxValue: 0,
    currentValue,
    nextValue,
    guideX: field.x + field.width / 2,
    dropCooldown: 0,
    dangerTimer: 0,
    dangerFlash: 0,
    comboCount: 0,
    comboResetTimer: 0,
    lastMergeTime: 0,
  };
}

export function startGame(state: GameState, field: FieldConfig): void {
  state.phase = "playing";
  state.balls = [];
  state.particles = [];
  state.floatingScores = [];
  state.comboIndicator = null;
  state.score = 0;
  state.maxValue = 0;
  state.currentValue = getNextValue(0);
  state.nextValue = getNextValue(0);
  state.guideX = field.x + field.width / 2;
  state.dropCooldown = 0;
  state.dangerTimer = 0;
  state.dangerFlash = 0;
  state.comboCount = 0;
  state.comboResetTimer = 0;
}

export function update(state: GameState, field: FieldConfig, dt: number): void {
  if (state.phase === "title" || state.phase === "gameover") return;

  // Update timers
  if (state.dropCooldown > 0) state.dropCooldown -= dt;
  if (state.comboResetTimer > 0) {
    state.comboResetTimer -= dt;
    if (state.comboResetTimer <= 0) {
      state.comboCount = 0;
    }
  }

  // Physics step
  const mergeRequests = stepPhysics(state.balls, field, dt);

  // Process merges
  for (const { a, b } of mergeRequests) {
    processMerge(state, field, a, b);
  }

  // Remove merged balls
  state.balls = state.balls.filter((b) => !b.merging);

  // Update particles
  for (const p of state.particles) {
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.vy += 0.02;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  // Update floating scores
  for (const fs of state.floatingScores) {
    fs.y += fs.vy * dt * 60;
    fs.life -= dt;
  }
  state.floatingScores = state.floatingScores.filter((fs) => fs.life > 0);

  // Update combo indicator
  if (state.comboIndicator) {
    state.comboIndicator.life -= dt;
    state.comboIndicator.scale = 1 + 0.3 * (state.comboIndicator.life / state.comboIndicator.maxLife);
    if (state.comboIndicator.life <= 0) {
      state.comboIndicator = null;
    }
  }

  // Danger check
  const danger = checkDanger(state, field);
  if (danger) {
    state.phase = "danger";
    state.dangerTimer += dt;
    state.dangerFlash += dt * 6;
    if (state.dangerTimer >= DANGER_TIMEOUT) {
      triggerGameOver(state);
    }
  } else {
    if (state.phase === "danger") {
      state.phase = "playing";
    }
    state.dangerTimer = 0;
    state.dangerFlash = 0;
  }
}

function processMerge(
  state: GameState,
  _field: FieldConfig,
  a: Ball,
  b: Ball
): void {
  const nextIdx = VALUES.indexOf(a.value) + 1;
  const isMaxMerge = nextIdx >= VALUES.length;
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;

  if (!isMaxMerge) {
    const newId = generateId();
    const merged = createMergedBall(a, b, newId);
    state.balls.push(merged);
  }
  // Max value merge: both balls disappear, no new ball created

  // Combo logic
  const now = Date.now() / 1000;
  if (now - state.lastMergeTime < COMBO_RESET_TIME) {
    state.comboCount++;
  } else {
    state.comboCount = 1;
  }
  state.lastMergeTime = now;
  state.comboResetTimer = COMBO_RESET_TIME;

  const combo = state.comboCount;
  const mergedValue = isMaxMerge ? a.value * 2 : a.value * 2;
  const baseScore = mergedValue;
  const totalScore = baseScore * combo;
  state.score += totalScore;
  if (mergedValue > state.maxValue) {
    state.maxValue = mergedValue;
  }
  if (state.score > state.highScore) {
    state.highScore = state.score;
  }

  // MEGA MERGE bonus
  if (a.value >= 1024) {
    state.score += 20000;
    if (state.score > state.highScore) state.highScore = state.score;
  }

  // Particles (extra for max merge)
  const particleCount = isMaxMerge ? 60 + combo * 10 : 20 + combo * 5;
  spawnParticles(state, midX, midY, a.value, particleCount);

  // Floating score
  const fs: FloatingScore = {
    x: midX,
    y: midY - 20,
    vy: -0.8,
    value: totalScore,
    life: 1.2,
    maxLife: 1.2,
    combo,
  };
  state.floatingScores.push(fs);

  // Combo indicator
  if (combo >= 2) {
    state.comboIndicator = {
      combo,
      life: 1.0,
      maxLife: 1.0,
      scale: 1.3,
    };
  }
}

function spawnParticles(
  state: GameState,
  x: number,
  y: number,
  value: number,
  count: number
): void {
  const color = getBallColor(value);
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const speed = 1.5 + Math.random() * 2.5;
    const p: Particle = {
      x,
      y,
      vx: Math.cos(angle) * speed * 0.016,
      vy: Math.sin(angle) * speed * 0.016 - 0.05,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 1.0,
      color: Math.random() < 0.3 ? "#ffffff" : color,
      size: 2 + Math.random() * 4,
    };
    state.particles.push(p);
  }
}

function checkDanger(state: GameState, field: FieldConfig): boolean {
  for (const ball of state.balls) {
    if (ball.y - ball.radius < field.dangerY && !ball.justDropped) {
      return true;
    }
  }
  return false;
}

function triggerGameOver(state: GameState): void {
  state.phase = "gameover";
}

export function dropBall(state: GameState, field: FieldConfig): void {
  if (state.dropCooldown > 0) return;
  if (state.phase !== "playing" && state.phase !== "danger") return;

  const value = state.currentValue;
  const radius = getRadius(value);
  const x = clamp(
    state.guideX,
    field.x + radius + 2,
    field.x + field.width - radius - 2
  );

  const ball: Ball = {
    id: generateId(),
    x,
    y: field.dangerY - radius - 2,
    vx: 0,
    vy: 0,
    radius,
    value,
    merging: false,
    justDropped: true,
    dropTimer: 0.6,
  };

  state.balls.push(ball);
  state.currentValue = state.nextValue;
  state.nextValue = getNextValue(state.score);
  state.dropCooldown = DROP_COOLDOWN;
}

export function setGuideX(state: GameState, field: FieldConfig, x: number): void {
  const minR = getRadius(VALUES[0]);
  state.guideX = clamp(x, field.x + minR, field.x + field.width - minR);
}

export function handleGameOverClick(
  state: GameState,
  field: FieldConfig,
  x: number,
  y: number
): boolean {
  const cx = field.x + field.width / 2;
  const cy = field.y + field.height / 2;
  const btnW = 180;
  const btnH = 50;
  const btnX = cx - btnW / 2;
  const btnY = cy + 145;

  if (x >= btnX && x <= btnX + btnW && y >= btnY && y <= btnY + btnH) {
    return true;
  }
  return false;
}
