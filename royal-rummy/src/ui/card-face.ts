/**
 * Single-card face renderer.
 *
 * Extracted from game-scene so the tutorial scene can render sample cards
 * with the exact same visual identity. Self-contained: imports the element
 * icon assets and exports the constants game-scene needs (e.g. ELEMENT_GLOW
 * for meld halos).
 */
import type { Card } from "../game/gin-rummy";
import { RANK_LABELS } from "../game/gin-rummy";
import { roundRect } from "./canvas-utils";
import { getCachedImage, loadImage } from "../core/image-loader";
import suitsUrl from "../assets/symbols/suits.png";

/**
 * Suit sprite sheet layout. The user-supplied suits.png is a 2×2 grid
 * (1254×1254, each cell 627×627):
 *   suit 0 = sword  (top-left)
 *   suit 1 = wand   (top-right)
 *   suit 2 = shield (bottom-left)
 *   suit 3 = crown  (bottom-right)
 */
export const SUITS_SHEET_URL = suitsUrl;
const SHEET_CELL = 627;
const SUIT_CELL = [
  { sx: 0,          sy: 0 },
  { sx: SHEET_CELL, sy: 0 },
  { sx: 0,          sy: SHEET_CELL },
  { sx: SHEET_CELL, sy: SHEET_CELL },
] as const;

export const ELEMENT_GLOW = ["#cfd6e6", "#c79052", "#7eb6ff", "#ffd86b"] as const;

/**
 * Per-suit card body palette. Top/bottom drive the velvet gradient mount and
 * `frame` is the resting border color (highlight overrides this with gold).
 *   sword  → cool steel-blue
 *   wand   → warm umber/wood
 *   shield → deep azure
 *   crown  → royal gold-violet
 */
const SUIT_BODY = [
  { top: "#2c3a4e", bottom: "#0c1218", frame: "rgba(180,200,220,0.65)" },
  { top: "#3d2b18", bottom: "#170b04", frame: "rgba(199,144,82,0.65)" },
  { top: "#1c2c4a", bottom: "#080f1c", frame: "rgba(126,182,255,0.65)" },
  { top: "#3a2c14", bottom: "#1a0e04", frame: "rgba(255,216,107,0.7)" },
] as const;

/** Kick off image decode for the suit sprite sheet; safe to call multiple times. */
export function preloadElementIcons(): void {
  loadImage(suitsUrl).catch(() => { /* ignore */ });
}

/**
 * Render one card face at (x,y,w,h). When `highlight` is true the rune frame
 * pulses gold and the element medallion glows brighter — used for selection
 * and meld highlighting.
 */
export function drawCardFace(
  ctx: CanvasRenderingContext2D,
  c: Card,
  x: number,
  y: number,
  w: number,
  h: number,
  highlight: boolean
): void {
  ctx.save();
  const cx = x + w / 2;

  // Drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  roundRect(ctx, x + 2, y + 3, w, h, 6);
  ctx.fill();

  // Per-suit velvet mount so the suit reads instantly from across the table.
  const body = SUIT_BODY[c.suit] ?? SUIT_BODY[0];
  const mountGrad = ctx.createLinearGradient(x, y, x, y + h);
  mountGrad.addColorStop(0, body.top);
  mountGrad.addColorStop(1, body.bottom);
  ctx.fillStyle = mountGrad;
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();

  // Outer rune frame — suit-tinted at rest, gold halo when highlighted.
  ctx.strokeStyle = highlight ? "#ffd54a" : body.frame;
  ctx.lineWidth = highlight ? 3.2 : 1.4;
  roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 6);
  ctx.stroke();

  const glow = ELEMENT_GLOW[c.suit] ?? "#ffffff";

  // Element medallion sits in the lower ~58% of the card
  const medSide = Math.min(w * 0.82, h * 0.58);
  const medX = x + (w - medSide) / 2;
  const medY = y + h * 0.40;
  const sheet = getCachedImage(suitsUrl);
  const cell = SUIT_CELL[c.suit];
  if (sheet && cell) {
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = highlight ? 22 : 10;
    ctx.drawImage(sheet, cell.sx, cell.sy, SHEET_CELL, SHEET_CELL, medX, medY, medSide, medSide);
    ctx.restore();
  } else {
    // Fallback while image decodes — colored disc keeps element identity.
    ctx.save();
    ctx.fillStyle = `${glow}33`;
    ctx.beginPath();
    ctx.arc(medX + medSide / 2, medY + medSide / 2, medSide * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Purity (rank) numeral at top centre — large, gold, with stroke for contrast
  const label = RANK_LABELS[c.rank];
  const labelLen = label.length;
  const purityFont = labelLen >= 4 ? Math.floor(w * 0.28)
                   : labelLen === 3 ? Math.floor(w * 0.32)
                   : Math.floor(w * 0.38);
  ctx.fillStyle = "#ffe18a";
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = 3.5;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${purityFont}px serif`;
  ctx.strokeText(label, cx, y + h * 0.18);
  ctx.fillText(label, cx, y + h * 0.18);

  ctx.restore();
}
