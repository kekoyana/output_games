// 共通配色・装飾パーツ（ダークファンタジー基盤）
// FS テンプレ準拠。Patreon CTA は ui/patreon-cta.ts に分離。
import Phaser from "phaser";
import { playClick } from "../core/sfx";

// ============================================================
// カラーパレット
// ============================================================
export const UI = {
  // 背景・パネル
  bg: "#160e22",
  bgDeep: "#0d0718",
  panel: 0x1f1530,
  panelDeep: 0x150d22,
  panelStroke: 0xc9a14a, // 金縁
  panelStrokeDim: 0x6a4d2a,

  // テキスト
  text: "#f5ecd9",
  textDim: "#a89c80",
  textMuted: "#7a6f5c",

  // 強調
  accent: 0xd4af37, // 金
  accentBright: 0xf5d671,
  accentText: "#1a0f24",

  // ステータス色
  hp: 0x4caf50,
  hpDim: 0x2d6a30,
  mp: 0x4a90e2,
  mpDim: 0x2a5a8a,
  xp: 0xffd966,
  xpDim: 0x8a7530,

  // 機能色
  locked: 0x3a2d4a,
  lockedText: "#7a6a8a",
  danger: 0xd04848,
  good: 0x6dbf6d,

  // レアリティ枠
  rarity: {
    common: 0x9a9a9a,
    uncommon: 0x6dbf6d,
    rare: 0x5b8fdb,
    epic: 0xb06bd0,
    legendary: 0xd4af37,
  },

  // フォント
  serif: "Georgia, 'Times New Roman', serif",
  sans: "system-ui, -apple-system, 'Helvetica Neue', sans-serif",
} as const;

export type Rarity = keyof typeof UI.rarity;

// ============================================================
// 内部ユーティリティ
// ============================================================
function lighten(color: number, amount: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + amount);
  const g = Math.min(255, ((color >> 8) & 0xff) + amount);
  const b = Math.min(255, (color & 0xff) + amount);
  return (r << 16) | (g << 8) | b;
}

function darken(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) - amount);
  const g = Math.max(0, ((color >> 8) & 0xff) - amount);
  const b = Math.max(0, (color & 0xff) - amount);
  return (r << 16) | (g << 8) | b;
}

function toHexStr(color: number): string {
  return "#" + color.toString(16).padStart(6, "0");
}

// ============================================================
// ボタン Variant パレット
// ============================================================
export type ButtonVariant = "primary" | "gold" | "purple" | "red" | "green" | "dark";

interface VariantPalette {
  base: number;
  frame: number;
  frameDim: number;
  text: string;
}

const VARIANT_PALETTES: Record<ButtonVariant, VariantPalette> = {
  primary: { base: 0x3a78d8, frame: 0xc9a14a, frameDim: 0x6a4d2a, text: "#ffffff" },
  gold:    { base: 0xd4af37, frame: 0xfff0a0, frameDim: 0x7a4d10, text: UI.accentText },
  purple:  { base: 0x8a4dc8, frame: 0xc9a14a, frameDim: 0x6a4d2a, text: "#ffffff" },
  red:     { base: 0xc73838, frame: 0xc9a14a, frameDim: 0x6a4d2a, text: "#ffffff" },
  green:   { base: 0x4ea64a, frame: 0xc9a14a, frameDim: 0x6a4d2a, text: "#ffffff" },
  dark:    { base: 0x2a2438, frame: 0x8a7a4a, frameDim: 0x4a3d2a, text: "#e6dcc4" },
};

