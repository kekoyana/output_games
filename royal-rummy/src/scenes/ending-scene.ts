import type { Scene, SceneContext } from "../core/scene";
import type { PointerInfo } from "../types";
import { GAME_W, GAME_H } from "../types";
import { GAME_CONFIG } from "../game-config";
import { STAGES } from "../stage-assets.all";
import { getCachedImage, loadImage } from "../core/image-loader";
import { Button } from "../ui/button";
import { playBgm } from "../core/bgm";
import { playConfirm } from "../core/sfx";
import { getCharacterName } from "../i18n";
import {
  clearCanvas,
  drawTextWithShadow,
  drawImageCover,
  roundRect,
} from "../ui/canvas-utils";
import trophyUrl from "../assets/ending/trophy.png";

interface Spark {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
  phase: number;
}

const TROPHY_HEIGHT = Math.round(GAME_H * 0.62);
const ROSTER_TOP = TROPHY_HEIGHT + 30;
const THUMB_W = 180;
const THUMB_H = 220;

export class EndingScene implements Scene {
  private ctx!: SceneContext;
  private time = 0;
  private titleBtn!: Button;
  private sparks: Spark[] = [];

  enter(ctx: SceneContext): void {
    this.ctx = ctx;
    this.time = 0;
    playBgm("opening");

    loadImage(trophyUrl).catch(() => {});
    for (const stage of STAGES) {
      loadImage(stage.portraitUrl).catch(() => {});
    }

    this.titleBtn = new Button(
      { x: GAME_W / 2 - 220, y: GAME_H - 130, w: 440, h: 90 },
      "TITLE",
      {
        bgColor: GAME_CONFIG.accentColor,
        textColor: "#1c1812",
        fontSize: 36,
        radius: 22,
        glossy: true,
      }
    );

    this.sparks = [];
    for (let i = 0; i < 36; i++) {
      this.sparks.push({
        x: Math.random() * GAME_W,
        y: Math.random() * GAME_H,
        size: 2 + Math.random() * 5,
        speed: 24 + Math.random() * 36,
        alpha: 0.3 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  exit(): void {}

  update(dt: number): void {
    this.time += dt;
    for (const s of this.sparks) {
      s.y -= s.speed * dt;
      s.phase += dt * 2;
      if (s.y < -20) {
        s.y = GAME_H + 20;
        s.x = Math.random() * GAME_W;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const vp = this.ctx.getViewport();
    clearCanvas(ctx, "#0a0712", vp);

    // Hero illustration (top portion).
    const trophy = getCachedImage(trophyUrl);
    if (trophy) {
      drawImageCover(ctx, trophy, 0, 0, GAME_W, TROPHY_HEIGHT);
    } else {
      const placeholder = ctx.createLinearGradient(0, 0, 0, TROPHY_HEIGHT);
      placeholder.addColorStop(0, "#1d2858");
      placeholder.addColorStop(1, "#2c1b3a");
      ctx.fillStyle = placeholder;
      ctx.fillRect(0, 0, GAME_W, TROPHY_HEIGHT);
    }

    // Soft fade at the bottom of the trophy art into the dark roster band.
    const fade = ctx.createLinearGradient(0, TROPHY_HEIGHT - 120, 0, TROPHY_HEIGHT);
    fade.addColorStop(0, "rgba(8, 6, 18, 0)");
    fade.addColorStop(1, "rgba(8, 6, 18, 1)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, TROPHY_HEIGHT - 120, GAME_W, 120);

    // Roster background — deep purple/black band.
    ctx.fillStyle = "#08060f";
    ctx.fillRect(0, TROPHY_HEIGHT, GAME_W, GAME_H - TROPHY_HEIGHT);

    // Floating gold sparks across the entire screen.
    for (const s of this.sparks) {
      const drawX = s.x + Math.sin(s.phase) * 6;
      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.shadowColor = "#ffd86b";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#fff2c0";
      ctx.beginPath();
      ctx.arc(drawX, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Title text overlaid on the trophy halo.
    const pulse = 0.85 + 0.15 * Math.sin(this.time * 2.5);
    ctx.save();
    ctx.globalAlpha = pulse;
    drawTextWithShadow(ctx, "APPROVED BY THE KING", GAME_W / 2, 100, {
      font: "900 italic 64px 'Arial Black', sans-serif",
      color: "#ffe9a8",
      shadowColor: "rgba(0,0,0,0.95)",
      shadowBlur: 22,
    });
    ctx.restore();
    drawTextWithShadow(ctx, "You bested every challenger.", GAME_W / 2, 162, {
      font: "italic 28px 'Arial Black', sans-serif",
      color: "#ffd86b",
      shadowColor: "rgba(0,0,0,0.85)",
      shadowBlur: 10,
    });

    // Roster header.
    drawTextWithShadow(ctx, "— DEFEATED CHALLENGERS —", GAME_W / 2, ROSTER_TOP - 8, {
      font: "bold 24px sans-serif",
      color: "#cbb068",
    });

    const total = STAGES.length;
    const totalW = total * THUMB_W + (total - 1) * 24;
    const startX = (GAME_W - totalW) / 2;
    const thumbY = ROSTER_TOP + 28;

    for (let i = 0; i < total; i++) {
      const stage = STAGES[i];
      const tx = startX + i * (THUMB_W + 24);
      const portraitImg = getCachedImage(stage.portraitUrl);

      ctx.save();
      roundRect(ctx, tx, thumbY, THUMB_W, THUMB_H, 14);
      ctx.clip();
      if (portraitImg) {
        drawImageCover(ctx, portraitImg, tx, thumbY, THUMB_W, THUMB_H);
      } else {
        ctx.fillStyle = "#1a1620";
        ctx.fillRect(tx, thumbY, THUMB_W, THUMB_H);
      }
      // Bottom darken for label legibility.
      const grad = ctx.createLinearGradient(tx, thumbY, tx, thumbY + THUMB_H);
      grad.addColorStop(0.5, "rgba(0,0,0,0)");
      grad.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = grad;
      ctx.fillRect(tx, thumbY, THUMB_W, THUMB_H);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = stage.accentColor ?? GAME_CONFIG.accentColor;
      ctx.lineWidth = 2;
      roundRect(ctx, tx, thumbY, THUMB_W, THUMB_H, 14);
      ctx.stroke();
      ctx.restore();

      drawTextWithShadow(ctx, getCharacterName(stage.name), tx + THUMB_W / 2, thumbY + THUMB_H - 18, {
        font: "900 22px 'Arial Black', sans-serif",
        color: "#fff",
        shadowColor: "rgba(0,0,0,0.9)",
        shadowBlur: 6,
      });
    }

    this.titleBtn.draw(ctx);
  }

  onPointerDown(e: PointerInfo): void {
    this.titleBtn.handlePointerDown(e);
  }

  onPointerMove(e: PointerInfo): void {
    this.titleBtn.handlePointerMove(e);
  }

  onPointerUp(e: PointerInfo): void {
    if (this.titleBtn.handlePointerUp(e)) {
      playConfirm();
      this.ctx.changeScene("title");
    }
  }

  onKeyDown(key: string): void {
    if (key === "Enter" || key === " " || key === "Escape") {
      playConfirm();
      this.ctx.changeScene("title");
    }
  }
}
