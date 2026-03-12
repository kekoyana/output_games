// Hex Tower - メインゲームロジック

import { GameState, Particle, SwingBlock, HexBlock, DebugGameState } from "./types";
import {
  getNeonColor, drawHexagon, drawHexagonWithShadow,
  getBackgroundGradient, drawStars, drawBackgroundGrid,
  clamp, randRange, easeOutCubic, easeOutElastic, getLightColor,
} from "./utils";

const BLOCK_HEIGHT = 32;
const INITIAL_WIDTH = 160;
const MIN_WIDTH = 15;
const PERFECT_THRESHOLD = 12;
const PERFECT_RECOVER = 12;
const BASE_SWING_SPEED = 0.02;
const SWING_AMPLITUDE_START = 0.2;
const SWING_AMPLITUDE_MAX = 0.38;
const GRAVITY = 0.6;
const FALL_SPEED = 14;

let canvasW = 0;
let canvasH = 0;

// スクリーンシェイク
let shakeX = 0;
let shakeY = 0;
let shakeIntensity = 0;

// 着地エフェクト
let landFlashTimer = 0;
let landFlashColor = "#fff";

export function createInitialState(): GameState {
  const saved = localStorage.getItem("hexTowerHighScore");
  return {
    scene: "title",
    score: 0,
    highScore: saved ? parseInt(saved, 10) : 0,
    level: 0,
    combo: 0,
    tower: [],
    current: createSwingBlock(INITIAL_WIDTH, 0),
    particles: [],
    perfectEffect: null,
    cameraY: 0,
    gameOverTimer: 0,
    lastTime: 0,
  };
}

function createSwingBlock(width: number, level: number): SwingBlock {
  const speed = BASE_SWING_SPEED + level * 0.0012;
  return {
    x: canvasW / 2,
    width,
    angle: 0,
    speed: Math.min(speed, 0.08),
    falling: false,
    fallY: 0,
    color: getNeonColor(level),
  };
}

function getTopY(state: GameState): number {
  return canvasH - (state.tower.length + 1) * BLOCK_HEIGHT;
}

function getSwingY(_state: GameState): number {
  return 80;
}

export function startGame(state: GameState): void {
  state.scene = "playing";
  state.score = 0;
  state.level = 0;
  state.combo = 0;
  state.tower = [];
  state.particles = [];
  state.perfectEffect = null;
  state.cameraY = 0;
  state.gameOverTimer = 0;
  shakeIntensity = 0;
  landFlashTimer = 0;

  const baseBlock: HexBlock = {
    x: canvasW / 2,
    y: canvasH - BLOCK_HEIGHT / 2,
    width: INITIAL_WIDTH,
    height: BLOCK_HEIGHT,
    color: getNeonColor(0),
  };
  state.tower.push(baseBlock);
  state.level = 1;
  state.current = createSwingBlock(INITIAL_WIDTH, 1);
}

export function dropBlock(state: GameState): void {
  if (state.scene !== "playing" || state.current.falling) return;
  state.current.falling = true;
  state.current.fallY = getSwingY(state) + state.cameraY;
}

export function update(state: GameState, dt: number): void {
  if (state.scene === "playing") {
    updatePlaying(state, dt);
  } else if (state.scene === "gameover") {
    state.gameOverTimer += dt;
  }
  updateParticles(state, dt);
  updateShake(dt);
  if (landFlashTimer > 0) landFlashTimer -= dt / 16;
}

function updatePlaying(state: GameState, _dt: number): void {
  const current = state.current;
  const ampRatio = Math.min(SWING_AMPLITUDE_START + state.level * 0.008, SWING_AMPLITUDE_MAX);
  const amplitude = canvasW * ampRatio;

  if (!current.falling) {
    current.angle += current.speed;
    current.x = canvasW / 2 + Math.sin(current.angle) * amplitude;
  } else {
    const targetY = canvasH - state.tower.length * BLOCK_HEIGHT - BLOCK_HEIGHT / 2;
    current.fallY += FALL_SPEED;

    if (current.fallY >= targetY) {
      landBlock(state, targetY);
    }
  }

  const towerTop = canvasH - state.tower.length * BLOCK_HEIGHT;
  const targetCameraY = Math.max(0, (canvasH / 2) - towerTop);
  state.cameraY += (targetCameraY - state.cameraY) * 0.08;
}