// ============================================================
// 内部: ボタン本体を Canvas で焼いてテクスチャ化
// ============================================================
function ctxRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function getButtonBodyTextureKey(
  scene: Phaser.Scene,
  variant: ButtonVariant,
  w: number,
  h: number,
): string {
  const key = `__btnbg_${variant}_${w}x${h}`;
  if (scene.textures.exists(key)) return key;

  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return key;
  ctx.scale(dpr, dpr);

  const p = VARIANT_PALETTES[variant];
  const radius = Math.min(14, Math.max(6, h * 0.3));

  // ─── 1. 本体（角丸クリップ内に多段グラデーション）
  ctx.save();
  ctxRoundedRect(ctx, 0.5, 0.5, w - 1, h - 1, radius);
  ctx.clip();

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0,    toHexStr(lighten(p.base, 70)));
  grad.addColorStop(0.42, toHexStr(lighten(p.base, 28)));
  grad.addColorStop(0.5,  toHexStr(p.base));
  grad.addColorStop(0.55, toHexStr(darken(p.base, 8)));
  grad.addColorStop(1,    toHexStr(darken(p.base, 34)));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // 上半分のガラス光沢
  const gloss = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  gloss.addColorStop(0,    "rgba(255,255,255,0.55)");
  gloss.addColorStop(0.65, "rgba(255,255,255,0.08)");
  gloss.addColorStop(1,    "rgba(255,255,255,0)");
  ctx.fillStyle = gloss;
  ctx.fillRect(0, 0, w, h * 0.55);

  // 下半分の暗化
  const darkOverlay = ctx.createLinearGradient(0, h * 0.55, 0, h);
  darkOverlay.addColorStop(0, "rgba(0,0,0,0)");
  darkOverlay.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = darkOverlay;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);

  // 下端の薄い反射
  const rim = ctx.createLinearGradient(0, h * 0.85, 0, h);
  rim.addColorStop(0, "rgba(255,255,255,0)");
  rim.addColorStop(1, "rgba(255,255,255,0.18)");
  ctx.fillStyle = rim;
  ctx.fillRect(0, h * 0.85, w, h * 0.15);

  ctx.restore();

  // ─── 2. フレーム（メタリックな三重ストローク）
  ctx.lineWidth = 1;
  ctx.strokeStyle = toHexStr(p.frameDim);
  ctxRoundedRect(ctx, 0.5, 0.5, w - 1, h - 1, radius);
  ctx.stroke();

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = toHexStr(p.frame);
  ctxRoundedRect(ctx, 1.75, 1.75, w - 3.5, h - 3.5, Math.max(1, radius - 1));
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = toHexStr(lighten(p.frame, 70));
  ctxRoundedRect(ctx, 2.75, 2.75, w - 5.5, h - 5.5, Math.max(1, radius - 2));
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = toHexStr(darken(p.base, 55));
  ctxRoundedRect(ctx, 3.75, 3.75, w - 7.5, h - 7.5, Math.max(1, radius - 3));
  ctx.stroke();
  ctx.globalAlpha = 1;

  scene.textures.addCanvas(key, canvas);
  return key;
}

// ============================================================
// ボタン
// ============================================================
export interface ButtonOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label: string;
  /** プリセット。指定すれば color より優先。 */
  variant?: ButtonVariant;
  /** 互換: 数値カラー。Variant 未指定時に近いプリセットへ自動マップする。 */
  color?: number;
  textColor?: string;
  fontSize?: number;
  onClick: () => void;
}

function resolveVariant(opts: ButtonOptions): ButtonVariant {
  if (opts.variant) return opts.variant;
  const c = opts.color;
  if (c === undefined) return "gold";
  if (c === 0xff5555) return "red";
  if (c === 0x6a5a8a) return "purple";
  if (c === 0x5a8a6a || c === 0x88aa66) return "green";
  if (c === 0x4a4a5a) return "dark";
  if (c === 0x4a5a8a) return "primary";
  if (c === UI.accent || c === 0xd4af37) return "gold";
  return "gold";
}

