import Phaser from "phaser";
import { createButton, UI } from "../ui/theme";
import { addGearButton } from "../ui/gear";
import { bindLayout, coverBackground, drawStars, heading } from "../ui/common";
import { pickLocalized, t, tr } from "../i18n";
import { STAGES, NIGHT_TINT } from "../game/stages";
import { getTotalBest, randomSeed, type ResultData } from "../game/save";
import { setLastResult } from "../game/debug";
import { BONUS_SCORE, HINT_SCORE, MISS_SCORE } from "../game/score";
import { playBgm } from "../core/bgm";

const BONUS_NAME: Record<string, string> = { item_straw_hat: "strawHat", item_balloon: "balloon" };

export class ResultScene extends Phaser.Scene {
  private res!: ResultData;

  constructor() {
    super("Result");
  }

  init(data: ResultData): void {
    this.res = data;
  }

  create(): void {
    setLastResult(this.res as unknown as Record<string, unknown>);
    playBgm(STAGES[this.res.stage - 1].night ? "night" : "day");
    this.cameras.main.fadeIn(250, 0, 0, 0);
    bindLayout(this, () => this.layout());
  }

  private rows(): Array<[string, string, string?]> {
    const r = this.res;
    const b = r.breakdown;
    const rows: Array<[string, string, string?]> = [];
    if (r.cleared) {
      rows.push([t("scoreBase"), `+${b.base}`]);
      rows.push([`${t("scoreTime")} (${Math.floor(r.timeLeft)}s × 20)`, `+${b.time}`]);
      rows.push([`${t("scoreBonus")} (${r.bonusFound} × ${BONUS_SCORE})`, `+${b.bonus}`]);
    }
    const neg = (n: number): string => (n === 0 ? "0" : `-${n}`);
    rows.push([`${t("scoreMiss")} (${r.misses} × ${MISS_SCORE})`, neg(b.missPenalty), "#ff9a9a"]);
    rows.push([`${t("scoreHint")} (${r.hints} × ${HINT_SCORE})`, neg(b.hintPenalty), "#ff9a9a"]);
    return rows;
  }

  private layout(): void {
    const r = this.res;
    const st = STAGES[r.stage - 1];
    const w = this.scale.width;
    const h = this.scale.height;
    const land = w > h;
    const bg = coverBackground(this, st.bg, 0.72);
    if (st.night) bg.setTint(NIGHT_TINT);

    const pw = Math.min(w - 24, 440);
    const cx = w / 2;
    let y = land ? 38 : 50;
    heading(this, cx, y, r.cleared ? t("clear") : t("failed"), land ? 40 : 34, r.cleared ? "#ffd966" : "#ff9a9a");
    y += land ? 26 : 30;
    this.add.text(cx, y, `${pickLocalized(st.name)}  (${tr("Stage", "ステージ")} ${st.id})`, {
      fontFamily: UI.sans, fontSize: "14px", color: "#c8a6ff",
    }).setOrigin(0.5);
    y += land ? 44 : 52;
    drawStars(this, cx, y, r.stars, land ? 44 : 52);
    y += land ? 46 : 58;

    if (r.cleared) {
      heading(this, cx, y, `${t("scoreTotal")}  ${r.score}`, land ? 34 : 36, "#ffffff");
      if (r.newBest) {
        const nb = heading(this, cx, y + 30, t("newBest"), 18, "#ff9ad0");
        this.tweens.add({ targets: nb, scale: 1.12, duration: 500, yoyo: true, repeat: -1 });
      }
      y += 58;
    }

    const rows = this.rows();
    const lineH = land ? 24 : 27;
    const allClear = r.cleared && r.stage === STAGES.length;
    const extra = allClear ? 5 : 3;
    const ph = (rows.length + extra) * lineH + 20;
    this.add.rectangle(cx, y + ph / 2 - 6, pw, ph, 0x1f1530, 0.88).setStrokeStyle(2, UI.panelStroke);
    let ly = y + 8;
    for (const [label, value, color] of rows) {
      this.line(cx, pw, ly, label, value, color ?? "#e6dcc4");
      ly += lineH;
    }
    const missed = r.missedBonus.length === 0
      ? t("none") : r.missedBonus.map((k) => t(BONUS_NAME[k] ?? k)).join(", ");
    this.line(cx, pw, ly, t("missedBonus"), r.bonusTotal === 0 ? "-" : missed, r.missedBonus.length ? "#ffd966" : "#e6dcc4");
    ly += lineH;
    this.line(cx, pw, ly, `${t("miss")} / ${t("hint")}`, `${r.misses} / ${r.hints}`, "#e6dcc4");
    ly += lineH;
    this.line(cx, pw, ly, t("seed"), `${r.seed}${r.mode === "random" ? " (new)" : ""}${r.hard ? " · HARD" : ""}`, "#a89c80");
    if (allClear) {
      const tb = getTotalBest(STAGES.length, r.hard);
      ly += lineH;
      this.line(cx, pw, ly, t("totalScoreAll"), `${tb.score}`, "#ffd966");
      ly += lineH;
      this.line(cx, pw, ly, t("totalStarsAll"), `${tb.stars} / ${STAGES.length * 3}`, "#ffd966");
    }
    y += ph + 14;

    this.buttons(cx, y, pw, land, w);
    addGearButton(this);
  }

