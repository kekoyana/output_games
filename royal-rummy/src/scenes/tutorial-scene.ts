import type { Scene, SceneContext, SceneName } from "../core/scene";
import type { PointerInfo } from "../types";
import { GAME_W, GAME_H } from "../types";
import { drawDialog } from "../ui/dialog";
import { drawTextWithShadow, roundRect, wrapText } from "../ui/canvas-utils";
import { Button } from "../ui/button";
import { drawCardFace, ELEMENT_GLOW, preloadElementIcons } from "../ui/card-face";
import type { Card } from "../game/gin-rummy";
import { GAME_CONFIG } from "../game-config";
import { t } from "../i18n";
import { playClick, playSelect } from "../core/sfx";

const PANEL_W = 880;
const PANEL_H = 1240;
const PANEL_X = (GAME_W - PANEL_W) / 2;
const PANEL_Y = (GAME_H - PANEL_H) / 2;

const TOTAL_PAGES = 4;

/**
 * Full-screen "HOW TO PLAY" tutorial. Shown once on the first match the
 * player ever starts; replayable from the settings panel (which simply
 * clears the same localStorage flag this scene reads/writes).
 *
 * Pages:
 *   1. Goal — combine into melds, lower DROSS, CAST; first to 5 wins
 *   2. CAST & DROSS — combined definition page (terms used in the goal)
 *   3. What is a Meld? — concept + COVEN/CASCADE shown side-by-side
 *   4. Turn Flow — draw 1 / discard 1, looped
 *
 * Routing: the previous scene puts {nextScene, nextData} in ctx.data; this
 * scene forwards them on completion (NEXT past the last page) or SKIP.
 */
export class TutorialScene implements Scene {
  private ctx!: SceneContext;
  private page = 0;
  private backBtn!: Button;
  private nextBtn!: Button;
  private skipBtn!: Button;
  private nextScene: SceneName = "game";
  private nextData: Record<string, unknown> = {};

  // Sample card sets used in the visual demonstrations.
  private readonly covenSample: Card[] = [
    { id: 0, suit: 0, rank: 7 },
    { id: 1, suit: 1, rank: 7 },
    { id: 2, suit: 3, rank: 7 },
  ];
  private readonly cascadeSample: Card[] = [
    { id: 3, suit: 3, rank: 5 },
    { id: 4, suit: 3, rank: 6 },
    { id: 5, suit: 3, rank: 7 },
  ];
  // Page 4: 5-card sample where 3 cards form a coven, 2 are deadwood.
  // Numbers chosen so DROSS = 3 + 5 = 8 ≤ 10 → "CAST OK!" feels achievable.
  private readonly handSample: Card[] = [
    { id: 6, suit: 0, rank: 7 }, // meld
    { id: 7, suit: 1, rank: 7 }, // meld
    { id: 8, suit: 3, rank: 7 }, // meld
    { id: 9, suit: 0, rank: 3 }, // deadwood
    { id: 10, suit: 1, rank: 5 }, // deadwood
  ];
  private readonly handMeldIds = new Set([6, 7, 8]);

  enter(ctx: SceneContext): void {
    this.ctx = ctx;
    this.page = 0;
    preloadElementIcons();

    // Inherit forwarding info from the loading-scene
    if (typeof ctx.data["nextScene"] === "string") {
      this.nextScene = ctx.data["nextScene"] as SceneName;
    }
    if (typeof ctx.data["nextData"] === "object" && ctx.data["nextData"] !== null) {
      this.nextData = ctx.data["nextData"] as Record<string, unknown>;
    }

    // Footer buttons — laid out from the bottom of the panel.
    const footerY = PANEL_Y + PANEL_H - 68 - 96;
    const btnH = 96;
    const sideBtnW = 200;
    const primaryBtnW = 320;

    this.backBtn = new Button(
      { x: PANEL_X + 36, y: footerY, w: sideBtnW, h: btnH },
      t("tutBack"),
      { bgColor: "#4a5260", textColor: "#fff", fontSize: 30, radius: 18 }
    );
    this.nextBtn = new Button(
      { x: PANEL_X + PANEL_W - primaryBtnW - 36, y: footerY, w: primaryBtnW, h: btnH },
      t("tutNext"),
      { bgColor: GAME_CONFIG.accentColor, textColor: "#fff", fontSize: 32, radius: 18 }
    );
    this.skipBtn = new Button(
      {
        x: PANEL_X + (PANEL_W - sideBtnW) / 2,
        y: footerY,
        w: sideBtnW,
        h: btnH,
      },
      t("tutSkip"),
      { bgColor: "#3a2a3e", textColor: "#aaa", fontSize: 26, radius: 18 }
    );
  }

