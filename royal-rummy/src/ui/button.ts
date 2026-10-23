import type { Rect, PointerInfo } from "../types";
import { roundRect } from "./canvas-utils";

export interface ButtonStyle {
  bgColor: string;
  textColor: string;
  hoverBgColor?: string;
  borderColor?: string;
  borderWidth?: number;
  fontSize?: number;
  radius?: number;
  glossy?: boolean;
  /** Secondary label (e.g. English under JP). Drawn in small caps with tracking. */
  sublabel?: string;
  sublabelColor?: string;
  /** Outer halo color. Defaults to bgColor. */
  glowColor?: string;
}

const DEFAULT_STYLE: ButtonStyle = {
  bgColor: "#333",
  textColor: "#fff",
  hoverBgColor: "#444",
  borderColor: "#555",
  borderWidth: 2,
  fontSize: 28,
  radius: 14,
  glossy: true,
};

export class Button {
  rect: Rect;
  label: string;
  style: ButtonStyle;
  private hovered = false;
  private pressed = false;

  constructor(rect: Rect, label: string, style?: Partial<ButtonStyle>) {
    this.rect = rect;
    this.label = label;
    this.style = { ...DEFAULT_STYLE, ...style };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.style.glossy) {
      this.drawGlossy(ctx);
    } else {
      this.drawFlat(ctx);
    }
  }

  private drawFlat(ctx: CanvasRenderingContext2D): void {
    const { x, y, w, h } = this.rect;
    const s = this.style;
    const r = s.radius ?? 12;

    const bg = this.pressed
      ? s.hoverBgColor ?? s.bgColor
      : this.hovered
        ? s.hoverBgColor ?? s.bgColor
        : s.bgColor;
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = bg;
    ctx.fill();

    if (s.borderColor && s.borderWidth) {
      ctx.strokeStyle = s.borderColor;
      ctx.lineWidth = s.borderWidth;
      ctx.stroke();
    }

    ctx.fillStyle = s.textColor;
    ctx.font = `bold ${s.fontSize ?? 28}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.label, x + w / 2, y + h / 2);
    ctx.restore();
  }

  private drawGlossy(ctx: CanvasRenderingContext2D): void {
    const { x, y, w, h } = this.rect;
    const s = this.style;
    const r = s.radius ?? 14;
    const pressOffset = this.pressed ? 2 : 0;
    const bx = x;
    const by = y + pressOffset;
    const accent = s.bgColor;
    const coreColor = this.hovered ? (s.hoverBgColor ?? accent) : accent;
    const glowColor = s.glowColor ?? accent;

    ctx.save();

    // 1) Outer diffused glow (accent halo)
    if (!this.pressed) {
      ctx.save();
      ctx.shadowColor = withAlpha(glowColor, 0.9);
      ctx.shadowBlur = 22;
      ctx.shadowOffsetY = 0;
      roundRect(ctx, bx, by, w, h, r);
      ctx.fillStyle = withAlpha(glowColor, 0.35);
      ctx.fill();
      ctx.restore();
    }

    // 2) Drop shadow (ground shadow)
    if (!this.pressed) {
      roundRect(ctx, bx, by + 5, w, h, r);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fill();
    }

    // 3) Outer metallic frame — dark steel with bright top/bottom edges
    roundRect(ctx, bx, by, w, h, r);
    const frameGrad = ctx.createLinearGradient(bx, by, bx, by + h);
    frameGrad.addColorStop(0.0, "#e4e4ec");
    frameGrad.addColorStop(0.15, "#7c7880");
    frameGrad.addColorStop(0.45, "#332f36");
    frameGrad.addColorStop(0.85, "#1a171c");
    frameGrad.addColorStop(1.0, "#b4b0b8");
    ctx.fillStyle = frameGrad;
    ctx.fill();

    // 4) Inner coloured core
    const inset = 4;
    const innerX = bx + inset;
    const innerY = by + inset;
    const innerW = w - inset * 2;
    const innerH = h - inset * 2;
    const innerR = Math.max(2, r - 3);

    roundRect(ctx, innerX, innerY, innerW, innerH, innerR);
    const coreGrad = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerH);
    coreGrad.addColorStop(0.0, lightenColor(coreColor, 70));
    coreGrad.addColorStop(0.35, coreColor);
    coreGrad.addColorStop(0.7, darkenColor(coreColor, 45));
    coreGrad.addColorStop(1.0, darkenColor(coreColor, 90));
    ctx.fillStyle = coreGrad;
    ctx.fill();

    // 5) Inner rim (dark shadow line)
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 6) Gloss + central highlight bar, clipped to the core shape
    ctx.save();
    roundRect(ctx, innerX, innerY, innerW, innerH, innerR);
    ctx.clip();

    // Upper-half gloss (soft top sheen, toned down for text readability)
    const glossH = innerH * 0.48;
    const glossGrad = ctx.createLinearGradient(0, innerY, 0, innerY + glossH);
    glossGrad.addColorStop(0, "rgba(255,255,255,0.30)");
    glossGrad.addColorStop(0.6, "rgba(255,255,255,0.08)");
    glossGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glossGrad;
    ctx.fillRect(innerX, innerY, innerW, glossH);

    // Central horizontal highlight bar (subtle specular strip, kept faint so text stays legible)
    const barY = innerY + innerH * 0.44;
    const barH = Math.max(2, innerH * 0.04);
    const barGrad = ctx.createLinearGradient(0, barY - 4, 0, barY + barH + 4);
    barGrad.addColorStop(0, "rgba(255,255,255,0)");
    barGrad.addColorStop(0.5, "rgba(255,255,255,0.18)");
    barGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = barGrad;
    ctx.fillRect(innerX, barY - 4, innerW, barH + 8);

    // Bottom rim accent (hint of the inner glow)
    const bottomGrad = ctx.createLinearGradient(
      0,
      innerY + innerH * 0.75,
      0,
      innerY + innerH
    );
    bottomGrad.addColorStop(0, "rgba(0,0,0,0)");
    bottomGrad.addColorStop(1, withAlpha(glowColor, 0.25));
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(innerX, innerY + innerH * 0.75, innerW, innerH * 0.25);

    ctx.restore();

    // 7) Inner thin accent line just inside the frame
    ctx.save();
    roundRect(ctx, innerX + 1.5, innerY + 1.5, innerW - 3, innerH - 3, Math.max(1, innerR - 1.5));
    ctx.strokeStyle = withAlpha(lightenColor(accent, 80), 0.55);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // 8) Labels
    const hasSub = !!s.sublabel && s.sublabel.length > 0;
    const mainSize = s.fontSize ?? 28;
    const cx = bx + w / 2;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;

    if (hasSub) {
      const subSize = Math.max(10, Math.round(mainSize * 0.42));
      // Use the canvas TextMetrics for the main label so we know the *actual*
      // visible bottom (alphabetic baseline + descender) instead of guessing
      // from font-size proportions. Then place the sub label a fixed clear
      // distance below that — which makes the gap independent of font quirks.
      ctx.font = `800 ${mainSize}px 'Hiragino Sans','Yu Gothic', sans-serif`;
      const mm = ctx.measureText(this.label);
      const mainAscent = mm.actualBoundingBoxAscent || mainSize * 0.72;
      const mainDescent = mm.actualBoundingBoxDescent || mainSize * 0.20;
      const mainVisibleH = mainAscent + mainDescent;

      ctx.font = `700 ${subSize}px 'Helvetica Neue','Arial', sans-serif`;
      const sm = ctx.measureText((s.sublabel ?? "").toUpperCase());
      const subAscent = sm.actualBoundingBoxAscent || subSize * 0.72;
      const subDescent = sm.actualBoundingBoxDescent || subSize * 0.20;
      const subVisibleH = subAscent + subDescent;

      const visibleGap = Math.max(16, Math.round(mainSize * 0.45));
      const totalH = mainVisibleH + visibleGap + subVisibleH;
      const topMargin = (h - totalH) / 2;
      // Use textBaseline='alphabetic' so positions are unambiguous.
      const mainBaseline = by + topMargin + mainAscent;
      const subBaseline = mainBaseline + mainDescent + visibleGap + subAscent;

      ctx.textBaseline = "alphabetic";

      ctx.fillStyle = s.textColor;
      ctx.font = `800 ${mainSize}px 'Hiragino Sans','Yu Gothic', sans-serif`;
      ctx.fillText(this.label, cx, mainBaseline);

      const spaced = (s.sublabel ?? "").toUpperCase().split("").join(" ");
      ctx.fillStyle = s.sublabelColor ?? "rgba(255,255,255,0.78)";
      ctx.font = `700 ${subSize}px 'Helvetica Neue','Arial', sans-serif`;
      ctx.shadowBlur = 2;
      ctx.shadowOffsetY = 0;
      ctx.fillText(spaced, cx, subBaseline);
    } else {
      ctx.fillStyle = s.textColor;
      ctx.font = `800 ${mainSize}px 'Hiragino Sans','Yu Gothic', sans-serif`;
      ctx.fillText(this.label, cx, by + h / 2 + 1);
    }

    ctx.restore();
    ctx.restore();
  }

  hitTest(p: PointerInfo): boolean {
    const { x, y, w, h } = this.rect;
    return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
  }

  handlePointerDown(p: PointerInfo): boolean {
    if (this.hitTest(p)) {
      this.pressed = true;
      return true;
    }
    return false;
  }

  handlePointerUp(p: PointerInfo): boolean {
    const wasPressed = this.pressed;
    this.pressed = false;
    return wasPressed && this.hitTest(p);
  }

  handlePointerMove(p: PointerInfo): void {
    this.hovered = this.hitTest(p);
  }
}

function lightenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  return `rgb(${Math.min(255, rgb.r + amount)},${Math.min(255, rgb.g + amount)},${Math.min(255, rgb.b + amount)})`;
}

function darkenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  return `rgb(${Math.max(0, rgb.r - amount)},${Math.max(0, rgb.g - amount)},${Math.max(0, rgb.b - amount)})`;
}

function withAlpha(color: string, alpha: number): string {
  const rgb = hexToRgb(color);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}
