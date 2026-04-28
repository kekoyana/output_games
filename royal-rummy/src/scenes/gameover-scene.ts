import type { Scene, SceneContext } from "../core/scene";
import type { PointerInfo } from "../types";
import { GAME_W, GAME_H } from "../types";
import {
  clearCanvas,
  drawVignette,
  drawTextWithShadow,
} from "../ui/canvas-utils";
import { Button } from "../ui/button";
import { playClick, playConfirm } from "../core/sfx";

export class GameOverScene implements Scene {
  private ctx!: SceneContext;
  private retryBtn!: Button;
  private selectBtn!: Button;
  private time = 0;

  enter(ctx: SceneContext): void {
    this.ctx = ctx;
    this.time = 0;
    playClick();

    const bw = 280;
    const bh = 76;
    const gap = 24;
    const cx = GAME_W / 2;
    const cy = GAME_H / 2 + 60;

    this.retryBtn = new Button(
      { x: cx - bw / 2, y: cy, w: bw, h: bh },
      "RETRY",
      { bgColor: "#c44", textColor: "#fff", fontSize: 34, radius: 14 }
    );
    this.selectBtn = new Button(
      { x: cx - bw / 2, y: cy + bh + gap, w: bw, h: bh },
      "STAGE SELECT",
      { bgColor: "#444", textColor: "#ccc", fontSize: 30, radius: 14 }
    );
  }

  exit(): void {}

  update(dt: number): void {
    this.time += dt;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const vp = this.ctx.getViewport();
    clearCanvas(ctx, "#111", vp);
    drawVignette(ctx, 0.6, vp);

    const fadeIn = Math.min(1, this.time / 0.4);
    ctx.globalAlpha = fadeIn;

    drawTextWithShadow(ctx, "GAME OVER", GAME_W / 2, GAME_H / 2 - 40, {
      font: "bold 72px sans-serif",
      color: "#c44",
      shadowBlur: 12,
    });

    ctx.globalAlpha = 1;

    this.retryBtn.draw(ctx);
    this.selectBtn.draw(ctx);
  }

  onPointerDown(e: PointerInfo): void {
    this.retryBtn.handlePointerDown(e);
    this.selectBtn.handlePointerDown(e);
  }

  onPointerMove(e: PointerInfo): void {
    this.retryBtn.handlePointerMove(e);
    this.selectBtn.handlePointerMove(e);
  }

  onPointerUp(e: PointerInfo): void {
    if (this.retryBtn.handlePointerUp(e)) {
      playConfirm();
      this.ctx.changeScene("loading", { ...this.ctx.data });
      return;
    }
    if (this.selectBtn.handlePointerUp(e)) {
      playClick();
      this.ctx.changeScene("select");
      return;
    }
  }

  onKeyDown(key: string): void {
    if (key === " " || key === "Enter") {
      playConfirm();
      this.ctx.changeScene("loading", { ...this.ctx.data });
    } else if (key === "Escape") {
      playClick();
      this.ctx.changeScene("select");
    }
  }
}