function landBlock(state: GameState, targetY: number): void {
  const current = state.current;
  const topBlock = state.tower[state.tower.length - 1];

  const offset = current.x - topBlock.x;
  const absOffset = Math.abs(offset);
  const overlap = topBlock.width / 2 + current.width / 2 - absOffset;

  if (overlap <= 0) {
    triggerGameOver(state);
    return;
  }

  let newWidth: number;
  let newX: number;
  let isPerfect = false;

  if (absOffset <= PERFECT_THRESHOLD) {
    isPerfect = true;
    newWidth = Math.min(current.width + PERFECT_RECOVER, INITIAL_WIDTH);
    newX = topBlock.x;
    state.combo++;
  } else {
    const cutRatio = Math.min(0.5 + state.level * 0.02, 0.85);
    const cutAmount = (current.width - overlap) * cutRatio;
    newWidth = Math.max(current.width - cutAmount, overlap);
    state.combo = 0;

    const cutWidth = current.width - newWidth;
    const cutX = offset > 0
      ? current.x + newWidth / 2 + cutWidth / 2
      : current.x - newWidth / 2 - cutWidth / 2;
    spawnCutParticles(state, cutX, targetY, cutWidth, current.color);

    if (offset > 0) {
      newX = current.x - (current.width - newWidth) / 2;
    } else {
      newX = current.x + (current.width - newWidth) / 2;
    }

    // 着地シェイク（ズレが大きいほど揺れる）
    triggerShake(absOffset / 20);
  }

  const newBlock: HexBlock = {
    x: newX,
    y: targetY,
    width: newWidth,
    height: BLOCK_HEIGHT,
    color: current.color,
  };
  state.tower.push(newBlock);
  state.level = state.tower.length;

  const precisionBonus = isPerfect ? 2 + state.combo : 1;
  state.score += state.level * precisionBonus;

  // 着地フラッシュ
  landFlashTimer = 8;
  landFlashColor = current.color;

  if (isPerfect) {
    state.perfectEffect = { timer: 40, x: newX, y: targetY };
    spawnPerfectParticles(state, newX, targetY);
    // PERFECTの小さなシェイク（心地よい振動）
    triggerShake(2);
  }

  if (newWidth < MIN_WIDTH) {
    triggerGameOver(state);
    return;
  }

  state.current = createSwingBlock(newWidth, state.level);
}

function triggerGameOver(state: GameState): void {
  state.scene = "gameover";
  state.gameOverTimer = 0;
  if (state.score > state.highScore) {
    state.highScore = state.score;
    localStorage.setItem("hexTowerHighScore", String(state.highScore));
  }
  triggerShake(8);
  // 崩壊パーティクル（大量）
  for (const block of state.tower.slice(-8)) {
    spawnCutParticles(state, block.x, block.y, block.width, block.color);
    spawnCutParticles(state, block.x, block.y, block.width, block.color);
  }
}

function triggerShake(intensity: number): void {
  shakeIntensity = Math.max(shakeIntensity, intensity);
}

function updateShake(_dt: number): void {
  if (shakeIntensity > 0) {
    shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
    shakeY = (Math.random() - 0.5) * shakeIntensity * 2;
    shakeIntensity *= 0.88;
    if (shakeIntensity < 0.2) {
      shakeIntensity = 0;
      shakeX = 0;
      shakeY = 0;
    }
  }
}

function spawnCutParticles(state: GameState, x: number, y: number, width: number, color: string): void {
  for (let i = 0; i < 10; i++) {
    state.particles.push({
      x: x + randRange(-width / 2, width / 2),
      y: y + randRange(-BLOCK_HEIGHT / 2, BLOCK_HEIGHT / 2),
      vx: randRange(-4, 4),
      vy: randRange(-3, 5),
      life: 1,
      color,
      size: randRange(2, 6),
    });
  }
}

function spawnPerfectParticles(state: GameState, x: number, y: number): void {
  // 放射状パーティクル
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const speed = randRange(3, 7);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color: i % 2 === 0 ? "#ffffff" : "#ffe500",
      size: randRange(2, 5),
    });
  }
  // キラキラ（上方向）
  for (let i = 0; i < 8; i++) {
    state.particles.push({
      x: x + randRange(-30, 30),
      y: y + randRange(-10, 10),
      vx: randRange(-1, 1),
      vy: randRange(-6, -2),
      life: 1,
      color: "#ffffff",
      size: randRange(1, 3),
    });
  }
}

