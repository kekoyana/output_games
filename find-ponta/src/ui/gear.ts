import Phaser from "phaser";
import { playClick } from "../core/sfx";

/**
 * 各シーンの右上に歯車アイコンを配置し、タップで SettingsScene をオーバーレイで開く。
 * シーンの `create()` または `layout()` で呼ぶ。`resize` で再構築するシーンでは layout 内で呼び直す。
 */
export function addGearButton(scene: Phaser.Scene): Phaser.GameObjects.Text {
  const w = scene.scale.width;
  const gear = scene.add.text(w - 14, 14, "⚙", {
    fontFamily: "sans-serif",
    fontSize: "26px",
    color: "#ffffff",
  })
    .setOrigin(1, 0)
    .setScrollFactor(0)
    .setDepth(900)
    .setShadow(0, 1, "#000000", 2, true, true)
    .setInteractive({ useHandCursor: true });

  gear.on("pointerdown", () => {
    playClick();
    if (scene.scene.isActive("Settings")) return;
    scene.scene.launch("Settings", { from: scene.scene.key });
    scene.scene.pause();
  });

  return gear;
}
