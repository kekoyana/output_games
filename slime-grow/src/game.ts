// Slime Grow - ゲームロジック

import type { GameState, Enemy, EnemyKind, Particle, FireworkParticle, SlimeState, PowerUp, PowerUpKind, ActiveEffect } from './types';
import {
  clamp, randRange, dist,
  ENEMY_RADIUS, ENEMY_SPEED, ENEMY_COLOR,
  POWERUP_COLOR, POWERUP_DURATION,
  getStageConfig, GAME_W, GAME_H,
} from './utils';

const SLIME_INIT_RADIUS = 15;
const SLIME_MIN_RADIUS = 5;
const BASE_SPEED = 3.0;
const EAT_GROWTH = 0.3;
const DAMAGE_BASE = 5;
const DAMAGE_RATIO = 0.1;
const MAX_STAGE = 5;

// ---- 初期化 ----

function makeSlime(w: number, h: number): SlimeState {
  return {
    x: w / 2,
    y: h / 2,
    radius: SLIME_INIT_RADIUS,
    wobblePhase: 0,
    eatPulse: 0,
    particles: [],
  };
}

export function createTitleState(bestStage: number): GameState {
  const w = GAME_W;
  const h = GAME_H;
  const cfg = getStageConfig(1);
  return {
    screen: 'title',
    stage: 1,
    slime: { ...makeSlime(w, h), radius: 30 },
    enemies: [],
    powerUps: [],
    activeEffects: [],
    nextEnemyId: 0,
    nextPowerUpId: 0,
    spawnTimer: 0,
    powerUpTimer: 0,
    time: 0,
    clearTimer: 0,
    targetRadius: cfg.targetRadius,
    shrinkRate: cfg.shrinkRate,
    damageFlash: 0,
    finalStage: 1,
    finalRadius: SLIME_INIT_RADIUS,
    bestStage,
    pointerX: w / 2,
    pointerY: h / 2,
    pointerActive: false,
    fireworks: [],
    maxRadius: SLIME_INIT_RADIUS,
  };
}

export function createPlayState(stage: number, bestStage: number): GameState {
  const w = GAME_W;
  const h = GAME_H;
  const cfg = getStageConfig(stage);
  const state: GameState = {
    screen: 'playing',
    stage,
    slime: makeSlime(w, h),
    enemies: [],
    powerUps: [],
    activeEffects: [],
    nextEnemyId: 0,
    nextPowerUpId: 0,
    spawnTimer: 0,
    powerUpTimer: 0,
    time: 0,
    clearTimer: 0,
    targetRadius: cfg.targetRadius,
    shrinkRate: cfg.shrinkRate,
    damageFlash: 0,
    finalStage: stage,
    finalRadius: SLIME_INIT_RADIUS,
    bestStage,
    pointerX: w / 2,
    pointerY: h / 2,
    pointerActive: false,
    fireworks: [],
    maxRadius: SLIME_INIT_RADIUS,
  };
  // 開始時に食べやすい小さな虫を画面内に配置
  for (let i = 0; i < 8; i++) {
    const [rMin, rMax] = ENEMY_RADIUS.bug;
    const radius = randRange(rMin, rMax);
    const margin = 60;
    const ex = randRange(margin, w - margin);
    const ey = randRange(margin, h - margin);
    // スライムの近くには置かない
    const d = dist(ex, ey, w / 2, h / 2);
    if (d < 80) continue;
    const angle = Math.random() * Math.PI * 2;
    const spd = randRange(0.8, 1.5);
    state.enemies.push({
      id: state.nextEnemyId++,
      kind: 'bug',
      x: ex, y: ey,
      radius,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      dirTimer: Math.floor(randRange(30, 90)),
      zigzagAngle: 0,
      alive: true,
    });
  }
  return state;
}

// ---- 敵スポーン ----

function pickEnemyKind(stage: number): EnemyKind {
  const cfg = getStageConfig(stage);
  const idx = Math.floor(Math.random() * cfg.enemyKinds.length);
  return cfg.enemyKinds[idx];
}

