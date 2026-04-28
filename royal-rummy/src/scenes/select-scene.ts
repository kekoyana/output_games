import type { Scene, SceneContext } from "../core/scene";
import type { PointerInfo, Rect } from "../types";
import { GAME_W, GAME_H } from "../types";
import { GAME_CONFIG } from "../game-config";
import { STAGES } from "../stage-assets.all";
import type { StageDef } from "../stage-types";
import { Button } from "../ui/button";
import { getCachedImage, loadImage } from "../core/image-loader";
import { isStageCleared } from "../core/save-data";
import { playSelect, playConfirm } from "../core/sfx";
import { playBgm } from "../core/bgm";
import { getCharacterName, t } from "../i18n";
import {
  clearCanvas,
  drawTextWithShadow,
  drawImageCover,
  roundRect,
  drawStar,
} from "../ui/canvas-utils";

const TILE_MARGIN_X = 60;
const TILE_GAP = 24;
const HEADER_H = 200;
const FOOTER_H = 220;
const PLAY_BTN_W = 420;
const PLAY_BTN_H = 110;

interface Tile {
  rect: Rect;
  stage: StageDef;
  index: number;
}

/** 2x2 grid opponent select. Tap a tile to highlight it, then PLAY. */
export class SelectScene implements Scene {
  private ctx!: SceneContext;
  private tiles: Tile[] = [];
  private selectedIndex = 0;
  private backBtn!: Button;
  private playBtn!: Button;

  enter(ctx: SceneContext): void {
    this.ctx = ctx;
    playBgm("opening");

    this.backBtn = new Button(
      { x: 20, y: 20, w: 150, h: 60 },
      "< TOP",
      { bgColor: "#5b6068", textColor: "#fff", fontSize: 26, radius: 14, glossy: true }
    );
    this.playBtn = new Button(
      { x: GAME_W / 2 - PLAY_BTN_W / 2, y: GAME_H - FOOTER_H + 30, w: PLAY_BTN_W, h: PLAY_BTN_H },
      "PLAY",
      {
        bgColor: GAME_CONFIG.accentColor,
        textColor: "#1c1812",
        fontSize: 42,
        radius: 22,
        sublabel: "Begin the duel",
        glossy: true,
      }
    );

    this.layoutTiles();
    for (const stage of STAGES) {
      loadImage(stage.portraitUrl).catch(() => {});
    }
  }

  exit(): void {}

  private layoutTiles(): void {
    const cols = 2;
    const rows = 2;
    const innerW = GAME_W - TILE_MARGIN_X * 2 - TILE_GAP * (cols - 1);
    const innerH = GAME_H - HEADER_H - FOOTER_H - TILE_GAP * (rows - 1);
    const tileW = innerW / cols;
    const tileH = innerH / rows;

    this.tiles = [];
    for (let i = 0; i < STAGES.length && i < 4; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      this.tiles.push({
        index: i,
        stage: STAGES[i],
        rect: {
          x: TILE_MARGIN_X + c * (tileW + TILE_GAP),
          y: HEADER_H + r * (tileH + TILE_GAP),
          w: tileW,
          h: tileH,
        },
      });
    }
  }

  update(_dt: number): void {}

  draw(ctx: CanvasRenderingContext2D): void {
    const vp = this.ctx.getViewport();
    this.backBtn.rect.x = vp.x + 20;

    clearCanvas(ctx, "#0c0a18", vp);

    // Backdrop gradient (deep blue → purple → near-black).
    const bg = ctx.createLinearGradient(0, 0, 0, GAME_H);
    bg.addColorStop(0, "#1c2a52");
    bg.addColorStop(0.55, "#241830");
    bg.addColorStop(1, "#08060f");
    ctx.fillStyle = bg;
    ctx.fillRect(vp.x, vp.y, vp.w, vp.h);

    // Heading.
    drawTextWithShadow(ctx, t("stageSelect"), GAME_W / 2, 110, {
      font: "900 56px 'Arial Black', sans-serif",
      color: "#ffe9a8",
      shadowColor: "rgba(0,0,0,0.85)",
      shadowBlur: 14,
    });
    drawTextWithShadow(ctx, "Choose your challenger", GAME_W / 2, 160, {
      font: "italic 26px sans-serif",
      color: "#cbb068",
    });

    for (const tile of this.tiles) {
      this.drawTile(ctx, tile, tile.index === this.selectedIndex);
    }

    this.backBtn.draw(ctx);
    this.playBtn.draw(ctx);
  }

