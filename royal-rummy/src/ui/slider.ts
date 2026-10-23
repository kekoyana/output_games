import type { PointerInfo } from "../types";
import { roundRect, drawLockIcon, drawStar, drawImageCover } from "./canvas-utils";
import { getCachedImage } from "../core/image-loader";
import { GAME_CONFIG } from "../game-config";
import type { StageDef } from "../stage-types";
import { isStageCleared } from "../core/save-data";

interface SliderLayout {
  /** Y position of the thumbnail strip */
  y: number;
  /** Height of each thumbnail */
  thumbH: number;
  /** Width of each thumbnail */
  thumbW: number;
  /** Gap between thumbnails */
  gap: number;
}

const DEFAULT_LAYOUT: SliderLayout = {
  y: 1140,
  thumbH: 140,
  thumbW: 100,
  gap: 10,
};

/**
 * Horizontal thumbnail slider for character selection.
 * Supports drag/swipe scrolling, arrow key navigation, and tap selection.
 */
export class Slider {
  private stages: StageDef[] = [];
  private selectedIndex = 0;
  private scrollX = 0;
  private targetScrollX = 0;
  private layout: SliderLayout;
  private accentColor: string;

  // Drag state
  private dragging = false;
  private dragStartX = 0;
  private dragScrollStart = 0;
  private dragDistance = 0;

  constructor(stages: StageDef[], layout?: Partial<SliderLayout>) {
    this.stages = stages;
    this.layout = { ...DEFAULT_LAYOUT, ...layout };
    this.accentColor = GAME_CONFIG.accentColor;
    this.centerOnSelected();
  }

  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  getSelectedStage(): StageDef {
    return this.stages[this.selectedIndex];
  }

  setStages(stages: StageDef[]): void {
    this.stages = stages;
    if (this.selectedIndex >= stages.length) {
      this.selectedIndex = 0;
    }
    this.centerOnSelected();
  }

  selectNext(): void {
    if (this.selectedIndex < this.stages.length - 1) {
      this.selectedIndex++;
      this.centerOnSelected();
    }
  }

  selectPrev(): void {
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
      this.centerOnSelected();
    }
  }

  selectIndex(index: number): void {
    if (index >= 0 && index < this.stages.length) {
      this.selectedIndex = index;
      this.centerOnSelected();
    }
  }

  isLocked(_index: number): boolean {
    return false;
  }

  update(_dt: number): void {
    // Smooth scroll
    this.scrollX += (this.targetScrollX - this.scrollX) * 0.15;
  }

  draw(ctx: CanvasRenderingContext2D, gameW: number): void {
    const { y, thumbW, thumbH, gap } = this.layout;
    const totalW = this.stages.length * (thumbW + gap) - gap;
    const startX = (gameW - totalW) / 2 + this.scrollX;

    ctx.save();
    // Background strip
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, y - 10, gameW, thumbH + 20);

    for (let i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i];
      const tx = startX + i * (thumbW + gap);
      const ty = y;
      const selected = i === this.selectedIndex;
      const locked = this.isLocked(i);
      const cleared = isStageCleared(stage.name);

      // Thumbnail background
      ctx.save();
      roundRect(ctx, tx, ty, thumbW, thumbH, 8);
      ctx.clip();

      // Cover image
      const coverImg = getCachedImage(stage.portraitUrl);
      if (coverImg) {
        drawImageCover(ctx, coverImg, tx, ty, thumbW, thumbH);
      } else if (locked) {
        // Accent-tinted thumbnail hints at the locked character.
        const grad = ctx.createLinearGradient(tx, ty, tx, ty + thumbH);
        grad.addColorStop(0, stage.accentColor + "55");
        grad.addColorStop(1, "#0a0612");
        ctx.fillStyle = grad;
        ctx.fillRect(tx, ty, thumbW, thumbH);
      } else {
        ctx.fillStyle = "#222";
        ctx.fillRect(tx, ty, thumbW, thumbH);
      }

      // Darken non-selected / locked
      if (!selected || locked) {
        ctx.fillStyle = locked ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.3)";
        ctx.fillRect(tx, ty, thumbW, thumbH);
      }

      ctx.restore();

      // Border
      roundRect(ctx, tx, ty, thumbW, thumbH, 8);
      ctx.strokeStyle = selected ? this.accentColor : "#333";
      ctx.lineWidth = selected ? 3 : 1;
      ctx.stroke();

      // Lock icon
      if (locked) {
        drawLockIcon(ctx, tx + thumbW / 2, ty + thumbH / 2, thumbH * 0.5);
      }

      // Clear badge
      if (cleared && !locked) {
        drawStar(ctx, tx + thumbW - 14, ty + 14, 10, "#ffd700");
      }
    }
    ctx.restore();
  }

  /** Handle pointer down — returns true if inside slider area */
  onPointerDown(p: PointerInfo, gameW: number): boolean {
    const { y, thumbH } = this.layout;
    if (p.y >= y - 10 && p.y <= y + thumbH + 10) {
      this.dragging = true;
      this.dragStartX = p.x;
      this.dragScrollStart = this.targetScrollX;
      this.dragDistance = 0;

      // Check if tapped a specific thumbnail
      const idx = this.hitTestThumb(p, gameW);
      if (idx !== null) {
        this.selectedIndex = idx;
        this.centerOnSelected();
      }
      return true;
    }
    return false;
  }

  onPointerMove(p: PointerInfo): void {
    if (this.dragging) {
      const dx = p.x - this.dragStartX;
      this.dragDistance += Math.abs(dx);
      this.targetScrollX = this.dragScrollStart + dx;
    }
  }

  onPointerUp(_p: PointerInfo): void {
    this.dragging = false;
  }

  /** Was the last interaction a drag (not a tap)? */
  wasDrag(): boolean {
    return this.dragDistance > 10;
  }

  private centerOnSelected(): void {
    const { thumbW, gap } = this.layout;
    const totalW = this.stages.length * (thumbW + gap) - gap;
    const selectedCenter = this.selectedIndex * (thumbW + gap) + thumbW / 2;
    this.targetScrollX = totalW / 2 - selectedCenter;
  }

  private hitTestThumb(p: PointerInfo, gameW: number): number | null {
    const { y, thumbW, thumbH, gap } = this.layout;
    const totalW = this.stages.length * (thumbW + gap) - gap;
    const startX = (gameW - totalW) / 2 + this.scrollX;

    for (let i = 0; i < this.stages.length; i++) {
      const tx = startX + i * (thumbW + gap);
      if (p.x >= tx && p.x <= tx + thumbW && p.y >= y && p.y <= y + thumbH) {
        return i;
      }
    }
    return null;
  }
}
