import type { Rect, Point } from './types';

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function choose<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function pointInRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function drawRoundRect(
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
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export function drawButton(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  label: string,
  bgColor: string,
  textColor: string,
  fontSize: number = 18,
  radius: number = 8
): void {
  drawRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = `bold ${fontSize}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  color: string,
  align: CanvasTextAlign = 'left',
  baseline: CanvasTextBaseline = 'top'
): void {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

export function drawPanel(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  bgColor: string,
  borderColor: string,
  radius: number = 10
): void {
  drawRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, radius);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawHpBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  current: number,
  max: number,
  color: string
): void {
  const ratio = clamp(current / max, 0, 1);
  const r = Math.min(h / 2, 4);

  // ベースカラーに基づいてHP割合で色を変化させる
  // 敵（赤系 #e74c3c）と味方（緑系 #2ecc71）で異なるパレット
  const isEnemy = color === '#e74c3c';
  let barColorTop: string;
  let barColorBot: string;
  if (ratio <= 0.25) {
    // 瀕死: 共通で暗い赤
    barColorTop = '#ff4444';
    barColorBot = '#881111';
  } else if (ratio <= 0.5) {
    // 半分以下: 敵はオレンジ系、味方は黄色系
    barColorTop = isEnemy ? '#e67e22' : '#f1c40f';
    barColorBot = isEnemy ? '#a05510' : '#b8860b';
  } else {
    // 通常: 敵は赤系、味方は緑系
    barColorTop = isEnemy ? '#e74c3c' : '#2ecc71';
    barColorBot = isEnemy ? '#992222' : '#1a7a44';
  }

  // 外枠: ベベル風二重線（暗い下枠 + 明るい上枠）
  ctx.save();
  drawRoundRect(ctx, x - 1, y - 1, w + 2, h + 2, r + 1);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  ctx.stroke();
  drawRoundRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 背景（暗い溝）
  drawRoundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();

  // HPバー本体グラデーション
  if (ratio > 0) {
    const barW = w * ratio;
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, barColorTop);
    grad.addColorStop(1, barColorBot);
    drawRoundRect(ctx, x, y, barW, h, r);
    ctx.fillStyle = grad;
    ctx.fill();

    // 斜めストライプ（高級感）
    ctx.save();
    drawRoundRect(ctx, x, y, barW, h, r);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 3;
    const stripeSpacing = 8;
    for (let sx = x - h; sx < x + barW + h; sx += stripeSpacing) {
      ctx.beginPath();
      ctx.moveTo(sx, y + h);
      ctx.lineTo(sx + h, y);
      ctx.stroke();
    }
    ctx.restore();

    // 光沢ハイライト（上部）
    const hlGrad = ctx.createLinearGradient(x, y, x, y + h * 0.55);
    hlGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
    hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    drawRoundRect(ctx, x, y, barW, h * 0.55, r);
    ctx.fillStyle = hlGrad;
    ctx.fill();
  }

  ctx.restore();
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  font: string,
  color: string
): void {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const words = text.split('');
  let line = '';
  let currentY = y;

  for (const char of words) {
    const testLine = line + char;
    if (ctx.measureText(testLine).width > maxWidth && line !== '') {
      ctx.fillText(line, x, currentY);
      line = char;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
}
