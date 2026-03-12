// 描画モジュール

import type { GameState } from "./types";
import {
  depthToY,
  depthToScale,
  laneDepthToX,
  laneToNorm,
  lerp,
  drawGlow,
  hexPath,
  rand,
} from "./utils";

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasW: number,
  canvasH: number
): void {
  ctx.save();

  // 画面揺れ
  if (state.screenShake > 0) {
    const intensity = state.screenShake * 6;
    ctx.translate(rand(-intensity, intensity), rand(-intensity, intensity));
  }

  drawBackground(ctx, state, canvasW, canvasH);
  drawSpeedLines(ctx, state);
  drawCoins(ctx, state, canvasW, canvasH);
  drawItems(ctx, state, canvasW, canvasH);
  drawObstacles(ctx, state, canvasW, canvasH);
  drawPlayer(ctx, state, canvasW, canvasH);
  drawParticles(ctx, state);
  drawHUD(ctx, state, canvasW, canvasH);
  drawMilestone(ctx, state, canvasW, canvasH);

  if (state.flashRed > 0) {
    ctx.fillStyle = `rgba(255,0,0,${state.flashRed * 0.5})`;
    ctx.fillRect(-10, -10, canvasW + 20, canvasH + 20);
  }
  if (state.flashWhite > 0) {
    ctx.fillStyle = `rgba(255,255,255,${state.flashWhite * 0.2})`;
    ctx.fillRect(-10, -10, canvasW + 20, canvasH + 20);
  }

  ctx.restore();

  if (state.scene === "title") drawTitle(ctx, canvasW, canvasH);
  if (state.scene === "gameover") drawGameOver(ctx, state, canvasW, canvasH);
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number
): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#0a0010");
  grad.addColorStop(0.5, "#120025");
  grad.addColorStop(1, "#1a0035");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const vanishX = w * 0.5;
  const vanishY = h * 0.3;
  const groundY = h * 0.85;
  const gridCount = 12;
  const offset = state.gridOffset % (1 / gridCount);

  // レベルに応じてグリッドの色が変化
  const hue = (state.level * 30) % 360;
  ctx.strokeStyle = `hsla(${hue}, 80%, 50%, 0.25)`;
  ctx.lineWidth = 1;

  for (let i = 0; i <= gridCount; i++) {
    const t = (i / gridCount + offset) % 1;
    if (t < 0.01) continue;
    const y = vanishY + (groundY - vanishY) * t;
    const halfW = w * 0.5 * t;
    ctx.beginPath();
    ctx.moveTo(vanishX - halfW * 0.55, y);
    ctx.lineTo(vanishX + halfW * 0.55, y);
    ctx.stroke();
  }

  const vLines = [-0.33, -0.11, 0, 0.11, 0.33];
  for (const vx of vLines) {
    ctx.beginPath();
    ctx.moveTo(vanishX + vx * w * 0.1, vanishY);
    ctx.lineTo(vanishX + vx * w * 1.1, groundY);
    ctx.stroke();
  }

  const floorGrad = ctx.createLinearGradient(0, groundY, 0, h);
  floorGrad.addColorStop(0, `hsla(${hue}, 60%, 20%, 0.5)`);
  floorGrad.addColorStop(1, "rgba(20,0,40,0.9)");
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, groundY, w, h - groundY);
}

