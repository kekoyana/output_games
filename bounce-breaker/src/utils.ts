import type { Vec2 } from "./types";

/** ベクトルの長さ */
export function vecLen(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

/** ベクトルの正規化 */
export function vecNormalize(v: Vec2): Vec2 {
  const len = vecLen(v);
  if (len === 0) return { x: 0, y: -1 };
  return { x: v.x / len, y: v.y / len };
}

/** ベクトルのスカラー倍 */
export function vecScale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

/** ベクトルの加算 */
export function vecAdd(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

/** ベクトルの減算 */
export function vecSub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

/** ランダム整数 [min, max] */
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** ランダム浮動小数 [min, max) */
export function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/** 角度をクランプ（上方向に発射するように制限） */
export function clampAngle(angle: number): number {
  const minAngle = Math.PI * 0.05;  // ほぼ水平は禁止
  const maxAngle = Math.PI * 0.95;
  return Math.max(minAngle, Math.min(maxAngle, angle));
}

/** ネオンカラー配列 */
export const NEON_COLORS = [
  "#00ffff", // シアン
  "#ff00ff", // マゼンタ
  "#ffff00", // イエロー
  "#00ff80", // グリーン
  "#ff6600", // オレンジ
  "#ff3377", // ピンク
];

/** HPに応じた色を返す */
export function getBlockColor(hp: number): string {
  return NEON_COLORS[hp % NEON_COLORS.length];
}

/** 角丸矩形のパスを作成 */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
