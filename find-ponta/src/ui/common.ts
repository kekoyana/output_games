import Phaser from "phaser";
import { UI } from "./theme";

/** layout を即実行し、resize 時に作り直す。シーン終了時にリスナーを外す。 */
export function bindLayout(scene: Phaser.Scene, layout: () => void): void {
  const run = (): void => {
    scene.tweens.killAll();
    scene.children.removeAll(true);
    layout();
  };
  layout();
  scene.scale.on("resize", run);
  scene.events.once("shutdown", () => scene.scale.off("resize", run));
}

/** 画面全体を覆うように背景画像を配置し、暗幕を重ねる。 */
export function coverBackground(
  scene: Phaser.Scene, key: string, dim = 0.55, tint?: number,
): Phaser.GameObjects.Image {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const img = scene.add.image(w / 2, h / 2, key);
  img.setScale(Math.max(w / img.width, h / img.height));
  if (tint !== undefined) img.setTint(tint);
  scene.add.rectangle(w / 2, h / 2, w, h, 0x120a22, dim);
  return img;
}

export function heading(
  scene: Phaser.Scene, x: number, y: number, text: string, size: number, color = "#ffd966",
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: UI.serif, fontSize: `${size}px`, color, fontStyle: "bold",
    stroke: "#000000", strokeThickness: Math.max(3, Math.round(size / 8)),
    align: "center",
  }).setOrigin(0.5);
}

export function bodyText(
  scene: Phaser.Scene, x: number, y: number, text: string, size: number,
  color: string = UI.text, originX = 0.5,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: UI.sans, fontSize: `${size}px`, color,
    stroke: "#000000", strokeThickness: 3,
  }).setOrigin(originX, 0.5);
}

export function openSettings(scene: Phaser.Scene, resume = false): void {
  if (scene.scene.isActive("Settings")) return;
  scene.scene.launch("Settings", { from: scene.scene.key, resume });
  scene.scene.pause();
}

/** 星 ★ を描画（filled 数だけ金色）。 */
export function drawStars(
  scene: Phaser.Scene, cx: number, cy: number, filled: number, size: number, total = 3,
): Phaser.GameObjects.Text[] {
  const out: Phaser.GameObjects.Text[] = [];
  const gap = size * 1.15;
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * gap;
    out.push(scene.add.text(x, cy, "★", {
      fontFamily: "sans-serif", fontSize: `${size}px`,
      color: i < filled ? "#ffd23f" : "#4a3f5c",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0.5));
  }
  return out;
}