function drawSpeedLines(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const line of state.speedLines) {
    ctx.save();
    ctx.strokeStyle = `rgba(0,255,255,${line.alpha})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(line.x, line.y);
    ctx.lineTo(line.x + (line.x < 50 ? -line.length : line.length), line.y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawCoins(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number
): void {
  for (const coin of state.coins) {
    if (coin.collected || coin.depth < 0.02) continue;
    const x = laneDepthToX(coin.lane, coin.depth, w);
    const y = depthToY(coin.depth, h);
    const scale = depthToScale(coin.depth);
    const r = Math.max(1, 14 * scale);

    drawGlow(ctx, "#ffd700", 15 * scale, () => {
      const squish = Math.abs(Math.cos(Date.now() * 0.005));
      const rx = Math.max(0.5, r * (0.3 + squish * 0.7));
      ctx.beginPath();
      ctx.ellipse(x, y, rx, r, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd700";
      ctx.fill();
      ctx.strokeStyle = "#ffaa00";
      ctx.lineWidth = Math.max(0.5, 1.5 * scale);
      ctx.stroke();
    });
  }
}

function drawItems(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number
): void {
  for (const item of state.items) {
    if (item.depth < 0.02 || item.depth > 1.1) continue;
    const x = laneDepthToX(item.lane, item.depth, w);
    const y = depthToY(item.depth, h);
    const scale = depthToScale(item.depth);
    const r = Math.max(2, 16 * scale);

    if (item.type === "magnet") {
      drawGlow(ctx, "#00aaff", 18 * scale, () => {
        hexPath(ctx, x, y, r);
        ctx.fillStyle = "rgba(0,100,255,0.8)";
        ctx.fill();
        ctx.strokeStyle = "#00ccff";
        ctx.lineWidth = Math.max(0.5, 2 * scale);
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.max(8, 14 * scale)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("M", x, y);
      });
    } else {
      drawGlow(ctx, "#00ff88", 18 * scale, () => {
        hexPath(ctx, x, y, r);
        ctx.fillStyle = "rgba(0,180,80,0.8)";
        ctx.fill();
        ctx.strokeStyle = "#00ff88";
        ctx.lineWidth = Math.max(0.5, 2 * scale);
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.max(8, 14 * scale)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("S", x, y);
      });
    }
  }
}

function drawObstacles(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number
): void {
  for (const obs of state.obstacles) {
    if (obs.depth < 0.02) continue;
    const x = laneDepthToX(obs.lane, obs.depth, w);
    const y = depthToY(obs.depth, h);
    const scale = depthToScale(obs.depth);

    if (obs.type === "barricade") {
      const bw = Math.max(4, 50 * scale);
      const bh = Math.max(3, 36 * scale);
      drawGlow(ctx, "#ff2200", 14 * scale, () => {
        ctx.fillStyle = "#cc1100";
        ctx.fillRect(x - bw / 2, y - bh, bw, bh);
        ctx.fillStyle = "#ff6600";
        const stripes = 4;
        for (let i = 0; i < stripes; i++) {
          const sx = x - bw / 2 + (bw / stripes) * i;
          ctx.fillRect(sx, y - bh, bw / stripes / 2, bh);
        }
        ctx.strokeStyle = "#ff4400";
        ctx.lineWidth = Math.max(0.5, 2 * scale);
        ctx.strokeRect(x - bw / 2, y - bh, bw, bh);
      });
    } else {
      const r = Math.max(2, 20 * scale);
      const teeth = 8;
      drawGlow(ctx, "#ff6600", 14 * scale, () => {
        ctx.save();
        ctx.translate(x, y - r);
        ctx.rotate(obs.angle);
        ctx.beginPath();
        for (let i = 0; i < teeth * 2; i++) {
          const angle = (Math.PI / teeth) * i;
          const ri = i % 2 === 0 ? r : r * 0.65;
          if (i === 0) ctx.moveTo(Math.cos(angle) * ri, Math.sin(angle) * ri);
          else ctx.lineTo(Math.cos(angle) * ri, Math.sin(angle) * ri);
        }
        ctx.closePath();
        ctx.fillStyle = "#ff6600";
        ctx.fill();
        ctx.strokeStyle = "#ffaa00";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      });
    }
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number
): void {
  const p = state.player;

  const fromX = laneDepthToX(p.lane, 1, w);
  const toX = laneDepthToX(p.targetLane, 1, w);
  const px = lerp(fromX, toX, p.laneProgress);
  const baseY = depthToY(1, h);
  const py = baseY + p.y - 40;

  const bodyH = 40;
  const bodyW = 22;
  const headR = 12;
  const legSwing = Math.sin(p.runFrame * 0.4) * 8;

  // シールドエフェクト
  if (p.shielded) {
    const pulse = 0.6 + Math.sin(Date.now() * 0.006) * 0.2;
    drawGlow(ctx, "#00ff88", 25, () => {
      ctx.beginPath();
      ctx.arc(px, py - bodyH / 2, bodyH * 0.8, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0,255,136,${pulse})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    });
  }

  // マグネットエフェクト
  if (p.magnetActive) {
    drawGlow(ctx, "#00aaff", 20, () => {
      for (let i = 0; i < 4; i++) {
        const angle = Date.now() * 0.004 + (i * Math.PI * 2) / 4;
        const mx = px + Math.cos(angle) * 28;
        const my = py - bodyH / 2 + Math.sin(angle) * 18;
        ctx.beginPath();
        ctx.arc(mx, my, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#00ccff";
        ctx.fill();
      }
    });
  }

  // 本体
  drawGlow(ctx, "#00ffff", 15, () => {
    ctx.fillStyle = "#e0f8ff";
    ctx.fillRect(px - bodyW / 2, py - bodyH, bodyW, bodyH);

    ctx.beginPath();
    ctx.arc(px, py - bodyH - headR + 4, headR, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.fillStyle = "#00ffff";
    ctx.fillRect(px - 6, py - bodyH - headR + 1, 5, 4);
    ctx.fillRect(px + 1, py - bodyH - headR + 1, 5, 4);

    ctx.fillStyle = "#80e0ff";
    if (!p.isJumping) {
      ctx.fillRect(px - bodyW / 2, py, bodyW / 2 - 1, 10 + legSwing);
      ctx.fillRect(px + 1, py, bodyW / 2 - 1, 10 - legSwing);
    } else {
      ctx.fillRect(px - bodyW / 2, py - 5, bodyW / 2 - 1, 8);
      ctx.fillRect(px + 1, py - 5, bodyW / 2 - 1, 8);
    }

    ctx.fillStyle = "#a0e8ff";
    ctx.fillRect(px - bodyW / 2 - 6, py - bodyH + 5, 6, 16 - legSwing * 0.5);
    ctx.fillRect(px + bodyW / 2, py - bodyH + 5, 6, 16 + legSwing * 0.5);
  });

  // 影
  const shadowAlpha = p.isJumping ? 0.3 * (1 + p.y / 100) : 0.5;
  ctx.beginPath();
  ctx.ellipse(px, baseY - 2, 18, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0,0,0,${Math.max(0.1, shadowAlpha)})`;
  ctx.fill();
}

