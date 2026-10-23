import type { Scene, SceneContext } from "../core/scene";
import type { PointerInfo } from "../types";
import { GAME_W, GAME_H } from "../types";
import { GAME_CONFIG } from "../game-config";
import { playSelect, playConfirm } from "../core/sfx";
import { playBgm } from "../core/bgm";
import { hasAnyClear, clearAllProgress } from "../core/save-data";
import { Button } from "../ui/button";
import {
  clearCanvas,
  drawTextWithShadow,
  drawStar,
  roundRect,
} from "../ui/canvas-utils";
import { drawCardFace, preloadElementIcons } from "../ui/card-face";
import type { Card } from "../game/gin-rummy";

interface Spark {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
  wobble: number;
  phase: number;
  hue: number;
}

const MENU_BTN_W = 440;
const MENU_BTN_H = 92;
const MENU_GAP = 22;
// Menu sits in the middle of the screen, between logo and the deco card fan.
const MENU_TOP = Math.round(GAME_H * 0.50);

const HOWTO_W = 320;
const HOWTO_H = 64;
const HOWTO_X = (GAME_W - HOWTO_W) / 2;
const HOWTO_Y = MENU_TOP + MENU_BTN_H * 2 + MENU_GAP * 2 + 12;

const DECO_CARDS: Card[] = [
  { id: 0, suit: 1, rank: 10 }, // Wand 10
  { id: 1, suit: 0, rank: 11 }, // Sword J
  { id: 2, suit: 3, rank: 1 },  // Crown A — centrepiece
  { id: 3, suit: 2, rank: 13 }, // Shield K
  { id: 4, suit: 0, rank: 7 },  // Sword 7
];
const DECO_CARD_W = 110;
const DECO_CARD_H = 158;
const DECO_CARD_GAP = 64;
const DECO_CARD_TILT = 8;
const DECO_CARD_CY = GAME_H - 200;

export class TitleScene implements Scene {
  private ctx!: SceneContext;
  private time = 0;
  private sparks: Spark[] = [];
  private newGameBtn!: Button;
  private continueBtn!: Button;
  private hasSave = false;

  enter(ctx: SceneContext): void {
    this.ctx = ctx;
    this.time = 0;

    preloadElementIcons();
    playBgm("opening");

    this.hasSave = hasAnyClear();

    const btnX = (GAME_W - MENU_BTN_W) / 2;
    this.newGameBtn = new Button(
      { x: btnX, y: MENU_TOP, w: MENU_BTN_W, h: MENU_BTN_H },
      "はじめから",
      {
        bgColor: GAME_CONFIG.accentColor,
        textColor: "#1c1812",
        fontSize: 38,
        radius: MENU_BTN_H / 2,
        sublabel: "New Game",
        glossy: true,
      }
    );
    this.continueBtn = new Button(
      { x: btnX, y: MENU_TOP + MENU_BTN_H + MENU_GAP, w: MENU_BTN_W, h: MENU_BTN_H },
      "つづきから",
      {
        bgColor: this.hasSave ? "#2a3858" : "#2a2630",
        textColor: this.hasSave ? "#fff" : "#666",
        fontSize: 36,
        radius: MENU_BTN_H / 2,
        sublabel: "Continue",
        glossy: this.hasSave,
      }
    );

    this.sparks = [];
    for (let i = 0; i < 24; i++) {
      this.sparks.push(this.createSpark(true));
    }
  }

  exit(): void {}

  private createSpark(initial = false): Spark {
    return {
      x: Math.random() * GAME_W,
      y: initial ? Math.random() * GAME_H : GAME_H + 40,
      size: 4 + Math.random() * 8,
      speed: 18 + Math.random() * 32,
      alpha: 0.25 + Math.random() * 0.45,
      wobble: 12 + Math.random() * 26,
      phase: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.5 ? 42 : 18,
    };
  }

