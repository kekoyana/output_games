import Phaser from "phaser";
import { UI } from "../../ui/theme";
import { pickLocalized, t, tr } from "../../i18n";
import type { StageDef } from "../../game/types";
import type { Hud } from "./Hud";

function reg<T extends Phaser.GameObjects.GameObject>(hud: Hud, o: T): T {
  hud.add(o);
  hud.modalObjs.push(o);
  return o;
}

function dim(hud: Hud, alpha: number): void {
  reg(hud, hud.scene.add.rectangle(hud.w / 2, hud.h / 2, hud.w, hud.h, 0x0a0614, alpha));
}

function panel(hud: Hud, cx: number, cy: number, pw: number, ph: number, fill: number, stroke: number): void {
  const g = reg(hud, hud.scene.add.graphics());
  g.fillStyle(fill, 0.98).fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 16);
  g.lineStyle(4, stroke, 1).strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 16);
}

function label(hud: Hud, x: number, y: number, text: string, size: number, color: string, wrap = 0, bold = true): Phaser.GameObjects.Text {
  return reg(hud, hud.scene.add.text(x, y, text, {
    fontFamily: UI.sans, fontSize: `${size}px`, color, fontStyle: bold ? "bold" : "normal",
    align: "center", wordWrap: wrap > 0 ? { width: wrap } : undefined, lineSpacing: 4,
  }).setOrigin(0.5));
}

/** なかま（HARD）のアイコンを中央揃えで1〜2行に並べる。使った高さを返す。 */
function friendRow(hud: Hud, cx: number, y: number, pw: number, friends: string[], size: number): number {
  const per = Math.max(1, Math.floor((pw - 30) / (size + 8)));
  const rows = Math.ceil(friends.length / per);
  friends.forEach((tex, i) => {
    const inRow = Math.min(per, friends.length - Math.floor(i / per) * per);
    const px = cx + ((i % per) - (inRow - 1) / 2) * (size + 8);
    const py = y + size / 2 + Math.floor(i / per) * (size + 6);
    reg(hud, hud.scene.add.image(px, py, tex).setDisplaySize(size, size));
  });
  return rows * (size + 6);
}

export interface IntroInfo {
  timeLimit: number;
  hints: number;
  /** HARD: ポンタといっしょに探すなかま（テクスチャキー） */
  friends: string[];
  /** EXTREME: ガラクタ（ハズレ）の注意書きを出す */
  junk?: boolean;
}

/** 手配書カードのイントロ。START で onStart。 */
export function showIntro(hud: Hud, stage: StageDef, info: IntroInfo, onStart: () => void): void {
  const { w, h } = hud;
  dim(hud, 0.62);
  const hasFriends = info.friends.length > 0;
  const pw = Math.min(w - 24, 440);
  const ph = Math.min(h - 24, hasFriends ? 640 : 520);
  const cx = w / 2;
  const top = h / 2 - ph / 2;
  panel(hud, cx, h / 2, pw, ph, 0xfff3d6, 0x8a5a2a);
  const small = ph < 460 || hasFriends;
  label(hud, cx, top + 30, t("wanted"), small ? 26 : 32, "#b02a1a");
  label(hud, cx, top + 58, `${tr("Stage", "ステージ")} ${stage.id}  ${pickLocalized(stage.name)}`, 15, "#5a3a1a");
  const img = small ? 96 : 140;
  reg(hud, hud.scene.add.image(cx, top + 70 + img / 2 + 4, "ponta").setDisplaySize(img, img));
  let y = top + 70 + img + 28;
  const feats = [t("featLeaf"), t("featBundle"), t("featScarf")];
  for (const f of feats) {
    label(hud, cx, y, `・${f}`, 16, "#3a2410", pw - 40);
    y += small ? 24 : 28;
  }
  label(hud, cx, y + 4, t("introHint"), 14, "#b02a1a", pw - 40);
  y += small ? 28 : 36;
  label(hud, cx, y, t("introHow"), 12, "#6a5a40", pw - 40, false);
  y += small ? 24 : 32;
  if (hasFriends) {
    label(hud, cx, y, t("friendsIntro"), 14, "#1f7a3a", pw - 40);
    y += 14;
    y += friendRow(hud, cx, y, pw, info.friends, 44) + 10;
  }
  if (info.junk) {
    label(hud, cx, y, t("junkWarn"), 13, "#b02a1a", pw - 40);
    y += 22;
  }
  label(hud, cx, y, tr(
    `Time ${info.timeLimit}s / Hints ${info.hints}`, `制限時間 ${info.timeLimit}秒 / ヒント ${info.hints}回`,
  ), 14, "#3a2410");
  hud.addButton("start", cx, top + ph - 40, Math.min(220, pw - 60), 54, t("start"), 0xd4892a, onStart, () => true, true, 26);
}

