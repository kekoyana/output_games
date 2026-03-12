export type GamePhase = "title" | "playing" | "danger" | "gameover";

export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  value: number;
  merging: boolean;
  justDropped: boolean;
  dropTimer: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface FloatingScore {
  x: number;
  y: number;
  vy: number;
  value: number;
  life: number;
  maxLife: number;
  combo: number;
}

export interface ComboIndicator {
  combo: number;
  life: number;
  maxLife: number;
  scale: number;
}

export interface GameState {
  phase: GamePhase;
  balls: Ball[];
  particles: Particle[];
  floatingScores: FloatingScore[];
  comboIndicator: ComboIndicator | null;
  score: number;
  highScore: number;
  maxValue: number;
  currentValue: number;
  nextValue: number;
  guideX: number;
  dropCooldown: number;
  dangerTimer: number;
  dangerFlash: number;
  comboCount: number;
  comboResetTimer: number;
  lastMergeTime: number;
}

export interface FieldConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  dangerY: number;
}
