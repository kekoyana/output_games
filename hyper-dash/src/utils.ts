// ユーティリティ関数

import type { Lane, Particle, SpeedLine } from "./types";

// レーンのX座標を正規化した値（-1, 0, 1）から画面比率（0~1）へ変換
export function laneToNorm(lane: number): number {
  return 0.5 + lane * 0.22;
}

// 奥行き(depth: 0=遠, 1=手前)から画面Y座標(比率)へ
export function depthToY(depth: number, canvasH: number): number {
  // 消失点は画面上部30%付近
  const vanishY = canvasH * 0.3;
  const groundY = canvasH * 0.85;
  return vanishY + (groundY - vanishY) * depth;
}

// 奥行きからスケールへ（負値を防ぐ）
export function depthToScale(depth: number): number {
  return Math.max(0.01, 0.15 + depth * 0.85);
}

// レーンと奥行きから画面X座標へ（パースペクティブ考慮）
export function laneDepthToX(lane: Lane, depth: number, canvasW: number): number {
  const vanishX = canvasW * 0.5;
  const norm = laneToNorm(lane);
  const groundX = norm * canvasW;
  return vanishX + (groundX - vanishX) * depth;
}

// 線形補間
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// イーズアウト補間
export function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ランダム範囲
export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ランダム整数
export function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

// パーティクル生成
export function spawnParticles(
  particles: Particle[],
  x: number,
  y: number,
  count: number,
  color: string
): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + rand(-0.3, 0.3);
    const speed = rand(2, 7);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      color,
      size: rand(3, 8),
    });
  }
}

// 速度線生成
export function spawnSpeedLines(lines: SpeedLine[], canvasW: number, canvasH: number): void {
  // 左右の端に速度線を追加
  for (let i = 0; i < 3; i++) {
    const side = Math.random() < 0.5 ? 0 : 1;
    lines.push({
      x: side === 0 ? rand(0, canvasW * 0.15) : rand(canvasW * 0.85, canvasW),
      y: rand(canvasH * 0.2, canvasH * 0.9),
      length: rand(40, 120),
      alpha: rand(0.3, 0.8),
    });
  }
  // 最大20本に制限
  if (lines.length > 20) {
    lines.splice(0, lines.length - 20);
  }
}

// グロー描画ヘルパー
export function drawGlow(
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,
  fn: () => void
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  fn();
  ctx.restore();
}

// 六角形パス
export function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    if (i === 0) ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
    else ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
  }
  ctx.closePath();
}
