import { GameState, FieldConfig, Ball } from "./types";
import { getBallColor, getBallGlow, getRadius } from "./utils";

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  field: FieldConfig,
  canvasW: number,
  canvasH: number
): void {
  ctx.fillStyle = "#050510";
  ctx.fillRect(0, 0, canvasW, canvasH);

  drawField(ctx, field, state);
  drawDangerLine(ctx, field, state);
  drawBalls(ctx, state.balls);
  drawParticles(ctx, state);
  drawFloatingScores(ctx, state);
  drawComboIndicator(ctx, state, canvasW, canvasH);
  drawGuide(ctx, state, field);
  drawHUD(ctx, state, field, canvasW);
}

function drawField(
  ctx: CanvasRenderingContext2D,
  field: FieldConfig,
  state: GameState
): void {
  ctx.fillStyle = "rgba(10,10,40,0.9)";
  ctx.fillRect(field.x, field.y, field.width, field.height);

  const glowColor =
    state.phase === "danger"
      ? `rgba(255,50,50,${0.4 + 0.4 * Math.abs(Math.sin(state.dangerFlash))})`
      : "rgba(100,100,255,0.3)";

  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 3;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 12;
  ctx.strokeRect(field.x, field.y, field.width, field.height);
  ctx.shadowBlur = 0;
}

function drawDangerLine(
  ctx: CanvasRenderingContext2D,
  field: FieldConfig,
  state: GameState
): void {
  const alpha =
    state.phase === "danger"
      ? 0.6 + 0.4 * Math.abs(Math.sin(state.dangerFlash))
      : 0.4;

  ctx.save();
  ctx.strokeStyle = `rgba(255,60,60,${alpha})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.shadowColor = "rgba(255,60,60,0.8)";
  ctx.shadowBlur = state.phase === "danger" ? 10 : 4;
  ctx.beginPath();
  ctx.moveTo(field.x, field.dangerY);
  ctx.lineTo(field.x + field.width, field.dangerY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = `rgba(255,80,80,${alpha})`;
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("危険ライン", field.x + field.width - 4, field.dangerY - 4);
  ctx.restore();
}

function drawBalls(ctx: CanvasRenderingContext2D, balls: Ball[]): void {
  for (const ball of balls) {
    drawBall(ctx, ball);
  }
}

function drawBall(ctx: CanvasRenderingContext2D, ball: Ball): void {
  const color = getBallColor(ball.value);
  const glow = getBallGlow(ball.value);

  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = ball.value >= 512 ? 20 : 12;

  const grad = ctx.createRadialGradient(
    ball.x - ball.radius * 0.3,
    ball.y - ball.radius * 0.3,
    ball.radius * 0.1,
    ball.x,
    ball.y,
    ball.radius
  );

  if (ball.value === 1024) {
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.4, "#ffffaa");
    grad.addColorStop(0.8, "#ffaa44");
    grad.addColorStop(1, "rgba(255,100,0,0.8)");
  } else if (ball.value === 512) {
    const t = Date.now() / 800;
    const r = Math.floor(128 + 127 * Math.sin(t));
    const g = Math.floor(128 + 127 * Math.sin(t + 2.1));
    const b2 = Math.floor(128 + 127 * Math.sin(t + 4.2));
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.5, `rgb(${r},${g},${b2})`);
    grad.addColorStop(1, `rgba(${r},${g},${b2},0.6)`);
  } else {
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.3, color);
    grad.addColorStop(1, `${color}88`);
  }

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.shadowBlur = 0;

  const fontSize =
    ball.radius > 30
      ? Math.floor(ball.radius * 0.55)
      : Math.floor(ball.radius * 0.65);
  ctx.fillStyle = ball.value === 1 ? "#222" : "#fff";
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 3;
  ctx.fillText(ball.value.toString(), ball.x, ball.y);

  ctx.restore();
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  state: GameState
): void {
  for (const p of state.particles) {
    const alpha = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawFloatingScores(
  ctx: CanvasRenderingContext2D,
  state: GameState
): void {
  for (const fs of state.floatingScores) {
    const alpha = fs.life / fs.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#ffd700";
    ctx.strokeStyle = "#ff8800";
    ctx.lineWidth = 3;
    ctx.font = `bold ${fs.combo > 1 ? 22 : 16}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#ffd700";
    ctx.shadowBlur = 8;
    const text = fs.combo > 1 ? `+${fs.value} x${fs.combo}!` : `+${fs.value}`;
    ctx.strokeText(text, fs.x, fs.y);
    ctx.fillText(text, fs.x, fs.y);
    ctx.restore();
  }
}

