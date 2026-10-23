import Phaser from "phaser";
import { UI } from "../../ui/theme";
import { pickLocalized, t } from "../../i18n";
import type { StageDef } from "../../game/types";
import { playUiClick } from "../../core/sfx";

export interface HudBtn {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fn: () => void;
  enabled: () => boolean;
}

export interface HudInfo {
  timeLeft: number;
  misses: number;
  hintsLeft: number;
  bonusFound: number;
  bonusTotal: number;
}

export interface HudActions {
  zoomIn: () => void;
  zoomOut: () => void;
  hint: () => void;
  pause: () => void;
}

const BTN = 52;

/** 固定カメラ(HUD)上のUI。ボタンは独自の矩形ヒットテストで処理する。 */
export class Hud {
  readonly layer: Phaser.GameObjects.Layer;
  readonly buttons: HudBtn[] = [];
  modalButtons: HudBtn[] = [];
  modalObjs: Phaser.GameObjects.GameObject[] = [];
  w = 0;
  h = 0;
  private timerText!: Phaser.GameObjects.Text;
  private missText!: Phaser.GameObjects.Text;
  private bonusText!: Phaser.GameObjects.Text;
  private hintBadge!: Phaser.GameObjects.Text;
  private lastInfo: HudInfo | null = null;
  private hintEnabled = true;
  private lastLow = false;
  private btnObjs = new Map<string, Phaser.GameObjects.GameObject[]>();

  constructor(readonly scene: Phaser.Scene, private stage: StageDef, private actions: HudActions) {
    this.layer = scene.add.layer();
    this.layer.setDepth(10);
  }