/** 手配書の拡大表示。どこをタップしても閉じる（閉じるボタンあり）。 */
export function showPoster(hud: Hud, friends: string[], onClose: () => void): void {
  const { w, h } = hud;
  dim(hud, 0.7);
  const pw = Math.min(w - 24, 520);
  const ph = Math.min(h - 24, 640);
  const cx = w / 2;
  const top = h / 2 - ph / 2;
  panel(hud, cx, h / 2, pw, ph, 0xfff3d6, 0x8a5a2a);
  const hasFriends = friends.length > 0;
  const small = ph < 520 || hasFriends;
  label(hud, cx, top + 34, t("wanted"), small ? 30 : 40, "#b02a1a");
  const img = Math.max(120, Math.min(pw - 60, ph * (hasFriends ? 0.28 : small ? 0.38 : 0.44)));
  reg(hud, hud.scene.add.image(cx, top + 62 + img / 2, "ponta").setDisplaySize(img, img));
  let y = top + 62 + img + 30;
  const step = small ? 30 : 38;
  for (const f of [t("featLeaf"), t("featBundle"), t("featScarf")]) {
    label(hud, cx, y, `・${f}`, small ? 18 : 22, "#3a2410", pw - 40);
    y += step;
  }
  label(hud, cx, y + 6, t("introHint"), small ? 15 : 18, "#b02a1a", pw - 40);
  if (hasFriends) {
    y += 36;
    label(hud, cx, y, t("friendsIntro"), 15, "#1f7a3a", pw - 40);
    friendRow(hud, cx, y + 14, pw, friends, 52);
  }
  const bw = Math.min(200, pw - 60);
  // ボタンを先に登録し、その後ろに全画面の「どこでも閉じる」領域を置く
  hud.addButton("close", cx, top + ph - 36, bw, 50, t("close"), 0xd4892a, onClose, () => true, true, 22);
  hud.modalButtons.push({ id: "closeAny", x: 0, y: 0, w, h, fn: onClose, enabled: () => true });
}

/** HARD: いっしょにさがすなかまの拡大表示。どこをタップしても閉じる。 */
export function showFriends(hud: Hud, friends: Array<{ tex: string; found: boolean }>, onClose: () => void): void {
  const { w, h } = hud;
  dim(hud, 0.7);
  const pw = Math.min(w - 24, 520);
  const ph = Math.min(h - 24, 600);
  const cx = w / 2;
  const top = h / 2 - ph / 2;
  panel(hud, cx, h / 2, pw, ph, 0xfff3d6, 0x8a5a2a);
  label(hud, cx, top + 34, t("friendsLabel"), 30, "#1f7a3a");
  label(hud, cx, top + 66, t("friendsIntro"), 15, "#3a2410", pw - 40);
  const per = friends.length <= 2 ? friends.length : 2;
  const rows = Math.ceil(friends.length / per);
  const areaH = ph - 100 - 90;
  const size = Math.max(80, Math.min((pw - 40) / per - 10, areaH / rows - 10, 240));
  friends.forEach((f, i) => {
    const inRow = Math.min(per, friends.length - Math.floor(i / per) * per);
    const px = cx + ((i % per) - (inRow - 1) / 2) * (size + 10);
    const py = top + 90 + size / 2 + 8 + Math.floor(i / per) * (size + 10);
    reg(hud, hud.scene.add.image(px, py, f.tex).setDisplaySize(size, size).setAlpha(f.found ? 0.4 : 1));
    if (f.found) {
      label(hud, px + size * 0.3, py + size * 0.3, "✓", Math.max(20, size * 0.2), "#ffffff")
        .setBackgroundColor("#2fb457").setPadding(6, 0, 6, 0);
    }
  });
  const bw = Math.min(200, pw - 60);
  hud.addButton("close", cx, top + ph - 36, bw, 50, t("close"), 0xd4892a, onClose, () => true, true, 22);
  hud.modalButtons.push({ id: "closeAny", x: 0, y: 0, w, h, fn: onClose, enabled: () => true });
}

export interface PauseActions {
  resume: () => void;
  settings: () => void;
  quit: () => void;
}

export function showPause(hud: Hud, a: PauseActions): void {
  const { w, h } = hud;
  dim(hud, 0.6);
  const pw = Math.min(w - 40, 340);
  const ph = 330;
  panel(hud, w / 2, h / 2, pw, ph, 0x1f1530, 0xc9a14a);
  label(hud, w / 2, h / 2 - ph / 2 + 36, t("pause"), 28, "#ffd966");
  const bw = pw - 60;
  hud.addButton("resume", w / 2, h / 2 - 30, bw, 56, t("resume"), 0xd4892a, a.resume, () => true, true, 24);
  hud.addButton("settings", w / 2, h / 2 + 44, bw, 56, t("settings"), 0x3a78d8, a.settings, () => true, true, 22);
  hud.addButton("quit", w / 2, h / 2 + 118, bw, 56, t("quit"), 0x6a4aa0, a.quit, () => true, true, 22);
}