  private drawTile(ctx: CanvasRenderingContext2D, tile: Tile, selected: boolean): void {
    const { x, y, w, h } = tile.rect;
    const stage = tile.stage;
    const cleared = isStageCleared(stage.name);
    const portraitImg = getCachedImage(stage.portraitUrl);

    ctx.save();
    roundRect(ctx, x, y, w, h, 18);
    ctx.clip();
    if (portraitImg) {
      drawImageCover(ctx, portraitImg, x, y, w, h);
    } else {
      ctx.fillStyle = "#1a1620";
      ctx.fillRect(x, y, w, h);
    }
    // Bottom darken for legibility.
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.55, "rgba(0,0,0,0.15)");
    grad.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    // Border.
    const borderColor = selected
      ? GAME_CONFIG.accentColor
      : (stage.accentColor ?? "rgba(255,255,255,0.25)");
    ctx.save();
    if (selected) {
      ctx.shadowColor = GAME_CONFIG.accentColor;
      ctx.shadowBlur = 18;
    }
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = selected ? 5 : 2;
    roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 16);
    ctx.stroke();
    ctx.restore();

    // Cleared overlay — gold tint + DEFEATED ribbon for unmistakable signal.
    if (cleared) {
      ctx.save();
      roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 16);
      ctx.clip();
      ctx.fillStyle = "rgba(255, 195, 60, 0.16)";
      ctx.fillRect(x, y, w, h);
      ctx.restore();

      // Diagonal "DEFEATED" ribbon across the top-left.
      ctx.save();
      ctx.translate(x + 6, y + 6);
      ctx.rotate(-Math.PI / 4);
      const ribbonW = 220;
      const ribbonH = 36;
      ctx.fillStyle = "#c89638";
      ctx.fillRect(-ribbonW / 2, -ribbonH / 2, ribbonW, ribbonH);
      ctx.strokeStyle = "#7a5018";
      ctx.lineWidth = 2;
      ctx.strokeRect(-ribbonW / 2, -ribbonH / 2, ribbonW, ribbonH);
      drawTextWithShadow(ctx, "DEFEATED", 0, 1, {
        font: "900 22px 'Arial Black', sans-serif",
        color: "#fff",
        shadowColor: "rgba(0,0,0,0.7)",
        shadowBlur: 4,
      });
      ctx.restore();

      // Gold star ⭐ at top-right.
      drawStar(ctx, x + w - 32, y + 32, 18, "#ffd700");
    }

    // Name + style at the bottom.
    const labelX = x + w / 2;
    drawTextWithShadow(ctx, getCharacterName(stage.name), labelX, y + h - 70, {
      font: "900 38px 'Arial Black', sans-serif",
      color: cleared ? "#ffe9a8" : "#fff",
      shadowColor: "rgba(0,0,0,0.85)",
      shadowBlur: 8,
    });
    if (stage.playStyle) {
      drawTextWithShadow(ctx, stage.playStyle.toUpperCase(), labelX, y + h - 30, {
        font: "bold 22px sans-serif",
        color: stage.accentColor ?? "#cbb068",
      });
    }
  }

  private hitTile(e: PointerInfo): Tile | null {
    for (const tile of this.tiles) {
      const r = tile.rect;
      if (e.x >= r.x && e.x <= r.x + r.w && e.y >= r.y && e.y <= r.y + r.h) {
        return tile;
      }
    }
    return null;
  }

  onPointerDown(e: PointerInfo): void {
    if (this.backBtn.handlePointerDown(e)) {
      playSelect();
      this.ctx.changeScene("title");
      return;
    }
    if (this.playBtn.handlePointerDown(e)) {
      playConfirm();
      this.ctx.changeScene("loading", { stageIndex: this.selectedIndex });
      return;
    }
    const tile = this.hitTile(e);
    if (tile) {
      if (tile.index === this.selectedIndex) {
        // Tap on the already-selected tile = quick start.
        playConfirm();
        this.ctx.changeScene("loading", { stageIndex: this.selectedIndex });
      } else {
        playSelect();
        this.selectedIndex = tile.index;
      }
    }
  }

  onPointerMove(e: PointerInfo): void {
    this.backBtn.handlePointerMove(e);
    this.playBtn.handlePointerMove(e);
  }

  onPointerUp(e: PointerInfo): void {
    this.backBtn.handlePointerUp(e);
    this.playBtn.handlePointerUp(e);
  }

  onKeyDown(key: string): void {
    const cols = 2;
    const total = this.tiles.length;
    if (key === "ArrowLeft") {
      this.selectedIndex = (this.selectedIndex + total - 1) % total;
    } else if (key === "ArrowRight") {
      this.selectedIndex = (this.selectedIndex + 1) % total;
    } else if (key === "ArrowUp") {
      this.selectedIndex = (this.selectedIndex + total - cols) % total;
    } else if (key === "ArrowDown") {
      this.selectedIndex = (this.selectedIndex + cols) % total;
    } else if (key === "Enter" || key === " ") {
      this.ctx.changeScene("loading", { stageIndex: this.selectedIndex });
    } else if (key === "Escape") {
      this.ctx.changeScene("title");
    }
  }
}
