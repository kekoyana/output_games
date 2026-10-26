import Phaser from "phaser";
import { getGameApi, getLastResult } from "../game/debug";

interface UiRect {
  scene: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

declare global {
  interface Window {
    getGameState?: () => Record<string, unknown>;
    __findPonta?: Record<string, unknown>;
  }
}

function walk(scene: Phaser.Scene, list: Phaser.GameObjects.GameObject[], out: UiRect[], parentLabel = ""): void {
  for (const o of list) {
    const c = o as Phaser.GameObjects.Container;
    if (o.input && o.input.enabled) {
      const b = (o as unknown as Phaser.GameObjects.Components.GetBounds).getBounds();
      const own = o instanceof Phaser.GameObjects.Text ? o.text : "";
      out.push({ scene: scene.scene.key, label: own || parentLabel, x: b.centerX, y: b.centerY, w: b.width, h: b.height });
    }
    if (Array.isArray(c.list)) {
      const txt = c.list.find((ch) => ch instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined;
      walk(scene, c.list, out, txt ? txt.text : parentLabel);
    }
  }
}

/** window.getGameState / window.__findPonta を公開する（テスト・デバッグ用）。 */
export function installDebugHooks(game: Phaser.Game): void {
  const sceneKey = (): string => {
    const keys = game.scene.getScenes(true).map((s) => s.scene.key);
    if (keys.includes("Settings")) return "Settings";
    return keys[keys.length - 1] ?? "Preload";
  };
  const toPage = (x: number, y: number): { x: number; y: number } => {
    const r = game.canvas.getBoundingClientRect();
    return { x: r.left + (x * r.width) / game.scale.width, y: r.top + (y * r.height) / game.scale.height };
  };

  window.getGameState = () => {
    const api = getGameApi();
    const key = sceneKey();
    const base: Record<string, unknown> = {
      scene: key, stage: null, seed: null, timeLeft: null, misses: 0, hintsUsed: 0, bonusFound: 0, score: 0,
    };
    if (api) return { ...base, ...api.getState(), scene: key };
    const r = getLastResult();
    if (r && key === "Result") {
      return {
        ...base, scene: key, stage: r.stage, seed: r.seed, timeLeft: r.timeLeft, misses: r.misses,
        hintsUsed: r.hints, bonusFound: r.bonusFound, score: r.score, cleared: r.cleared, stars: r.stars,
        difficulty: r.difficulty,
      };
    }
    return base;
  };

  const need = <T>(f: (a: NonNullable<ReturnType<typeof getGameApi>>) => T): T | null => {
    const api = getGameApi();
    return api ? f(api) : null;
  };
  window.__findPonta = {
    getPontaWorldPos: () => need((a) => a.getPontaWorldPos()),
    getDecoyWorldPositions: () => need((a) => a.getDecoyWorldPositions()) ?? [],
    getMobWorldPositions: () => need((a) => a.getMobWorldPositions()) ?? [],
    getBonusWorldPositions: () => need((a) => a.getBonusWorldPositions()) ?? [],
    getFriendWorldPositions: () => need((a) => a.getFriendWorldPositions()) ?? [],
    getTreasureWorldPositions: () => need((a) => a.getTreasureWorldPositions()) ?? [],
    getJunkWorldPositions: () => need((a) => a.getJunkWorldPositions()) ?? [],
    tapWorld: (x: number, y: number) => need((a) => a.tapWorld(x, y)),
    setView: (z: number, x: number, y: number) => { need((a) => a.setView(z, x, y)); },
    skipIntro: () => { need((a) => a.skipIntro()); },
    worldToPage: (x: number, y: number) => need((a) => a.worldToPage(x, y)),
    /** 現在アクティブなシーンの操作可能UIの矩形（ページ座標の中心とサイズ）。 */
    getInteractives: () => {
      const out: UiRect[] = [];
      for (const s of game.scene.getScenes(true)) walk(s, s.children.list, out);
      const api = getGameApi();
      const hb = api ? api.getHudButtons() : [];
      return [...out, ...hb].map((r) => {
        const c = toPage(r.x, r.y);
        const k = game.canvas.getBoundingClientRect().width / game.scale.width;
        return { ...r, x: c.x, y: c.y, w: r.w * k, h: r.h * k };
      });
    },
  };
}
