import { GAME_W, GAME_H } from "../types";
import { GAME_CONFIG } from "../game-config";
import {
  drawMetallicPlate,
  drawNameTag,
  drawTextWithShadow,
} from "./canvas-utils";

/**
 * Unified modal dialog look. All in-game prompts (start match, CAST? confirm,
 * round result, settings, etc.) flow through this helper so the visual
 * language stays consistent. Built on top of `drawMetallicPlate` + `drawNameTag`
 * (the most polished pre-existing pieces) and exposes layout slots so callers
 * can place their own buttons.
 *
 * Layout (within panel rect):
 *   [header tag pill, vertically straddling top edge]
 *   y +  74px → title (large)
 *   y + 130px → subtitle (medium)
 *   y + 188px → body text line 1
 *   y + 222px → body text line 2 ...
 *   buttonsTop (returned) → caller places buttons
 */

/** Standard backdrop dim — used by every modal. */
export const DIALOG_BACKDROP = "rgba(0,0,0,0.78)";

export interface DialogOpts {
  /** Panel rect. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Optional name-tag pill straddling the top of the panel. */
  headerTag?: string;
  /** Tag accent color (defaults to GAME_CONFIG.accentColor). */
  headerColor?: string;
  /** Title (one line, large). */
  title?: string;
  titleColor?: string;
  /** Title font size (px). Default 42. Use ~30 for long stage-name questions. */
  titleSize?: number;
  /** Subtitle (one line, medium). */
  subtitle?: string;
  subtitleColor?: string;
  /** Optional body lines (rendered below subtitle). */
  body?: string[];
  bodyColor?: string;
  /** Skip drawing the full-screen backdrop (already drawn by caller). */
  skipBackdrop?: boolean;
}

export interface DialogLayout {
  /** Panel rect echoed back. */
  panel: { x: number; y: number; w: number; h: number };
  /** Y of the next available content line after the rendered text block. */
  contentBottom: number;
}

/**
 * Draw the full modal: backdrop + metallic panel + optional name-tag header +
 * title/subtitle/body. Returns layout info so the caller can position buttons
 * below the text block.
 */
export function drawDialog(
  ctx: CanvasRenderingContext2D,
  opts: DialogOpts
): DialogLayout {
  const { x, y, w, h } = opts;

  // 1. Backdrop
  if (!opts.skipBackdrop) {
    ctx.save();
    ctx.fillStyle = DIALOG_BACKDROP;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.restore();
  }

  // 2. Metallic plate panel — same recipe as select-scene confirm dialog.
  drawMetallicPlate(ctx, x, y, w, h, {
    radius: 24,
    accent: "#172033",
    dim: 0.28,
    hairlines: true,
    glow: true,
    glowColor: opts.headerColor ?? GAME_CONFIG.accentColor,
    noCenterGloss: true,
  });

  // 3. Optional name-tag pill straddling the top edge.
  if (opts.headerTag) {
    const tagFontSize = 26;
    const tagPadX = 26;
    ctx.save();
    ctx.font = `800 ${tagFontSize}px 'Hiragino Sans','Yu Gothic','Helvetica Neue',sans-serif`;
    const textW = ctx.measureText(opts.headerTag).width;
    ctx.restore();
    const pillW = 4;
    const pillGap = 10;
    const tagW = Math.ceil(textW + tagPadX * 2 + pillW + pillGap);
    drawNameTag(ctx, GAME_W / 2 - tagW / 2, y + 4, opts.headerTag, {
      accent: opts.headerColor ?? GAME_CONFIG.accentColor,
      height: 46,
      fontSize: tagFontSize,
      paddingX: tagPadX,
    });
  }

  // 4. Title / subtitle / body block.
  let cursorY = y + 90;
  if (opts.title) {
    const tSize = opts.titleSize ?? 42;
    drawTextWithShadow(ctx, opts.title, x + w / 2, cursorY, {
      font: `900 ${tSize}px 'Helvetica Neue','Arial',sans-serif`,
      color: opts.titleColor ?? "#fff",
      shadowBlur: 8,
    });
    cursorY += Math.round(tSize * 1.32);
  }
  if (opts.subtitle) {
    drawTextWithShadow(ctx, opts.subtitle, x + w / 2, cursorY, {
      font: "bold 30px 'Helvetica Neue','Arial',sans-serif",
      color: opts.subtitleColor ?? "#ffd54a",
      shadowBlur: 6,
    });
    cursorY += 44;
  }
  if (opts.body) {
    for (const line of opts.body) {
      drawTextWithShadow(ctx, line, x + w / 2, cursorY, {
        font: "bold 24px 'Helvetica Neue','Arial',sans-serif",
        color: opts.bodyColor ?? "#e6e8ee",
        shadowBlur: 4,
      });
      cursorY += 34;
    }
  }

  return {
    panel: { x, y, w, h },
    contentBottom: cursorY,
  };
}

/** Draw just the standardized full-screen dim backdrop. */
export function drawDialogBackdrop(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = DIALOG_BACKDROP;
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  ctx.restore();
}
