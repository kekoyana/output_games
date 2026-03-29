import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';

// テンプレートのcanvasを非表示にする
const templateCanvas = document.getElementById('game') as HTMLCanvasElement | null;
if (templateCanvas) {
  templateCanvas.style.display = 'none';
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#1a1a2e',
  scene: [TitleScene, GameScene, ResultScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    touch: true,
  },
  parent: document.body,
};

const game = new Phaser.Game(config);

// デバッグ用: Phaserゲームインスタンスを公開
(window as unknown as Record<string, unknown>).__PHASER_GAME__ = game;

// リサイズ対応
window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});
