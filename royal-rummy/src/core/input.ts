import { GAME_W, GAME_H, type PointerInfo, type Viewport } from "../types";

export type PointerHandler = (e: PointerInfo) => void;
export type KeyHandler = (key: string) => void;

/**
 * Unified input manager.
 * Converts pointer events from screen coords to virtual game coords.
 *
 * Layout strategy:
 * - Canvas fills the full window (CSS 100vw × 100vh).
 * - Scale is chosen so the safe area (GAME_W × GAME_H) always fits entirely.
 * - Extra canvas space beyond the safe area is exposed via `getViewport()`.
 */
export class InputManager {
  private canvas: HTMLCanvasElement;
  private scale = 1;
  /** CSS-pixel offset from the canvas top-left to the safe area top-left. */
  private offsetX = 0;
  private offsetY = 0;
  /** CSS-pixel canvas size. */
  private cssW = 0;
  private cssH = 0;

  onPointerDown: PointerHandler | null = null;
  onPointerMove: PointerHandler | null = null;
  onPointerUp: PointerHandler | null = null;
  onKeyDown: KeyHandler | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.updateLayout();

    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    canvas.addEventListener("pointercancel", this.handlePointerUp);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("resize", this.handleResize);
    // itch.io iframe 内のフルスクリーン切替で window.resize が発火しない/遅延する
    // ブラウザがあるため、fullscreenchange も自前で拾い RAF + 200ms の二段階で
    // canvas を再計測する。2026-04-24 arcane-cards インシデント対応。
    document.addEventListener("fullscreenchange", this.handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", this.handleFullscreenChange);

    // Prevent context menu on long press
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  updateLayout(): void {
    const ww = window.innerWidth;
    const wh = window.innerHeight;

    // Fit safe area entirely inside the window — extra room spills into viewport.
    this.scale = Math.min(ww / GAME_W, wh / GAME_H);
    this.offsetX = (ww - GAME_W * this.scale) / 2;
    this.offsetY = (wh - GAME_H * this.scale) / 2;
    this.cssW = ww;
    this.cssH = wh;

    // Canvas buffer matches CSS pixels (no DPR for now — consistent with prior behavior).
    this.canvas.width = ww;
    this.canvas.height = wh;
    this.canvas.style.width = `${ww}px`;
    this.canvas.style.height = `${wh}px`;
    this.canvas.style.marginLeft = "0";
    this.canvas.style.marginTop = "0";
  }

  getScale(): number {
    return this.scale;
  }

  getOffset(): { x: number; y: number } {
    return { x: this.offsetX, y: this.offsetY };
  }

  /** Visible area in virtual coordinates. Includes space outside the safe area. */
  getViewport(): Viewport {
    return {
      x: -this.offsetX / this.scale,
      y: -this.offsetY / this.scale,
      w: this.cssW / this.scale,
      h: this.cssH / this.scale,
    };
  }

  private toVirtual(e: PointerEvent): PointerInfo {
    return {
      x: (e.clientX - this.offsetX) / this.scale,
      y: (e.clientY - this.offsetY) / this.scale,
      id: e.pointerId,
    };
  }

  private handlePointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.onPointerDown?.(this.toVirtual(e));
  };

  private handlePointerMove = (e: PointerEvent): void => {
    this.onPointerMove?.(this.toVirtual(e));
  };

  private handlePointerUp = (e: PointerEvent): void => {
    this.onPointerUp?.(this.toVirtual(e));
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    this.onKeyDown?.(e.key);
  };

  private handleResize = (): void => {
    this.updateLayout();
  };

  /**
   * itch.io のフルスクリーンボタンは iframe コンテナに requestFullscreen() を呼ぶため
   * window.resize が発火しない/遅延するブラウザがある。RAF で次フレーム + さらに 200ms 後に
   * もう一度 updateLayout() を回し、確実に新しいウィンドウサイズへ追従させる。
   */
  private handleFullscreenChange = (): void => {
    this.updateLayout();
    requestAnimationFrame(() => {
      this.updateLayout();
      setTimeout(() => this.updateLayout(), 200);
    });
  };

  destroy(): void {
    this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.canvas.removeEventListener("pointermove", this.handlePointerMove);
    this.canvas.removeEventListener("pointerup", this.handlePointerUp);
    this.canvas.removeEventListener("pointercancel", this.handlePointerUp);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("fullscreenchange", this.handleFullscreenChange);
    document.removeEventListener("webkitfullscreenchange", this.handleFullscreenChange);
  }
}
