import Phaser from "phaser";
import { createButton, UI } from "../ui/theme";
import { addGearButton } from "../ui/gear";
import { bindLayout, bodyText, coverBackground, heading } from "../ui/common";
import { pickLocalized, t, tr } from "../i18n";
import { STAGES, NIGHT_TINT } from "../game/stages";
import { getBest, isHardMode, isUnlocked, randomSeed, setHardMode, type GameStartData } from "../game/save";
import type { StageDef } from "../game/types";
import { playBgm } from "../core/bgm";

export class StageSelectScene extends Phaser.Scene {
  constructor() {
    super("StageSelect");
  }

  create(): void {
    playBgm("day");
    this.cameras.main.fadeIn(200, 0, 0, 0);
    bindLayout(this, () => this.layout());
  }

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const land = w > h;
    coverBackground(this, "bg_market", 0.7);
    heading(this, w / 2, 32, t("stageSelect"), land ? 34 : 28);

    // NORMAL / HARD 切り替え（HARD はキャラが動き回る）
    const hard = isHardMode();
    const dw = 128;
    for (const [isHard, label] of [[false, t("normalMode")], [true, t("hardMode")]] as const) {
      createButton({
        scene: this, x: w / 2 + (isHard ? dw / 2 + 6 : -dw / 2 - 6), y: 72, width: dw, height: 34, label,
        variant: hard === isHard ? (isHard ? "purple" : "gold") : "dark", fontSize: 16,
        onClick: () => {
          if (isHardMode() === isHard) return;
          setHardMode(isHard);
          this.tweens.killAll();
          this.children.removeAll(true);
          this.layout();
        },
      });
    }
    if (hard) bodyText(this, w / 2, 96, t("hardNote"), 12, "#c8a6ff", 0.5);

    const cols = land ? 2 : 1;
    const rows = Math.ceil(STAGES.length / cols);
    const gap = 14;
    const top = 108;
    const bottomPad = 64;
    const availH = h - top - bottomPad;
    const cardH = Math.max(112, Math.min(210, (availH - gap * (rows - 1)) / rows));
    const cardW = Math.min(land ? 600 : 520, (w - 24 - gap * (cols - 1)) / cols);
    const gridW = cardW * cols + gap * (cols - 1);
    const x0 = (w - gridW) / 2;

    STAGES.forEach((st, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      this.drawCard(st, x0 + c * (cardW + gap), top + r * (cardH + gap), cardW, cardH);
    });

    createButton({
      scene: this, x: w / 2, y: h - 34, width: 160, height: 46, label: t("back"),
      variant: "dark", fontSize: 18, onClick: () => this.scene.start("Title"),
    });
    addGearButton(this);
  }

  private drawCard(st: StageDef, x: number, y: number, cw: number, ch: number): void {
    const unlocked = isUnlocked(st.id);
    this.add.rectangle(x + cw / 2, y + ch / 2, cw, ch, UI.panel, 0.94)
      .setStrokeStyle(3, unlocked ? UI.panelStroke : UI.panelStrokeDim);

    // サムネイル（背景中央を正方形に切り出し）
    const ts = ch - 20;
    const tx = x + 10;
    const ty = y + 10;
    const thumb = this.add.image(0, 0, st.bg).setOrigin(0, 0);
    const side = Math.min(thumb.width, thumb.height);
    const cropX = (thumb.width - side) / 2;
    thumb.setCrop(cropX, 0, side, side);
    const sc = ts / side;
    thumb.setScale(sc).setPosition(tx - cropX * sc, ty);
    if (st.night) thumb.setTint(NIGHT_TINT);
    if (!unlocked) thumb.setTint(0x333344);

    const px = tx + ts + 14;
    const pw = x + cw - 10 - px;
    const compact = ch < 150;
    bodyText(this, px, y + (compact ? 16 : 24), `${tr("Stage", "ステージ")} ${st.id}`, 12, "#c8a6ff", 0);
    const name = this.add.text(px, y + (compact ? 36 : 44), pickLocalized(st.name), {
      fontFamily: UI.serif, fontSize: "21px", color: "#ffd966", fontStyle: "bold",
      stroke: "#000000", strokeThickness: 3,
    }).setOrigin(0, 0.5);
    if (name.width > pw) name.setFontSize(Math.floor(21 * (pw / name.width)));

    if (!unlocked) {
      bodyText(this, px, y + ch / 2 + 6, `🔒 ${t("locked")}`, 18, "#ff9a9a", 0);
      this.add.text(px, y + ch / 2 + 34, tr(`Clear Stage ${st.id - 1} first`, `ステージ${st.id - 1}をクリアで解放`), {
        fontFamily: UI.sans, fontSize: "13px", color: "#c8b6e8", wordWrap: { width: pw },
      }).setOrigin(0, 0.5);
      return;
    }

    if (!compact) {
      const info = tr(
        `${st.timeLimit}s · Hints ${st.hints}`,
        `${st.timeLimit}秒 · ヒント${st.hints}回`,
      );
      bodyText(this, px, y + 64, info, 12, UI.textDim, 0);
    }
    this.drawBest(px, y + (compact ? 58 : 92), getBest(st.id, isHardMode()));

    // 配置はプレイのたびにランダム
    createButton({
      scene: this, x: px + pw / 2, y: y + ch - (compact ? 20 : 26), width: pw, height: compact ? 34 : 40, label: t("play"),
      variant: "gold", fontSize: 18,
      onClick: () => this.go({ stage: st.id, seed: randomSeed(), hard: isHardMode() }),
    });
  }

  private drawBest(x: number, y: number, rec: { score: number; stars: number } | null): void {
    bodyText(this, x, y, t("best"), 12, UI.textDim, 0);
    const stars = rec ? "★".repeat(rec.stars) + "☆".repeat(3 - rec.stars) : "☆☆☆";
    this.add.text(x + 52, y, `${stars}  ${rec ? rec.score : "-"}`, {
      fontFamily: "sans-serif", fontSize: "13px", color: rec ? "#ffd23f" : "#6a5f7c",
    }).setOrigin(0, 0.5);
  }

  private go(d: GameStartData): void {
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start("Game", d));
  }
}

