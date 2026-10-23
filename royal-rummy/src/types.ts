/** Virtual canvas dimensions */
export const GAME_W = 1024;
export const GAME_H = 1400;

/** Pointer input info in virtual coordinates */
export interface PointerInfo {
  x: number;
  y: number;
  id: number;
}

/** Rectangle for hit testing */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Visible area of the canvas in virtual coordinates.
 * The safe area (0, 0, GAME_W, GAME_H) is always contained inside the viewport.
 * - On PC/wide screens: x < 0, w > GAME_W (extra horizontal canvas room).
 * - On tall phone screens: y < 0, h > GAME_H (extra vertical canvas room).
 */
export interface Viewport {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Particle for visual effects */
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

/** Build mode feature flags (injected by Vite) */
declare global {
  const __DEV__: boolean;
}
