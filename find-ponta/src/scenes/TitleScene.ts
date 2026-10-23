import Phaser from "phaser";
import { createButton } from "../ui/theme";
import { addGearButton } from "../ui/gear";
import { bindLayout, bodyText, coverBackground, heading, openSettings } from "../ui/common";
import { ALL_LOCALES, getLocale, setLocale, t } from "../i18n";
import { playBgm } from "../core/bgm";

const LANG_LABEL = { en: "EN", ja: "日本語" } as const;

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("Title");
  }

  create(): void {
    playBgm("day");
    this.cameras.main.fadeIn(250, 0, 0, 0);
    bindLayout(this, () => this.layout());
  }

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const land = w > h;
    coverBackground(this, "bg_park", 0.45);

    const titleY = land ? h * 0.2 : h * 0.17;
    heading(this, w / 2, titleY, t("gameTitle"), Math.min(land ? 64 : 46, w / 8.5), "#ffd966");
    bodyText(this, w / 2, titleY + (land ? 52 : 42), t("tagline"), Math.min(18, w / 22), "#fff3d6");

    const pontaSize = land ? 200 : Math.min(240, w * 0.55);
    const ponta = this.add.image(w / 2, land ? h * 0.47 : h * 0.42, "ponta");
    ponta.setDisplaySize(pontaSize, pontaSize);
    this.tweens.add({
      targets: ponta, y: ponta.y - 12, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });

    const btnW = land ? 260 : Math.min(260, w * 0.62);
    const btnY = land ? h * 0.68 : h * 0.66;
    createButton({
      scene: this, x: w / 2, y: btnY, width: btnW, height: 62, label: t("play"),
      variant: "gold", fontSize: 28,
      onClick: () => this.scene.start("StageSelect"),
    });
    createButton({
      scene: this, x: w / 2, y: btnY + 76, width: btnW, height: 52, label: t("settings"),
      variant: "primary", fontSize: 20,
      onClick: () => openSettings(this),
    });

    // 言語切替
    const lw = 92;
    ALL_LOCALES.forEach((lang, i) => {
      const active = getLocale() === lang;
      createButton({
        scene: this, x: w / 2 + (i - 0.5) * (lw + 10), y: btnY + 148, width: lw, height: 44,
        label: LANG_LABEL[lang], fontSize: 16, variant: active ? "gold" : "dark",
        onClick: () => {
          setLocale(lang);
          this.scene.restart();
        },
      });
    });

    addGearButton(this);
  }
}
