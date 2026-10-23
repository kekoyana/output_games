// 環境検出とレイアウト寸法定義
// スマホ縦持ち = portrait (540x960)
// スマホ横持ち = portrait + rotate-overlay 警告（CSS で表示）
// PC / タブレット横 = landscape (1280x720)

export type LayoutMode = "portrait" | "landscape";

export const PORTRAIT_W = 540;
export const PORTRAIT_H = 960;
export const LANDSCAPE_W = 1280;
export const LANDSCAPE_H = 720;

/**
 * 起動時の環境からレイアウトモードを判定する。
 * - 短辺 < 500px（スマホ画面想定）: portrait（横持ちでも CSS overlay で警告）
 * - aspect ≥ 1.3 かつ 短辺 ≥ 500px: landscape（PC・タブレット横）
 * - その他: portrait
 */
export function detectLayoutMode(): LayoutMode {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const shortEdge = Math.min(w, h);
  const aspect = w / h;
  if (shortEdge < 500) return "portrait";
  if (aspect >= 1.3) return "landscape";
  return "portrait";
}

let currentMode: LayoutMode = detectLayoutMode();

export function getLayoutMode(): LayoutMode {
  return currentMode;
}

export function setLayoutMode(m: LayoutMode): void {
  currentMode = m;
}

export function getDesignSize(): { w: number; h: number } {
  return currentMode === "landscape"
    ? { w: LANDSCAPE_W, h: LANDSCAPE_H }
    : { w: PORTRAIT_W, h: PORTRAIT_H };
}

export function isLandscape(): boolean {
  return currentMode === "landscape";
}
