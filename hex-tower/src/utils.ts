// ユーティリティ関数

const NEON_COLORS = [
  "#00e5ff", // シアン
  "#ff00e5", // マゼンタ
  "#ffe500", // イエロー
  "#00ff88", // グリーン
  "#ff6600", // オレンジ
  "#aa66ff", // パープル
  "#ff3366", // ピンク
];

export function getNeonColor(index: number): string {
  return NEON_COLORS[index % NEON_COLORS.length];
}

/** ネオンカラーを暗くしたバージョン */
export function getDarkColor(color: string): string {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgb(${Math.floor(r * 0.3)},${Math.floor(g * 0.3)},${Math.floor(b * 0.3)})`;
}

/** ネオンカラーを明るくしたバージョン */
export function getLightColor(color: string, factor: number = 0.5): string {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const lr = Math.min(255, Math.floor(r + (255 - r) * factor));
  const lg = Math.min(255, Math.floor(g + (255 - g) * factor));
  const lb = Math.min(255, Math.floor(b + (255 - b) * factor));
  return `rgb(${lr},${lg},${lb})`;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 六角形のパスを作成（再利用用） */
function hexPath(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  width: number, height: number
): void {
  const hw = width / 2;
  const hh = height / 2;
  const inset = width * 0.15;
  ctx.beginPath();
  ctx.moveTo(cx - hw + inset, cy - hh);
  ctx.lineTo(cx + hw - inset, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx + hw - inset, cy + hh);
  ctx.lineTo(cx - hw + inset, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
}

/** グロー付き六角形を描画 */
export function drawHexagon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
  fillColor: string,
  strokeColor?: string
): void {
  // グロー（外側の光）
  ctx.save();
  ctx.shadowColor = fillColor;
  ctx.shadowBlur = 12;
  hexPath(ctx, cx, cy, width, height);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.restore();

  // メインのグラデーション塗り
  hexPath(ctx, cx, cy, width, height);
  const grad = ctx.createLinearGradient(cx, cy - height / 2, cx, cy + height / 2);
  grad.addColorStop(0, getLightColor(fillColor, 0.35));
  grad.addColorStop(0.4, fillColor);
  grad.addColorStop(1, getDarkColor(fillColor));
  ctx.fillStyle = grad;
  ctx.fill();

  // 上面ハイライト（光沢感）
  hexPath(ctx, cx, cy - 2, width - 6, height * 0.45);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fill();

  // 枠線
  if (strokeColor) {
    hexPath(ctx, cx, cy, width, height);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/** 影付き六角形（タワーブロック用） */
export function drawHexagonWithShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
  fillColor: string,
  alpha: number = 1
): void {
  ctx.globalAlpha = alpha;

  // 底面の影
  hexPath(ctx, cx + 2, cy + 3, width, height);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fill();

  // 本体
  drawHexagon(ctx, cx, cy, width, height, fillColor, "rgba(255,255,255,0.08)");

  ctx.globalAlpha = 1;
}

/** 背景グラデーション（高度に応じて変化） */
export function getBackgroundGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  altitude: number
): CanvasGradient {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  const t = clamp(altitude / 50, 0, 1);

  // より深みのある宇宙的グラデーション
  const r1 = Math.round(lerp(8, 1, t));
  const g1 = Math.round(lerp(12, 1, t));
  const b1 = Math.round(lerp(35, 15, t));
  const r2 = Math.round(lerp(15, 8, t));
  const g2 = Math.round(lerp(20, 5, t));
  const b2 = Math.round(lerp(55, 40, t));

  grad.addColorStop(0, `rgb(${r1},${g1},${b1})`);
  grad.addColorStop(0.5, `rgb(${Math.round((r1 + r2) / 2)},${Math.round((g1 + g2) / 2)},${Math.round((b1 + b2) / 2)})`);
  grad.addColorStop(1, `rgb(${r2},${g2},${b2})`);
  return grad;
}

/** 背景の星を描画（パララックス＋きらめき） */
export function drawStars(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  altitude: number,
  time: number
): void {
  const starCount = Math.min(20 + altitude * 3, 100);
  let seed = 42;

  for (let i = 0; i < starCount; i++) {
    seed = (seed * 16807 + 0) % 2147483647;
    const sx = seed % w;
    seed = (seed * 16807 + 0) % 2147483647;
    const sy = seed % h;
    seed = (seed * 16807 + 0) % 2147483647;
    const baseBrightness = 0.2 + (seed % 60) / 100;
    seed = (seed * 16807 + 0) % 2147483647;
    const twinkleSpeed = 0.001 + (seed % 100) / 30000;
    seed = (seed * 16807 + 0) % 2147483647;
    const size = 0.5 + (seed % 100) / 60;

    // きらめき
    const twinkle = Math.sin(time * twinkleSpeed + i * 1.7) * 0.3 + 0.7;
    const brightness = baseBrightness * twinkle;

    ctx.globalAlpha = brightness;
    ctx.fillStyle = i % 7 === 0 ? "#aaccff" : i % 11 === 0 ? "#ffddaa" : "#fff";
    ctx.beginPath();
    ctx.arc(sx, sy, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** 背景グリッドライン（奥行き感） */
export function drawBackgroundGrid(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  cameraY: number,
  altitude: number
): void {
  const alpha = clamp(0.03 + altitude * 0.001, 0, 0.08);
  ctx.strokeStyle = `rgba(100,150,255,${alpha})`;
  ctx.lineWidth = 0.5;

  const spacing = 60;
  const offsetY = cameraY % spacing;

  for (let y = -spacing + offsetY; y < h + spacing; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

/** ランダム範囲 */
export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** イージング: easeOutCubic */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** イージング: easeOutElastic */
export function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
}
