import type { PointerInfo, Rect } from "../types";
import { GAME_W, GAME_H } from "../types";
import { GAME_CONFIG } from "../game-config";
import { getLang, setLang } from "../i18n";
import { getVolume, setVolumeRemembered, isMuted, toggleMute } from "../core/bgm";
import { isSfxMuted, toggleSfxMute, playClick } from "../core/sfx";
import {
  drawMetallicPlate,
  drawProgressBar,
  drawToggleSwitch,
} from "./canvas-utils";
import { drawDialog } from "./dialog";
import { Button } from "./button";

type LangOption = { code: "en" | "ja"; label: string };

const LANG_OPTIONS: LangOption[] = [
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
];

const PANEL_W = 760;
// Panel height accounts for 3-button stack (TUTORIAL / TITLE / CLOSE) on the
// bottom; was 900 before the tutorial replay button was added.
const PANEL_H = 1004;
const PANEL_X = (GAME_W - PANEL_W) / 2;
const PANEL_Y = (GAME_H - PANEL_H) / 2;

const PAD = 48;
const LANG_BTN_H = 78;
const LANG_BTN_GAP = 14;
const TOGGLE_W = 130;
const TOGGLE_H = 54;
const SLIDER_H = 30;
const SLIDER_HANDLE_R = 22;
const ACTION_BTN_W = 380;
const ACTION_BTN_H = 84;
const CLOSE_BTN_W = 280;
const CLOSE_BTN_H = 84;


export class SettingsPanel {
  private open = false;
  private langRects: Rect[] = [];
  private toggleRect: Rect;
  private sfxToggleRect: Rect;
  private sliderRect: Rect;
  private titleRect: Rect;
  private closeRect: Rect;
  private tutorialRect: Rect;
  private draggingSlider = false;
  private toggleAnim = 0;
  private sfxToggleAnim = 0;
  private onReturnToTitle?: () => void;
  private onShowTutorial?: () => void;
  private titleBtn?: Button;
  private closeBtn: Button;
  private tutorialBtn: Button;

  constructor(opts?: {
    onReturnToTitle?: () => void;
    onShowTutorial?: () => void;
  }) {
    this.onReturnToTitle = opts?.onReturnToTitle;
    this.onShowTutorial = opts?.onShowTutorial;
    const onReturnToTitle = opts?.onReturnToTitle;
    const innerX = PANEL_X + PAD;
    const innerW = PANEL_W - PAD * 2;

    // Layout: every section header (LANGUAGE / BGM / SFX / VOLUME) is centered
    // on a row at a fixed pitch so spacing feels uniform.
    const SECTION_PITCH = 110;
    const langCenterY = PANEL_Y + 130;
    const bgmCenterY = langCenterY + SECTION_PITCH + LANG_BTN_H; // skip language buttons
    const sfxCenterY = bgmCenterY + SECTION_PITCH;
    const volumeLabelCenterY = sfxCenterY + SECTION_PITCH;

    // Language buttons row (sit just below language label)
    const langBtnW = (innerW - LANG_BTN_GAP * 2) / 3;
    const langY = langCenterY + 30;
    this.langRects = LANG_OPTIONS.map((_, i) => ({
      x: innerX + i * (langBtnW + LANG_BTN_GAP),
      y: langY,
      w: langBtnW,
      h: LANG_BTN_H,
    }));

    // BGM toggle — vertically centered on the BGM row
    this.toggleRect = {
      x: PANEL_X + PANEL_W - PAD - TOGGLE_W,
      y: bgmCenterY - TOGGLE_H / 2,
      w: TOGGLE_W,
      h: TOGGLE_H,
    };

    // SFX toggle — vertically centered on the SFX row
    this.sfxToggleRect = {
      x: PANEL_X + PANEL_W - PAD - TOGGLE_W,
      y: sfxCenterY - TOGGLE_H / 2,
      w: TOGGLE_W,
      h: TOGGLE_H,
    };

    // Volume slider — sits 40px under the volume label so the label/track relation
    // matches the unified 40px spacing used by other section headers.
    this.sliderRect = {
      x: innerX + SLIDER_HANDLE_R,
      y: volumeLabelCenterY + 40,
      w: innerW - SLIDER_HANDLE_R * 2,
      h: SLIDER_H,
    };

    // Bottom action stack — bottom up: CLOSE → TITLE (optional) → TUTORIAL
    const closeY = PANEL_Y + PANEL_H - PAD - CLOSE_BTN_H;
    this.titleRect = {
      x: PANEL_X + (PANEL_W - ACTION_BTN_W) / 2,
      y: closeY - ACTION_BTN_H - 18,
      w: ACTION_BTN_W,
      h: ACTION_BTN_H,
    };
    // Tutorial button is always present, regardless of whether TITLE is shown.
    // Stacked above whichever action button sits directly under it.
    const tutorialAnchorY = onReturnToTitle ? this.titleRect.y : closeY;
    this.tutorialRect = {
      x: PANEL_X + (PANEL_W - ACTION_BTN_W) / 2,
      y: tutorialAnchorY - ACTION_BTN_H - 18,
      w: ACTION_BTN_W,
      h: ACTION_BTN_H,
    };

    this.closeRect = {
      x: PANEL_X + (PANEL_W - CLOSE_BTN_W) / 2,
      y: closeY,
      w: CLOSE_BTN_W,
      h: CLOSE_BTN_H,
    };

    this.tutorialBtn = new Button(this.tutorialRect, "HOW TO PLAY", {
      bgColor: "#3a6f8c",
      textColor: "#fff",
      fontSize: 32,
      radius: 18,
      sublabel: "Replay how-to demo",
    });

    if (onReturnToTitle) {
      this.titleBtn = new Button(this.titleRect, "TITLE", {
        bgColor: "#c24a58",
        textColor: "#fff",
        fontSize: 32,
        radius: 18,
        sublabel: "Return to title",
      });
    }

    this.closeBtn = new Button(this.closeRect, "CLOSE", {
      bgColor: "#4a5260",
      textColor: "#fff",
      fontSize: 32,
      radius: 18,
      sublabel: "Dismiss",
    });
  }

