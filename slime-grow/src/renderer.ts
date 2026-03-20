// Slime Grow - レンダラー

import type { GameState, Enemy, EnemyKind, Particle, FireworkParticle, SlimeState, PowerUp, ActiveEffect, PowerUpKind } from './types';
import { clamp, lerp, ENEMY_COLOR, POWERUP_COLOR, POWERUP_DURATION, getStageConfig, slimeBodyColor } from './utils';

// ---- 背景 ----

function drawBackground(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number): void {
  const cfg = getStageConfig(state.stage);
  ctx.fillStyle = cfg.bgColor;
  ctx.fillRect(0, 0, w, h);

  // ドット模様
  ctx.fillStyle = cfg.dotColor;
  const spacing = 40;
  for (let y = 0; y < h; y += spacing) {
    for (let x = 0; x < w; x += spacing) {
      ctx.beginPath();
      ctx.arc(x + 4, y + 4, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ダメージフラッシュ
  if (state.damageFlash > 0) {
    ctx.fillStyle = `rgba(255,50,50,${state.damageFlash * 0.3})`;
    ctx.fillRect(0, 0, w, h);
  }
}

// ---- スライム ----

function getSlimeTint(effects: ActiveEffect[]): PowerUpKind | null {
  // 最も残り時間が長いエフェクトの色を優先
  let best: ActiveEffect | null = null;
  for (const e of effects) {
    if (!best || e.remaining > best.remaining) best = e;
  }
  return best ? best.kind : null;
}

function tintedSlimeColor(base: string, tint: PowerUpKind | null, t: number): string {
  if (!tint) return base;
  const m = base.match(/rgb\((\d+),(\d+),(\d+)\)/);
  if (!m) return base;
  let r = parseInt(m[1]);
  let g = parseInt(m[2]);
  let b = parseInt(m[3]);
  const blend = 0.4 + Math.sin(t * 0.1) * 0.1; // 脈動するブレンド
  if (tint === 'speed') {
    r = Math.round(r + (255 - r) * blend);
    g = Math.round(g + (215 - g) * blend);
    b = Math.round(b * (1 - blend * 0.7));
  } else if (tint === 'size') {
    r = Math.round(r * (1 - blend * 0.5));
    g = Math.round(g + (187 - g) * blend * 0.6);
    b = Math.round(b + (255 - b) * blend);
  } else if (tint === 'magnet') {
    r = Math.round(r + (204 - r) * blend);
    g = Math.round(g * (1 - blend * 0.6));
    b = Math.round(b + (255 - b) * blend);
  }
  return `rgb(${clamp(r,0,255)},${clamp(g,0,255)},${clamp(b,0,255)})`;
}

function drawSlime(ctx: CanvasRenderingContext2D, slime: SlimeState, time: number, effects: ActiveEffect[]): void {
  const { x, y, radius, wobblePhase, eatPulse } = slime;
  const tint = getSlimeTint(effects);

  // ぷるぷる変形: sin波でx/y半径を交互に変動
  const wobble = Math.sin(wobblePhase) * radius * 0.08;
  const pulseExtra = eatPulse * radius * 0.15;
  const rx = radius + wobble + pulseExtra;
  const ry = radius - wobble + pulseExtra * 0.5;

  const bodyColor = tintedSlimeColor(slimeBodyColor(radius, eatPulse), tint, time);
  const highlightColor = tintedSlimeColor(slimeBodyColor(radius + 10, eatPulse * 0.5), tint, time);
  const edgeColor = tint === 'speed' ? 'rgba(80,40,0,0.8)'
    : tint === 'size' ? 'rgba(0,30,80,0.8)'
    : tint === 'magnet' ? 'rgba(60,0,60,0.8)'
    : 'rgba(0,60,0,0.8)';

  // 影
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 4, rx * 0.9, ry * 0.7, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();

  // エフェクト中のオーラ
  if (tint) {
    const auraColor = POWERUP_COLOR[tint];
    const pulse = 0.15 + Math.sin(time * 0.08) * 0.1;
    const aura = ctx.createRadialGradient(x, y, rx * 0.8, x, y, rx * 2);
    aura.addColorStop(0, auraColor + Math.round(pulse * 255).toString(16).padStart(2, '0'));
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(x, y, rx * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 本体
  const grad = ctx.createRadialGradient(x - rx * 0.2, y - ry * 0.2, 0, x, y, rx);
  grad.addColorStop(0, highlightColor);
  grad.addColorStop(0.6, bodyColor);
  grad.addColorStop(1, edgeColor);

  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // ハイライト
  ctx.beginPath();
  ctx.ellipse(x - rx * 0.25, y - ry * 0.3, rx * 0.35, ry * 0.2, -0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fill();

  // 目（左右）
  const eyeOffset = rx * 0.28;
  const eyeY = y - ry * 0.1;
  const eyeR = Math.max(3, radius * 0.12);
  const blinkFactor = (Math.sin(time * 0.03) > 0.92) ? 0.15 : 1;

  for (const sign of [-1, 1]) {
    const ex = x + sign * eyeOffset;
    // 白目
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, eyeR, eyeR * blinkFactor, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    // 黒目
    ctx.beginPath();
    ctx.ellipse(ex + sign * eyeR * 0.2, eyeY + eyeR * 0.1, eyeR * 0.5, eyeR * 0.55 * blinkFactor, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    // 光沢点
    ctx.beginPath();
    ctx.arc(ex + sign * eyeR * 0.05 - eyeR * 0.2, eyeY - eyeR * 0.3 * blinkFactor, eyeR * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
  }

  void time;
}

// ---- 敵 ----

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, slimeRadius: number): void {
  const { x, y, radius, kind } = e;
  const color = ENEMY_COLOR[kind];

  // サイズ比較に応じた枠
  const ratio = radius / slimeRadius;
  let borderColor = '';
  let borderWidth = 0;
  if (ratio > 1.05) {
    borderColor = '#FF2222';
    borderWidth = 3;
  } else if (ratio >= 0.95) {
    borderColor = '#FFEE00';
    borderWidth = 2;
  }

  // Shadow for all enemies
  ctx.beginPath();
  ctx.ellipse(x + 2, y + 3, radius * 0.9, radius * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();

  if (kind === 'bug') {
    const r = radius;
    // Legs (6 legs)
    ctx.strokeStyle = '#5A4010';
    ctx.lineWidth = Math.max(1, r * 0.12);
    for (let i = -1; i <= 1; i++) {
      const ly = y + i * r * 0.35;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.8, ly);
      ctx.quadraticCurveTo(x - r * 1.4, ly - r * 0.3, x - r * 1.5, ly + r * 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + r * 0.8, ly);
      ctx.quadraticCurveTo(x + r * 1.4, ly - r * 0.3, x + r * 1.5, ly + r * 0.2);
      ctx.stroke();
    }
    // Body (2 segments)
    const bodyGrad = ctx.createRadialGradient(x - r * 0.1, y - r * 0.15, 0, x, y, r * 1.2);
    bodyGrad.addColorStop(0, '#C49030');
    bodyGrad.addColorStop(1, '#5A3A08');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(x + r * 0.3, y, r * 0.85, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x - r * 0.35, y, r * 0.6, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    // Shell pattern line
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = Math.max(0.5, r * 0.08);
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.6);
    ctx.lineTo(x, y + r * 0.6);
    ctx.stroke();
    // Antennae with tips
    ctx.strokeStyle = '#6B4E18';
    ctx.lineWidth = Math.max(1, r * 0.1);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, y - r * 0.45);
    ctx.quadraticCurveTo(x - r * 0.8, y - r * 1.5, x - r * 1.2, y - r * 1.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + r * 0.5, y - r * 0.45);
    ctx.quadraticCurveTo(x + r * 0.8, y - r * 1.5, x + r * 1.2, y - r * 1.3);
    ctx.stroke();
    // Antenna tips
    ctx.fillStyle = '#C49030';
    ctx.beginPath();
    ctx.arc(x - r * 1.2, y - r * 1.3, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + r * 1.2, y - r * 1.3, r * 0.15, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.2, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + r * 0.05, y - r * 0.2, r * 0.12, 0, Math.PI * 2);
    ctx.fill();

  } else if (kind === 'bat') {
    const r = radius;
    const wingFlap = Math.sin(e.zigzagAngle * 3) * 0.3;
    // Wings (curved)
    const wingColor = '#5A2880';
    for (const s of [-1, 1]) {
      ctx.fillStyle = wingColor;
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.2);
      ctx.quadraticCurveTo(x + s * r * 1.2, y - r * (1.2 + wingFlap), x + s * r * 2.0, y - r * (0.2 + wingFlap * 0.5));
      ctx.quadraticCurveTo(x + s * r * 1.6, y + r * 0.3, x + s * r * 0.8, y + r * 0.5);
      ctx.quadraticCurveTo(x + s * r * 0.4, y + r * 0.1, x, y + r * 0.2);
      ctx.fill();
      // Wing membrane lines
      ctx.strokeStyle = 'rgba(90,40,128,0.5)';
      ctx.lineWidth = Math.max(0.5, r * 0.06);
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.1);
      ctx.lineTo(x + s * r * 1.5, y - r * (0.6 + wingFlap * 0.5));
      ctx.stroke();
    }
    // Body
    const batGrad = ctx.createRadialGradient(x, y - r * 0.15, 0, x, y, r);
    batGrad.addColorStop(0, '#9B5FC0');
    batGrad.addColorStop(1, '#3A1060');
    ctx.fillStyle = batGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.6, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ears
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#6A3090';
      ctx.beginPath();
      ctx.moveTo(x + s * r * 0.2, y - r * 0.65);
      ctx.lineTo(x + s * r * 0.45, y - r * 1.2);
      ctx.lineTo(x + s * r * 0.5, y - r * 0.55);
      ctx.closePath();
      ctx.fill();
    }
    // Eyes (glowing)
    ctx.fillStyle = '#FF4400';
    ctx.shadowColor = '#FF4400';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(x - r * 0.2, y - r * 0.15, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + r * 0.2, y - r * 0.15, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Fangs
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.12, y + r * 0.15);
    ctx.lineTo(x - r * 0.06, y + r * 0.35);
    ctx.lineTo(x, y + r * 0.15);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + r * 0.12, y + r * 0.15);
    ctx.lineTo(x + r * 0.06, y + r * 0.35);
    ctx.lineTo(x, y + r * 0.15);
    ctx.fill();

  } else if (kind === 'rat') {
    const r = radius;
    // Tail (curvy)
    ctx.strokeStyle = '#AA8888';
    ctx.lineWidth = Math.max(1.5, r * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + r * 0.7, y + r * 0.1);
    ctx.bezierCurveTo(x + r * 1.3, y - r * 0.3, x + r * 1.6, y + r * 0.8, x + r * 1.2, y + r * 1.1);
    ctx.stroke();
    ctx.lineCap = 'butt';
    // Body
    const ratGrad = ctx.createRadialGradient(x - r * 0.1, y - r * 0.1, 0, x, y, r);
    ratGrad.addColorStop(0, '#AAAAAA');
    ratGrad.addColorStop(1, '#555555');
    ctx.fillStyle = ratGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.95, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Belly (lighter)
    ctx.fillStyle = 'rgba(200,200,200,0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.15, r * 0.55, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ears (pink inside)
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(x + s * r * 0.55, y - r * 0.6, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#CC9999';
      ctx.beginPath();
      ctx.arc(x + s * r * 0.55, y - r * 0.6, r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    // Nose
    ctx.fillStyle = '#FF8888';
    ctx.beginPath();
    ctx.arc(x - r * 0.6, y + r * 0.05, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.15, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + r * 0.1, y - r * 0.15, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Whiskers
    ctx.strokeStyle = 'rgba(150,150,150,0.6)';
    ctx.lineWidth = Math.max(0.5, r * 0.04);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, y + s * r * 0.05);
      ctx.lineTo(x - r * 1.1, y + s * r * 0.2);
      ctx.stroke();
    }

  } else if (kind === 'goblin') {
    const r = radius;
    // Body
    const gobGrad = ctx.createRadialGradient(x - r * 0.15, y - r * 0.2, 0, x, y, r);
    gobGrad.addColorStop(0, '#8DD850');
    gobGrad.addColorStop(1, '#2A6010');
    ctx.fillStyle = gobGrad;
    ctx.beginPath();
    ctx.arc(x, y + r * 0.1, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
    // Belly
    ctx.fillStyle = 'rgba(180,230,130,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.25, r * 0.5, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pointy ears
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#5CA832';
      ctx.beginPath();
      ctx.moveTo(x + s * r * 0.7, y - r * 0.15);
      ctx.lineTo(x + s * r * 1.3, y - r * 0.7);
      ctx.lineTo(x + s * r * 0.9, y + r * 0.1);
      ctx.closePath();
      ctx.fill();
      // Inner ear
      ctx.fillStyle = 'rgba(120,80,40,0.4)';
      ctx.beginPath();
      ctx.moveTo(x + s * r * 0.8, y - r * 0.1);
      ctx.lineTo(x + s * r * 1.15, y - r * 0.5);
      ctx.lineTo(x + s * r * 0.9, y + r * 0.0);
      ctx.closePath();
      ctx.fill();
    }
    // Eyes (angry, yellow)
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#FFEE00';
      ctx.beginPath();
      ctx.ellipse(x + s * r * 0.3, y - r * 0.15, r * 0.18, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#CC0000';
      ctx.beginPath();
      ctx.arc(x + s * r * 0.3, y - r * 0.12, r * 0.09, 0, Math.PI * 2);
      ctx.fill();
      // Angry brow
      ctx.strokeStyle = '#2A4010';
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(x + s * r * 0.12, y - r * 0.38);
      ctx.lineTo(x + s * r * 0.45, y - r * 0.28);
      ctx.stroke();
    }
    // Mouth (grin with teeth)
    ctx.strokeStyle = '#1A3008';
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath();
    ctx.arc(x, y + r * 0.2, r * 0.3, 0.1, Math.PI - 0.1);
    ctx.stroke();
    // Teeth
    ctx.fillStyle = '#FFFFCC';
    for (const ox of [-0.15, 0.15]) {
      ctx.beginPath();
      ctx.moveTo(x + r * (ox - 0.06), y + r * 0.25);
      ctx.lineTo(x + r * ox, y + r * 0.42);
      ctx.lineTo(x + r * (ox + 0.06), y + r * 0.25);
      ctx.fill();
    }

  } else {
    // Skeleton
    const r = radius;
    // Ghostly glow
    const skGlow = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 1.3);
    skGlow.addColorStop(0, 'rgba(220,220,255,0.15)');
    skGlow.addColorStop(1, 'rgba(220,220,255,0)');
    ctx.fillStyle = skGlow;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.3, 0, Math.PI * 2);
    ctx.fill();
    // Skull
    const skullGrad = ctx.createRadialGradient(x - r * 0.1, y - r * 0.15, 0, x, y, r);
    skullGrad.addColorStop(0, '#F5F5FF');
    skullGrad.addColorStop(0.7, '#D0D0E0');
    skullGrad.addColorStop(1, '#888899');
    ctx.fillStyle = skullGrad;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.1, r * 0.85, 0, Math.PI * 2);
    ctx.fill();
    // Jaw
    ctx.fillStyle = '#C8C8D8';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.45, r * 0.55, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eye sockets (dark)
    for (const s of [-1, 1]) {
      const socketGrad = ctx.createRadialGradient(x + s * r * 0.28, y - r * 0.15, 0, x + s * r * 0.28, y - r * 0.15, r * 0.22);
      socketGrad.addColorStop(0, '#110022');
      socketGrad.addColorStop(1, '#333344');
      ctx.fillStyle = socketGrad;
      ctx.beginPath();
      ctx.ellipse(x + s * r * 0.28, y - r * 0.15, r * 0.22, r * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
      // Glowing pupils
      ctx.fillStyle = '#FF2200';
      ctx.shadowColor = '#FF2200';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.arc(x + s * r * 0.28, y - r * 0.12, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // Nose hole
    ctx.fillStyle = '#444455';
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.05);
    ctx.lineTo(x - r * 0.08, y + r * 0.18);
    ctx.lineTo(x + r * 0.08, y + r * 0.18);
    ctx.closePath();
    ctx.fill();
    // Teeth
    ctx.fillStyle = '#E8E8F0';
    ctx.strokeStyle = '#888899';
    ctx.lineWidth = Math.max(0.5, r * 0.03);
    const teethCount = 5;
    const teethW = r * 0.18;
    const teethStartX = x - (teethCount * teethW) / 2;
    for (let i = 0; i < teethCount; i++) {
      const tx = teethStartX + i * teethW;
      ctx.fillRect(tx, y + r * 0.28, teethW - 1, r * 0.18);
      ctx.strokeRect(tx, y + r * 0.28, teethW - 1, r * 0.18);
    }
    // Crossbones hint
    ctx.strokeStyle = 'rgba(200,200,220,0.3)';
    ctx.lineWidth = Math.max(1, r * 0.08);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.6, y + r * 0.7);
    ctx.lineTo(x + r * 0.6, y + r * 1.1);
    ctx.moveTo(x + r * 0.6, y + r * 0.7);
    ctx.lineTo(x - r * 0.6, y + r * 1.1);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // 危険度枠（最後に描画）
  if (borderWidth > 0) {
    ctx.save();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    if (kind === 'bat') {
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.3, 0, Math.PI * 2);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, radius + borderWidth + 1, 0, Math.PI * 2);
    }
    ctx.stroke();
    // 危険なら赤いオーラ
    if (ratio > 1.05) {
      const aura = ctx.createRadialGradient(x, y, radius, x, y, radius * 1.8);
      aura.addColorStop(0, 'rgba(255,30,30,0.3)');
      aura.addColorStop(1, 'rgba(255,30,30,0)');
      ctx.beginPath();
      ctx.arc(x, y, radius * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = aura;
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---- パーティクル ----

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFireworks(ctx: CanvasRenderingContext2D, fireworks: FireworkParticle[]): void {
  for (const fw of fireworks) {
    ctx.globalAlpha = clamp(fw.life, 0, 1);
    ctx.beginPath();
    ctx.arc(fw.x, fw.y, 3 * fw.life, 0, Math.PI * 2);
    ctx.fillStyle = fw.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---- 特殊エサ ----

function drawPowerUp(ctx: CanvasRenderingContext2D, pu: PowerUp): void {
  const { x, y: baseY, radius, kind, bobPhase, life } = pu;
  const y = baseY + Math.sin(bobPhase) * 4; // 浮遊
  const color = POWERUP_COLOR[kind];

  // 点滅（残り少ないとき）
  if (life < 120 && Math.sin(life * 0.3) < 0) return;

  // 外側グロー
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
  glow.addColorStop(0, color + '60');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
  ctx.fill();

  // 本体（星型）
  ctx.fillStyle = color;
  ctx.beginPath();
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2 + bobPhase * 0.5;
    const r = i % 2 === 0 ? radius : radius * 0.5;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  // アイコン文字
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${radius}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const icon = kind === 'speed' ? '⚡' : kind === 'size' ? '↑' : '◎';
  ctx.fillText(icon, x, y);
  ctx.textBaseline = 'alphabetic';
}

// ---- アクティブエフェクト表示 ----

function drawActiveEffects(ctx: CanvasRenderingContext2D, state: GameState, w: number): void {
  const effects = state.activeEffects;
  if (effects.length === 0) return;

  let offsetX = w - 10;
  for (const eff of effects) {
    const color = POWERUP_COLOR[eff.kind];
    const ratio = eff.remaining / POWERUP_DURATION;
    const barW = 50;
    const barH = 8;
    offsetX -= barW + 10;

    // ラベル
    const label = eff.kind === 'speed' ? '⚡SPD' : eff.kind === 'size' ? '↑SIZE' : '◎MAG';
    ctx.fillStyle = color;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, offsetX + barW / 2, 56);

    // 残り時間バー
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(offsetX, 60, barW, barH);
    ctx.fillStyle = color;
    ctx.fillRect(offsetX, 60, barW * ratio, barH);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX, 60, barW, barH);
  }
}

// ---- HUD ----

function drawHUD(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number): void {
  const { slime, stage, targetRadius } = state;
  const progress = clamp((slime.radius - 15) / (targetRadius - 15), 0, 1);
  const pct = Math.floor(progress * 100);

  const barW = Math.min(w * 0.6, 300);
  const barH = 18;
  const barX = (w - barW) / 2;
  const barY = 14;

  // バー背景
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, barX - 2, barY - 2, barW + 4, barH + 4, 5);
  ctx.fill();

  // バー本体
  const fillColor = lerp(0, 1, progress) > 0.6 ? '#44FF44' : progress > 0.3 ? '#AAFF44' : '#FFFF44';
  ctx.fillStyle = fillColor;
  roundRect(ctx, barX, barY, barW * progress, barH, 4);
  ctx.fill();

  // バー枠
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, barX, barY, barW, barH, 4);
  ctx.stroke();

  // テキスト
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`Stage ${stage}  ${Math.max(0, 100 - pct)}% to goal`, w / 2, barY + barH + 16);

  // サイズ表示
  ctx.textAlign = 'left';
  ctx.font = '12px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`SIZE: ${slime.radius.toFixed(1)} / ${targetRadius}`, 8, h - 8);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- タイトル画面 ----

function drawTitle(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number): void {
  const t = state.time;

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#040E1A');
  bgGrad.addColorStop(0.5, '#0d1b2a');
  bgGrad.addColorStop(1, '#081820');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Floating background particles
  for (let i = 0; i < 30; i++) {
    const seed = i * 137.5;
    const px = ((seed * 3.7 + t * 0.15 * (0.3 + (i % 5) * 0.15)) % (w + 40)) - 20;
    const py = ((seed * 2.3 + t * 0.1 * (0.2 + (i % 3) * 0.1)) % (h + 40)) - 20;
    const pr = 1.5 + (i % 4) * 0.8;
    const alpha = 0.15 + Math.sin(t * 0.02 + i) * 0.1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = i % 3 === 0 ? '#44FF88' : i % 3 === 1 ? '#8866FF' : '#FFAA44';
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Floating mini enemies in background
  const enemyKinds: Array<{ kind: EnemyKind; cx: number; cy: number; r: number; speed: number }> = [
    { kind: 'bug', cx: w * 0.15, cy: h * 0.4, r: 8, speed: 0.8 },
    { kind: 'bat', cx: w * 0.85, cy: h * 0.35, r: 12, speed: 1.2 },
    { kind: 'rat', cx: w * 0.2, cy: h * 0.65, r: 10, speed: 0.6 },
    { kind: 'goblin', cx: w * 0.8, cy: h * 0.6, r: 14, speed: 0.5 },
    { kind: 'skeleton', cx: w * 0.5, cy: h * 0.78, r: 16, speed: 0.4 },
  ];
  ctx.globalAlpha = 0.35;
  for (const em of enemyKinds) {
    const ex = em.cx + Math.sin(t * 0.012 * em.speed + em.cx) * 30;
    const ey = em.cy + Math.cos(t * 0.015 * em.speed + em.cy) * 20;
    const fakeEnemy: Enemy = {
      id: 0, kind: em.kind, x: ex, y: ey, radius: em.r,
      vx: 0, vy: 0, dirTimer: 0, zigzagAngle: t * 0.05, alive: true,
    };
    drawEnemy(ctx, fakeEnemy, 999);
  }
  ctx.globalAlpha = 1;

  // Vignette overlay
  const vig = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.2, w / 2, h * 0.45, h * 0.85);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // Title text with layered glow
  ctx.textAlign = 'center';
  const titleSize = Math.min(68, w * 0.14);
  const titleY = h * 0.2;

  // Outer glow layer
  ctx.fillStyle = 'rgba(0,255,100,0.08)';
  ctx.font = `bold ${titleSize + 4}px monospace`;
  ctx.fillText('SLIME GROW', w / 2, titleY);

  // Main title
  const titleGrad = ctx.createLinearGradient(w * 0.2, titleY - titleSize, w * 0.8, titleY);
  titleGrad.addColorStop(0, '#22FF66');
  titleGrad.addColorStop(0.5, '#88FFAA');
  titleGrad.addColorStop(1, '#22DD88');
  ctx.fillStyle = titleGrad;
  ctx.font = `bold ${titleSize}px monospace`;
  ctx.shadowColor = '#00FF66';
  ctx.shadowBlur = 25 + Math.sin(t * 0.04) * 8;
  ctx.fillText('SLIME GROW', w / 2, titleY);
  ctx.shadowBlur = 0;

  // Subtitle
  ctx.fillStyle = 'rgba(180,255,210,0.85)';
  ctx.font = `${Math.min(17, w * 0.034)}px monospace`;
  ctx.fillText('Eat, Grow, Survive!', w / 2, titleY + titleSize * 0.55);

  // Slime (main character, bigger bounce)
  const savedSlime = { ...state.slime };
  savedSlime.wobblePhase = t * 0.06;
  savedSlime.eatPulse = Math.sin(t * 0.03) * 0.15 + 0.15;
  drawSlime(ctx, savedSlime, t, state.activeEffects);

  // Ground line under slime
  const groundY = state.slime.y + state.slime.radius + 8;
  ctx.strokeStyle = 'rgba(100,255,150,0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.25, groundY);
  ctx.quadraticCurveTo(w * 0.5, groundY + 5, w * 0.75, groundY);
  ctx.stroke();

  // Info panel
  const panelY = h * 0.68;
  const panelH = h * 0.22;
  const panelGrad = ctx.createLinearGradient(0, panelY, 0, panelY + panelH);
  panelGrad.addColorStop(0, 'rgba(10,30,50,0.7)');
  panelGrad.addColorStop(1, 'rgba(10,30,50,0.4)');
  ctx.fillStyle = panelGrad;
  roundRect(ctx, w * 0.08, panelY, w * 0.84, panelH, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(80,200,140,0.25)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, w * 0.08, panelY, w * 0.84, panelH, 16);
  ctx.stroke();

  // Best stage (with trophy icon)
  if (state.bestStage > 0) {
    ctx.fillStyle = '#FFD700';
    ctx.font = `bold ${Math.min(15, w * 0.032)}px monospace`;
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 6;
    ctx.fillText(`★ BEST STAGE: ${state.bestStage} ★`, w / 2, panelY + panelH * 0.2);
    ctx.shadowBlur = 0;
  }

  // Instructions with icons
  const instY = panelY + panelH * (state.bestStage > 0 ? 0.42 : 0.3);
  ctx.font = `${Math.min(13, w * 0.027)}px monospace`;

  ctx.fillStyle = '#88DDAA';
  ctx.fillText('🖱 Move mouse / touch to guide', w / 2, instY);
  ctx.fillStyle = '#AAFFCC';
  ctx.fillText('🟢 Eat smaller  ·  🔴 Avoid bigger', w / 2, instY + 22);
  ctx.fillStyle = '#FFCC88';
  ctx.fillText('⭐ Collect power-ups for boosts!', w / 2, instY + 44);

  // Start prompt (pulsing)
  const pulse = Math.sin(t * 0.06) * 0.5 + 0.5;
  const startY = h * 0.96;
  ctx.fillStyle = `rgba(100,255,180,${0.5 + pulse * 0.5})`;
  ctx.font = `bold ${Math.min(22, w * 0.042)}px monospace`;
  ctx.shadowColor = `rgba(0,255,100,${pulse * 0.6})`;
  ctx.shadowBlur = 12 + pulse * 8;
  ctx.fillText('TAP / CLICK TO START', w / 2, startY);
  ctx.shadowBlur = 0;

  ctx.textAlign = 'left';
}

// ---- ゲームオーバー ----

function drawGameOver(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FF4444';
  ctx.font = `bold ${Math.min(60, w * 0.1)}px monospace`;
  ctx.shadowColor = '#FF0000';
  ctx.shadowBlur = 16;
  ctx.fillText('GAME OVER', w / 2, h * 0.38);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `${Math.min(20, w * 0.038)}px monospace`;
  ctx.fillText(`Stage reached: ${state.finalStage}`, w / 2, h * 0.52);
  ctx.fillText(`Max size: ${state.maxRadius.toFixed(1)}`, w / 2, h * 0.60);

  ctx.fillStyle = 'rgba(200,220,255,0.8)';
  ctx.font = `${Math.min(16, w * 0.03)}px monospace`;
  ctx.fillText('TAP / CLICK FOR TITLE', w / 2, h * 0.78);
}

// ---- ステージクリア ----

function drawStageClear(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, w, h);

  drawFireworks(ctx, state.fireworks);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFF44';
  ctx.font = `bold ${Math.min(56, w * 0.09)}px monospace`;
  ctx.shadowColor = '#FFEE00';
  ctx.shadowBlur = 18;
  ctx.fillText(`STAGE ${state.stage} CLEAR!`, w / 2, h * 0.42);
  ctx.shadowBlur = 0;

  const pct = Math.min(100, Math.floor(state.clearTimer / 1.2));
  ctx.fillStyle = 'rgba(200,255,200,0.9)';
  ctx.font = `${Math.min(18, w * 0.034)}px monospace`;
  ctx.fillText('Next stage...', w / 2, h * 0.58);
}

// ---- 全クリア ----

function drawAllClear(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number): void {
  ctx.fillStyle = 'rgba(0,0,10,0.75)';
  ctx.fillRect(0, 0, w, h);

  drawFireworks(ctx, state.fireworks);

  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.min(52, w * 0.085)}px monospace`;
  ctx.shadowColor = '#AAFFAA';
  ctx.shadowBlur = 24;

  const rainbow = `hsl(${(state.time * 3) % 360},100%,65%)`;
  ctx.fillStyle = rainbow;
  ctx.fillText('CONGRATULATIONS!', w / 2, h * 0.32);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `${Math.min(22, w * 0.04)}px monospace`;
  ctx.fillText('All stages cleared!', w / 2, h * 0.46);
  ctx.fillText(`Max size: ${state.maxRadius.toFixed(1)}`, w / 2, h * 0.56);

  ctx.fillStyle = 'rgba(200,220,255,0.8)';
  ctx.font = `${Math.min(16, w * 0.03)}px monospace`;
  ctx.fillText('TAP / CLICK FOR TITLE', w / 2, h * 0.76);
}

// ---- メイン描画 ----

export function render(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);

  if (state.screen === 'title') {
    drawTitle(ctx, state, w, h);
    return;
  }

  if (state.screen === 'stageclear') {
    drawBackground(ctx, state, w, h);
    for (const e of state.enemies) drawEnemy(ctx, e, state.slime.radius);
    drawParticles(ctx, state.slime.particles);
    drawSlime(ctx, state.slime, state.time, state.activeEffects);
    drawStageClear(ctx, state, w, h);
    return;
  }

  if (state.screen === 'gameover') {
    drawBackground(ctx, state, w, h);
    for (const e of state.enemies) drawEnemy(ctx, e, state.slime.radius);
    drawSlime(ctx, state.slime, state.time, state.activeEffects);
    drawGameOver(ctx, state, w, h);
    return;
  }

  if (state.screen === 'allclear') {
    drawBackground(ctx, state, w, h);
    drawAllClear(ctx, state, w, h);
    return;
  }

  // playing
  drawBackground(ctx, state, w, h);
  for (const pu of state.powerUps) drawPowerUp(ctx, pu);
  for (const e of state.enemies) drawEnemy(ctx, e, state.slime.radius);
  drawParticles(ctx, state.slime.particles);
  drawSlime(ctx, state.slime, state.time, state.activeEffects);
  drawHUD(ctx, state, w, h);
  drawActiveEffects(ctx, state, w);
}
