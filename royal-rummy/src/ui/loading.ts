import { GAME_W, GAME_H } from "../types";
import { GAME_CONFIG } from "../game-config";
import { drawProgressBar, drawNameTag, drawTextWithShadow } from "./canvas-utils";

/**
 * Draw a loading overlay — accent spinner + horizontal progress bar
 * + percentage readout + status name tag.
 */
export function drawLoadingScreen(
  ctx: CanvasRenderingContext2D,
  progress?: number,
  message?: string
): void {
  const cx = GAME_W / 2;
  const cy = GAME_H / 2;
  const accent = GAME_CONFIG.accentColor;

  // Dark overlay
  ctx.fillStyle = "rgba(0,0,0,0.88)";
  ctx.fillRect(0, 0, GAME_W, GAME_H);

  // Circular spinner (above the bar)
  const time = performance.now() / 1000;
  const spinnerR = 34;
  const lineWidth = 5;
  const spinnerY = cy - 90;

  ctx.save();
  ctx.lineCap = "round";

  // Track
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.arc(cx, spinnerY, spinnerR, 0, Math.PI * 2);
  ctx.stroke();

  // Soft accent glow behind the arc
  ctx.shadowColor = accent;
  ctx.shadowBlur = 14;

  // Accent arc
  ctx.strokeStyle = accent;
  ctx.lineWidth = lineWidth;
  const startAngle = time * 3;
  const arcLength = Math.PI * 1.2;
  ctx.beginPath();
  ctx.arc(cx, spinnerY, spinnerR, startAngle, startAngle + arcLength);
  ctx.stroke();
  ctx.restore();

  // Progress bar
  const barW = 560;
  const barH = 30;
  const barX = cx - barW / 2;
  const barY = cy - 10;
  const p = progress ?? 0;
  drawProgressBar(ctx, barX, barY, barW, barH, p, {
    accent,
    glow: true,
    shimmer: true,
  });

  // Percentage (right-aligned inside / below the bar)
  if (progress !== undefined) {
    const pct = Math.round(p * 100);
    drawTextWithShadow(ctx, `${pct}%`, cx, barY + barH + 36, {
      font: "800 28px 'Helvetica Neue','Arial',sans-serif",
      color: "#fff",
      shadowColor: "rgba(0,0,0,0.85)",
      shadowBlur: 4,
    });
  }

  // Status name-tag (centered under the bar)
  if (message) {
    const padX = 26;
    const pillW = 4;
    const pillGap = 10;
    ctx.save();
    ctx.font = "800 24px 'Hiragino Sans','Yu Gothic','Helvetica Neue',sans-serif";
    const textW = ctx.measureText(message).width;
    ctx.restore();
    const tagW = Math.ceil(textW + padX * 2 + pillW + pillGap);
    drawNameTag(ctx, cx - tagW / 2, cy + 90, message, {
      accent,
      height: 50,
      fontSize: 24,
      paddingX: padX,
    });
  }
}