  update(dt: number): void {
    this.time += dt;
    for (const s of this.sparks) {
      s.y -= s.speed * dt;
      s.phase += dt * 2;
      if (s.y < -40) {
        Object.assign(s, this.createSpark(false));
        s.y = GAME_H + 20;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const vp = this.ctx.getViewport();
    clearCanvas(ctx, "#0e1426", vp);

    const bg = ctx.createLinearGradient(0, 0, 0, GAME_H);
    bg.addColorStop(0, "#1c2244");
    bg.addColorStop(0.55, "#2a1d2c");
    bg.addColorStop(1, "#0a0712");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    for (const s of this.sparks) {
      const drawX = s.x + Math.sin(s.phase) * s.wobble;
      const col = s.hue === 42 ? "#ffd86b" : "#ff9a54";
      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.shadowColor = col;
      ctx.shadowBlur = 12;
      drawStar(ctx, drawX, s.y, s.size, col);
      ctx.restore();
    }

    const cx = GAME_W / 2;
    const logoCY = GAME_H * 0.16;
    drawTextWithShadow(ctx, GAME_CONFIG.name.toUpperCase(), cx, logoCY, {
      font: "900 italic 86px 'Arial Black', sans-serif",
      color: "#ffe9a8",
      shadowColor: "rgba(0,0,0,0.85)",
      shadowBlur: 20,
    });
    drawTextWithShadow(ctx, "— A Court Card Tournament —", cx, logoCY + 70, {
      font: "italic 28px 'Arial Black', sans-serif",
      color: "#cbb068",
      shadowColor: "rgba(0,0,0,0.7)",
      shadowBlur: 6,
    });

    this.drawCardFan(ctx);

    // Menu buttons.
    this.newGameBtn.draw(ctx);
    this.continueBtn.draw(ctx);

    // Subtle pulse on the New Game button to draw the eye.
    if (!this.hasSave) {
      const pulse = 0.45 + 0.55 * Math.sin(this.time * 3);
      ctx.save();
      ctx.globalAlpha = pulse * 0.6;
      ctx.strokeStyle = "#ffe9a8";
      ctx.lineWidth = 3;
      roundRect(
        ctx,
        this.newGameBtn.rect.x - 4,
        this.newGameBtn.rect.y - 4,
        this.newGameBtn.rect.w + 8,
        this.newGameBtn.rect.h + 8,
        (this.newGameBtn.rect.h + 8) / 2
      );
      ctx.stroke();
      ctx.restore();
    }

    this.drawHowToPlayBtn(ctx);
    void vp;
  }

  private drawCardFan(ctx: CanvasRenderingContext2D): void {
    const cx = GAME_W / 2;
    const cy = DECO_CARD_CY;
    ctx.save();
    ctx.globalAlpha = 0.92;
    for (let i = 0; i < DECO_CARDS.length; i++) {
      const offset = i - (DECO_CARDS.length - 1) / 2;
      const px = cx + offset * DECO_CARD_GAP;
      const py = cy + Math.abs(offset) * 6;
      const angle = offset * DECO_CARD_TILT * (Math.PI / 180);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle);
      drawCardFace(
        ctx,
        DECO_CARDS[i],
        -DECO_CARD_W / 2,
        -DECO_CARD_H / 2,
        DECO_CARD_W,
        DECO_CARD_H,
        false
      );
      ctx.restore();
    }
    ctx.restore();
  }

  private howtoHitTest(e: PointerInfo): boolean {
    return (
      e.x >= HOWTO_X &&
      e.x <= HOWTO_X + HOWTO_W &&
      e.y >= HOWTO_Y &&
      e.y <= HOWTO_Y + HOWTO_H
    );
  }

  private drawHowToPlayBtn(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.shadowColor = "rgba(255,216,107,0.55)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "rgba(34,22,18,0.85)";
    roundRect(ctx, HOWTO_X, HOWTO_Y, HOWTO_W, HOWTO_H, HOWTO_H / 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(255,216,107,0.85)";
    ctx.lineWidth = 2;
    roundRect(ctx, HOWTO_X + 1, HOWTO_Y + 1, HOWTO_W - 2, HOWTO_H - 2, HOWTO_H / 2);
    ctx.stroke();
    ctx.restore();

    drawTextWithShadow(ctx, "HOW TO PLAY", HOWTO_X + HOWTO_W / 2, HOWTO_Y + HOWTO_H / 2 + 1, {
      font: "800 26px 'Hiragino Sans','Yu Gothic','Helvetica Neue',sans-serif",
      color: "#fff",
    });
  }

  onPointerDown(e: PointerInfo): void {
    if (this.newGameBtn.handlePointerDown(e)) return;
    if (this.hasSave && this.continueBtn.handlePointerDown(e)) return;
    if (this.howtoHitTest(e)) {
      playSelect();
      this.ctx.changeScene("tutorial", { nextScene: "title", nextData: {} });
      return;
    }
  }

  onPointerMove(e: PointerInfo): void {
    this.newGameBtn.handlePointerMove(e);
    this.continueBtn.handlePointerMove(e);
  }

  onPointerUp(e: PointerInfo): void {
    if (this.newGameBtn.handlePointerUp(e)) {
      playConfirm();
      // 「はじめから」: 進捗を全消去してから select へ。
      clearAllProgress();
      this.hasSave = false;
      this.ctx.changeScene("select");
      return;
    }
    if (this.hasSave && this.continueBtn.handlePointerUp(e)) {
      playConfirm();
      this.ctx.changeScene("select");
      return;
    }
  }

  onKeyDown(key: string): void {
    if (key === " " || key === "Enter") {
      playConfirm();
      if (this.hasSave) {
        this.ctx.changeScene("select");
      } else {
        clearAllProgress();
        this.ctx.changeScene("select");
      }
    }
  }
}
