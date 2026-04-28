import type { PointerInfo, Viewport } from "../types";

export type SceneName =
  | "title"
  | "select"
  | "loading"
  | "tutorial"
  | "game"
  | "round_clear"
  | "stage_clear"
  | "gameover"
  | "ending";

/** Context passed to scenes for cross-scene communication */
export interface SceneContext {
  changeScene(name: SceneName, data?: Record<string, unknown>): void;
  getCanvas(): HTMLCanvasElement;
  getCtx(): CanvasRenderingContext2D;
  /** Visible area in virtual coords (includes space outside the safe area). */
  getViewport(): Viewport;
  /** Data passed from the previous scene */
  data: Record<string, unknown>;
}

/** Scene interface — implement per scene */
export interface Scene {
  enter(ctx: SceneContext): void;
  exit(): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  onPointerDown?(e: PointerInfo): void;
  onPointerMove?(e: PointerInfo): void;
  onPointerUp?(e: PointerInfo): void;
  onKeyDown?(key: string): void;
  /** Return true to hide the system UI (settings gear) while this scene is active. */
  isSystemUiHidden?(): boolean;
}
