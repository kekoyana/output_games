import "./core/namespace";
import Phaser from "phaser";
import { getDesignSize } from "./layout";
import { unlockSfx } from "./core/sfx";
import { PreloadScene } from "./scenes/PreloadScene";
import { TitleScene } from "./scenes/TitleScene";
import { StageSelectScene } from "./scenes/StageSelectScene";
import { GameScene } from "./scenes/GameScene";
import { ResultScene } from "./scenes/ResultScene";
import { installDebugHooks } from "./ui/debugHooks";
import { SettingsScene } from "./scenes/SettingsScene";

const size = getDesignSize();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: size.w,
  height: size.h,
  backgroundColor: "#1a0f24",
  // RESIZE: ゲーム解像度を #game-root の実寸に追従させる（FIT だと resize() 後に
  // canvas が歪むため）。各シーンは scale.width/height を見て再レイアウトする。
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  // mipmap で縮小表示時のジャギーを抑える（2 の累乗サイズのスプライトのみ対象）
  render: { mipmapFilter: "LINEAR_MIPMAP_LINEAR" },
  scene: [PreloadScene, TitleScene, StageSelectScene, GameScene, ResultScene, SettingsScene],
};

const game = new Phaser.Game(config);
installDebugHooks(game);

// 初回タッチ / クリック / キー押下で WebAudio をアンロック（モバイル必須）
const unlock = (): void => {
  unlockSfx();
};
window.addEventListener("pointerdown", unlock, { once: true });
window.addEventListener("keydown", unlock, { once: true });

// ResizeObserver で #game-root のサイズ変化を検知し、Phaser.Scale をリサイズする。
// `window.innerWidth` を直接渡すと最大化 ↔ 戻す時にズレるので、ラッパー div を観測する
// （CLAUDE.md 「Chrome 最大化 → 戻すで HUD が画面外に出る不具合」対策）
const gameRoot = document.getElementById("game-root");
if (gameRoot) {
  const ro = new ResizeObserver(() => {
    game.scale.resize(gameRoot.clientWidth, gameRoot.clientHeight);
  });
  ro.observe(gameRoot);
}

// ブラウザ標準のピンチズーム・Ctrl+ホイール拡大を抑止（ゲーム内ズームは独自処理）
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
window.addEventListener("wheel", (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