  exit(): void {}

  update(_dt: number): void {}

  draw(ctx: CanvasRenderingContext2D): void {
    drawDialog(ctx, {
      x: PANEL_X,
      y: PANEL_Y,
      w: PANEL_W,
      h: PANEL_H,
      headerTag: "HOW TO PLAY",
      headerColor: GAME_CONFIG.accentColor,
    });

    // Page indicator (e.g. "2 / 4")
    drawTextWithShadow(
      ctx,
      t("tutPageOf", { n: this.page + 1, total: TOTAL_PAGES }),
      GAME_W / 2,
      PANEL_Y + 168,
      {
        font: "700 24px sans-serif",
        color: "rgba(220,210,240,0.85)",
      }
    );

    // Page title
    const pageTitle = [
      t("tutPage1Title"),
      t("tutPage2Title"),
      t("tutPage3Title"),
      t("tutPage4Title"),
    ][this.page];
    drawTextWithShadow(ctx, pageTitle, GAME_W / 2, PANEL_Y + 230, {
      font: "900 50px 'Hiragino Sans','Yu Gothic','Helvetica Neue',sans-serif",
      color: "#ffe18a",
      shadowColor: "rgba(0,0,0,0.85)",
      shadowBlur: 8,
    });

    // Visual sample area. Page 1 (overview) and Page 2 (DROSS detail) share
    // the same meld + deadwood + DROSS=8 figure: P1 introduces the picture,
    // P2 explains it. Avoiding two distinct illustrations also keeps the
    // teaser feel consistent.
    const visualCy = PANEL_Y + 530;
    if (this.page === 0 || this.page === 1) this.drawDrossExample(ctx, visualCy);
    else if (this.page === 2) this.drawMeldConcept(ctx, visualCy);
    else this.drawTurnFlow(ctx, visualCy);

    // Body text — multi-line wrap inside panel inner width
    const body = [
      t("tutPage1Body"),
      t("tutPage2Body"),
      t("tutPage3Body"),
      t("tutPage4Body"),
    ][this.page];
    this.drawWrappedText(ctx, body, GAME_W / 2, PANEL_Y + 800, PANEL_W - 120, 36);

    // (Per-page hint line removed — body copy alone, no redundant subtitle.)

    // Footer buttons
    if (this.page > 0) this.backBtn.draw(ctx);
    this.skipBtn.draw(ctx);
    this.nextBtn.draw(ctx);
  }

  // --- Visual samples ---

  // (drawPage1 removed — Page 1 reuses drawDrossExample as a teaser.)