function spawnEnemy(state: GameState, w: number, h: number): void {
  const cfg = getStageConfig(state.stage);
  const kind = pickEnemyKind(state.stage);
  const [rMin, rMax] = ENEMY_RADIUS[kind];
  const radius = randRange(rMin, rMax);

  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  const mg = radius + 20;
  if (side === 0) { x = randRange(0, w); y = -mg; }
  else if (side === 1) { x = w + mg; y = randRange(0, h); }
  else if (side === 2) { x = randRange(0, w); y = h + mg; }
  else { x = -mg; y = randRange(0, h); }

  const angle = Math.atan2(h / 2 - y, w / 2 - x) + randRange(-0.6, 0.6);
  const spd = ENEMY_SPEED[kind] * randRange(0.8, 1.3);

  const enemy: Enemy = {
    id: state.nextEnemyId++,
    kind,
    x, y,
    radius,
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd,
    dirTimer: Math.floor(randRange(30, 90)),
    zigzagAngle: 0,
    alive: true,
  };
  state.enemies.push(enemy);
  void cfg; // suppress unused warning
}

// ---- 敵移動 ----

function updateEnemy(e: Enemy, slime: SlimeState, w: number, h: number): void {
  e.dirTimer--;
  e.zigzagAngle += 0.12;

  if (e.kind === 'bug') {
    if (e.dirTimer <= 0) {
      const a = Math.random() * Math.PI * 2;
      const spd = randRange(0.9, 1.8);
      e.vx = Math.cos(a) * spd;
      e.vy = Math.sin(a) * spd;
      e.dirTimer = Math.floor(randRange(30, 80));
    }
  } else if (e.kind === 'bat') {
    if (e.dirTimer <= 0) {
      const a = Math.random() * Math.PI * 2;
      const spd = randRange(2.2, 3.8);
      e.vx = Math.cos(a) * spd;
      e.vy = Math.sin(a) * spd;
      e.dirTimer = Math.floor(randRange(15, 45));
    }
  } else if (e.kind === 'rat') {
    if (e.dirTimer <= 0) {
      const a = Math.random() * Math.PI * 2;
      const spd = randRange(1.5, 2.8);
      e.vx = Math.cos(a) * spd;
      e.vy = Math.sin(a) * spd;
      e.dirTimer = Math.floor(randRange(25, 60));
    }
    // ジグザグ: 進行方向の垂直成分を加算
    const norm = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
    if (norm > 0) {
      const px = -e.vy / norm;
      const py = e.vx / norm;
      const zz = Math.sin(e.zigzagAngle) * 1.8;
      e.x += e.vx + px * zz;
      e.y += e.vy + py * zz;
    } else {
      e.x += e.vx;
      e.y += e.vy;
    }
    bounceEnemy(e, w, h);
    return;
  } else if (e.kind === 'goblin') {
    if (e.dirTimer <= 0) {
      const a = Math.random() * Math.PI * 2;
      const spd = randRange(0.5, 1.1);
      e.vx = Math.cos(a) * spd;
      e.vy = Math.sin(a) * spd;
      e.dirTimer = Math.floor(randRange(60, 130));
    }
  } else if (e.kind === 'skeleton') {
    // プレイヤー追尾
    const dx = slime.x - e.x;
    const dy = slime.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 0) {
      const spd = randRange(1.1, 1.7);
      e.vx = (dx / d) * spd;
      e.vy = (dy / d) * spd;
    }
  }

  e.x += e.vx;
  e.y += e.vy;
  bounceEnemy(e, w, h);
}

function bounceEnemy(e: Enemy, w: number, h: number): void {
  const r = e.radius;
  if (e.x < r) { e.x = r; e.vx = Math.abs(e.vx); }
  if (e.x > w - r) { e.x = w - r; e.vx = -Math.abs(e.vx); }
  if (e.y < r) { e.y = r; e.vy = Math.abs(e.vy); }
  if (e.y > h - r) { e.y = h - r; e.vy = -Math.abs(e.vy); }
}

// ---- パーティクル ----

function spawnParticles(
  particles: Particle[],
  x: number, y: number,
  color: string,
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = randRange(1.5, 5.0);
    particles.push({
      x, y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      radius: randRange(2, 5),
      color,
      life: 1,
      decay: 1 / randRange(20, 45),
    });
  }
}

function updateParticles(particles: Particle[]): Particle[] {
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.93;
    p.vy *= 0.93;
    p.life -= p.decay;
  }
  return particles.filter(p => p.life > 0);
}

// ---- 花火 ----