  private line(cx: number, pw: number, y: number, label: string, value: string, color: string): void {
    this.add.text(cx - pw / 2 + 14, y + 8, label, { fontFamily: UI.sans, fontSize: "14px", color }).setOrigin(0, 0.5);
    this.add.text(cx + pw / 2 - 14, y + 8, value, {
      fontFamily: UI.sans, fontSize: "14px", color, fontStyle: "bold",
    }).setOrigin(1, 0.5);
  }

  private buttons(cx: number, y: number, pw: number, land: boolean, w: number): void {
    const r = this.res;
    const hasNext = r.cleared && r.stage < STAGES.length;
    const specs: Array<{ label: string; variant: "gold" | "primary" | "purple" | "dark"; fn: () => void }> = [];
    if (hasNext) {
      specs.push({ label: t("next"), variant: "gold", fn: () => this.play(r.stage + 1, "fixed", STAGES[r.stage].fixedSeed, r.hard) });
    }
    specs.push({ label: t("retry"), variant: hasNext ? "primary" : "gold", fn: () => this.play(r.stage, r.mode, r.seed, r.hard) });
    specs.push({ label: t("newLayout"), variant: "purple", fn: () => this.play(r.stage, "random", randomSeed(), r.hard) });
    specs.push({ label: t("toStages"), variant: "dark", fn: () => this.scene.start("StageSelect") });

    if (land) {
      const bw = Math.min(190, (Math.min(w - 24, 820) - 12 * (specs.length - 1)) / specs.length);
      const total = bw * specs.length + 12 * (specs.length - 1);
      specs.forEach((s, i) => {
        createButton({
          scene: this, x: cx - total / 2 + bw / 2 + i * (bw + 12), y: y + 24, width: bw, height: 48,
          label: s.label, variant: s.variant, fontSize: 18, onClick: s.fn,
        });
      });
    } else if (this.scale.height - y < specs.length * 58 + 4) {
      // 縦が足りない画面では 2x2 配置
      const bw = (Math.min(pw, 420) - 10) / 2;
      specs.forEach((s, i) => {
        createButton({
          scene: this, x: cx + (i % 2 === 0 ? -1 : 1) * (bw / 2 + 5), y: y + 26 + Math.floor(i / 2) * 58, width: bw, height: 50,
          label: s.label, variant: s.variant, fontSize: 18, onClick: s.fn,
        });
      });
    } else {
      const bw = Math.min(pw, 300);
      specs.forEach((s, i) => {
        createButton({
          scene: this, x: cx, y: y + 26 + i * 58, width: bw, height: 50,
          label: s.label, variant: s.variant, fontSize: 20, onClick: s.fn,
        });
      });
    }
  }

  private play(stage: number, mode: ResultData["mode"], seed: number, hard: boolean): void {
    this.scene.start("Game", { stage, mode, seed, hard });
  }
}