  add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.layer.add(o);
    return o;
  }

  /** 現在のサイズで HUD を作り直す（モーダルは含まない）。 */
  build(): void {
    this.layer.removeAll(true);
    this.lastLow = false;
    this.btnObjs.clear();
    this.buttons.length = 0;
    this.modalObjs = [];
    this.modalButtons = [];
    const w = (this.w = this.scene.scale.width);
    this.h = this.scene.scale.height;
    const barH = 52;
    const bar = this.add(this.scene.add.graphics());
    bar.fillStyle(0x120a22, 0.72).fillRect(0, 0, w, barH);
    bar.fillStyle(0xc9a14a, 0.9).fillRect(0, barH - 2, w, 2);

    this.add(this.scene.add.text(10, barH / 2, `${this.stage.id}. ${pickLocalized(this.stage.name)}`, {
      fontFamily: UI.sans, fontSize: "13px", color: "#e6dcc4", wordWrap: { width: w * 0.28 },
    }).setOrigin(0, 0.5));
    this.timerText = this.add(this.scene.add.text(w / 2, barH / 2, "0:00", {
      fontFamily: UI.serif, fontSize: "32px", color: "#ffffff", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 4,
    }).setOrigin(0.5));
    this.missText = this.add(this.scene.add.text(w - 10, barH / 2, "", {
      fontFamily: UI.sans, fontSize: "14px", color: "#ff9a9a", fontStyle: "bold",
    }).setOrigin(1, 0.5));
    this.bonusText = this.add(this.scene.add.text(w - 10, barH + 16, "", {
      fontFamily: UI.sans, fontSize: "13px", color: "#ffd966", stroke: "#000000", strokeThickness: 3,
    }).setOrigin(1, 0.5));

    this.buildCard(8, barH + 8);
    this.buildButtons();
    for (const o of this.btnObjs.get("hint") ?? []) (o as Phaser.GameObjects.Text).setAlpha(this.hintEnabled ? 1 : 0.4);
    if (this.lastInfo) this.update(this.lastInfo);
  }

  private buildCard(x: number, y: number): void {
    const cw = Math.min(this.w * 0.58, 260);
    const ch = 88;
    const g = this.add(this.scene.add.graphics());
    g.fillStyle(0xfff3d6, 0.94).fillRoundedRect(x, y, cw, ch, 8);
    g.lineStyle(3, 0x8a5a2a, 1).strokeRoundedRect(x, y, cw, ch, 8);
    this.add(this.scene.add.text(x + 8, y + 8, t("wanted"), {
      fontFamily: UI.serif, fontSize: "12px", color: "#8a2a1a", fontStyle: "bold",
    }));
    this.add(this.scene.add.image(x + 38, y + ch / 2 + 6, "ponta").setDisplaySize(68, 68));
    const lines = [t("featCompact1"), t("featCompact2"), t("featCompact3")];
    this.add(this.scene.add.text(x + 76, y + 28, lines.map((l) => `・${l}`).join("\n"), {
      fontFamily: UI.sans, fontSize: "12px", color: "#3a2410", lineSpacing: 6,
      wordWrap: { width: cw - 84 },
    }));
  }

  private buildButtons(): void {
    const { w, h } = this;
    const x = w - 12 - BTN / 2;
    const y0 = h - 14 - BTN / 2;
    const step = BTN + 10;
    this.addButton("pause", x, y0, BTN, BTN, "II", 0x4a4a6a, this.actions.pause);
    this.addButton("hint", x, y0 - step, BTN, BTN, "?", 0x6a4aa0, this.actions.hint, () => this.hintEnabled);
    this.hintBadge = this.add(this.scene.add.text(x + BTN / 2 - 4, y0 - step - BTN / 2 + 4, "", {
      fontFamily: UI.sans, fontSize: "13px", color: "#ffffff", fontStyle: "bold",
      backgroundColor: "#c73838", padding: { x: 4, y: 1 },
    }).setOrigin(1, 0));
    this.addButton("zoomOut", x, y0 - step * 2, BTN, BTN, "−", 0x3a78d8, this.actions.zoomOut);
    this.addButton("zoomIn", x, y0 - step * 3, BTN, BTN, "+", 0x3a78d8, this.actions.zoomIn);
  }

  /** 矩形ボタン（描画 + ヒット登録）。modal=true ならモーダル用リストへ。 */
  addButton(
    id: string, cx: number, cy: number, bw: number, bh: number, label: string, color: number,
    fn: () => void, enabled: () => boolean = () => true, modal = false, fontSize = 26,
  ): void {
    const g = this.scene.add.graphics();
    g.fillStyle(0x000000, 0.45).fillRoundedRect(cx - bw / 2, cy - bh / 2 + 4, bw, bh, 12);
    g.fillStyle(color, 0.96).fillRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 12);
    g.lineStyle(3, 0xf5d671, 0.95).strokeRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 12);
    const text = this.scene.add.text(cx, cy, label, {
      fontFamily: UI.serif, fontSize: `${fontSize}px`, color: "#ffffff", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 4,
    }).setOrigin(0.5);
    if (text.width > bw - 14) text.setFontSize(Math.max(10, Math.floor(fontSize * (bw - 14) / text.width)));
    this.add(g);
    this.add(text);
    this.btnObjs.set(id, [g, text]);
    const btn: HudBtn = { id, x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh, fn, enabled };
    if (modal) {
      this.modalObjs.push(g, text);
      this.modalButtons.push(btn);
    } else {
      this.buttons.push(btn);
    }
  }

  /** ボタン押下判定。消費したら true（モーダル表示中は常に true）。 */
  press(px: number, py: number): boolean {
    const list = this.modalObjs.length > 0 ? this.modalButtons : this.buttons;
    for (const b of list) {
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h && b.enabled()) {
        playUiClick();
        b.fn();
        return true;
      }
    }
    if (this.modalObjs.length > 0) return true;
    return list.some((b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h);
  }

  hasModal(): boolean {
    return this.modalObjs.length > 0;
  }

  clearModal(): void {
    for (const o of this.modalObjs) o.destroy();
    this.modalObjs = [];
    this.modalButtons = [];
  }

  setHintEnabled(v: boolean): void {
    if (v === this.hintEnabled) return;
    this.hintEnabled = v;
    for (const o of this.btnObjs.get("hint") ?? []) (o as Phaser.GameObjects.Text).setAlpha(v ? 1 : 0.4);
  }

  update(info: HudInfo): void {
    this.lastInfo = info;
    const secs = Math.max(0, Math.ceil(info.timeLeft));
    const low = info.timeLeft <= 10;
    this.timerText.setText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`);
    if (low !== this.lastLow) {
      this.lastLow = low;
      this.timerText.setColor(low ? "#ff5a5a" : "#ffffff");
    }
    this.missText.setText(`${t("miss")} ${info.misses}`);
    this.bonusText.setText(info.bonusTotal > 0 ? `${t("bonus")} ${info.bonusFound}/${info.bonusTotal}` : "");
    this.hintBadge.setText(String(info.hintsLeft));
  }

  toast(text: string, color = "#ff9a9a", y = this.h * 0.27): void {
    const tx = this.add(this.scene.add.text(this.w / 2, y, text, {
      fontFamily: UI.serif, fontSize: "30px", color, fontStyle: "bold",
      stroke: "#000000", strokeThickness: 5,
    }).setOrigin(0.5));
    this.scene.tweens.add({
      targets: tx, y: y - 36, alpha: 0, duration: 1100, ease: "Cubic.easeOut",
      onComplete: () => tx.destroy(),
    });
  }

  banner(text: string, color: string): Phaser.GameObjects.Text {
    const size = Math.min(54, this.w / 8);
    const tx = this.add(this.scene.add.text(this.w / 2, this.h * 0.4, text, {
      fontFamily: UI.serif, fontSize: `${size}px`, color, fontStyle: "bold",
      stroke: "#000000", strokeThickness: 8,
    }).setOrigin(0.5).setScale(0.2));
    this.scene.tweens.add({ targets: tx, scale: 1, duration: 380, ease: "Back.easeOut" });
    return tx;
  }

  confetti(): void {
    const colors = [0xff5a5a, 0xffd23f, 0x5ad07a, 0x4aa8ff, 0xc77dff, 0xff9ad0];
    for (let i = 0; i < 90; i++) {
      const p = this.add(this.scene.add.rectangle(
        Math.random() * this.w, -20 - Math.random() * 120, 8 + Math.random() * 8, 12 + Math.random() * 8,
        colors[i % colors.length],
      ));
      p.setRotation(Math.random() * 6);
      this.scene.tweens.add({
        targets: p, y: this.h + 40, x: p.x + (Math.random() - 0.5) * 160,
        rotation: p.rotation + (Math.random() - 0.5) * 12,
        duration: 1600 + Math.random() * 1400, delay: Math.random() * 500,
        ease: "Sine.easeIn", onComplete: () => p.destroy(),
      });
    }
  }
}