function spawnFireworks(state: GameState, w: number, h: number): void {
  const count = 60;
  for (let i = 0; i < count; i++) {
    const px = randRange(w * 0.2, w * 0.8);
    const py = randRange(h * 0.1, h * 0.6);
    const a = Math.random() * Math.PI * 2;
    const spd = randRange(1, 6);
    const fw: FireworkParticle = {
      x: px, y: py,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      color: `hsl(${Math.floor(Math.random() * 360)},90%,65%)`,
      life: 1,
      decay: 1 / randRange(40, 80),
    };
    state.fireworks.push(fw);
  }
}

function updateFireworks(fireworks: FireworkParticle[]): FireworkParticle[] {
  for (const fw of fireworks) {
    fw.x += fw.vx;
    fw.y += fw.vy;
    fw.vy += 0.05;
    fw.vx *= 0.97;
    fw.vy *= 0.97;
    fw.life -= fw.decay;
  }
  return fireworks.filter(fw => fw.life > 0);
}

// ---- 特殊エサ ----

function spawnPowerUp(state: GameState, w: number, h: number): void {
  const kinds: PowerUpKind[] = ['speed', 'size', 'magnet'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const margin = 60;
  const pu: PowerUp = {
    id: state.nextPowerUpId++,
    kind,
    x: randRange(margin, w - margin),
    y: randRange(margin, h - margin),
    radius: 12,
    life: 600, // 10秒間表示
    bobPhase: Math.random() * Math.PI * 2,
  };
  state.powerUps.push(pu);
}

function activatePowerUp(state: GameState, kind: PowerUpKind): void {
  // 同種の効果がある場合は時間をリセット
  const existing = state.activeEffects.find(e => e.kind === kind);
  if (existing) {
    existing.remaining = POWERUP_DURATION;
  } else {
    state.activeEffects.push({ kind, remaining: POWERUP_DURATION });
  }
}

// ---- メインupdate ----

export function updateGame(state: GameState, w: number, h: number): GameState {
  state.time++;

  if (state.screen === 'title') {
    state.slime.wobblePhase += 0.05;
    state.slime.x = w / 2 + Math.cos(state.time * 0.015) * 50;
    state.slime.y = h / 2 + Math.sin(state.time * 0.020) * 30;
    return state;
  }

  if (state.screen === 'stageclear') {
    state.clearTimer++;
    state.fireworks = updateFireworks(state.fireworks);
    if (state.clearTimer % 25 === 0) {
      spawnFireworks(state, w, h);
    }
    if (state.clearTimer >= 120) {
      const nextStage = state.stage + 1;
      const newBest = Math.max(state.bestStage, state.stage);
      if (nextStage > MAX_STAGE) {
        const next = createPlayState(MAX_STAGE, newBest);
        next.screen = 'allclear';
        next.finalStage = MAX_STAGE;
        next.finalRadius = state.slime.radius;
        next.maxRadius = state.maxRadius;
        spawnFireworks(next, w, h);
        return next;
      }
      return createPlayState(nextStage, newBest);
    }
    return state;
  }

  if (state.screen === 'gameover' || state.screen === 'allclear') {
    state.fireworks = updateFireworks(state.fireworks);
    if (state.screen === 'allclear' && state.time % 30 === 0) {
      spawnFireworks(state, w, h);
    }
    return state;
  }

  // playing
  const slime = state.slime;
  const cfg = getStageConfig(state.stage);

  // スライム移動
  const dx = state.pointerX - slime.x;
  const dy = state.pointerY - slime.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const hasSpeed = state.activeEffects.some(e => e.kind === 'speed');
  const speedMul = clamp(1.0 - (slime.radius - SLIME_INIT_RADIUS) * 0.004, 0.5, 1.0);
  const spd = BASE_SPEED * speedMul * (hasSpeed ? 1.8 : 1.0);
  if (d > 2) {
    const mv = Math.min(spd, d);
    slime.x += (dx / d) * mv;
    slime.y += (dy / d) * mv;
  }
  slime.x = clamp(slime.x, slime.radius, w - slime.radius);
  slime.y = clamp(slime.y, slime.radius, h - slime.radius);

  slime.wobblePhase += 0.08;
  slime.eatPulse = Math.max(0, slime.eatPulse - 0.06);

  // 縮小
  slime.radius -= state.shrinkRate;
  if (slime.radius <= SLIME_MIN_RADIUS) {
    slime.radius = SLIME_MIN_RADIUS;
    state.screen = 'gameover';
    state.finalStage = state.stage;
    state.finalRadius = slime.radius;
    return state;
  }

  if (slime.radius > state.maxRadius) state.maxRadius = slime.radius;

  // ダメージフラッシュ減衰
  state.damageFlash = Math.max(0, state.damageFlash - 0.05);

  // 特殊エサスポーン（約8秒に1個）
  state.powerUpTimer++;
  if (state.powerUpTimer >= 480 && state.powerUps.length < 3) {
    spawnPowerUp(state, w, h);
    state.powerUpTimer = 0;
  }

  // 特殊エサ更新・収集
  for (const pu of state.powerUps) {
    pu.bobPhase += 0.06;
    pu.life--;
    const d3 = dist(slime.x, slime.y, pu.x, pu.y);
    if (d3 < slime.radius + pu.radius) {
      pu.life = 0; // 回収
      activatePowerUp(state, pu.kind);
      spawnParticles(slime.particles, pu.x, pu.y, POWERUP_COLOR[pu.kind], 15);
    }
  }
  state.powerUps = state.powerUps.filter(pu => pu.life > 0);

  // アクティブエフェクト更新
  for (const eff of state.activeEffects) {
    eff.remaining--;
  }
  state.activeEffects = state.activeEffects.filter(e => e.remaining > 0);

  // 磁石効果: 小さい敵を吸い寄せる
  const hasMagnet = state.activeEffects.some(e => e.kind === 'magnet');
  if (hasMagnet) {
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (e.radius < slime.radius * 0.95) {
        const mdx = slime.x - e.x;
        const mdy = slime.y - e.y;
        const md = Math.sqrt(mdx * mdx + mdy * mdy);
        if (md > 0 && md < 200) {
          const pull = 2.0;
          e.x += (mdx / md) * pull;
          e.y += (mdy / md) * pull;
        }
      }
    }
  }

  // 敵スポーン
  state.spawnTimer++;
  if (state.spawnTimer >= cfg.spawnInterval && state.enemies.length < cfg.maxEnemies) {
    spawnEnemy(state, w, h);
    state.spawnTimer = 0;
  }

  // 敵更新・衝突
  for (const e of state.enemies) {
    if (!e.alive) continue;
    updateEnemy(e, slime, w, h);

    const d2 = dist(slime.x, slime.y, e.x, e.y);
    if (d2 < slime.radius + e.radius) {
      if (e.radius < slime.radius * 0.95) {
        // 食べる
        e.alive = false;
        const hasSize = state.activeEffects.some(ef => ef.kind === 'size');
        slime.radius += e.radius * EAT_GROWTH * (hasSize ? 2.0 : 1.0);
        slime.eatPulse = 1;
        spawnParticles(slime.particles, e.x, e.y, ENEMY_COLOR[e.kind], 10);
      } else if (e.radius > slime.radius * 1.05) {
        // ダメージ
        e.alive = false;
        const dmg = DAMAGE_BASE + e.radius * DAMAGE_RATIO;
        slime.radius -= dmg;
        state.damageFlash = 1;
        spawnParticles(slime.particles, slime.x, slime.y, '#FF4444', 8);
        if (slime.radius <= SLIME_MIN_RADIUS) {
          slime.radius = SLIME_MIN_RADIUS;
          state.screen = 'gameover';
          state.finalStage = state.stage;
          state.finalRadius = slime.radius;
          return state;
        }
      }
      // ほぼ同サイズは何もしない
    }
  }
  state.enemies = state.enemies.filter(e => e.alive);

  // パーティクル更新
  slime.particles = updateParticles(slime.particles);

  // ステージクリア判定
  if (slime.radius >= state.targetRadius) {
    state.screen = 'stageclear';
    state.clearTimer = 0;
    spawnFireworks(state, w, h);
    return state;
  }

  return state;
}

export function onPointerMove(state: GameState, x: number, y: number): void {
  state.pointerX = x;
  state.pointerY = y;
  state.pointerActive = true;
}

export function onTap(state: GameState): GameState {
  if (state.screen === 'title') {
    return createPlayState(1, state.bestStage);
  }
  if (state.screen === 'gameover' || state.screen === 'allclear') {
    return createTitleState(state.bestStage);
  }
  return state;
}