function drawParticles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const p of state.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.size * p.life), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawHUD(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number
): void {
  if (state.scene !== "playing") return;

  ctx.textBaseline = "top";

  // レベル表示（左上）
  const hue = (state.level * 30) % 360;
  ctx.textAlign = "left";
  drawGlow(ctx, `hsl(${hue}, 100%, 60%)`, 12, () => {
    ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
    ctx.font = `bold ${Math.min(18, w * 0.035)}px monospace`;
    ctx.fillText(`LV.${state.level}`, 16, 14);
  });

  // スコア
  drawGlow(ctx, "#00ffff", 10, () => {
    ctx.fillStyle = "#00ffff";
    ctx.font = `bold ${Math.min(26, w * 0.048)}px monospace`;
    ctx.textAlign = "left";
    ctx.fillText(`${state.score}`, 16, 36);
  });

  // ハイスコア
  ctx.fillStyle = "rgba(200,200,255,0.5)";
  ctx.font = `${Math.min(13, w * 0.025)}px monospace`;
  ctx.textAlign = "left";
  ctx.fillText(`BEST: ${state.highScore}`, 16, 64);

  // 距離（右上）
  ctx.textAlign = "right";
  drawGlow(ctx, "#ffffff", 8, () => {
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.min(22, w * 0.04)}px monospace`;
    ctx.fillText(`${Math.floor(state.distance)}m`, w - 16, 14);
  });

  // 次のレベルまでのプログレスバー
  const progress = Math.min(1, state.distance / state.nextLevelDist);
  const barW = Math.min(100, w * 0.2);
  const barH = 6;
  const barX = w - 16 - barW;
  const barY = 42;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
  ctx.fillRect(barX, barY, barW * progress, barH);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = `${Math.min(10, w * 0.02)}px monospace`;
  ctx.textAlign = "right";
  ctx.fillText(`NEXT LV`, w - 16, barY + barH + 3);

  // コンボ（中央上）
  if (state.combo >= 2) {
    const comboScale = Math.min(1 + (state.combo - 2) * 0.08, 1.8);
    ctx.save();
    ctx.translate(w / 2, 55);
    ctx.scale(comboScale, comboScale);
    const comboColor = state.combo >= 8 ? "#ff4400" : state.combo >= 5 ? "#ff8800" : "#ffd700";
    drawGlow(ctx, comboColor, 12, () => {
      ctx.fillStyle = comboColor;
      ctx.font = `bold ${Math.min(22, w * 0.04)}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(`x${state.combo} COMBO`, 0, 0);
    });
    ctx.restore();

    // コンボタイマーバー
    const comboBarW = 80;
    const comboBarH = 3;
    const comboBarX = w / 2 - comboBarW / 2;
    const comboBarY = 75;
    const comboProgress = state.comboTimer / 1.0;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(comboBarX, comboBarY, comboBarW, comboBarH);
    ctx.fillStyle = comboColor;
    ctx.fillRect(comboBarX, comboBarY, comboBarW * comboProgress, comboBarH);
  }

  // コイン数
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd700";
  ctx.font = `${Math.min(14, w * 0.028)}px monospace`;
  ctx.fillText(`${state.totalCoins} COINS`, w / 2, 16);

  // アイテム状態
  let iconY = 38;
  ctx.textAlign = "right";
  if (state.player.shielded) {
    ctx.fillStyle = "#00ff88";
    ctx.font = `bold ${Math.min(14, w * 0.028)}px monospace`;
    ctx.fillText(`SHIELD ${Math.ceil(state.player.shieldTimer)}s`, w - 16, iconY + 22);
    iconY += 20;
  }
  if (state.player.magnetActive) {
    ctx.fillStyle = "#00aaff";
    ctx.font = `bold ${Math.min(14, w * 0.028)}px monospace`;
    ctx.fillText(`MAGNET ${Math.ceil(state.player.magnetTimer)}s`, w - 16, iconY + 22);
  }
}