  isOpen(): boolean {
    return this.open;
  }

  show(): void {
    this.open = true;
    this.toggleAnim = isMuted() ? 0 : 1;
    this.sfxToggleAnim = isSfxMuted() ? 0 : 1;
  }

  hide(): void {
    this.open = false;
    this.draggingSlider = false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.open) return;

    // Smooth toggle animation
    const target = isMuted() ? 0 : 1;
    this.toggleAnim += (target - this.toggleAnim) * 0.25;
    const sfxTarget = isSfxMuted() ? 0 : 1;
    this.sfxToggleAnim += (sfxTarget - this.sfxToggleAnim) * 0.25;

    // Unified panel: backdrop + metallic plate + "SETTINGS" name-tag header.
    drawDialog(ctx, {
      x: PANEL_X,
      y: PANEL_Y,
      w: PANEL_W,
      h: PANEL_H,
      headerTag: "SETTINGS",
    });

    // Section label: Language (sits 30px above the language buttons)
    this.drawSectionLabel(ctx, "Language", PANEL_X + PAD, this.langRects[0].y - 30);

    // Language buttons
    const currentLang = getLang();
    for (let i = 0; i < LANG_OPTIONS.length; i++) {
      const opt = LANG_OPTIONS[i];
      const r = this.langRects[i];
      const selected = opt.code === currentLang;
      drawMetallicPlate(ctx, r.x, r.y, r.w, r.h, {
        radius: 16,
        accent: selected ? GAME_CONFIG.accentColor : "#1c2232",
        dim: selected ? 0.75 : 0.35,
        glow: selected,
        glowColor: GAME_CONFIG.accentColor,
        hairlines: selected,
      });
      ctx.save();
      ctx.fillStyle = "#fff";
      ctx.font = `800 ${opt.code === "ja" ? 32 : 30}px 'Hiragino Sans','Yu Gothic','Helvetica Neue',sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 4;
      ctx.fillText(opt.label, r.x + r.w / 2, r.y + r.h / 2 - 6);

      ctx.font = "700 16px 'Helvetica Neue','Arial',sans-serif";
      ctx.fillStyle = selected ? "rgba(255,255,255,0.9)" : "rgba(180,186,198,0.85)";
      ctx.fillText(opt.code.toUpperCase(), r.x + r.w / 2, r.y + r.h / 2 + 18);
      ctx.restore();
    }

    // Section label: BGM
    this.drawSectionLabel(ctx, "BGM", PANEL_X + PAD, this.toggleRect.y + this.toggleRect.h / 2);

    // BGM toggle
    const tr = this.toggleRect;
    drawToggleSwitch(ctx, tr.x, tr.y, tr.w, tr.h, !isMuted(), {
      accent: GAME_CONFIG.accentColor,
      t: this.toggleAnim,
    });

    // Section label: SFX
    this.drawSectionLabel(ctx, "SFX", PANEL_X + PAD, this.sfxToggleRect.y + this.sfxToggleRect.h / 2);

    // SFX toggle
    const sr2 = this.sfxToggleRect;
    drawToggleSwitch(ctx, sr2.x, sr2.y, sr2.w, sr2.h, !isSfxMuted(), {
      accent: GAME_CONFIG.accentColor,
      t: this.sfxToggleAnim,
    });

    // Section label: Volume
    this.drawSectionLabel(ctx, "Volume", PANEL_X + PAD, this.sliderRect.y - 40);

    // Volume percentage
    const vol = getVolume();
    ctx.save();
    ctx.font = "800 32px 'Helvetica Neue','Arial',sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 4;
    ctx.fillText(`${Math.round(vol * 100)}%`, PANEL_X + PANEL_W - PAD, this.sliderRect.y - 40);
    ctx.restore();

    // Slider track (progress bar style)
    const sr = this.sliderRect;
    const barH = 20;
    const barY = sr.y + (sr.h - barH) / 2;
    drawProgressBar(ctx, sr.x, barY, sr.w, barH, vol, {
      accent: GAME_CONFIG.accentColor,
      glow: false,
    });

    // Slider handle (white sphere sitting on the fill edge)
    const handleX = sr.x + sr.w * Math.max(0, Math.min(1, vol));
    const handleY = barY + barH / 2;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 2;
    const hGrad = ctx.createRadialGradient(
      handleX - SLIDER_HANDLE_R * 0.4,
      handleY - SLIDER_HANDLE_R * 0.4,
      SLIDER_HANDLE_R * 0.1,
      handleX,
      handleY,
      SLIDER_HANDLE_R
    );
    hGrad.addColorStop(0, "#ffffff");
    hGrad.addColorStop(0.7, "#d8dce3");
    hGrad.addColorStop(1, "#aab0b8");
    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.arc(handleX, handleY, SLIDER_HANDLE_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = GAME_CONFIG.accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(handleX, handleY, SLIDER_HANDLE_R - 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Action buttons (top to bottom)
    this.tutorialBtn.draw(ctx);
    if (this.titleBtn) this.titleBtn.draw(ctx);
    this.closeBtn.draw(ctx);
  }

  private drawSectionLabel(ctx: CanvasRenderingContext2D, label: string, x: number, cy: number): void {
    ctx.save();
    ctx.font = "800 28px 'Helvetica Neue','Arial',sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = GAME_CONFIG.accentColor;
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 3;
    ctx.fillText(label.toUpperCase().split("").join(" "), x, cy);
    ctx.restore();
  }

  /** Returns true if the panel consumed the event. */
  onPointerDown(e: PointerInfo): boolean {
    if (!this.open) return false;

    for (let i = 0; i < this.langRects.length; i++) {
      if (hit(this.langRects[i], e)) {
        setLang(LANG_OPTIONS[i].code);
        return true;
      }
    }

    if (hit(this.toggleRect, e)) {
      toggleMute();
      return true;
    }

    if (hit(this.sfxToggleRect, e)) {
      toggleSfxMute();
      // Play a click only if we just turned SFX on, so we don't beep on the way out.
      if (!isSfxMuted()) playClick();
      return true;
    }

    const sr = this.sliderRect;
    const expanded: Rect = {
      x: sr.x - SLIDER_HANDLE_R,
      y: sr.y - SLIDER_HANDLE_R,
      w: sr.w + SLIDER_HANDLE_R * 2,
      h: sr.h + SLIDER_HANDLE_R * 2,
    };
    if (hit(expanded, e)) {
      this.draggingSlider = true;
      this.updateVolumeFromPointer(e);
      return true;
    }

    this.tutorialBtn.handlePointerDown(e);
    if (this.titleBtn) {
      this.titleBtn.handlePointerDown(e);
    }
    this.closeBtn.handlePointerDown(e);

    if (!hit({ x: PANEL_X, y: PANEL_Y, w: PANEL_W, h: PANEL_H }, e)) {
      this.hide();
      return true;
    }

    return true;
  }

  onPointerMove(e: PointerInfo): boolean {
    if (!this.open) return false;
    if (this.draggingSlider) {
      this.updateVolumeFromPointer(e);
      return true;
    }
    this.tutorialBtn.handlePointerMove(e);
    if (this.titleBtn) this.titleBtn.handlePointerMove(e);
    this.closeBtn.handlePointerMove(e);
    return this.open;
  }

  onPointerUp(e: PointerInfo): boolean {
    if (!this.open) return false;
    this.draggingSlider = false;

    if (this.tutorialBtn.handlePointerUp(e)) {
      // Replay the HOW TO PLAY demo immediately. The host (App) decides
      // where to come back to — typically the title screen.
      playClick();
      this.hide();
      this.onShowTutorial?.();
      return true;
    }
    if (this.titleBtn && this.titleBtn.handlePointerUp(e)) {
      this.hide();
      this.onReturnToTitle?.();
      return true;
    }
    if (this.closeBtn.handlePointerUp(e)) {
      this.hide();
      return true;
    }
    return true;
  }

  onKeyDown(key: string): boolean {
    if (!this.open) return false;
    if (key === "Escape") {
      this.hide();
    }
    return true;
  }

  private updateVolumeFromPointer(e: PointerInfo): void {
    const sr = this.sliderRect;
    const ratio = Math.max(0, Math.min(1, (e.x - sr.x) / sr.w));
    setVolumeRemembered(ratio);
  }
}

function hit(r: Rect, p: PointerInfo): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}
