// ---- Enums & Literal Types ----

export type Scene = 'title' | 'playing' | 'gameOver';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type PanelColor = 0 | 1 | 2 | 3 | 4;

// ---- Data Structures ----

export interface Vec2 {
  x: number;
  y: number;
}

export interface Cell {
  /** null = empty cell */
  panel: Panel | null;
}

export interface Panel {
  color: PanelColor;
  /** For animations (fade-in, clear flash) */
  age: number;
  /** If panel is being cleared, this counts down */
  clearing: number;
  /** What chain count this panel was cleared at (0 = not clearing / no chain) */
  chainLevel: number;
  /** Freed-creature flag for visual flair */
  hasCreature: boolean;
}

export interface Player {
  col: number;
  row: number;
  facing: Direction;
  /** Visual interpolation for smooth movement (0..1) */
  moveT: number;
  prevCol: number;
  prevRow: number;
}

/** The next panel to be placed */
export interface NextPanel {
  color: PanelColor;
  /** Queue of upcoming colors */
  queue: PanelColor[];
}

export interface SpawnWarning {
  col: number;
  row: number;
  color: PanelColor;
  timer: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

export interface FreedCreature {
  x: number;
  y: number;
  vy: number;
  alpha: number;
  color: string;
}

export interface ScreenShake {
  intensity: number;
  duration: number;
  elapsed: number;
}

export interface GameState {
  scene: Scene;
  grid: Cell[][];
  cols: number;
  rows: number;
  player: Player;
  nextPanel: NextPanel;
  score: number;
  level: number;
  clearedCount: number;
  clearTarget: number;
  chainCount: number;
  maxChain: number;
  spawnTimer: number;
  spawnInterval: number;
  spawnWarnings: SpawnWarning[];
  particles: Particle[];
  freedCreatures: FreedCreature[];
  screenShake: ScreenShake;
  sceneTimer: number;
  /** For title/game-over input cooldown */
  inputCooldown: number;
  /** Total panels on board */
  panelCount: number;
}

// ---- Debug API ----

export interface DebugInfo {
  scene: Scene;
  score: number;
  level: number;
  panelCount: number;
  chainCount: number;
}

// ---- Input ----

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  action: boolean;
  /** Consumed flags to prevent repeat */
  actionConsumed: boolean;
  moveConsumed: boolean;
  /** Swipe tracking */
  pointerDown: boolean;
  pointerStartX: number;
  pointerStartY: number;
  swipeDir: Direction | null;
}
