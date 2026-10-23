import Phaser from "phaser";
import { ALL_LOCALES, getLocale, setLocale, t, type Locale } from "../i18n";
import {
  getVolume as getBgmVolume,
  setVolumeRemembered as setBgmVolume,
  isMuted as isBgmMuted,
  toggleMute as toggleBgmMute,
} from "../core/bgm";
import {
  getSfxVolume,
  setSfxVolume,
  isSfxMuted,
  setSfxMuted,
  playClick,
} from "../core/sfx";
import { clearAll } from "../core/storage";
import { UI, createButton } from "../ui/theme";

const LANG_LABELS: Record<Locale, string> = {
  en: "EN",
  ja: "日本語",
};

interface InitData {
  from?: string;
  /** true: 閉じるときに呼び出し元を再起動せず resume する（ゲーム中ポーズ用） */
  resume?: boolean;
}

/**
 * 設定モーダルシーン。
 * - 言語切替（en / ja）
 * - BGM 音量 / mute
 * - SFX 音量 / mute
 * - Reset（localStorage の全データ削除）
 * - Close
 */
export class SettingsScene extends Phaser.Scene {
  private fromKey = "Title";
  private resumeMode = false;

  constructor() {
    super("Settings");
  }

  init(data: InitData): void {
    this.fromKey = data.from ?? "Title";
    this.resumeMode = data.resume === true;
  }

  create(): void {
    this.layout();
    const onResize = (): void => {
      this.children.removeAll(true);
      this.layout();
    };
    this.scale.on("resize", onResize);
    this.events.once("shutdown", () => this.scale.off("resize", onResize));
  }

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // 背面 dim
    const dim = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.7).setInteractive();
    dim.on("pointerdown", () => this.close());

    // パネル
    const panelW = Math.min(w - 40, 420);
    const panelH = Math.min(h - 60, 480);
    const px = w / 2;
    const py = h / 2;
    const panel = this.add.rectangle(px, py, panelW, panelH, UI.panel)
      .setStrokeStyle(3, UI.panelStroke);
    panel.setInteractive(); // dim へのクリックを止める

    this.add.text(px, py - panelH / 2 + 24, t("settings").toUpperCase(), {
      fontFamily: UI.serif, fontSize: "26px", color: "#ffd966", fontStyle: "bold",
    }).setOrigin(0.5);

    let yCursor = py - panelH / 2 + 64;

    // ── Language
    this.add.text(px - panelW / 2 + 20, yCursor, t("language").toUpperCase(), {
      fontFamily: UI.sans, fontSize: "13px", color: "#aaaaaa", fontStyle: "bold",
    });
    yCursor += 22;
    const currentLang = getLocale();
    const btnW = (panelW - 40 - 16) / ALL_LOCALES.length;
    const btnH = 38;
    for (let i = 0; i < ALL_LOCALES.length; i++) {
      const lang = ALL_LOCALES[i];
      const x = px - panelW / 2 + 20 + btnW / 2 + i * (btnW + 4);
      const isActive = currentLang === lang;
      createButton({
        scene: this, x, y: yCursor + btnH / 2, width: btnW - 4, height: btnH,
        label: LANG_LABELS[lang],
        color: isActive ? UI.accent : 0x4a4a5a,
        textColor: isActive ? UI.accentText : "#ffffff",
        fontSize: 14,
        onClick: () => {
          playClick();
          setLocale(lang);
          this.refresh();
        },
      });
    }
    yCursor += btnH + 24;

    // ── BGM
    yCursor = this.drawAudioRow(t("bgm"), yCursor, px, panelW, {
      getVolume: getBgmVolume,
      setVolume: (v) => setBgmVolume(v),
      isMuted: isBgmMuted,
      toggleMute: toggleBgmMute,
    });

    // ── SFX
    yCursor = this.drawAudioRow(t("sfx"), yCursor, px, panelW, {
      getVolume: getSfxVolume,
      setVolume: (v) => setSfxVolume(v),
      isMuted: isSfxMuted,
      toggleMute: () => setSfxMuted(!isSfxMuted()),
    });

    // ── Buttons
    const btnY = py + panelH / 2 - 38;
    createButton({
      scene: this, x: px - panelW / 2 + 80, y: btnY, width: 130, height: 44,
      label: t("reset"),
      color: 0xc73838, textColor: "#ffffff", fontSize: 14,
      onClick: () => {
        playClick();
        clearAll();
        this.refresh();
      },
    });
    createButton({
      scene: this, x: px + panelW / 2 - 70, y: btnY, width: 110, height: 44,
      label: t("close"), fontSize: 16,
      onClick: () => {
        playClick();
        this.close();
      },
    });
  }

  private drawAudioRow(
    label: string,
    yStart: number,
    cx: number,
    panelW: number,
    api: {
      getVolume: () => number;
      setVolume: (v: number) => void;
      isMuted: () => boolean;
      toggleMute: () => void;
    },
  ): number {
    const labelX = cx - panelW / 2 + 20;
    this.add.text(labelX, yStart, label, {
      fontFamily: UI.sans, fontSize: "13px", color: "#aaaaaa", fontStyle: "bold",
    });
    const muted = api.isMuted();
    const valueText = this.add.text(labelX + 50, yStart, muted ? "OFF" : `${Math.round(api.getVolume() * 100)}%`, {
      fontFamily: UI.sans, fontSize: "13px", color: muted ? "#ff8888" : "#88ddff",
    });

    yStart += 22;

    // ON/OFF トグル
    createButton({
      scene: this, x: labelX + 30, y: yStart + 14, width: 60, height: 28,
      label: muted ? t("off") : t("on"),
      color: muted ? 0x4a4a5a : 0x5a8a6a,
      textColor: "#ffffff", fontSize: 12,
      onClick: () => {
        playClick();
        api.toggleMute();
        this.refresh();
      },
    });

    // Slider
    const sx = labelX + 80;
    const sw = panelW - 80 - 40;
    const sy = yStart + 14;
    this.add.rectangle(sx + sw / 2, sy, sw, 6, 0x222033).setStrokeStyle(1, 0x554477);
    const fillW = Math.max(0, Math.min(1, api.getVolume())) * sw;
    const fill = this.add.rectangle(sx, sy, fillW, 6, UI.accent).setOrigin(0, 0.5);
    const knob = this.add.circle(sx + fillW, sy, 10, UI.accent).setStrokeStyle(2, 0x000000);
    knob.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(knob);
    knob.on("drag", (_p: Phaser.Input.Pointer, dx: number) => {
      const x = Math.max(sx, Math.min(sx + sw, dx));
      knob.x = x;
      const ratio = (x - sx) / sw;
      fill.width = ratio * sw;
      api.setVolume(ratio);
      valueText.setText(api.isMuted() ? "OFF" : `${Math.round(ratio * 100)}%`);
    });

    return yStart + 36;
  }

  private close(): void {
    const from = this.fromKey;
    if (this.resumeMode) {
      this.scene.stop();
      this.scene.resume(from);
      return;
    }
    // 言語切替を即時反映させるため再起動
    this.scene.stop(from);
    this.scene.stop();
    this.scene.start(from);
  }

  private refresh(): void {
    this.children.removeAll(true);
    this.layout();
  }
}