export function createButton(opts: ButtonOptions): Phaser.GameObjects.Container {
  const w = opts.width ?? 220;
  const h = opts.height ?? 56;
  const fz = opts.fontSize ?? 22;
  const variant = resolveVariant(opts);
  const palette = VARIANT_PALETTES[variant];
  const radius = Math.min(14, Math.max(6, h * 0.3));
  const container = opts.scene.add.container(opts.x, opts.y);

  // 影
  const shadow = opts.scene.add.graphics();
  shadow.fillStyle(0x000000, 0.55);
  shadow.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, radius);

  // 本体
  const bodyKey = getButtonBodyTextureKey(opts.scene, variant, w, h);
  const body = opts.scene.add.image(0, 0, bodyKey).setDisplaySize(w, h);

  // ホバー時のオーバーレイ
  const hoverFx = opts.scene.add.graphics();
  hoverFx.setVisible(false);

  // クリック判定
  const hit = opts.scene.add.rectangle(0, 0, w, h, 0xffffff, 0.0001)
    .setInteractive({ useHandCursor: true });

  // ラベル
  const finalTextColor = opts.textColor ?? palette.text;
  const isDarkText = finalTextColor === UI.accentText || finalTextColor === "#1a0f24";
  const text = opts.scene.add.text(0, 0, opts.label, {
    fontFamily: UI.serif,
    fontSize: `${fz}px`,
    color: finalTextColor,
    fontStyle: "bold",
    stroke: isDarkText ? "" : "#000000",
    strokeThickness: isDarkText ? 0 : 4,
  }).setOrigin(0.5);
  text.setShadow(0, 2, "rgba(0,0,0,0.65)", 4, true, true);

  // ラベルがボタン幅を超えたら自動縮小
  const maxTextWidth = w - radius * 2 - 12;
  if (text.width > maxTextWidth) {
    const shrunk = Math.max(8, Math.floor(fz * (maxTextWidth / text.width)));
    text.setFontSize(shrunk);
  }

  container.add([shadow, body, hoverFx, hit, text]);

  const drawHover = (active: boolean): void => {
    hoverFx.clear();
    if (!active) {
      hoverFx.setVisible(false);
      return;
    }
    hoverFx.setVisible(true);
    hoverFx.lineStyle(4, UI.accentBright, 0.18);
    hoverFx.strokeRoundedRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 10, radius + 5);
    hoverFx.lineStyle(3, UI.accentBright, 0.32);
    hoverFx.strokeRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, radius + 2);
    hoverFx.lineStyle(2, UI.accentBright, 0.95);
    hoverFx.strokeRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, Math.max(1, radius - 1));
    hoverFx.fillStyle(0xffffff, 0.16);
    hoverFx.fillRoundedRect(-w / 2 + 3, -h / 2 + 2, w - 6, h * 0.42, Math.max(1, radius - 2));
  };

  hit.on("pointerover", () => drawHover(true));
  hit.on("pointerout", () => {
    drawHover(false);
    container.setScale(1);
  });
  hit.on("pointerdown", () => {
    opts.scene.tweens.add({
      targets: container,
      scale: 0.94,
      duration: 60,
      yoyo: true,
      ease: "Quad.easeOut",
    });
    playClick();
    opts.onClick();
  });

  return container;
}

// ============================================================
// パネル（金縁・装飾なしの素朴版）
// ============================================================
export interface PanelOptions {
  scene: Phaser.Scene;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: number;
  strokeColor?: number;
}

export function createPanel(opts: PanelOptions): Phaser.GameObjects.Container {
  const c = opts.scene.add.container(opts.x, opts.y);
  const shadow = opts.scene.add.rectangle(0, 6, opts.width, opts.height, 0x000000, 0.55);
  const fill = opts.scene.add.rectangle(0, 0, opts.width, opts.height, opts.color ?? UI.panel);
  const innerHighlight = opts.scene.add.rectangle(0, -opts.height / 2 + 4, opts.width - 8, 2, 0xffffff, 0.18);
  const stroke = opts.scene.add.rectangle(0, 0, opts.width, opts.height)
    .setStrokeStyle(2, opts.strokeColor ?? UI.panelStroke);
  c.add([shadow, fill, innerHighlight, stroke]);
  return c;
}

// ============================================================
// 装飾パネル（金縁 + コーナー装飾 + 内側影）
// ============================================================
export interface OrnatePanelOptions extends PanelOptions {
  cornerSize?: number;
  doubleStroke?: boolean;
}

export function createOrnatePanel(opts: OrnatePanelOptions): Phaser.GameObjects.Container {
  const c = opts.scene.add.container(opts.x, opts.y);
  const w = opts.width;
  const h = opts.height;
  const fillColor = opts.color ?? UI.panel;
  const strokeColor = opts.strokeColor ?? UI.panelStroke;
  const corner = opts.cornerSize ?? Math.min(18, Math.floor(Math.min(w, h) * 0.18));

  const shadow = opts.scene.add.rectangle(0, 7, w, h, 0x000000, 0.6);
  const upperFill = opts.scene.add.rectangle(0, -h / 4, w, h / 2, lighten(fillColor, 10));
  const lowerFill = opts.scene.add.rectangle(0, h / 4, w, h / 2, darken(fillColor, 8));
  const topHi = opts.scene.add.rectangle(0, -h / 2 + 3, w - 6, 2, 0xffffff, 0.22);
  const botSh = opts.scene.add.rectangle(0, h / 2 - 3, w - 6, 2, 0x000000, 0.45);
  const outerStroke = opts.scene.add.rectangle(0, 0, w, h).setStrokeStyle(2, strokeColor);
  const inner = opts.scene.add.rectangle(0, 0, w - 6, h - 6).setStrokeStyle(1, UI.panelStrokeDim);

  c.add([shadow, upperFill, lowerFill, topHi, botSh, outerStroke, inner]);

  if (opts.doubleStroke) {
    const innerInner = opts.scene.add.rectangle(0, 0, w - 12, h - 12).setStrokeStyle(1, darken(strokeColor, 40));
    c.add(innerInner);
  }

  const ornaments = drawCornerOrnaments(opts.scene, w, h, corner, strokeColor);
  c.add(ornaments);

  return c;
}

