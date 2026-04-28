import type { Scene, SceneContext, SceneName } from "../core/scene";
import { STAGES } from "../stage-assets.all";
import { loadImages } from "../core/image-loader";
import { drawLoadingScreen } from "../ui/loading";
import { clearCanvas } from "../ui/canvas-utils";
import type { StageDef } from "../stage-types";
import { GAME_CONFIG } from "../game-config";

import suitsUrl from "../assets/symbols/suits.png";

/**
 * Loading scene — loads all assets for the selected stage,
 * then transitions to the game scene (or tutorial first if unseen).
 */
export class LoadingScene implements Scene {
  private ctx!: SceneContext;
  private progress = 0;
  private done = false;

  enter(ctx: SceneContext): void {
    this.ctx = ctx;
    this.progress = 0;
    this.done = false;

    const stageIndex = ctx.data["stageIndex"] as number;
    const stage: StageDef = STAGES[stageIndex];

    const urls: string[] = [stage.portraitUrl, suitsUrl];

    loadImages(urls, (loaded, total) => {
      this.progress = loaded / total;
    })
      .then(() => {
        this.done = true;
      })
      .catch((err) => {
        console.error("Failed to load stage assets:", err);
        this.done = true;
      });
  }

  exit(): void {}

  update(_dt: number): void {
    if (!this.done) return;

    const tutSeen = (() => {
      try {
        return localStorage.getItem(`${GAME_CONFIG.saveKey}-tut-seen`) === "1";
      } catch {
        return true;
      }
    })();

    const gameTarget: { scene: SceneName; data: Record<string, unknown> } = {
      scene: "game",
      data: { ...this.ctx.data },
    };

    if (!tutSeen) {
      this.ctx.changeScene("tutorial", {
        nextScene: gameTarget.scene,
        nextData: gameTarget.data,
      });
    } else {
      this.ctx.changeScene(gameTarget.scene, gameTarget.data);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    clearCanvas(ctx, "#000", this.ctx.getViewport());
    drawLoadingScreen(ctx, this.progress, "Loading...");
  }
}
