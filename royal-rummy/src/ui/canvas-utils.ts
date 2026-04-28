import { GAME_W, GAME_H, type Viewport } from "../types";

/** Draw a rounded rectangle path */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** Draw vignette overlay. If `viewport` is given, covers the full visible area. */
export function drawVignette(
  ctx: CanvasRenderingContext2D,
  alpha = 0.4,
  viewport?: Viewport
): void {
  const vx = viewport?.x ?? 0;
  const vy = viewport?.y ?? 0;
  const vw = viewport?.w ?? GAME_W;
  const vh = viewport?.h ?? GAME_H;
  const cx = vx + vw / 2;
  const cy = vy + vh / 2;
  const r = Math.max(vw, vh) * 0.7;
  const grad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
  grad.addColorStop(0, `rgba(0,0,0,0)`);
  grad.addColorStop(1, `rgba(0,0,0,${alpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(vx, vy, vw, vh);
}

/**
 * Wrap a body of text to a max width.
 * - If the input contains spaces, breaks at word boundaries.
 * - Otherwise (CJK languages without word spaces) breaks character-by-character.
 *
 * Single tokens longer than maxWidth are still split character-by-character so
 * the result never overflows. Caller must set ctx.font BEFORE calling so that
 * measureText reflects the rendered metrics.
 */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const flushChars = (token: string): void => {
    let cur = "";
    for (const ch of token) {
      const test = cur + ch;
      if (ctx.measureText(test).width > maxWidth && cur.length > 0) {
        lines.push(cur);
        cur = ch;
      } else {
        cur = test;
      }
    }
    if (cur.length > 0) {
      // If there's already a partial line in `lines`, leave it; this token's
      // remainder becomes its own line. Caller decides downstream whether to
      // merge.
      lines.push(cur);
    }
  };

  if (text.includes(" ")) {
    const words = text.split(" ");
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        // The word itself may exceed maxWidth (e.g. extremely long URL or CJK
        // segment glued to a Latin word); split it character-by-character.
        if (ctx.measureText(word).width > maxWidth) {
          flushChars(word);
          current = "";
        } else {
          current = word;
        }
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  } else {
    flushChars(text);
  }
  return lines;
}

/** Draw text with shadow */
export function drawTextWithShadow(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: {
    font: string;
    color: string;
    shadowColor?: string;
    shadowBlur?: number;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
  }
): void {
  ctx.save();
  ctx.font = opts.font;
  ctx.fillStyle = opts.color;
  ctx.textAlign = opts.align ?? "center";
  ctx.textBaseline = opts.baseline ?? "middle";
  ctx.shadowColor = opts.shadowColor ?? "rgba(0,0,0,0.8)";
  ctx.shadowBlur = opts.shadowBlur ?? 6;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * Cinematic banner title (STAGE CLEAR / ROUND CLEAR style).
 * Heavy industrial font, wide tracking, metallic gradient, dual stroke, glow,
 * optional subtitle, and thin rule lines.
 */
export function drawCinematicTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: {
    size: number;
    accent?: string;
    tracking?: number;
    subtitle?: string;
    subtitleSize?: number;
    italic?: boolean;
    rules?: boolean;
    rulesWidth?: number;
  }
): void {
  const accent = opts.accent ?? "#ffd27a";
  const tracking = opts.tracking ?? Math.max(6, opts.size * 0.1);
  const italic = opts.italic ?? true;
  const family = `'Arial Black', 'Helvetica Neue', Impact, sans-serif`;
  const style = italic ? "900 italic" : "900";
  const textUp = text.toUpperCase();

  ctx.save();
  ctx.font = `${style} ${opts.size}px ${family}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const chars = [...textUp];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const totalW =
    widths.reduce((s, w) => s + w, 0) + tracking * Math.max(0, chars.length - 1);
  const startX = x - totalW / 2;

  const forEachGlyph = (fn: (ch: string, cx: number) => void): void => {
    let cx = startX;
    for (let i = 0; i < chars.length; i++) {
      fn(chars[i], cx);
      cx += widths[i] + tracking;
    }
  };

  // 1) Outer glow (accent-colored halo behind everything)
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = Math.max(18, opts.size * 0.3);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.35;
  forEachGlyph((ch, cx) => ctx.fillText(ch, cx, y));
  ctx.restore();

  // 2) Heavy black stroke (outer outline)
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = Math.max(8, opts.size * 0.1);
  forEachGlyph((ch, cx) => ctx.strokeText(ch, cx, y));

  // 3) Accent-colored stroke (inner bevel)
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(2.5, opts.size * 0.028);
  forEachGlyph((ch, cx) => ctx.strokeText(ch, cx, y));

  // 4) Metallic gradient fill
  const top = y - opts.size * 0.55;
  const bottom = y + opts.size * 0.55;
  const grad = ctx.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0.0, "#ffffff");
  grad.addColorStop(0.35, accent);
  grad.addColorStop(0.55, shade(accent, -0.45));
  grad.addColorStop(0.75, accent);
  grad.addColorStop(1.0, "#ffffff");
  ctx.fillStyle = grad;
  forEachGlyph((ch, cx) => ctx.fillText(ch, cx, y));

  // 5) Subtle highlight line across the upper half
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const hiGrad = ctx.createLinearGradient(0, top, 0, y);
  hiGrad.addColorStop(0, "rgba(255,255,255,0.55)");
  hiGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hiGrad;
  ctx.fillRect(startX - 10, top, totalW + 20, (y - top));
  ctx.restore();

  ctx.restore();

  // 6) Subtitle + rule lines
  const rulesWidth = opts.rulesWidth ?? totalW + opts.size * 1.2;
  const rules = opts.rules ?? true;

  if (rules) {
    const ruleY = y - opts.size * 0.75;
    drawHairline(ctx, x, ruleY, rulesWidth, accent);
    const ruleY2 = y + opts.size * 0.75;
    drawHairline(ctx, x, ruleY2, rulesWidth, accent);
  }

  if (opts.subtitle) {
    const subSize = opts.subtitleSize ?? Math.max(14, opts.size * 0.2);
    const subY = y + opts.size * 0.78 + subSize * 0.9;
    ctx.save();
    ctx.font = `600 ${subSize}px 'Helvetica Neue', 'Arial', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 6;
    // Wider tracking for sub by injecting thin spaces
    const spaced = opts.subtitle.toUpperCase().split("").join(" ");
    ctx.fillText(spaced, x, subY);
    ctx.restore();
  }
}

/** Draw a horizontal hairline with a soft fade at the ends */
function drawHairline(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  color: string
): void {
  ctx.save();
  const x1 = cx - width / 2;
  const x2 = cx + width / 2;
  const grad = ctx.createLinearGradient(x1, 0, x2, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.2, color);
  grad.addColorStop(0.5, "#ffffff");
  grad.addColorStop(0.8, color);
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(x1, cy - 1, width, 2);
  ctx.restore();
}

/** Return a shaded hex color. amount in [-1..1], negative = darker, positive = lighter. */
function shade(hex: string, amount: number): string {
  const m = hex.replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const adjust = (v: number): number => {
    if (amount >= 0) return Math.round(v + (255 - v) * amount);
    return Math.round(v * (1 + amount));
  };
  const clamp = (v: number): number => Math.max(0, Math.min(255, v));
  const hexPart = (v: number): string => clamp(v).toString(16).padStart(2, "0");
  return `#${hexPart(adjust(r))}${hexPart(adjust(g))}${hexPart(adjust(b))}`;
}

// ---------------------------------------------------------------------------
// Metallic plate / name tag / progress bar — reusable game UI parts
// ---------------------------------------------------------------------------

interface RGB { r: number; g: number; b: number }

/** Accept hex (#rgb, #rrggbb) and `rgb(r,g,b)` / `rgba(r,g,b,a)` strings. */
function toRgb(color: string): RGB {
  if (color.startsWith("rgb")) {
    const m = color.match(/-?\d+(?:\.\d+)?/g);
    if (m && m.length >= 3) {
      return { r: Math.round(+m[0]), g: Math.round(+m[1]), b: Math.round(+m[2]) };
    }
  }
  const h = color.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return {
    r: parseInt(full.slice(0, 2), 16) || 0,
    g: parseInt(full.slice(2, 4), 16) || 0,
    b: parseInt(full.slice(4, 6), 16) || 0,
  };
}

function toHex({ r, g, b }: RGB): string {
  const part = (v: number): string =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

function lighten(color: string, amount: number): string {
  const { r, g, b } = toRgb(color);
  return toHex({
    r: Math.min(255, r + amount),
    g: Math.min(255, g + amount),
    b: Math.min(255, b + amount),
  });
}

function darken(color: string, amount: number): string {
  const { r, g, b } = toRgb(color);
  return toHex({
    r: Math.max(0, r - amount),
    g: Math.max(0, g - amount),
    b: Math.max(0, b - amount),
  });
}

function alpha(color: string, a: number): string {
  const { r, g, b } = toRgb(color);
  return `rgba(${r},${g},${b},${a})`;
}

export interface MetallicPlateOptions {
  radius?: number;
  accent?: string;
  glow?: boolean;
  glowColor?: string;
  hairlines?: boolean;
  /** 0..1 — reduce core lightness (darker backgrounds use lower values) */
  dim?: number;
  /** Suppress the horizontal gloss band that runs through the vertical middle.
   *  Set this on dialog backgrounds where content sits across the centre line. */
  noCenterGloss?: boolean;
}

/**
 * Draw a layered metallic plate: outer frame + coloured core + gloss + accent rim.
 * Suitable for tabs, badges, dialogue backgrounds, progress-bar frames.
 */
export function drawMetallicPlate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: MetallicPlateOptions = {}
): void {
  const r = opts.radius ?? 14;
  const accent = opts.accent ?? "#3a5a8a";
  const glowColor = opts.glowColor ?? accent;
  const dim = opts.dim ?? 1;

  // Outer glow halo
  if (opts.glow) {
    ctx.save();
    ctx.shadowColor = alpha(glowColor, 0.7);
    ctx.shadowBlur = 16;
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = alpha(glowColor, 0.25);
    ctx.fill();
    ctx.restore();
  }

  // Outer metallic frame
  roundRect(ctx, x, y, w, h, r);
  const frameGrad = ctx.createLinearGradient(x, y, x, y + h);
  frameGrad.addColorStop(0.0, "#c8c8d0");
  frameGrad.addColorStop(0.18, "#6c686f");
  frameGrad.addColorStop(0.5, "#26232a");
  frameGrad.addColorStop(0.85, "#0f0d12");
  frameGrad.addColorStop(1.0, "#847f88");
  ctx.fillStyle = frameGrad;
  ctx.fill();

  // Inner coloured core
  const inset = 3;
  const ix = x + inset;
  const iy = y + inset;
  const iw = w - inset * 2;
  const ih = h - inset * 2;
  const ir = Math.max(2, r - 2);

  roundRect(ctx, ix, iy, iw, ih, ir);
  const dimOff = (1 - dim) * 60;
  const core = ctx.createLinearGradient(0, iy, 0, iy + ih);
  core.addColorStop(0.0, darken(lighten(accent, 40), dimOff));
  core.addColorStop(0.45, darken(accent, dimOff));
  core.addColorStop(0.75, darken(accent, 45 + dimOff));
  core.addColorStop(1.0, darken(accent, 90 + dimOff));
  ctx.fillStyle = core;
  ctx.fill();

  // Inner dark rim
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Clipped gloss: upper-half sheen + central highlight strip
  ctx.save();
  roundRect(ctx, ix, iy, iw, ih, ir);
  ctx.clip();
  const glossH = ih * 0.5;
  const gloss = ctx.createLinearGradient(0, iy, 0, iy + glossH);
  gloss.addColorStop(0, "rgba(255,255,255,0.20)");
  gloss.addColorStop(0.6, "rgba(255,255,255,0.06)");
  gloss.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.fillRect(ix, iy, iw, glossH);

  if (!opts.noCenterGloss) {
    const barY = iy + ih * 0.44;
    const barH = Math.max(2, ih * 0.04);
    const bar = ctx.createLinearGradient(0, barY - 4, 0, barY + barH + 4);
    bar.addColorStop(0, "rgba(255,255,255,0)");
    bar.addColorStop(0.5, "rgba(255,255,255,0.15)");
    bar.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = bar;
    ctx.fillRect(ix, barY - 4, iw, barH + 8);
  }
  ctx.restore();

  // Subtle accent inner ring
  ctx.save();
  roundRect(ctx, ix + 1.5, iy + 1.5, iw - 3, ih - 3, Math.max(1, ir - 1.5));
  ctx.strokeStyle = alpha(lighten(accent, 80), 0.45);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // Horizontal hairlines near top & bottom
  if (opts.hairlines) {
    const lineGrad = ctx.createLinearGradient(x, 0, x + w, 0);
    lineGrad.addColorStop(0, "rgba(255,255,255,0)");
    lineGrad.addColorStop(0.5, alpha(lighten(accent, 80), 0.9));
    lineGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = lineGrad;
    ctx.fillRect(x + 10, y + 3, w - 20, 1);
    ctx.fillRect(x + 10, y + h - 4, w - 20, 1);
  }
}

export interface NameTagOptions {
  accent?: string;
  height?: number;
  paddingX?: number;
  fontSize?: number;
  glow?: boolean;
}

/**
 * Draw a left-anchored name tag (speaker label style).
 * Returns the bounding box width.
 */
export function drawNameTag(
  ctx: CanvasRenderingContext2D,
  x: number,
  cy: number,
  label: string,
  opts: NameTagOptions = {}
): { w: number; h: number } {
  const accent = opts.accent ?? "#4aa8ff";
  const h = opts.height ?? 44;
  const padX = opts.paddingX ?? 22;
  const fontSize = opts.fontSize ?? 22;
  const pillW = 4;
  const pillGap = 10;

  ctx.save();
  ctx.font = `800 ${fontSize}px 'Hiragino Sans','Yu Gothic','Helvetica Neue',sans-serif`;
  const textW = ctx.measureText(label).width;
  ctx.restore();

  const w = Math.ceil(textW + padX * 2 + pillW + pillGap);
  const y = cy - h / 2;

  drawMetallicPlate(ctx, x, y, w, h, {
    radius: h / 2,
    accent,
    glow: opts.glow ?? true,
    glowColor: accent,
    dim: 0.75,
  });

  // Left accent pill
  const pillX = x + 10;
  const pillY = y + 9;
  const pillH = h - 18;
  ctx.save();
  const pillGrad = ctx.createLinearGradient(0, pillY, 0, pillY + pillH);
  pillGrad.addColorStop(0, lighten(accent, 80));
  pillGrad.addColorStop(1, accent);
  ctx.fillStyle = pillGrad;
  roundRect(ctx, pillX, pillY, pillW, pillH, 2);
  ctx.fill();
  ctx.shadowColor = alpha(accent, 0.8);
  ctx.shadowBlur = 8;
  ctx.fillStyle = lighten(accent, 40);
  ctx.fillRect(pillX, pillY, pillW, pillH);
  ctx.restore();

  // Label text
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${fontSize}px 'Hiragino Sans','Yu Gothic','Helvetica Neue',sans-serif`;
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 4;
  ctx.fillStyle = "#fff";
  ctx.fillText(label, x + padX + pillW + pillGap - 6, cy + 1);
  ctx.restore();

  return { w, h };
}

export interface ProgressBarOptions {
  accent?: string;
  radius?: number;
  glow?: boolean;
  /** Show animated shimmer on the filled portion */
  shimmer?: boolean;
}

/**
 * Draw a horizontal progress bar: metallic frame + accent-coloured fill with
 * glossy sheen and a bright leading edge.
 */
export function drawProgressBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  progress: number,
  opts: ProgressBarOptions = {}
): void {
  const accent = opts.accent ?? "#4aa8ff";
  const r = opts.radius ?? h / 2;

  // Outer metallic frame (darker core because the fill will stand out)
  drawMetallicPlate(ctx, x, y, w, h, {
    radius: r,
    accent: "#0f1320",
    dim: 0.15,
    glow: opts.glow ?? false,
    glowColor: accent,
  });

  // Inside area
  const inset = 4;
  const fx = x + inset;
  const fy = y + inset;
  const fw = w - inset * 2;
  const fh = h - inset * 2;
  const fr = Math.max(2, r - 3);

  // Track (deep black under the fill)
  ctx.save();
  roundRect(ctx, fx, fy, fw, fh, fr);
  ctx.clip();

  const trackGrad = ctx.createLinearGradient(0, fy, 0, fy + fh);
  trackGrad.addColorStop(0, "#05070c");
  trackGrad.addColorStop(1, "#0c0e15");
  ctx.fillStyle = trackGrad;
  ctx.fillRect(fx, fy, fw, fh);

  // Fill
  const p = Math.max(0, Math.min(1, progress));
  const filled = p * fw;
  if (filled > 0) {
    const fillGrad = ctx.createLinearGradient(0, fy, 0, fy + fh);
    fillGrad.addColorStop(0, lighten(accent, 65));
    fillGrad.addColorStop(0.5, accent);
    fillGrad.addColorStop(1, darken(accent, 40));
    ctx.fillStyle = fillGrad;
    ctx.fillRect(fx, fy, filled, fh);

    // Upper sheen
    const sheen = ctx.createLinearGradient(0, fy, 0, fy + fh * 0.55);
    sheen.addColorStop(0, "rgba(255,255,255,0.45)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(fx, fy, filled, fh * 0.55);

    // Bright leading edge
    if (filled > 4 && filled < fw) {
      const tipX = fx + filled;
      const tipGrad = ctx.createLinearGradient(tipX - 28, 0, tipX + 4, 0);
      tipGrad.addColorStop(0, "rgba(255,255,255,0)");
      tipGrad.addColorStop(1, alpha(lighten(accent, 90), 0.95));
      ctx.fillStyle = tipGrad;
      ctx.fillRect(tipX - 28, fy, 32, fh);
    }

    if (opts.shimmer ?? false) {
      const t = (performance.now() / 1200) % 1;
      const shX = fx - 60 + (filled + 60) * t;
      const shGrad = ctx.createLinearGradient(shX - 40, 0, shX + 40, 0);
      shGrad.addColorStop(0, "rgba(255,255,255,0)");
      shGrad.addColorStop(0.5, "rgba(255,255,255,0.35)");
      shGrad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = shGrad;
      ctx.fillRect(shX - 40, fy, 80, fh);
    }
  }

  ctx.restore();

  // Tick marks (optional subtle segments)
  ctx.save();
  const ticks = 10;
  for (let i = 1; i < ticks; i++) {
    const tx = fx + (fw / ticks) * i;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(tx - 0.5, fy + 2, 1, fh - 4);
  }
  ctx.restore();
}

export interface ToggleSwitchOptions {
  accent?: string;
  /** Override the animated handle position (0..1). Defaults to `on ? 1 : 0`. */
  t?: number;
  showLabels?: boolean;
}

/** Draw a pill-shaped ON/OFF toggle switch matching the reference UI kit. */
export function drawToggleSwitch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  on: boolean,
  opts: ToggleSwitchOptions = {}
): void {
  const accent = opts.accent ?? "#4aa8ff";
  const showLabels = opts.showLabels ?? true;
  const t = Math.max(0, Math.min(1, opts.t ?? (on ? 1 : 0)));

  // Track — metallic pill
  drawMetallicPlate(ctx, x, y, w, h, {
    radius: h / 2,
    accent: on ? accent : "#1a1e28",
    dim: on ? 0.65 : 0.2,
    glow: on,
    glowColor: accent,
  });

  // Optional ON/OFF label on the inactive side
  if (showLabels) {
    ctx.save();
    ctx.font = "800 14px 'Helvetica Neue','Arial',sans-serif";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 4;
    if (on) {
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("ON", x + h * 0.65, y + h / 2);
    } else {
      ctx.textAlign = "right";
      ctx.fillStyle = "#888c94";
      ctx.fillText("OFF", x + w - h * 0.65, y + h / 2);
    }
    ctx.restore();
  }

  // Handle — white-to-silver sphere
  const pad = 4;
  const handleR = (h - pad * 2) / 2;
  const travel = w - pad * 2 - handleR * 2;
  const hx = x + pad + handleR + travel * t;
  const hy = y + h / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  const grad = ctx.createRadialGradient(
    hx - handleR * 0.4,
    hy - handleR * 0.4,
    handleR * 0.1,
    hx,
    hy,
    handleR
  );
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.7, "#d8dce3");
  grad.addColorStop(1, "#aab0b8");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(hx, hy, handleR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Handle inner ring
  ctx.save();
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(hx, hy, handleR - 1, 0, Math.PI * 2);
  ctx.stroke();
  // Accent core dot when on
  if (on) {
    ctx.fillStyle = alpha(accent, 0.55);
    ctx.beginPath();
    ctx.arc(hx, hy, handleR * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Draw gradient text (metallic effect) */
export function drawGradientText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  colors: string[]
): void {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const m = ctx.measureText(text);
  const top = y - m.actualBoundingBoxAscent;
  const bottom = y + m.actualBoundingBoxDescent;
  const grad = ctx.createLinearGradient(0, top, 0, bottom);
  colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
  ctx.fillStyle = grad;
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 8;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Fill the visible canvas with a color. Defaults to safe area if viewport omitted. */
export function clearCanvas(
  ctx: CanvasRenderingContext2D,
  color = "#000",
  viewport?: Viewport
): void {
  ctx.fillStyle = color;
  if (viewport) {
    ctx.fillRect(viewport.x, viewport.y, viewport.w, viewport.h);
  } else {
    ctx.fillRect(0, 0, GAME_W, GAME_H);
  }
}

/** Draw image fitted inside a rect, maintaining aspect ratio */
export function drawImageFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const imgAspect = img.width / img.height;
  const boxAspect = w / h;
  let dw: number, dh: number, dx: number, dy: number;
  if (imgAspect > boxAspect) {
    dw = w;
    dh = w / imgAspect;
    dx = x;
    dy = y + (h - dh) / 2;
  } else {
    dh = h;
    dw = h * imgAspect;
    dx = x + (w - dw) / 2;
    dy = y;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** Vertical anchor for cover cropping — "top" protects the face of portrait art. */
export type CoverAnchorY = "center" | "top" | "bottom";

/** Draw image covering a rect (crop to fill) */
export function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  anchorY: CoverAnchorY = "center"
): void {
  const imgAspect = img.width / img.height;
  const boxAspect = w / h;
  let sx: number, sy: number, sw: number, sh: number;
  if (imgAspect > boxAspect) {
    // Image wider than box — crop sides.
    sh = img.height;
    sw = sh * boxAspect;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    // Image taller than box — crop top/bottom.
    sw = img.width;
    sh = sw / boxAspect;
    sx = 0;
    if (anchorY === "top") sy = 0;
    else if (anchorY === "bottom") sy = img.height - sh;
    else sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/** Draw a lock icon */
export function drawLockIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number
): void {
  ctx.save();
  ctx.strokeStyle = "#aaa";
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = "round";
  // Shackle
  const r = size * 0.22;
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.15, r, Math.PI, 0);
  ctx.stroke();
  // Body
  ctx.fillStyle = "#888";
  roundRect(ctx, cx - size * 0.28, cy - size * 0.05, size * 0.56, size * 0.42, size * 0.06);
  ctx.fill();
  // Keyhole
  ctx.fillStyle = "#555";
  ctx.beginPath();
  ctx.arc(cx, cy + size * 0.08, size * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Draw a star icon (for clear badge) */
export function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const r = i === 0 ? size : size;
    const method = i === 0 ? "moveTo" : "lineTo";
    ctx[method](cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
