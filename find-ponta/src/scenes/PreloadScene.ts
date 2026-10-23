import Phaser from "phaser";
import { t } from "../i18n";
import { BG_KEYS, SPRITE_KEYS, assetUrl } from "../game/assets";
import { UI } from "../ui/theme";

/** 起動時の共通ロード画面。全アセットを読み込み、完了後に Title へ。 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("Preload");
  }

  preload(): void {
    // index.html の watchdog 用マーカー
    (window as unknown as { __phaser_scene_started?: boolean }).__phaser_scene_started = true;
    this.cameras.main.setBackgroundColor("#1a1424");

    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    const cy = h / 2;
    const barW = Math.min(360, w * 0.7);
    const barH = 18;

    this.add.text(cx, cy - 90, "Find Ponta!", {
      fontFamily: UI.serif, fontSize: "40px", color: "#ffd966", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 5,
    }).setOrigin(0.5);
    const back = this.add.rectangle(cx, cy, barW, barH, 0x222033).setStrokeStyle(2, 0x554477);
    const fill = this.add.rectangle(cx - barW / 2, cy, 0, barH, 0xc9a85a).setOrigin(0, 0.5);
    const label = this.add.text(cx, cy - 32, t("loading"), {
      fontFamily: UI.serif, fontSize: "20px", color: "#ffd966",
    }).setOrigin(0.5);
    const pct = this.add.text(cx, cy + 32, "0%", {
      fontFamily: UI.sans, fontSize: "14px", color: "#c8a6ff",
    }).setOrigin(0.5);

    this.load.on("progress", (p: number) => {
      fill.width = barW * p;
      pct.setText(`${Math.round(p * 100)}%`);
    });
    this.load.on("complete", () => {
      back.destroy();
      fill.destroy();
      label.destroy();
      pct.destroy();
    });

    for (const k of BG_KEYS) this.load.image(k, assetUrl(`bg/${k}.jpg`));
    for (const k of SPRITE_KEYS) this.load.image(k, assetUrl(`sprites/${k}.png`));
  }

  create(): void {
    this.scene.start("Title");
  }
}