  /**
   * Page 3 visual: meld concept. Two card-trios stacked vertically (COVEN
   * above, CASCADE below) — name + one-line description to the right of each
   * trio so the player sees concretely what each meld looks like.
   */
  private drawMeldConcept(ctx: CanvasRenderingContext2D, cy: number): void {
    const cw = 100;
    const ch = 144;
    const gap = 12;
    const trioW = cw * 3 + gap * 2;
    const rowGap = 220;
    // Layout: trio occupies left portion, label/description right of trio.
    const trioStartX = PANEL_X + 60;
    const labelX = trioStartX + trioW + 32;

    // Width budget for the description text — from labelX to the right
    // panel padding, with a small visual margin so glyphs don't kiss the edge.
    const descMaxW = (PANEL_X + PANEL_W - 28) - labelX;

    const drawTrio = (cards: Card[], rowCy: number, label: string, desc: string): void => {
      for (let i = 0; i < 3; i++) {
        drawCardFace(ctx, cards[i], trioStartX + i * (cw + gap), rowCy - ch / 2, cw, ch, true);
      }
      // Connecting glow under the trio
      ctx.save();
      const glow = ELEMENT_GLOW[cards[0].suit];
      ctx.strokeStyle = glow;
      ctx.lineWidth = 3;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(trioStartX, rowCy + ch / 2 + 12);
      ctx.lineTo(trioStartX + trioW, rowCy + ch / 2 + 12);
      ctx.stroke();
      ctx.restore();
      // Name on the right of the trio
      drawTextWithShadow(ctx, label, labelX, rowCy - 22, {
        font: "900 32px 'Hiragino Sans','Yu Gothic','Helvetica Neue',sans-serif",
        color: "#ffd84a",
        align: "left",
      });
      // Description, wrapped within the available width so long English/RU
      // strings never overflow the panel.
      ctx.save();
      ctx.font = "500 20px 'Hiragino Sans','Yu Gothic','Helvetica Neue',sans-serif";
      const descLines = wrapText(ctx, desc, descMaxW);
      ctx.restore();
      const descLineH = 26;
      for (let i = 0; i < descLines.length; i++) {
        drawTextWithShadow(ctx, descLines[i].trim(), labelX, rowCy + 18 + i * descLineH, {
          font: "500 20px 'Hiragino Sans','Yu Gothic','Helvetica Neue',sans-serif",
          color: "#fff",
          align: "left",
        });
      }
    };

    drawTrio(this.covenSample, cy - rowGap / 2, t("coven"), t("tutCovenDesc"));
    drawTrio(this.cascadeSample, cy + rowGap / 2, t("cascade"), t("tutCascadeDesc"));
  }

  /**
   * Page 4 visual: turn flow diagram — DECK → HAND → DISCARD with arrows,
   * a return arrow under HAND emphasising the loop nature.
   */
  private drawTurnFlow(ctx: CanvasRenderingContext2D, cy: number): void {
    const boxW = 180;
    const boxH = 220;
    const gap = 70;
    const totalW = boxW * 3 + gap * 2;
    const startX = GAME_W / 2 - totalW / 2;

    const drawBox = (label: string, idx: number, color: string): void => {
      const x = startX + idx * (boxW + gap);
      const y = cy - boxH / 2;
      ctx.save();
      ctx.fillStyle = "rgba(28,16,46,0.92)";
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      roundRect(ctx, x, y, boxW, boxH, 16);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      roundRect(ctx, x, y, boxW, boxH, 16);
      ctx.stroke();
      ctx.restore();
      // Step number badge
      drawTextWithShadow(ctx, `${idx + 1}`, x + boxW / 2, y + 38, {
        font: "900 32px sans-serif",
        color: "rgba(255,255,255,0.4)",
      });
      // Bigger central icon
      drawTextWithShadow(ctx, idx === 1 ? "✋" : (idx === 0 ? "🂠" : "🗑"), x + boxW / 2, y + boxH / 2, {
        font: "60px sans-serif",
        color: "#fff",
      });
      drawTextWithShadow(ctx, label, x + boxW / 2, y + boxH - 28, {
        font: "900 24px 'Hiragino Sans','Yu Gothic','Helvetica Neue',sans-serif",
        color,
      });
    };

    drawBox(t("tutFlowDeck"), 0, "#5fb6ff");
    drawBox(t("tutFlowHand"), 1, "#ffd84a");
    drawBox(t("tutFlowDiscard"), 2, "#ff8a4a");

    // Arrows between boxes
    const drawArrow = (idx: number): void => {
      const ax = startX + (idx + 1) * boxW + idx * gap + gap / 2;
      drawTextWithShadow(ctx, "→", ax, cy, {
        font: "700 48px sans-serif",
        color: "#9aa3b2",
      });
    };
    drawArrow(0);
    drawArrow(1);
  }