function updateParticles(state: GameState, _dt: number): void {
  for (const p of state.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += GRAVITY * 0.1;
    p.life -= 0.018;
    p.size *= 0.995;
  }
  state.particles = state.particles.filter((p) => p.life > 0);

  if (state.perfectEffect) {
    state.perfectEffect.timer--;
    if (state.perfectEffect.timer <= 0) {
      state.perfectEffect = null;
    }
  }
}

// ========== 描画 ==========

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  canvasW = ctx.canvas.width;
  canvasH = ctx.canvas.height;

  const time = performance.now();

  // 背景
  const altitude = state.tower.length;
  const bgGrad = getBackgroundGradient(ctx, canvasW, canvasH, altitude);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // 星（きらめき付き）
  drawStars(ctx, canvasW, canvasH, altitude, time);

  // 背景グリッド
  drawBackgroundGrid(ctx, canvasW, canvasH, state.cameraY, altitude);

  // 着地フラッシュ
  if (landFlashTimer > 0) {
    const flashAlpha = (landFlashTimer / 8) * 0.08;
    ctx.fillStyle = landFlashColor;
    ctx.globalAlpha = flashAlpha;
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.globalAlpha = 1;
  }

  // スクリーンシェイク適用
  ctx.save();
  ctx.translate(shakeX, shakeY);

  ctx.save();
  ctx.translate(0, state.cameraY);

  // タワー描画（下から上へ、フェード付き）
  for (let i = 0; i < state.tower.length; i++) {
    const block = state.tower[i];
    const screenY = block.y + state.cameraY;

    // 画面外はスキップ
    if (screenY < -50 || screenY > canvasH + 50) continue;

    // 下の方のブロックはやや暗く
    const depthFade = clamp(0.5 + (i / state.tower.length) * 0.5, 0.4, 1);
    drawHexagonWithShadow(ctx, block.x, block.y, block.width, block.height, block.color, depthFade);
  }

  // 落下中のブロック
  if (state.scene === "playing" && state.current.falling) {
    const c = state.current;
    // 落下中はモーションブラー風の残像
    ctx.globalAlpha = 0.3;
    drawHexagon(ctx, c.x, c.fallY - 8, c.width, BLOCK_HEIGHT, c.color);
    ctx.globalAlpha = 0.15;
    drawHexagon(ctx, c.x, c.fallY - 16, c.width, BLOCK_HEIGHT, c.color);
    ctx.globalAlpha = 1;
    drawHexagon(ctx, c.x, c.fallY, c.width, BLOCK_HEIGHT, c.color, "#ffffff44");
  }

  // パーティクル
  for (const p of state.particles) {
    ctx.globalAlpha = p.life * p.life; // 二次カーブで消える
    ctx.save();
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // PERFECTフラッシュ
  if (state.perfectEffect) {
    const ef = state.perfectEffect;
    const progress = 1 - ef.timer / 40;
    const alpha = (1 - progress) * 0.25;
    const radius = easeOutCubic(progress) * 200;

    // 放射状グラデーション
    const grad = ctx.createRadialGradient(ef.x, ef.y, 0, ef.x, ef.y, radius);
    grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
    grad.addColorStop(0.5, `rgba(255,229,0,${alpha * 0.5})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(ef.x - radius, ef.y - radius, radius * 2, radius * 2);

    // リング
    if (progress < 0.6) {
      const ringRadius = easeOutCubic(progress / 0.6) * 120;
      ctx.strokeStyle = `rgba(255,255,255,${(1 - progress / 0.6) * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ef.x, ef.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore(); // cameraY

  // 揺れているブロック（カメラ影響なし）
  if (state.scene === "playing" && !state.current.falling) {
    const c = state.current;
    const swingY = getSwingY(state);

    // 落下ガイドライン（グラデーションで消える）
    const lineGrad = ctx.createLinearGradient(0, swingY + BLOCK_HEIGHT / 2, 0, canvasH);
    lineGrad.addColorStop(0, `rgba(255,255,255,0.12)`);
    lineGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = lineGrad;
    ctx.setLineDash([4, 8]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c.x, swingY + BLOCK_HEIGHT / 2);
    ctx.lineTo(c.x, canvasH);
    ctx.stroke();
    ctx.setLineDash([]);

    // ブロック本体（グロー強め）
    drawHexagon(ctx, c.x, swingY, c.width, BLOCK_HEIGHT, c.color, "#ffffff44");

    // ブロック幅のインジケーター（小さくなっていく警告）
    if (c.width < INITIAL_WIDTH * 0.4) {
      const danger = 1 - c.width / (INITIAL_WIDTH * 0.4);
      const pulse = 0.5 + Math.sin(time / 150) * 0.5;
      ctx.strokeStyle = `rgba(255,50,50,${danger * pulse * 0.6})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x - c.width / 2 - 4, swingY - BLOCK_HEIGHT / 2 - 4,
        c.width + 8, BLOCK_HEIGHT + 8);
    }
  }

  ctx.restore(); // shake

  // UI描画（シェイクの影響を受けない）
  drawUI(ctx, state, time);

  if (state.scene === "title") {
    drawTitleScreen(ctx, state, time);
  } else if (state.scene === "gameover") {
    drawGameOverScreen(ctx, state, time);
  }
}

function drawUI(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  if (state.scene !== "playing") return;

  // スコア（シャドウ付き）
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px 'Helvetica Neue', 'Arial', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`${state.score}`, 20, 36);

  ctx.font = "12px 'Helvetica Neue', 'Arial', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("SCORE", 20, 52);

  // 段数
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px 'Helvetica Neue', 'Arial', sans-serif";
  ctx.fillText(`${state.level}`, canvasW - 20, 36);

  ctx.font = "12px 'Helvetica Neue', 'Arial', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("LEVEL", canvasW - 20, 52);

  ctx.restore();

  // コンボ表示（アニメーション付き）
  if (state.combo >= 2) {
    const comboScale = 1 + Math.sin(time / 200) * 0.08;
    ctx.save();
    ctx.textAlign = "center";
    ctx.translate(canvasW / 2, 48);
    ctx.scale(comboScale, comboScale);
    ctx.shadowColor = "#ffe500";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffe500";
    ctx.font = "bold 20px 'Helvetica Neue', 'Arial', sans-serif";
    ctx.fillText(`${state.combo}x COMBO`, 0, 0);
    ctx.restore();
  }

  // PERFECT テキスト（フェードアウト + スケール）
  if (state.perfectEffect && state.perfectEffect.timer > 10) {
    const progress = 1 - state.perfectEffect.timer / 40;
    const scale = easeOutElastic(Math.min(progress * 2, 1));
    const alpha = state.perfectEffect.timer > 20 ? 1 : state.perfectEffect.timer / 20;

    ctx.save();
    ctx.textAlign = "center";
    ctx.globalAlpha = alpha;
    ctx.translate(canvasW / 2, canvasH / 2 - 60);
    ctx.scale(scale, scale);
    ctx.shadowColor = "#ffe500";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px 'Helvetica Neue', 'Arial', sans-serif";
    ctx.fillText("PERFECT!", 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function drawTitleScreen(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  // 半透明オーバーレイ
  ctx.fillStyle = "rgba(5,8,25,0.75)";
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.textAlign = "center";

  // 装飾ライン
  const lineY = canvasH / 2 - 100;
  const lineWidth = 180;
  ctx.strokeStyle = "rgba(0,229,255,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(canvasW / 2 - lineWidth, lineY);
  ctx.lineTo(canvasW / 2 + lineWidth, lineY);
  ctx.stroke();

  // タイトル（グロー付き）
  ctx.save();
  ctx.shadowColor = "#00e5ff";
  ctx.shadowBlur = 30;
  ctx.fillStyle = "#00e5ff";
  ctx.font = "bold 52px 'Helvetica Neue', 'Arial', sans-serif";
  ctx.fillText("HEX TOWER", canvasW / 2, canvasH / 2 - 55);
  ctx.restore();

  // サブタイトル
  ctx.fillStyle = "#ff00e5";
  ctx.font = "16px 'Helvetica Neue', 'Arial', sans-serif";
  ctx.fillText("六角ブロックを積み上げろ！", canvasW / 2, canvasH / 2 - 15);

  // 装飾ライン
  ctx.strokeStyle = "rgba(255,0,229,0.3)";
  ctx.beginPath();
  ctx.moveTo(canvasW / 2 - lineWidth, canvasH / 2);
  ctx.lineTo(canvasW / 2 + lineWidth, canvasH / 2);
  ctx.stroke();

  // 操作説明
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "14px 'Helvetica Neue', 'Arial', sans-serif";
  ctx.fillText("タップ / クリック / Space で落下", canvasW / 2, canvasH / 2 + 40);

  // スタートボタン風
  const pulse = 0.6 + Math.sin(time / 400) * 0.4;
  ctx.globalAlpha = pulse;
  ctx.save();
  ctx.shadowColor = "#ffe500";
  ctx.shadowBlur = 15;
  ctx.fillStyle = "#ffe500";
  ctx.font = "bold 22px 'Helvetica Neue', 'Arial', sans-serif";
  ctx.fillText("タップしてスタート", canvasW / 2, canvasH / 2 + 90);
  ctx.restore();
  ctx.globalAlpha = 1;

  // ハイスコア
  if (state.highScore > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "13px 'Helvetica Neue', 'Arial', sans-serif";
    ctx.fillText(`BEST: ${state.highScore}`, canvasW / 2, canvasH / 2 + 130);
  }
}

function drawGameOverScreen(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  const alpha = clamp(state.gameOverTimer / 600, 0, 0.8);
  ctx.fillStyle = `rgba(5,5,15,${alpha})`;
  ctx.fillRect(0, 0, canvasW, canvasH);

  if (state.gameOverTimer < 400) return;

  const uiProgress = clamp((state.gameOverTimer - 400) / 400, 0, 1);
  const uiAlpha = easeOutCubic(uiProgress);
  ctx.globalAlpha = uiAlpha;
  ctx.textAlign = "center";

  // GAME OVER テキスト
  ctx.save();
  ctx.shadowColor = "#ff00e5";
  ctx.shadowBlur = 25;
  ctx.fillStyle = "#ff00e5";
  ctx.font = "bold 44px 'Helvetica Neue', 'Arial', sans-serif";
  const goScale = easeOutElastic(Math.min(uiProgress * 1.5, 1));
  ctx.translate(canvasW / 2, canvasH / 2 - 70);
  ctx.scale(goScale, goScale);
  ctx.fillText("GAME OVER", 0, 0);
  ctx.restore();
  ctx.globalAlpha = uiAlpha;

  // スコア
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 28px 'Helvetica Neue', 'Arial', sans-serif";
  ctx.fillText(`${state.score}`, canvasW / 2, canvasH / 2 - 10);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "12px 'Helvetica Neue', 'Arial', sans-serif";
  ctx.fillText("SCORE", canvasW / 2, canvasH / 2 + 8);

  // 統計
  ctx.fillStyle = "#ffe500";
  ctx.font = "16px 'Helvetica Neue', 'Arial', sans-serif";
  ctx.fillText(`${state.level} 段  ·  最大コンボ ${state.combo}`, canvasW / 2, canvasH / 2 + 42);

  // ハイスコア更新
  if (state.score >= state.highScore && state.highScore > 0) {
    const sparkle = 0.7 + Math.sin(time / 300) * 0.3;
    ctx.save();
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 12;
    ctx.globalAlpha = uiAlpha * sparkle;
    ctx.fillStyle = "#00e5ff";
    ctx.font = "bold 18px 'Helvetica Neue', 'Arial', sans-serif";
    ctx.fillText("★ NEW BEST! ★", canvasW / 2, canvasH / 2 + 75);
    ctx.restore();
    ctx.globalAlpha = uiAlpha;
  } else if (state.highScore > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "13px 'Helvetica Neue', 'Arial', sans-serif";
    ctx.fillText(`BEST: ${state.highScore}`, canvasW / 2, canvasH / 2 + 75);
  }

  // リトライ
  if (state.gameOverTimer > 600) {
    const pulse = 0.5 + Math.sin(time / 400) * 0.5;
    ctx.globalAlpha = uiAlpha * pulse;
    ctx.save();
    ctx.shadowColor = "#ffe500";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffe500";
    ctx.font = "bold 20px 'Helvetica Neue', 'Arial', sans-serif";
    ctx.fillText("タップしてリトライ", canvasW / 2, canvasH / 2 + 130);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// デバッグAPI
export function getDebugState(state: GameState): DebugGameState {
  return {
    scene: state.scene,
    score: state.score,
    highScore: state.highScore,
    level: state.level,
    combo: state.combo,
    towerHeight: state.tower.length,
    currentBlockWidth: state.current.width,
    currentBlockX: state.current.x,
  };
}

export function setCanvasSize(w: number, h: number): void {
  canvasW = w;
  canvasH = h;
}
