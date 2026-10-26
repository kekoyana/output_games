import type { GameApi } from "../../game/debug";
import { entityCenter } from "../../game/geometry";
import type { GameScene } from "../GameScene";

/** AIプレイテスト用フックの実体（GameScene を操作・参照する）。 */
export function createGameApi(s: GameScene): GameApi {
  const center = (e: Parameters<typeof entityCenter>[0]): { x: number; y: number } => {
    const c = entityCenter(e, s.stage);
    return { x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10 };
  };
  return {
    getState: () => ({
      scene: "Game",
      phase: s.phase,
      stage: s.stage.id,
      difficulty: s.difficulty,
      hard: s.hard,
      seed: s.seed,
      timeLeft: Math.round(Math.max(0, s.timeLeft) * 100) / 100,
      misses: s.misses,
      hintsUsed: s.hintsUsed,
      hintsLeft: s.hintMax - s.hintsUsed,
      bonusFound: s.found.size,
      bonusTotal: s.layout.bonuses.length,
      friendFound: s.layout.friends.filter((e) => s.foundExtras.has(e.id)).length,
      friendTotal: s.layout.friends.length,
      treasureFound: s.layout.treasures.filter((e) => s.foundExtras.has(e.id)).length,
      treasureTotal: s.layout.treasures.length,
      junkTotal: s.layout.junk.length,
      pontaFound: s.pontaFound,
      score: s.score,
      zoom: s.rig.zoom,
      minZoom: s.rig.minZoom,
      viewCenter: { x: s.rig.cx, y: s.rig.cy },
      hintActive: s.world.hintActive(),
    }),
    getPontaWorldPos: () => center(s.layout.ponta),
    getDecoyWorldPositions: () => s.layout.decoys.map((e) => ({ ...center(e), tex: e.tex })),
    getMobWorldPositions: () => s.layout.mobs.map((e) => ({ ...center(e), tex: e.tex })),
    getBonusWorldPositions: () =>
      s.layout.bonuses.map((e) => ({ ...center(e), tex: e.tex, found: s.found.has(e.id) })),
    getFriendWorldPositions: () =>
      s.layout.friends.map((e) => ({ ...center(e), tex: e.tex, found: s.foundExtras.has(e.id) })),
    getTreasureWorldPositions: () =>
      s.layout.treasures.map((e) => ({ ...center(e), tex: e.tex, found: s.foundExtras.has(e.id) })),
    getJunkWorldPositions: () => s.layout.junk.map((e) => ({ ...center(e), tex: e.tex })),
    tapWorld: (x, y) => s.handleTap(x, y, Math.min(60, 22 / s.rig.zoom)),
    setView: (zoom, wx, wy) => s.rig.setView(zoom, wx, wy),
    skipIntro: () => s.startPlay(),
    getHudButtons: () => {
      const list = s.hud.hasModal() ? s.hud.modalButtons : s.hud.buttons;
      return list.map((b) => ({ scene: "Game", label: b.id, x: b.x + b.w / 2, y: b.y + b.h / 2, w: b.w, h: b.h }));
    },
    worldToPage: (x, y) => {
      const p = s.rig.worldToScreen(x, y);
      const r = s.game.canvas.getBoundingClientRect();
      return { x: r.left + (p.x * r.width) / s.scale.width, y: r.top + (p.y * r.height) / s.scale.height };
    },
  };
}
