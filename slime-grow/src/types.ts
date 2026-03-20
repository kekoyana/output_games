// Slime Grow - 型定義

export type EnemyKind = 'bug' | 'bat' | 'rat' | 'goblin' | 'skeleton';

export type PowerUpKind = 'speed' | 'size' | 'magnet';

export interface PowerUp {
  id: number;
  kind: PowerUpKind;
  x: number;
  y: number;
  radius: number;
  life: number;      // 残り表示フレーム
  bobPhase: number;  // 浮遊アニメーション
}

export interface ActiveEffect {
  kind: PowerUpKind;
  remaining: number; // 残りフレーム
}

export type GameScreen = 'title' | 'playing' | 'stageclear' | 'gameover' | 'allclear';

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  dirTimer: number;
  zigzagAngle: number;
  alive: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  life: number;    // 残りライフ (0〜1)
  decay: number;   // 1フレームあたり減衰
}

export interface SlimeState {
  x: number;
  y: number;
  radius: number;
  wobblePhase: number;
  eatPulse: number;  // 0〜1、食べた瞬間に1→減衰
  particles: Particle[];
}

export interface FireworkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  decay: number;
}

export interface GameState {
  screen: GameScreen;
  stage: number;
  slime: SlimeState;
  enemies: Enemy[];
  powerUps: PowerUp[];
  activeEffects: ActiveEffect[];
  nextEnemyId: number;
  nextPowerUpId: number;
  spawnTimer: number;
  powerUpTimer: number;
  time: number;
  clearTimer: number;
  targetRadius: number;
  shrinkRate: number;
  damageFlash: number;
  finalStage: number;
  finalRadius: number;
  bestStage: number;
  pointerX: number;
  pointerY: number;
  pointerActive: boolean;
  fireworks: FireworkParticle[];
  maxRadius: number;
}

export interface StageConfig {
  stage: number;
  targetRadius: number;
  shrinkRate: number;
  enemyKinds: EnemyKind[];
  spawnInterval: number;
  maxEnemies: number;
  bgColor: string;
  dotColor: string;
}
