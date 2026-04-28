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
 * (1536×1024, each cell 768×512):
 *   suit 0 = sword  (top-left)
 *   suit 1 = wand   (top-right)
 *   suit 2 = shield (bottom-left)
 *   suit 3 = crown  (bottom-right)
 */
export const SUITS_SHEET_URL = suitsUrl;
const SHEET_CELL_W = 768;
const SHEET_CELL_H = 512;
const SUIT_CELL = [
  { sx: 0,            sy: 0 },
  { sx: SHEET_CELL_W, sy: 0 },
  { sx: 0,            sy: SHEET_CELL_H },
  { sx: SHEET_CELL_W, sy: SHEET_CELL_H },
] as const;

/** Halo color for melds + per-suit medallion glow. Tied to SUIT_BODY hue. */
export const ELEMENT_GLOW = ["#ff6464", "#6ba7ff", "#5fc56e", "#ffd86b"] as const;

/**
 * Per-suit card body palette. Each suit gets a distinct primary color so the
 * suit reads instantly across the table:
 *   sword  → red
 *   wand   → blue
 *   shield → green
 *   crown  → yellow / gold
 *
 * `top` / `bottom` form the vertical velvet gradient; `frame` is the resting
 * border color (highlight state overrides with gold).
 */
const SUIT_BODY = [
  { top: "#7a1c1c", bottom: "#260606", frame: "rgba(255,120,120,0.95)" },
  { top: "#1c3978", bottom: "#06101e", frame: "rgba(130,180,255,0.95)" },
  { top: "#1c5a30", bottom: "#06180c", frame: "rgba(110,210,130,0.95)" },
  { top: "#7a5a18", bottom: "#1f1604", frame: "rgba(255,216,107,1.0)" },
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

  // Outer rune frame — bold suit-tinted at rest, gold halo when highlighted.
  ctx.strokeStyle = highlight ? "#ffd54a" : body.frame;
  ctx.lineWidth = highlight ? 3.4 : 2.4;
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 6);
  ctx.stroke();

  const glow = ELEMENT_GLOW[c.suit] ?? "#ffffff";

  // Suit medallion takes the bottom ~70% of the card so it reads from a
  // distance. Cell aspect is 1.5:1 (768×512) so the destination box scales
  // letterboxed below.
  const medSide = Math.min(w * 0.96, h * 0.78);
  const medX = x + (w - medSide) / 2;
  const medY = y + h * 0.30;
  const sheet = getCachedImage(suitsUrl);
  const cell = SUIT_CELL[c.suit];
  if (sheet && cell) {
    // Cell aspect (1.5:1) doesn't match the square medallion target — letterbox
    // so wider symbols (shield, crown) and tall ones (sword, wand) keep shape.
    const cellAspect = SHEET_CELL_W / SHEET_CELL_H;
    const dstW = medSide;
    const dstH = medSide / cellAspect;
    const dstY = medY + (medSide - dstH) / 2;
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = highlight ? 22 : 10;
    ctx.drawImage(sheet, cell.sx, cell.sy, SHEET_CELL_W, SHEET_CELL_H, medX, dstY, dstW, dstH);
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

  // Rank numeral at the top — pulled higher to make room for the bigger
  // medallion below.
  const label = RANK_LABELS[c.rank];
  const labelLen = label.length;
  const purityFont = labelLen >= 4 ? Math.floor(w * 0.26)
                   : labelLen === 3 ? Math.floor(w * 0.30)
                   : Math.floor(w * 0.34);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "rgba(0,0,0,0.9)";
  ctx.lineWidth = 3.5;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${purityFont}px serif`;
  ctx.strokeText(label, cx, y + h * 0.13);
  ctx.fillText(label, cx, y + h * 0.13);

  ctx.restore();
}
