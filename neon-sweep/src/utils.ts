import { PanelColor, Direction, Vec2 } from './types';

// ---- Color Palette ----

const PANEL_COLORS: readonly string[] = [
  '#00ffff', // 0: Cyan
  '#ff00ff', // 1: Magenta
  '#ffff00', // 2: Yellow
  '#00ff80', // 3: Green
  '#ff8800', // 4: Orange
];

const PANEL_COLORS_DIM: readonly string[] = [
  '#007777',
  '#770077',
  '#777700',
  '#007740',
  '#774400',
];

export function panelColorHex(c: PanelColor): string {
  return PANEL_COLORS[c];
}

export function panelColorDim(c: PanelColor): string {
  return PANEL_COLORS_DIM[c];
}

// ---- Shapes for each color (drawn inside panels for accessibility) ----

export function drawPanelShape(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: PanelColor
): void {
  ctx.save();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.7;
  switch (color) {
    case 0: // circle
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 1: // diamond
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.45);
      ctx.lineTo(cx + r * 0.35, cy);
      ctx.lineTo(cx, cy + r * 0.45);
      ctx.lineTo(cx - r * 0.35, cy);
      ctx.closePath();
      ctx.stroke();
      break;
    case 2: // star (5-point)
      drawStar(ctx, cx, cy, r * 0.45, 5);
      ctx.stroke();
      break;
    case 3: // triangle
      ctx.beginPath();
      ctx.moveTo(cx, cy - r * 0.45);
      ctx.lineTo(cx + r * 0.4, cy + r * 0.35);
      ctx.lineTo(cx - r * 0.4, cy + r * 0.35);
      ctx.closePath();
      ctx.stroke();
      break;
    case 4: // square
      ctx.strokeRect(cx - r * 0.3, cy - r * 0.3, r * 0.6, r * 0.6);
      break;
  }
  ctx.restore();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  points: number
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const radius = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ---- Easing ----

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  else if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  else if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  else return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

// ---- Direction Helpers ----

const DIR_OFFSETS: Record<Direction, Vec2> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function dirOffset(d: Direction): Vec2 {
  return DIR_OFFSETS[d];
}

export function oppositeDir(d: Direction): Direction {
  switch (d) {
    case 'up': return 'down';
    case 'down': return 'up';
    case 'left': return 'right';
    case 'right': return 'left';
  }
}

// ---- Random Helpers ----

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function randPanelColor(numColors: number): PanelColor {
  return Math.floor(Math.random() * numColors) as PanelColor;
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---- Drawing Utilities ----

export function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha: number
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawRoundedRect(
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

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
