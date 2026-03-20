// Slime Grow - ユーティリティ

import type { StageConfig, EnemyKind } from './types';

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export const ENEMY_RADIUS: Record<EnemyKind, [number, number]> = {
  bug:      [5,  9],
  bat:      [10, 15],
  rat:      [13, 19],
  goblin:   [20, 28],
  skeleton: [26, 36],
};

export const ENEMY_SPEED: Record<EnemyKind, number> = {
  bug:      1.2,
  bat:      2.8,
  rat:      1.8,
  goblin:   0.8,
  skeleton: 1.4,
};

export const ENEMY_COLOR: Record<EnemyKind, string> = {
  bug:      '#8B6914',
  bat:      '#7B3FA0',
  rat:      '#888888',
  goblin:   '#5CA832',
  skeleton: '#E8E8E8',
};

export const STAGE_CONFIGS: StageConfig[] = [
  {
    stage: 1,
    targetRadius: 60,
    shrinkRate: 0.008,
    enemyKinds: ['bug', 'bug', 'bug', 'bug', 'bug'],
    spawnInterval: 30,
    maxEnemies: 25,
    bgColor: '#0d1b2a',
    dotColor: '#1a2e45',
  },
  {
    stage: 2,
    targetRadius: 80,
    shrinkRate: 0.010,
    enemyKinds: ['bug', 'bug', 'bug', 'bat', 'bat'],
    spawnInterval: 35,
    maxEnemies: 25,
    bgColor: '#0a2012',
    dotColor: '#123020',
  },
  {
    stage: 3,
    targetRadius: 100,
    shrinkRate: 0.013,
    enemyKinds: ['bug', 'bug', 'bat', 'bat', 'rat'],
    spawnInterval: 35,
    maxEnemies: 28,
    bgColor: '#1a1a08',
    dotColor: '#2a2a12',
  },
  {
    stage: 4,
    targetRadius: 120,
    shrinkRate: 0.016,
    enemyKinds: ['bug', 'bat', 'rat', 'goblin', 'goblin'],
    spawnInterval: 30,
    maxEnemies: 30,
    bgColor: '#1a0a2a',
    dotColor: '#2a1240',
  },
  {
    stage: 5,
    targetRadius: 150,
    shrinkRate: 0.020,
    enemyKinds: ['bat', 'rat', 'goblin', 'skeleton', 'skeleton'],
    spawnInterval: 28,
    maxEnemies: 32,
    bgColor: '#2a0808',
    dotColor: '#3a1010',
  },
];

export const POWERUP_COLOR: Record<import('./types').PowerUpKind, string> = {
  speed:  '#FFD700',
  size:   '#44BBFF',
  magnet: '#CC44FF',
};

export const POWERUP_DURATION = 300; // 5秒 (60fps)

export function getStageConfig(stage: number): StageConfig {
  return STAGE_CONFIGS[clamp(stage - 1, 0, STAGE_CONFIGS.length - 1)];
}

// 画面サイズに依存しない難易度を実現するためのスケール係数
// 基準解像度 960x540 を基準に、速度・敵数をスケーリングする
const REF_W = 960;
const REF_H = 540;
const REF_AREA = REF_W * REF_H;

/** 速度スケール: sqrt(面積比) — 移動距離を画面サイズに比例させる */
export function speedScale(w: number, h: number): number {
  return Math.sqrt((w * h) / REF_AREA);
}

/** 敵数スケール: 面積比 — 敵密度を一定に保つ */
export function enemyCountScale(w: number, h: number): number {
  return (w * h) / REF_AREA;
}

/** 距離スケール（マグネット範囲など）: speedScaleと同じ */
export function distScale(w: number, h: number): number {
  return Math.sqrt((w * h) / REF_AREA);
}

export function slimeBodyColor(radius: number, pulse: number): string {
  const t = clamp((radius - 15) / 55, 0, 1);
  const r = Math.round(lerp(140, 20, t) + pulse * 60);
  const g = Math.round(lerp(220, 160, t) + pulse * 60);
  const b = Math.round(lerp(140, 30, t) + pulse * 40);
  return `rgb(${clamp(r,0,255)},${clamp(g,0,255)},${clamp(b,0,255)})`;
}
