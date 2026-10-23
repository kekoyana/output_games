import type { Scene, SceneName, SceneContext } from "./core/scene";
import { InputManager } from "./core/input";
import type { PointerInfo, Rect } from "./types";
import { SettingsPanel } from "./ui/settings-panel";
import { roundRect } from "./ui/canvas-utils";
import { unlockSfx } from "./core/sfx";

import { TitleScene } from "./scenes/title-scene";
import { SelectScene } from "./scenes/select-scene";
import { LoadingScene } from "./scenes/loading-scene";
import { TutorialScene } from "./scenes/tutorial-scene";
import { GameScene } from "./scenes/game-scene";
import { GameOverScene } from "./scenes/gameover-scene";
import { EndingScene } from "./scenes/ending-scene";

const GEAR_SIZE = 72;
const GEAR_MARGIN = 24;

export class App {
  private canvas: HTMLCanvasElement;
  private ctx2d: CanvasRenderingContext2D;
  private input: InputManager;
  private scenes: Map<SceneName, Scene>;
  private currentScene: Scene | null = null;
  currentSceneName: SceneName | null = null;
  private lastTime = 0;
  private settings = new SettingsPanel({
    onReturnToTitle: () => this.changeScene("title", {}),
    // Tutorial replay. Mid-match we resume the same GameScene instance
    // (its fields persist across enter/exit since the scene Map keeps it
    // alive); elsewhere we drop back to the title.
    onShowTutorial: () => {
      const inGame = this.currentSceneName === "game";
      this.changeScene("tutorial", {
        nextScene: inGame ? "game" : "title",
        nextData: inGame ? { resume: true } : {},
      });
    },
  });

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) throw new Error("Canvas 2D context not available");
    this.ctx2d = ctx2d;

    this.input = new InputManager(canvas);

    this.scenes = new Map<SceneName, Scene>([
      ["title", new TitleScene()],
      ["select", new SelectScene()],
      ["loading", new LoadingScene()],
      ["tutorial", new TutorialScene()],
      ["game", new GameScene()],
      ["gameover", new GameOverScene()],
      ["ending", new EndingScene()],
    ]);

    // Wire input — settings overlay gets first look at every event.
    this.input.onPointerDown = (e) => {
      // iOS/Safari requires unlocking audio inside a user gesture.
      unlockSfx();
      if (this.settings.onPointerDown(e)) return;
      if (!this.isGearHidden() && this.hitGear(e)) {
        this.settings.show();
        return;
      }
      this.currentScene?.onPointerDown?.(e);
    };
    this.input.onPointerMove = (e) => {
      if (this.settings.onPointerMove(e)) return;
      this.currentScene?.onPointerMove?.(e);
    };
    this.input.onPointerUp = (e) => {
      if (this.settings.onPointerUp(e)) return;
      this.currentScene?.onPointerUp?.(e);
    };
    this.input.onKeyDown = (key) => {
      if (this.settings.onKeyDown(key)) return;
      this.currentScene?.onKeyDown?.(key);
    };
  }

  /** Register a custom scene (for extending the template) */
  registerScene(name: SceneName, scene: Scene): void {
    this.scenes.set(name, scene);
  }

  start(): void {
    this.changeScene("title", {});
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop);
  }

  private changeScene = (name: SceneName, data?: Record<string, unknown>): void => {
    if (this.currentScene) {
      this.currentScene.exit();
    }
    const scene = this.scenes.get(name);
    if (!scene) {
      console.error(`Scene "${name}" not found`);
      return;
    }
    this.currentScene = scene;
    this.currentSceneName = name;
    const context: SceneContext = {
      changeScene: this.changeScene,
      getCanvas: () => this.canvas,
      getCtx: () => this.ctx2d,
      getViewport: () => this.input.getViewport(),
      data: data ?? {},
    };
    scene.enter(context);
  };

  /** Gear icon rect anchored to the viewport top-right. */
  private getGearRect(): Rect {
    const vp = this.input.getViewport();
    return {
      x: vp.x + vp.w - GEAR_SIZE - GEAR_MARGIN,
      y: vp.y + GEAR_MARGIN,
      w: GEAR_SIZE,
      h: GEAR_SIZE,
    };
  }

  private hitGear(e: PointerInfo): boolean {
    const r = this.getGearRect();
    return e.x >= r.x && e.x <= r.x + r.w && e.y >= r.y && e.y <= r.y + r.h;
  }

  private isGearHidden(): boolean {
    return this.currentScene?.isSystemUiHidden?.() === true;
  }

  private drawGear(ctx: CanvasRenderingContext2D): void {
    const { x, y, w, h } = this.getGearRect();
    ctx.save();
    roundRect(ctx, x, y, w, h, 14);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Gear body
    const cx = x + w / 2;
    const cy = y + h / 2;
    const outer = w * 0.32;
    const inner = w * 0.22;
    const hole = w * 0.11;

    ctx.fillStyle = "#e8e8e8";
    ctx.beginPath();
    const teeth = 8;
    for (let i = 0; i < teeth * 2; i++) {
      const angle = (Math.PI / teeth) * i;
      const r = i % 2 === 0 ? outer : inner;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#1a1a1a";
    ctx.beginPath();
    ctx.arc(cx, cy, hole, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private loop = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05); // Cap at 50ms
    this.lastTime = now;

    if (this.currentScene) {
      this.currentScene.update(dt);

      // Clear full device-pixel canvas to black (covers viewport extensions).
      this.ctx2d.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx2d.fillStyle = "#000";
      this.ctx2d.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Map virtual coords → device pixels. Scenes draw in virtual coords.
      const scale = this.input.getScale();
      const { x: ox, y: oy } = this.input.getOffset();
      this.ctx2d.setTransform(scale, 0, 0, scale, ox, oy);

      this.currentScene.draw(this.ctx2d);

      if (!this.isGearHidden() && !this.settings.isOpen()) {
        this.drawGear(this.ctx2d);
      }
      this.settings.draw(this.ctx2d);
    }

    requestAnimationFrame(this.loop);
  };
}