function drawComboIndicator(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasW: number,
  canvasH: number
): void {
  if (!state.comboIndicator) return;
  const ci = state.comboIndicator;
  const alpha = ci.life / ci.maxLife;
  ctx.save();
  ctx.globalAlpha = alpha * 0.9;
  ctx.translate(canvasW / 2, canvasH / 2);
  ctx.scale(ci.scale, ci.scale);
  ctx.font = "bold 64px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "#ff4400";
  ctx.lineWidth = 6;
  ctx.shadowColor = "#ff8800";
  ctx.shadowBlur = 20;
  const text = `COMBO x${ci.combo}!`;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = "#ffdd00";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawGuide(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  field: FieldConfig
): void {
  if (state.phase !== "playing" && state.phase !== "danger") return;

  const gx = state.guideX;
  const topY = field.y;

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(gx, topY);
  ctx.lineTo(gx, field.dangerY + 20);
  ctx.stroke();
  ctx.setLineDash([]);

  const curR = getRadius(state.currentValue);
  const previewY = topY - curR - 8;
  drawBallAt(ctx, gx, previewY, curR, state.currentValue, 0.85);
  ctx.restore();
}

function drawBallAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  value: number,
  alpha: number
): void {
  const color = getBallColor(value);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const fontSize = Math.floor(r * 0.65);
  ctx.fillStyle = value === 1 ? "#222" : "#fff";
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(value.toString(), x, y);
  ctx.restore();
}

function drawHUD(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  field: FieldConfig,
  canvasW: number
): void {
  const sx = field.x + field.width + 12;
  const sy = field.y;
  const sw = canvasW - sx - 10;
  if (sw < 60) return;

  ctx.save();
  ctx.textAlign = "left";

  ctx.fillStyle = "rgba(255,255,100,0.7)";
  ctx.font = "11px sans-serif";
  ctx.fillText("スコア", sx, sy + 16);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(state.score.toLocaleString(), sx, sy + 36);

  ctx.fillStyle = "rgba(255,255,100,0.7)";
  ctx.font = "11px sans-serif";
  ctx.fillText("ベスト", sx, sy + 58);
  ctx.fillStyle = "#aaf";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(state.highScore.toLocaleString(), sx, sy + 76);

  ctx.fillStyle = "rgba(255,255,100,0.7)";
  ctx.font = "11px sans-serif";
  ctx.fillText("最大値", sx, sy + 100);
  ctx.fillStyle = "#ffd700";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(state.maxValue.toLocaleString(), sx, sy + 118);

  ctx.fillStyle = "rgba(255,255,100,0.7)";
  ctx.font = "11px sans-serif";
  ctx.fillText("NEXT", sx, sy + 144);

  const previewCx = sx + sw / 2;
  const previewCy = sy + 180;
  const previewR = Math.min(sw / 2 - 8, 30);
  drawBallAt(ctx, previewCx, previewCy, previewR, state.nextValue, 1.0);

  ctx.restore();
}

export function drawTitle(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number
): void {
  ctx.fillStyle = "#050510";
  ctx.fillRect(0, 0, canvasW, canvasH);

  const cx = canvasW / 2;
  const cy = canvasH / 2;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#ffd700";
  ctx.font = "bold 40px sans-serif";
  ctx.shadowColor = "#ffa500";
  ctx.shadowBlur = 20;
  ctx.fillText("Merge Drop", cx, cy - 80);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#88aaff";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText("数字合体パズル", cx, cy - 40);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "14px sans-serif";
  ctx.fillText("同じ数字のボールをぶつけて合体！", cx, cy + 10);
  ctx.fillText("積み上がって天井を超えるとゲームオーバー", cx, cy + 36);

  const blink = Math.floor(Date.now() / 500) % 2 === 0;
  if (blink) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px sans-serif";
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 10;
    ctx.fillText("タップ / クリックでスタート", cx, cy + 90);
  }

  ctx.restore();
}

export function drawGameOver(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasW: number,
  canvasH: number,
  field: FieldConfig
): void {
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, 0, canvasW, canvasH);

  const cx = field.x + field.width / 2;
  const cy = field.y + field.height / 2;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#ff4444";
  ctx.font = "bold 36px sans-serif";
  ctx.shadowColor = "#ff0000";
  ctx.shadowBlur = 20;
  ctx.fillText("GAME OVER", cx, cy - 100);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffd700";
  ctx.font = "16px sans-serif";
  ctx.fillText("スコア", cx, cy - 54);
  ctx.font = "bold 32px sans-serif";
  ctx.fillText(state.score.toLocaleString(), cx, cy - 28);

  ctx.fillStyle = "#aaaaff";
  ctx.font = "14px sans-serif";
  ctx.fillText("ハイスコア", cx, cy + 10);
  ctx.font = "bold 24px sans-serif";
  ctx.fillText(state.highScore.toLocaleString(), cx, cy + 34);

  ctx.fillStyle = "#ffdd44";
  ctx.font = "14px sans-serif";
  ctx.fillText("最大値", cx, cy + 66);
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(state.maxValue.toLocaleString(), cx, cy + 88);

  if (state.maxValue >= 1024) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.shadowColor = "#ffaa00";
    ctx.shadowBlur = 15;
    ctx.fillText("MEGA MERGE 達成！", cx, cy + 116);
    ctx.shadowBlur = 0;
  }

  const btnW = 180;
  const btnH = 50;
  const btnX = cx - btnW / 2;
  const btnY = cy + 145;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px sans-serif";
  ctx.shadowBlur = 0;
  ctx.fillText("もう一回！", cx, btnY + btnH / 2);

  ctx.restore();
}