function drawCornerOrnaments(
  scene: Phaser.Scene,
  w: number,
  h: number,
  size: number,
  color: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.lineStyle(2, color, 1);
  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -h / 2;
  const y1 = h / 2;

  g.beginPath();
  g.moveTo(x0 + 2, y0 + size);
  g.lineTo(x0 + 2, y0 + 2);
  g.lineTo(x0 + size, y0 + 2);
  g.strokePath();
  g.beginPath();
  g.moveTo(x1 - size, y0 + 2);
  g.lineTo(x1 - 2, y0 + 2);
  g.lineTo(x1 - 2, y0 + size);
  g.strokePath();
  g.beginPath();
  g.moveTo(x0 + 2, y1 - size);
  g.lineTo(x0 + 2, y1 - 2);
  g.lineTo(x0 + size, y1 - 2);
  g.strokePath();
  g.beginPath();
  g.moveTo(x1 - size, y1 - 2);
  g.lineTo(x1 - 2, y1 - 2);
  g.lineTo(x1 - 2, y1 - size);
  g.strokePath();

  g.fillStyle(color, 0.85);
  g.fillCircle(x0 + 6, y0 + 6, 1.5);
  g.fillCircle(x1 - 6, y0 + 6, 1.5);
  g.fillCircle(x0 + 6, y1 - 6, 1.5);
  g.fillCircle(x1 - 6, y1 - 6, 1.5);

  return g;
}

// ============================================================
// 紋章タイトル（グロー + 装飾枠）
// ============================================================
export function createGlowTitle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  opts: { fontSize?: number; color?: string; glowColor?: number } = {},
): Phaser.GameObjects.Container {
  const fontSize = opts.fontSize ?? 56;
  const c = scene.add.container(x, y);

  const glow1 = scene.add.text(0, 0, text, {
    fontFamily: UI.serif,
    fontSize: `${fontSize}px`,
    color: opts.color ?? "#ffd966",
    stroke: "#7a4d10",
    strokeThickness: 12,
    fontStyle: "bold",
  }).setOrigin(0.5).setAlpha(0.4);
  const glow2 = scene.add.text(0, 0, text, {
    fontFamily: UI.serif,
    fontSize: `${fontSize}px`,
    color: opts.color ?? "#ffd966",
    stroke: "#000000",
    strokeThickness: 7,
    fontStyle: "bold",
  }).setOrigin(0.5);
  const main = scene.add.text(0, 0, text, {
    fontFamily: UI.serif,
    fontSize: `${fontSize}px`,
    color: opts.color ?? "#ffd966",
    stroke: "#000000",
    strokeThickness: 4,
    fontStyle: "bold",
  }).setOrigin(0.5);

  c.add([glow1, glow2, main]);

  scene.tweens.add({
    targets: glow1,
    alpha: { from: 0.25, to: 0.6 },
    duration: 1400,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
  scene.tweens.add({
    targets: c,
    scale: { from: 1, to: 1.03 },
    duration: 1800,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  void opts.glowColor;
  return c;
}

// ============================================================
// シーン遷移ヘルパ
// ============================================================
export function fadeToScene(scene: Phaser.Scene, target: string, data?: object): void {
  scene.cameras.main.fadeOut(220, 0, 0, 0);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.scene.start(target, data);
  });
}

export function fadeIn(scene: Phaser.Scene, durationMs = 280): void {
  scene.cameras.main.fadeIn(durationMs, 0, 0, 0);
}

// ============================================================
// 背景ヘルパ（紫黒 + 微粒子 + ヴィネット）
// ============================================================
export function paintFantasyBackground(scene: Phaser.Scene, w: number, h: number): void {
  const g = scene.add.graphics();
  g.fillStyle(0x1a0f24, 1);
  g.fillRect(0, 0, w, h);
  g.fillStyle(0x0a0512, 0.55);
  g.fillRect(0, h * 0.6, w, h * 0.4);
  g.fillStyle(0x2a1a3a, 0.4);
  for (let i = 0; i < 80; i++) {
    g.fillCircle(Phaser.Math.Between(0, w), Phaser.Math.Between(0, h), Phaser.Math.Between(1, 2));
  }
  scene.add.rectangle(w / 2, 0, w, 120, 0x000000, 0.55).setOrigin(0.5, 0);
  scene.add.rectangle(w / 2, h, w, 140, 0x000000, 0.55).setOrigin(0.5, 1);
}