function drawMilestone(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number
): void {
  if (!state.milestone) return;
  const m = state.milestone;
  const alpha = Math.min(1, m.timer);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(w / 2, h * 0.38);
  ctx.scale(m.scale, m.scale);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const size = Math.min(42, w * 0.08);
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 5;
  ctx.font = `bold ${size}px monospace`;
  ctx.strokeText(m.text, 0, 0);

  drawGlow(ctx, m.color, 25, () => {
    ctx.fillStyle = m.color;
    ctx.font = `bold ${size}px monospace`;
    ctx.fillText(m.text, 0, 0);
  });

  ctx.restore();
}

function drawTitle(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const titleSize = Math.min(64, w * 0.12);
  drawGlow(ctx, "#00ffff", 30, () => {
    ctx.fillStyle = "#00ffff";
    ctx.font = `bold ${titleSize}px monospace`;
    ctx.fillText("HYPER DASH!!", w / 2, h * 0.3);
  });

  ctx.fillStyle = "#cc88ff";
  ctx.font = `${Math.min(20, w * 0.038)}px monospace`;
  ctx.fillText("無限ランナー サイバーパンク", w / 2, h * 0.42);

  // 操作説明
  const infoSize = Math.min(15, w * 0.028);
  ctx.fillStyle = "rgba(200,200,255,0.85)";
  ctx.font = `${infoSize}px monospace`;
  ctx.fillText("← → / A D : レーン移動", w / 2, h * 0.53);
  ctx.fillText("↑ / W / Space : ジャンプ", w / 2, h * 0.58);
  ctx.fillText("スワイプ操作にも対応", w / 2, h * 0.63);

  // 目的の説明
  ctx.fillStyle = "#ffd700";
  ctx.font = `bold ${Math.min(16, w * 0.03)}px monospace`;
  ctx.fillText("コインを集めてコンボを繋げ!", w / 2, h * 0.72);
  ctx.fillStyle = "#00ff88";
  ctx.fillText("レベルアップを目指そう!", w / 2, h * 0.77);

  const blink = Math.sin(Date.now() * 0.004) > 0;
  if (blink) {
    drawGlow(ctx, "#ffffff", 15, () => {
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.min(24, w * 0.045)}px monospace`;
      ctx.fillText("タップ / クリックでスタート", w / 2, h * 0.88);
    });
  }
}

function drawGameOver(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number
): void {
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  drawGlow(ctx, "#ff2200", 30, () => {
    ctx.fillStyle = "#ff4422";
    ctx.font = `bold ${Math.min(52, w * 0.1)}px monospace`;
    ctx.fillText("GAME OVER", w / 2, h * 0.25);
  });

  // ハイスコア更新チェック
  if (state.score >= state.highScore && state.score > 0) {
    drawGlow(ctx, "#ffd700", 20, () => {
      ctx.fillStyle = "#ffd700";
      ctx.font = `bold ${Math.min(22, w * 0.04)}px monospace`;
      ctx.fillText("NEW RECORD!", w / 2, h * 0.33);
    });
  }

  // 統計情報
  const statSize = Math.min(18, w * 0.035);
  const valSize = Math.min(28, w * 0.05);
  let sy = h * 0.42;
  const gap = h * 0.08;

  ctx.fillStyle = "rgba(200,200,255,0.7)";
  ctx.font = `${statSize}px monospace`;
  ctx.fillText("スコア", w / 2, sy);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${valSize}px monospace`;
  ctx.fillText(`${state.score}`, w / 2, sy + 28);
  sy += gap + 16;

  ctx.fillStyle = "rgba(200,200,255,0.7)";
  ctx.font = `${statSize}px monospace`;
  ctx.fillText("走行距離", w / 2, sy);
  ctx.fillStyle = "#00ffff";
  ctx.font = `bold ${Math.min(22, w * 0.04)}px monospace`;
  ctx.fillText(`${Math.floor(state.distance)}m`, w / 2, sy + 24);
  sy += gap + 10;

  // レベル・コイン・最大コンボを横並び
  const col3W = w * 0.28;
  const col3Y = sy;

  ctx.fillStyle = "rgba(200,200,255,0.7)";
  ctx.font = `${Math.min(13, w * 0.025)}px monospace`;
  ctx.fillText("レベル", w / 2 - col3W, col3Y);
  ctx.fillText("コイン", w / 2, col3Y);
  ctx.fillText("最大コンボ", w / 2 + col3W, col3Y);

  const smallVal = Math.min(20, w * 0.038);
  ctx.font = `bold ${smallVal}px monospace`;
  ctx.fillStyle = "#cc88ff";
  ctx.fillText(`${state.level}`, w / 2 - col3W, col3Y + 22);
  ctx.fillStyle = "#ffd700";
  ctx.fillText(`${state.totalCoins}`, w / 2, col3Y + 22);
  ctx.fillStyle = "#ff8800";
  ctx.fillText(`x${state.maxCombo}`, w / 2 + col3W, col3Y + 22);

  // ハイスコア
  ctx.fillStyle = "rgba(255,215,0,0.6)";
  ctx.font = `${Math.min(14, w * 0.028)}px monospace`;
  ctx.fillText(`ハイスコア: ${state.highScore}`, w / 2, h * 0.82);

  const blink = Math.sin(Date.now() * 0.005) > 0;
  if (blink) {
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.min(22, w * 0.042)}px monospace`;
    ctx.fillText("タップ / クリックでリスタート", w / 2, h * 0.9);
  }
}