  /** 3-card meld (highlighted) + 2 deadwood cards with running sum. */
  private drawDrossExample(ctx: CanvasRenderingContext2D, cy: number): void {
    const cw = 130;
    const ch = 188;
    const gap = 14;
    const meldGap = 38; // wider gap separating meld from deadwood
    const cards = this.handSample;
    const totalW = cards.length * cw + (cards.length - 1) * gap + meldGap;
    const startX = GAME_W / 2 - totalW / 2;
    let x = startX;
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const isInMeld = this.handMeldIds.has(c.id);
      // Insert wider gap when transitioning from meld → deadwood
      if (i > 0 && this.handMeldIds.has(cards[i - 1].id) !== isInMeld) {
        x += meldGap;
      }
      drawCardFace(ctx, c, x, cy - ch / 2, cw, ch, isInMeld);
      // Label "MELD" / point value
      if (isInMeld && i === 0) {
        drawTextWithShadow(ctx, "MELD", x + (cw * 3 + gap * 2) / 2, cy - ch / 2 - 24, {
          font: "900 22px sans-serif",
          color: "#ffd84a",
        });
      }
      if (!isInMeld) {
        drawTextWithShadow(ctx, `+${c.rank}`, x + cw / 2, cy + ch / 2 + 30, {
          font: "900 28px sans-serif",
          color: "#ff8a4a",
        });
      }
      x += cw + gap;
    }

    // Sum below the deadwood cards
    const sum = cards.filter((c) => !this.handMeldIds.has(c.id)).reduce((s, c) => s + c.rank, 0);
    drawTextWithShadow(ctx, `LEFT = ${sum} ≤ 10  →  ATTACK OK`, GAME_W / 2, cy + ch / 2 + 80, {
      font: "900 30px sans-serif",
      color: "#ffd84a",
    });
  }

  // drawCardRow removed — the prior dedicated COVEN/CASCADE pages were merged
  // into the single "What is a Meld?" page (see drawMeldConcept).

  private drawWrappedText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxW: number, lineH: number): void {
    ctx.save();
    // Set font BEFORE wrapText so measureText reflects the rendered metrics.
    ctx.font = "500 30px 'Hiragino Sans','Yu Gothic','Helvetica Neue',sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 4;
    // Honour explicit newlines as paragraph breaks; wrap each chunk separately.
    const lines: string[] = [];
    for (const para of text.split("\n")) {
      const wrapped = wrapText(ctx, para, maxW);
      // Empty paragraphs render as a blank line for visual spacing.
      if (wrapped.length === 0) lines.push("");
      else for (const w of wrapped) lines.push(w);
    }
    const top = cy - ((lines.length - 1) * lineH) / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i].trim(), cx, top + i * lineH);
    }
    ctx.restore();
  }

  // --- Input ---

  onPointerDown(e: PointerInfo): void {
    if (this.page > 0) this.backBtn.handlePointerDown(e);
    this.skipBtn.handlePointerDown(e);
    this.nextBtn.handlePointerDown(e);
  }

  onPointerMove(e: PointerInfo): void {
    if (this.page > 0) this.backBtn.handlePointerMove(e);
    this.skipBtn.handlePointerMove(e);
    this.nextBtn.handlePointerMove(e);
  }

  onPointerUp(e: PointerInfo): void {
    if (this.page > 0 && this.backBtn.handlePointerUp(e)) {
      playClick();
      this.page = Math.max(0, this.page - 1);
      this.refreshButtonLabels();
      return;
    }
    if (this.skipBtn.handlePointerUp(e)) {
      playClick();
      this.complete();
      return;
    }
    if (this.nextBtn.handlePointerUp(e)) {
      playSelect();
      if (this.page < TOTAL_PAGES - 1) {
        this.page++;
        this.refreshButtonLabels();
      } else {
        this.complete();
      }
      return;
    }
  }

  onKeyDown(key: string): void {
    if (key === "ArrowLeft" && this.page > 0) {
      playClick();
      this.page--;
      this.refreshButtonLabels();
    } else if (key === "ArrowRight" || key === " " || key === "Enter") {
      playSelect();
      if (this.page < TOTAL_PAGES - 1) {
        this.page++;
        this.refreshButtonLabels();
      } else {
        this.complete();
      }
    } else if (key === "Escape") {
      playClick();
      this.complete();
    }
  }

  /** Update the primary button label when on the last page (NEXT → START). */
  private refreshButtonLabels(): void {
    const isLast = this.page === TOTAL_PAGES - 1;
    this.nextBtn.label = isLast ? t("tutStart") : t("tutNext");
  }

  /** Mark the tutorial seen and forward to the queued next scene. */
  private complete(): void {
    try {
      localStorage.setItem(`${GAME_CONFIG.saveKey}-tut-seen`, "1");
    } catch {
      /* ignore */
    }
    this.ctx.changeScene(this.nextScene, this.nextData);
  }
}
