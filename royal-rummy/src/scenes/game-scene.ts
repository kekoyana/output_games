import type { Scene, SceneContext } from "../core/scene";
import type { PointerInfo, Rect } from "../types";
import { GAME_W, GAME_H } from "../types";
import { STAGES } from "../stage-assets.all";
import type { StageDef } from "../stage-types";
import { getCachedImage } from "../core/image-loader";
import { drawCardFace, ELEMENT_GLOW, preloadElementIcons } from "../ui/card-face";
import {
  clearCanvas,
  drawVignette,
  drawTextWithShadow,
  drawImageCover,
  drawProgressBar,
  roundRect,
} from "../ui/canvas-utils";
import { drawDialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { GAME_CONFIG } from "../game-config";
import { t, getCharacterName, type TextKey } from "../i18n";
import {
  type Card,
  buildDeck,
  shuffle,
  sortHand,
  bestMelds,
  decideAIMove,
  cardPoints,
  deadwoodAfterDiscard,
  resolveKnock,
  type HandOutcome,
} from "../game/gin-rummy";
import {
  playCardDraw,
  playCardDiscard,
  playMeld,
  playCast,
  playImpact,
  playRoundWin,
  playRoundLose,
} from "../core/sfx";
import { playBgm } from "../core/bgm";
import { markStageCleared, isStageCleared } from "../core/save-data";

type Phase =
  | "deal"
  | "player_draw"
  | "player_discard"
  | "cast_prompt"
  | "opponent_thinking"
  | "opponent_drawing"
  | "opponent_discarding"
  | "opponent_casting"
  | "impact_pending"
  | "hand_over"
  | "match_over";

const MAX_HP = 100;
const WINS_TO_VICTORY = 5;

// Unified in-game dialog panel layout (cast prompt / round result).
// Same width/height/centering so all modals share the same visual frame.
const DIALOG_PANEL_W = 760;
const DIALOG_PANEL_H = 400;
const DIALOG_PANEL_X = GAME_W / 2 - DIALOG_PANEL_W / 2;
const DIALOG_PANEL_Y = 510;
const DIALOG_BTN_Y = DIALOG_PANEL_Y + DIALOG_PANEL_H - 110;

// Opponent-turn pacing (seconds). Total ~2.0–2.5s — enough to follow the action.
const T_THINK = 0.55;
const T_DRAW = 0.60;
const T_DISCARD = 0.60;
const T_CAST = 0.55;

// Deal animation pacing — cards fly from the stock pile to their slots
// alternating opp/player, then the discard top. Total ~1.6s for 21 cards.
const DEAL_STAGGER = 0.06;
const DEAL_FLIGHT = 0.35;

// Suit fill palette indexed by Card.suit (matches gin-rummy.ts / suits.png):
// 0 = Sword (silver), 1 = Wand (amber), 2 = Shield (azure), 3 = Crown (gold).
const ELEMENT_FILL = [
  "rgba(207, 214, 230, 0.55)",
  "rgba(199, 144, 82, 0.55)",
  "rgba(126, 182, 255, 0.55)",
  "rgba(255, 216, 107, 0.55)",
] as const;

// Coven (set) crosses suits — neutral royal purple.
const COVEN_GLOW = "#c98bff";
const COVEN_FILL = "rgba(201, 139, 255, 0.55)";

/**
 * Cascade (run) glows in the meld's suit color so the halo matches the
 * cards it surrounds. Coven (set) crosses suits — falls back to a neutral
 * royal purple so it reads as "cross-suit resonance".
 */
function meldPaletteFor(meld: Card[]): { glow: string; fill: string } {
  const isSet = meld.every((c) => c.rank === meld[0].rank);
  if (isSet) return { glow: COVEN_GLOW, fill: COVEN_FILL };
  return { glow: ELEMENT_GLOW[meld[0].suit], fill: ELEMENT_FILL[meld[0].suit] };
}

// Speech bubble (opponent voice line)
const SPEECH_LIFE = 2.4;

interface ActiveSpeech {
  text: string;
  age: number;
}

/** Card flying from one rect to another with cross-fade in size. */
interface CardAnim {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromW: number;
  fromH: number;
  toW: number;
  toH: number;
  age: number;
  duration: number;
  faceUp: boolean;
  card: Card | null;
}

/** Damage popup floating above the loser side. */
interface DamagePopup {
  text: string;
  side: "player" | "opponent";
  age: number; // seconds since spawn
  variant: "knock" | "undercut" | "gin";
}
const POPUP_LIFE = 1.2;

/**
 * Light orb projectile flying from attacker to defender. Multiple orbs are
 * fired in a short burst — the last one to land triggers the actual damage
 * application via `applyImpact()`. Trajectory is a quadratic bezier with a
 * mid-point offset so orbs arc rather than travel straight.
 */
interface Projectile {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Mid-point control (x,y) for the bezier arc. */
  ctrlX: number;
  ctrlY: number;
  age: number;
  /** Total flight time (sec). */
  duration: number;
  /** Time before flight begins (sec). Used to stagger the barrage. */
  delay: number;
  color: string;
  /** Radius in px (varies for visual variety). */
  radius: number;
  /** True after impact has been resolved (avoid double-trigger). */
  resolved: boolean;
}

/** Radial sparkle burst spawned at the impact point. */
interface ImpactBurst {
  x: number;
  y: number;
  age: number;
  duration: number;
  color: string;
  /** Pre-computed sparkle directions (radians) and speeds (px/s). */
  sparkles: Array<{ a: number; speed: number }>;
}
const BURST_LIFE = 0.6;
const ORB_DURATION = 0.65;

/** Quadratic bezier scalar. */
function bezier(p0: number, p1: number, p2: number, t: number): number {
  const it = 1 - t;
  return it * it * p0 + 2 * it * t * p1 + t * t * p2;
}

/**
 * Damage formula based on outcome.
 * - knock:     5 + |loser_dw - winner_dw|         (typical 10-25)
 * - undercut: 25 + |knocker_dw - defender_dw|     (typical 25-40)
 * - gin:      25 + loser_deadwood                  (typical 30-50)
 */
function calcDamage(out: HandOutcome): number {
  const loserDw = out.winner === "player" ? out.opponentDeadwood : out.playerDeadwood;
  const winnerDw = out.winner === "player" ? out.playerDeadwood : out.opponentDeadwood;
  if (out.gin) return Math.max(25, 25 + loserDw);
  if (out.undercut) return 25 + Math.abs(loserDw - winnerDw);
  return Math.max(5, Math.abs(loserDw - winnerDw));
}

/** Main Gin Rummy scene. */
export class GameScene implements Scene {
  private ctx!: SceneContext;
  private stage!: StageDef;

  // Game state
  private stock: Card[] = [];
  private discardPile: Card[] = [];
  private playerHand: Card[] = [];
  private opponentHand: Card[] = [];
  private phase: Phase = "deal";
  private selectedCardId: number | null = null;
  /** Card the player just drew this turn — pinned to the right edge of the hand. */
  private lastDrawnCardId: number | null = null;
  private playerHp = MAX_HP;
  private opponentHp = MAX_HP;
  /** Win counts drive strip progression (independent of HP). */
  private playerWins = 0;
  private opponentWins = 0;
  /**
   * Per-hand knock ceiling. The first up-card's points value (J/Q/K=10, A=1)
   * sets this each hand — Hollywood Gin "knock card" rule. ATTACK is allowed
   * only when LEFT ≤ knockMax.
   */
  private knockMax = 10;
  private messageKey: TextKey | "" = "";
  private messageVars: Record<string, string | number> | undefined;
  private outcome: HandOutcome | null = null;
  private outcomeDamage = 0;

  // Animation / timing
  private opponentPhaseTimer = 0;
  private handOverTimer = 0;
  private flashTimer = 0;
  private timeAccum = 0;
  private damagePopups: DamagePopup[] = [];

  // Attack/impact effects
  private projectiles: Projectile[] = [];
  private impactBursts: ImpactBurst[] = [];
  /** Camera shake remaining time (sec) and current intensity (px). */
  private shakeTimer = 0;
  private shakeMag = 0;
  /** Pending damage application — fires when the last projectile lands. */
  private pendingImpact: {
    out: HandOutcome;
    dmg: number;
  } | null = null;

  // Opponent-turn animation state
  private cardAnim: CardAnim | null = null;
  private pendingAIMove: ReturnType<typeof decideAIMove> | null = null;
  private pendingDrawnCard: Card | null = null;

  // Speech bubble state (opponent talks)
  private speech: ActiveSpeech | null = null;
  /** Tracks the highest strip-progress index already triggered. */
  private spokenStripIdx = -1;
  /** Avoid spamming the "approachingCast" line each turn. */
  private spokenApproachingThisHand = false;
  /** Reach (knock-eligible) line fires once per hand. */
  private spokenReachThisHand = false;
  /** Number of meld-ready voice lines already spoken this hand. */
  private spokenMeldsThisHand = 0;

  // Deal animation state
  private dealTime = 0;
  private dealEndTime = 0;
  /** Card.id → time (sec) at which it begins flying from stock to its slot. */
  private dealAppearAt: Map<number, number> = new Map();

  // UI
  private castConfirmBtn!: Button;
  private castPassBtn!: Button;
  private nextHandBtn!: Button;

  // Hit rects recomputed every frame
  private stockRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private discardRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private playerCardRects: Array<{ id: number; rect: Rect }> = [];
  enter(ctx: SceneContext): void {
    this.ctx = ctx;
    // Resume mid-match (e.g. returning from the tutorial overlay): keep all
    // state in place, just rebind the scene context and ensure BGM is on.
    if (ctx.data["resume"] === true) {
      playBgm("battle");
      return;
    }
    const stageIndex = ctx.data["stageIndex"] as number;
    this.stage = STAGES[stageIndex];
    playBgm("battle");

    // Preload element sigils used as suit symbols. First-frame render before
    // they decode falls through gracefully (corner symbol is just absent).
    preloadElementIcons();

    this.playerHp = MAX_HP;
    this.opponentHp = MAX_HP;
    this.playerWins = 0;
    this.opponentWins = 0;
    this.spokenStripIdx = -1;
    this.speech = null;

    // Cast prompt + round-result buttons. Position must fall inside the
    // unified dialog panel (see DIALOG_* constants below).
    this.castPassBtn = new Button(
      { x: GAME_W / 2 - 252, y: DIALOG_BTN_Y, w: 240, h: 80 },
      t("pass"),
      {
        bgColor: "#3a2a3e",
        textColor: "#fff",
        fontSize: 32,
        radius: 14,
      }
    );
    this.castConfirmBtn = new Button(
      { x: GAME_W / 2 + 12, y: DIALOG_BTN_Y, w: 240, h: 80 },
      t("cast"),
      {
        bgColor: GAME_CONFIG.accentColor,
        textColor: "#fff",
        fontSize: 32,
        radius: 14,
      }
    );
    this.nextHandBtn = new Button(
      { x: GAME_W / 2 - 130, y: DIALOG_BTN_Y + 4, w: 260, h: 72 },
      t("nextRound"),
      {
        bgColor: GAME_CONFIG.accentColor,
        textColor: "#fff",
        fontSize: 30,
        radius: 14,
      }
    );
    this.startNewHand();
  }

  exit(): void {}

  /** Start a fresh Gin Rummy hand. Non-dealer (player) goes first. */
  private startNewHand(): void {
    const deck = shuffle(buildDeck());
    this.playerHand = sortHand(deck.slice(0, 10));
    this.opponentHand = deck.slice(10, 20);
    this.discardPile = [deck[20]];
    this.stock = deck.slice(21);
    this.selectedCardId = null;
    this.lastDrawnCardId = null;
    this.outcome = null;
    this.opponentPhaseTimer = 0;
    this.handOverTimer = 0;
    this.cardAnim = null;
    this.pendingAIMove = null;
    this.pendingDrawnCard = null;
    this.spokenApproachingThisHand = false;
    this.spokenReachThisHand = false;
    this.spokenMeldsThisHand = 0;
    // First up-card sets the per-hand knock ceiling.
    this.knockMax = cardPoints(this.discardPile[0].rank);

    // Deal animation: alternate opp/player for 10 rounds, then top of discard.
    this.dealAppearAt.clear();
    let dt = 0;
    for (let i = 0; i < 10; i++) {
      this.dealAppearAt.set(this.opponentHand[i].id, dt);
      dt += DEAL_STAGGER;
      this.dealAppearAt.set(this.playerHand[i].id, dt);
      dt += DEAL_STAGGER;
    }
    this.dealAppearAt.set(this.discardPile[0].id, dt);
    this.dealEndTime = dt + DEAL_FLIGHT;
    this.dealTime = 0;
    this.phase = "deal";
    this.setMessage("");
  }

  /** Voice-line system removed (Phase 1). Kept as a no-op so callers compile. */
  private speak(): void {}

  private setMessage(key: TextKey | "", vars?: Record<string, string | number>): void {
    this.messageKey = key;
    this.messageVars = vars;
  }

  update(dt: number): void {
    this.timeAccum += dt;

    // Advance card-fly animation regardless of phase.
    if (this.cardAnim) {
      this.cardAnim.age += dt;
      if (this.cardAnim.age >= this.cardAnim.duration) {
        this.cardAnim = null;
      }
    }

    if (this.phase === "deal") {
      this.dealTime += dt;
      if (this.dealTime >= this.dealEndTime) {
        this.phase = "player_draw";
        this.setMessage("drawCardPrompt");
        this.dealAppearAt.clear();
        if (this.opponentWins === 0 && this.playerWins === 0) {
          this.speak();
        }
      }
    }

    if (
      this.phase === "opponent_thinking" ||
      this.phase === "opponent_drawing" ||
      this.phase === "opponent_discarding" ||
      this.phase === "opponent_casting"
    ) {
      this.opponentPhaseTimer -= dt;
      if (this.opponentPhaseTimer <= 0) {
        this.advanceOpponentPhase();
      }
    } else if (this.phase === "hand_over") {
      this.handOverTimer += dt;
    }

    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this.shakeTimer > 0) this.shakeTimer -= dt;

    // Advance projectiles. Each landing spawns an impact burst and adds shake;
    // the LAST landing also commits the queued damage via applyImpact().
    if (this.projectiles.length > 0) {
      for (const p of this.projectiles) {
        if (p.delay > 0) {
          p.delay -= dt;
          continue;
        }
        if (p.resolved) continue;
        p.age += dt;
        if (p.age >= p.duration) {
          p.resolved = true;
          this.spawnImpactBurst(p.toX, p.toY, p.color);
          this.shakeTimer = 0.32;
          this.shakeMag = Math.max(this.shakeMag, 14);
          playImpact();
        }
      }
      this.projectiles = this.projectiles.filter((p) => !p.resolved);
      if (this.projectiles.length === 0 && this.phase === "impact_pending") {
        // Final orb landed — apply damage and transition.
        this.applyImpact();
      }
    }

    // Age-out impact bursts
    for (const b of this.impactBursts) b.age += dt;
    this.impactBursts = this.impactBursts.filter((b) => b.age < b.duration);

    // Age-out damage popups
    for (const p of this.damagePopups) p.age += dt;
    this.damagePopups = this.damagePopups.filter((p) => p.age < POPUP_LIFE);
    // Age-out speech bubble
    if (this.speech) {
      this.speech.age += dt;
      if (this.speech.age >= SPEECH_LIFE) this.speech = null;
    }

  }

  // ---------- Player actions ----------

  private onDrawStock(): void {
    if (this.phase !== "player_draw") return;
    const c = this.stock.pop();
    if (!c) {
      this.handleStockExhausted();
      return;
    }
    const meldsBefore = bestMelds(this.playerHand).melds.length;
    this.playerHand = sortHand([...this.playerHand, c]);
    this.lastDrawnCardId = c.id;
    this.phase = "player_discard";
    this.selectedCardId = c.id;
    this.setMessage("discardPrompt", { n: this.knockMax });
    playCardDraw();
    if (bestMelds(this.playerHand).melds.length > meldsBefore) playMeld();
  }

  private onDrawDiscard(): void {
    if (this.phase !== "player_draw") return;
    const c = this.discardPile.pop();
    if (!c) return;
    const meldsBefore = bestMelds(this.playerHand).melds.length;
    this.playerHand = sortHand([...this.playerHand, c]);
    this.lastDrawnCardId = c.id;
    this.phase = "player_discard";
    this.selectedCardId = c.id;
    this.setMessage("discardPrompt", { n: this.knockMax });
    playCardDraw();
    if (bestMelds(this.playerHand).melds.length > meldsBefore) playMeld();
  }

  private onDiscardCard(cardId: number): void {
    if (this.phase !== "player_discard") return;
    const c = this.playerHand.find((x) => x.id === cardId);
    if (!c) return;
    this.playerHand = this.playerHand.filter((x) => x.id !== cardId);
    this.discardPile.push(c);
    this.selectedCardId = null;
    this.lastDrawnCardId = null;
    playCardDiscard();

    // After committing the discard, prompt the player to CAST if eligible.
    // Otherwise the turn passes to the opponent immediately.
    const after = bestMelds(this.playerHand);
    if (after.deadwoodPoints <= this.knockMax) {
      this.phase = "cast_prompt";
      this.setMessage("");
      return;
    }
    this.endPlayerTurn();
  }

  private onCastConfirmed(): void {
    if (this.phase !== "cast_prompt") return;
    const after = bestMelds(this.playerHand);
    playCast();
    this.resolveHand("player", after.deadwoodPoints === 0);
  }

  private onCastDeclined(): void {
    if (this.phase !== "cast_prompt") return;
    this.endPlayerTurn();
  }

  private endPlayerTurn(): void {
    this.phase = "opponent_thinking";
    this.opponentPhaseTimer = T_THINK;
    this.setMessage("opponentThinking");
  }

  // ---------- Opponent turn (animated) ----------

  /** Phase machine entry — called when opponentPhaseTimer expires. */
  private advanceOpponentPhase(): void {
    if (this.phase === "opponent_thinking") {
      this.startOpponentDrawing();
    } else if (this.phase === "opponent_drawing") {
      this.startOpponentDiscarding();
    } else if (this.phase === "opponent_discarding") {
      this.startOpponentCastingOrEnd();
    } else if (this.phase === "opponent_casting") {
      this.resolveHand("opponent", !!this.pendingAIMove?.gin);
    }
  }

  /**
   * Step 1 → 2: decide AI move, animate the drawn card flying from
   * stock or discard to the opponent's hand area (face-down).
   */
  private startOpponentDrawing(): void {
    const discardTop = this.discardPile[this.discardPile.length - 1] ?? null;
    const stockTop = this.stock[this.stock.length - 1];
    if (!stockTop) {
      this.handleStockExhausted();
      return;
    }
    const style = this.stage.playStyle ?? "defensive";
    const move = decideAIMove(
      this.opponentHand,
      discardTop,
      stockTop,
      style,
      this.knockMax,
      {
        selfHpRatio: this.opponentHp / MAX_HP,
        opponentHpRatio: this.playerHp / MAX_HP,
      },
    );
    this.pendingAIMove = move;

    // Trigger "approaching cast" voice line when opponent is dangerously close.
    if (
      !this.spokenApproachingThisHand &&
      !move.knock &&
      !move.gin &&
      bestMelds(this.opponentHand).deadwoodPoints <= 12
    ) {
      this.speak();
      this.spokenApproachingThisHand = true;
    }

    let drawn: Card;
    let fromCenter: { x: number; y: number };
    let faceUp: boolean;
    if (move.drawFromDiscard && discardTop) {
      drawn = this.discardPile.pop()!;
      fromCenter = this.discardPileCenter();
      faceUp = true; // they took a visible card from discard
    } else {
      drawn = this.stock.pop()!;
      fromCenter = this.stockPileCenter();
      faceUp = false; // hidden draw from deck
    }
    this.pendingDrawnCard = drawn;

    const fromW = 140;
    const fromH = 200;
    const toW = 88;
    const toH = 128;
    const opp = this.opponentHandCenter();
    this.cardAnim = {
      fromX: fromCenter.x - fromW / 2,
      fromY: fromCenter.y - fromH / 2,
      toX: opp.x - toW / 2,
      toY: opp.y - toH / 2,
      fromW,
      fromH,
      toW,
      toH,
      age: 0,
      duration: T_DRAW,
      faceUp,
      card: drawn,
    };

    this.phase = "opponent_drawing";
    this.opponentPhaseTimer = T_DRAW;
    this.setMessage(faceUp ? "opponentDrawsTrash" : "opponentDrawsDeck");
    playCardDraw();
  }

  /**
   * Step 2 → 3: commit drawn card into hand, then animate the discarded
   * card flying from opponent's hand to the discard pile (face-up).
   */
  private startOpponentDiscarding(): void {
    if (!this.pendingDrawnCard || !this.pendingAIMove) {
      this.phase = "player_draw";
      this.setMessage("yourTurnDraw");
      return;
    }
    this.opponentHand.push(this.pendingDrawnCard);
    this.pendingDrawnCard = null;

    const move = this.pendingAIMove;
    let discard = this.opponentHand.find((c) => c.id === move.discardCardId);
    if (!discard) {
      // Fail safe: discard last
      discard = this.opponentHand[this.opponentHand.length - 1];
    }
    this.opponentHand = this.opponentHand.filter((c) => c.id !== discard.id);

    // Voice line for this discard. Priority: reach (knock-eligible) >
    // meldReady (new coven/cascade formed). Skipped when the opponent is
    // about to CAST (selfCast voice covers that beat).
    if (!move.knock && !move.gin) {
      const after = bestMelds(this.opponentHand);
      const meldCount = after.melds.length;
      if (!this.spokenReachThisHand && after.deadwoodPoints <= this.knockMax) {
        this.speak();
        this.spokenReachThisHand = true;
        // Reach is the strongest warning — suppress lesser warnings later.
        this.spokenApproachingThisHand = true;
        this.spokenMeldsThisHand = meldCount;
      } else if (meldCount > this.spokenMeldsThisHand) {
        this.speak();
        this.spokenMeldsThisHand = meldCount;
      }
    }

    const fromW = 88;
    const fromH = 128;
    const toW = 140;
    const toH = 200;
    const opp = this.opponentHandCenter();
    const dest = this.discardPileCenter();
    this.cardAnim = {
      fromX: opp.x - fromW / 2,
      fromY: opp.y - fromH / 2,
      toX: dest.x - toW / 2,
      toY: dest.y - toH / 2,
      fromW,
      fromH,
      toW,
      toH,
      age: 0,
      duration: T_DISCARD,
      faceUp: true,
      card: discard,
    };

    // Push to discard pile already so it shows up after animation lands;
    // the anim overlay covers the pile during the flight.
    this.discardPile.push(discard);

    this.phase = "opponent_discarding";
    this.opponentPhaseTimer = T_DISCARD;
    this.setMessage("opponentDiscards");
    playCardDiscard();
  }

  /** Step 3 → 4 or hand back to player: cast banner if knock/gin, else end turn. */
  private startOpponentCastingOrEnd(): void {
    const move = this.pendingAIMove;
    if (move && (move.knock || move.gin)) {
      this.phase = "opponent_casting";
      this.opponentPhaseTimer = T_CAST;
      this.setMessage("opponentCasts");
      playCast();
      // Voice line during the cast banner
      this.speak();
      return;
    }
    this.pendingAIMove = null;
    this.phase = "player_draw";
    this.setMessage("yourTurnDraw");
  }

  /**
   * Position to draw a card at, given its slot top-left (slotX, slotY) and
   * size (cw, ch). During the deal phase, cards interpolate from the stock
   * pile center toward their slot. Returns null when a card hasn't yet
   * "appeared" (still inside the deck).
   */
  private dealOffsetFor(
    cardId: number,
    slotX: number,
    slotY: number,
    cw: number,
    ch: number,
  ): { x: number; y: number } | null {
    const appearAt = this.dealAppearAt.get(cardId);
    if (appearAt === undefined) return { x: slotX, y: slotY };
    const t = this.dealTime - appearAt;
    if (t < 0) return null;
    if (t >= DEAL_FLIGHT) return { x: slotX, y: slotY };
    const stockC = this.stockPileCenter();
    const fromX = stockC.x - cw / 2;
    const fromY = stockC.y - ch / 2;
    const e = 1 - Math.pow(1 - t / DEAL_FLIGHT, 3); // ease-out cubic
    return {
      x: fromX + (slotX - fromX) * e,
      y: fromY + (slotY - fromY) * e,
    };
  }

  // ---------- Pile/hand center helpers (match drawCenterPiles geometry) ----------

  private stockPileCenter(): { x: number; y: number } {
    const cw = 140;
    const gap = 40;
    return { x: GAME_W / 2 - cw / 2 - gap / 2, y: 600 + 100 };
  }

  private discardPileCenter(): { x: number; y: number } {
    const cw = 140;
    const gap = 40;
    return { x: GAME_W / 2 + cw / 2 + gap / 2, y: 600 + 100 };
  }

  private opponentHandCenter(): { x: number; y: number } {
    return { x: GAME_W / 2, y: 80 + 128 / 2 };
  }

  private handleStockExhausted(): void {
    // When stock runs out before anyone knocks: hand is a draw — no damage.
    this.phase = "hand_over";
    this.handOverTimer = 0;
    this.outcome = null;
    this.setMessage("deckEmptyDraw");
  }

  // ---------- Resolution ----------

  private resolveHand(knocker: "player" | "opponent", gin: boolean): void {
    const out = resolveKnock(knocker, this.playerHand, this.opponentHand, gin);
    this.outcome = out;
    const dmg = calcDamage(out);
    this.outcomeDamage = dmg;

    // Spawn the orb barrage and let `applyImpact()` finalize damage on landing.
    this.spawnAttackOrbs(out, dmg);
    this.pendingImpact = { out, dmg };
    this.phase = "impact_pending";
    this.setMessage("");
  }

  /**
   * Apply pending damage, popups, voice lines, and transition to hand_over /
   * match_over. Called from update() once every projectile in the barrage has
   * landed (or unconditionally on a stock-exhausted draw, etc.).
   */
  private applyImpact(): void {
    const pending = this.pendingImpact;
    if (!pending) return;
    this.pendingImpact = null;
    const { out, dmg } = pending;

    if (out.winner === "player") {
      this.opponentHp = Math.max(0, this.opponentHp - dmg);
      this.playerWins += 1;
      this.spawnDamagePopup(dmg, "opponent", out);
      playRoundWin();
      // Strip stage advanced (1..4 maps to stripProgress[0..3]); 5 is reward.
      const idx = this.playerWins - 1;
      if (idx >= 0 && idx <= 3 && idx > this.spokenStripIdx) {
        this.speak();
        this.spokenStripIdx = idx;
      }
    } else {
      this.playerHp = Math.max(0, this.playerHp - dmg);
      this.opponentWins += 1;
      this.spawnDamagePopup(dmg, "player", out);
      playRoundLose();
    }

    this.flashTimer = 0.5;

    const matchEnd =
      this.playerWins >= WINS_TO_VICTORY ||
      this.opponentWins >= WINS_TO_VICTORY ||
      this.opponentHp <= 0 ||
      this.playerHp <= 0;
    if (matchEnd) {
      if (this.opponentHp <= 0 && this.playerWins < WINS_TO_VICTORY) {
        this.playerWins = WINS_TO_VICTORY;
      }
      if (this.playerHp <= 0 && this.opponentWins < WINS_TO_VICTORY) {
        this.opponentWins = WINS_TO_VICTORY;
      }
      this.phase = "match_over";
      this.handOverTimer = 0;
    } else {
      this.phase = "hand_over";
      this.handOverTimer = 0;
    }
  }

  /**
   * Fire a small barrage of glowing orbs from attacker → defender. The number
   * and color of orbs scales with the cast type (knock < undercut < gin).
   */
  private spawnAttackOrbs(out: HandOutcome, dmg: number): void {
    const playerAttacks = out.winner === "player";
    // Origin: attacker's hand center. Destination: defender's HP bar.
    const fromX = GAME_W / 2;
    const fromY = playerAttacks ? GAME_H - 130 : 80 + 64;
    const toX = GAME_W / 2;
    const toY = playerAttacks ? 58 : GAME_H - 66;

    // Color: gold for gin/PURE, cyan-white for player knocks, magenta for opponent.
    const color = out.gin
      ? "#ffd54a"
      : out.undercut
        ? "#9fdaff"
        : playerAttacks
          ? "#7af3d4"
          : "#ff6e9a";

    // 3 orbs for knock, 4 for undercut, 5 for gin — all heavy hits feel bigger.
    const count = out.gin ? 5 : out.undercut ? 4 : 3;

    for (let i = 0; i < count; i++) {
      // Lateral spread on origin so orbs fan out, then converge on the target.
      const spreadX = (i - (count - 1) / 2) * 36;
      // Mid-control bowed away from origin so orbs arc upward (player) /
      // downward (opponent) before homing in.
      const ctrlY = (fromY + toY) / 2 + (playerAttacks ? -160 : 160);
      this.projectiles.push({
        fromX: fromX + spreadX,
        fromY,
        toX,
        toY,
        ctrlX: (fromX + toX) / 2 + spreadX * 0.6,
        ctrlY,
        age: 0,
        duration: ORB_DURATION,
        delay: i * 0.07,
        color,
        radius: out.gin ? 22 : out.undercut ? 18 : 16,
        resolved: false,
      });
    }
    // Heavier hits → louder shake.
    this.shakeMag = Math.min(20, 8 + dmg * 0.18);
    this.shakeTimer = 0;
  }

  private spawnImpactBurst(x: number, y: number, color: string): void {
    const sparkles: Array<{ a: number; speed: number }> = [];
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 280 + Math.random() * 220;
      sparkles.push({ a, speed });
    }
    this.impactBursts.push({
      x,
      y,
      age: 0,
      duration: BURST_LIFE,
      color,
      sparkles,
    });
  }

  private spawnDamagePopup(
    dmg: number,
    side: "player" | "opponent",
    out: HandOutcome,
  ): void {
    const variant: "knock" | "undercut" | "gin" = out.gin
      ? "gin"
      : out.undercut
        ? "undercut"
        : "knock";
    const tag = out.gin ? `${t("pure")} ` : out.undercut ? `${t("counter")} ` : "";
    this.damagePopups.push({
      text: `${tag}${dmg} ${t("damage")}`,
      side,
      age: 0,
      variant,
    });
  }

  private onNextHand(): void {
    if (this.phase === "hand_over") {
      this.startNewHand();
    } else if (this.phase === "match_over") {
      const playerVictory =
        this.playerWins >= WINS_TO_VICTORY || this.opponentHp <= 0;
      if (playerVictory) {
        markStageCleared(this.stage.name, 0);
        const allCleared = STAGES.every((s) => isStageCleared(s.name));
        this.ctx.changeScene(allCleared ? "ending" : "select", {
          ...this.ctx.data,
          victory: true,
          characterName: this.stage.name,
        });
      } else {
        this.ctx.changeScene("gameover", {
          ...this.ctx.data,
          victory: false,
          characterName: this.stage.name,
        });
      }
    }
  }

  // ---------- Draw ----------

  draw(ctx: CanvasRenderingContext2D): void {
    clearCanvas(ctx, "#140a14");

    // Background: opponent portrait (single fixed image — flag pips
    // communicate progress instead of changing artwork).
    const portraitUrl = this.stage.portraitUrl;

    // Apply camera shake (impact only — fades out as shakeTimer decays).
    let shakeX = 0, shakeY = 0;
    if (this.shakeTimer > 0) {
      const k = Math.min(1, this.shakeTimer / 0.32);
      shakeX = Math.sin(this.timeAccum * 60) * this.shakeMag * k;
      shakeY = Math.cos(this.timeAccum * 72) * this.shakeMag * k;
    }
    ctx.save();
    if (shakeX !== 0 || shakeY !== 0) ctx.translate(shakeX, shakeY);

    if (portraitUrl) {
      const img = getCachedImage(portraitUrl);
      if (img) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        drawImageCover(ctx, img, 0, 0, GAME_W, GAME_H);
        ctx.restore();
      }
    }
    drawVignette(ctx, 0.55);

    // Top header: opponent flag pips + HP bar. Right edge leaves room for the
    // global gear icon (72px + 24px margin).
    const headerX = 24;
    const headerW = GAME_W - 104 - headerX;
    this.drawStripPips(ctx, headerX, 16, headerW, 14, this.playerWins, this.stage.rounds.length);
    this.drawHpBar(ctx, headerX, 36, headerW, 44, this.opponentHp, getCharacterName(this.stage.name), "#ff4a7a");

    // Opponent hand (face-down, top)
    this.drawOpponentHand(ctx);

    // Center: stock + discard
    this.drawCenterPiles(ctx);

    // Message / deadwood info
    this.drawStatusArea(ctx);

    // Player hand (bottom)
    this.drawPlayerHand(ctx);

    // Bottom: player HP bar (no strip pips on player side).
    // x / width matched to the opponent bar above so both sides line up.
    this.drawHpBar(
      ctx,
      headerX,
      GAME_H - 88,
      headerW,
      44,
      this.playerHp,
      t("you"),
      "#4affd6"
    );

    // Card-fly animation (above piles/hands so it's visible during opponent turn)
    if (this.cardAnim) this.drawCardAnim(ctx, this.cardAnim);

    // Opponent speech bubble (above the opponent hand area)
    if (this.speech) this.drawSpeechBubble(ctx, this.speech);

    // Opponent-phase banner ("thinking", "drawing from discard", "casting")
    this.drawOpponentBanner(ctx);

    // Attack orbs + impact bursts (above gameplay, below popups).
    if (this.projectiles.length > 0) this.drawProjectiles(ctx);
    if (this.impactBursts.length > 0) this.drawImpactBursts(ctx);

    // Damage popups (drawn last so they sit above everything)
    this.drawDamagePopups(ctx);

    // Phase-specific overlays
    if (this.phase === "cast_prompt") {
      this.drawCastPromptOverlay(ctx);
    } else if (this.phase === "hand_over" || this.phase === "match_over") {
      this.drawHandOverOverlay(ctx);
    }

    // End shake-transformed pass.
    ctx.restore();

    // Damage flash (full-screen overlay, NOT shaken).
    if (this.flashTimer > 0 && this.outcome) {
      const a = this.flashTimer / 0.5;
      ctx.fillStyle = this.outcome.winner === "player" ? `rgba(255,80,150,${a * 0.35})` : `rgba(200,60,60,${a * 0.35})`;
      ctx.fillRect(0, 0, GAME_W, GAME_H);
    }

  }

  /**
   * Draw the orb barrage. Each orb has:
   *  - a quadratic bezier path from origin → control → target
   *  - a fading streak trail (sampled at past t values)
   *  - a glowing radial-gradient core
   */
  private drawProjectiles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.projectiles) {
      if (p.delay > 0) continue;
      const tNorm = Math.min(1, p.age / p.duration);
      const e = tNorm * tNorm; // ease-in (slow then fast — feels like acceleration)

      // Trail: 8 samples behind the head, decreasing alpha and radius.
      ctx.save();
      for (let i = 8; i >= 1; i--) {
        const ts = Math.max(0, e - i * 0.05);
        const px = bezier(p.fromX, p.ctrlX, p.toX, ts);
        const py = bezier(p.fromY, p.ctrlY, p.toY, ts);
        const a = (1 - i / 8) * 0.35;
        const r = p.radius * (0.9 - i * 0.07);
        if (r <= 0) continue;
        ctx.globalAlpha = a;
        const g = ctx.createRadialGradient(px, py, 0, px, py, r * 2);
        g.addColorStop(0, p.color);
        g.addColorStop(0.4, p.color);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Head: bright core + outer glow halo.
      const hx = bezier(p.fromX, p.ctrlX, p.toX, e);
      const hy = bezier(p.fromY, p.ctrlY, p.toY, e);
      ctx.save();
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 28;
      const halo = ctx.createRadialGradient(hx, hy, 0, hx, hy, p.radius * 3);
      halo.addColorStop(0, "rgba(255,255,255,0.95)");
      halo.addColorStop(0.25, p.color);
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(hx, hy, p.radius * 3, 0, Math.PI * 2);
      ctx.fill();
      // Bright white core
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(hx, hy, p.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /** Draw radial sparkle bursts at landing points. */
  private drawImpactBursts(ctx: CanvasRenderingContext2D): void {
    for (const b of this.impactBursts) {
      const t = b.age / b.duration;
      const fade = 1 - t;

      // Shockwave ring
      ctx.save();
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 4 * fade;
      ctx.globalAlpha = fade * 0.8;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 18;
      const ringR = 30 + 220 * t;
      ctx.beginPath();
      ctx.arc(b.x, b.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Sparkle streaks radiating outward
      ctx.save();
      ctx.strokeStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 14;
      ctx.lineCap = "round";
      ctx.lineWidth = 3 * fade;
      ctx.globalAlpha = fade;
      for (const s of b.sparkles) {
        const r0 = 20 + s.speed * b.age * 0.6;
        const r1 = r0 + 30 * fade;
        const x0 = b.x + Math.cos(s.a) * r0;
        const y0 = b.y + Math.sin(s.a) * r0;
        const x1 = b.x + Math.cos(s.a) * r1;
        const y1 = b.y + Math.sin(s.a) * r1;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** Render a flying card with eased size + position interpolation. */
  private drawCardAnim(ctx: CanvasRenderingContext2D, a: CardAnim): void {
    const tNorm = Math.min(1, a.age / a.duration);
    const e = 1 - Math.pow(1 - tNorm, 3); // ease-out cubic
    const x = a.fromX + (a.toX - a.fromX) * e;
    const y = a.fromY + (a.toY - a.fromY) * e;
    const w = a.fromW + (a.toW - a.fromW) * e;
    const h = a.fromH + (a.toH - a.fromH) * e;
    if (a.faceUp && a.card) {
      drawCardFace(ctx, a.card, x, y, w, h, false);
    } else {
      this.drawCardBack(ctx, x, y, w, h);
    }
  }

  /** Render the opponent speech bubble (top-right, fades in/out). */
  private drawSpeechBubble(ctx: CanvasRenderingContext2D, s: ActiveSpeech): void {
    const fadeIn = Math.min(1, s.age / 0.18);
    const fadeOut = s.age > SPEECH_LIFE - 0.4
      ? Math.max(0, (SPEECH_LIFE - s.age) / 0.4)
      : 1;
    const alpha = fadeIn * fadeOut;
    if (alpha <= 0) return;

    // Measure & wrap.
    ctx.save();
    ctx.font = "bold 26px sans-serif";
    const maxWidth = 460;
    const lines = this.wrapBubbleText(ctx, s.text, maxWidth);
    const lineH = 32;
    const padX = 22;
    const padY = 18;
    const textW = Math.min(
      maxWidth,
      Math.max(...lines.map((ln) => ctx.measureText(ln).width)),
    );
    const w = textW + padX * 2;
    const h = lines.length * lineH + padY * 2;

    // Anchor: overlap with the opponent's face-down hand (y=80..208) so the
    // character portrait below stays visible. Vertically centered on the cards.
    const handTop = 80;
    const handH = 128;
    const anchorX = GAME_W / 2 + 80;
    const x = Math.min(GAME_W - w - 24, anchorX - w / 2);
    const y = handTop + (handH - h) / 2;

    ctx.globalAlpha = alpha;
    // Bubble background
    ctx.fillStyle = "rgba(20, 10, 30, 0.92)";
    ctx.strokeStyle = this.stage.accentColor ?? "#e07aa0";
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "bold 26px sans-serif";
    lines.forEach((ln, i) => {
      ctx.fillText(ln, x + padX, y + padY + i * lineH);
    });
    ctx.restore();
  }

  /** Word/char-aware wrapper for bubble text — handles JP/RU/EN. */
  private wrapBubbleText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
    const out: string[] = [];
    let line = "";
    for (const ch of text) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line.length > 0) {
        out.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
    return out;
  }

  /** Banner for opponent_casting — overlays the table center for ~0.55s. */
  private drawOpponentBanner(ctx: CanvasRenderingContext2D): void {
    if (this.phase !== "opponent_casting") return;
    const text = t("opponentCasts");
    const elapsed = T_CAST - this.opponentPhaseTimer;
    const slide = Math.min(1, elapsed / 0.18);
    const alpha = Math.min(1, elapsed / 0.12);

    const w = GAME_W * 0.78;
    const h = 110;
    const cx = GAME_W / 2;
    const cy = GAME_H / 2 - 40;
    const x = cx - w / 2;
    const y = cy - h / 2 + (1 - slide) * -30;

    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = "rgba(180, 30, 50, 0.92)";
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = "#ffd54a";
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, w, h, 12);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    drawTextWithShadow(ctx, text, cx, cy, {
      font: "900 56px sans-serif",
      color: "#fff",
      shadowColor: "#000",
      shadowBlur: 12,
    });
    ctx.restore();
  }

  private drawHpBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    hp: number,
    label: string,
    color: string
  ): void {
    ctx.save();
    const ratio = Math.max(0, Math.min(1, hp / MAX_HP));
    drawProgressBar(ctx, x, y, w, h, ratio, {
      accent: color,
      radius: h / 2,
      glow: true,
      shimmer: true,
    });

    // Label and HP readout sit on top of the metallic frame.
    drawTextWithShadow(ctx, label, x + 18, y + h / 2, {
      font: "bold 26px sans-serif",
      color: "#fff",
      align: "left",
      baseline: "middle",
      shadowColor: "rgba(0,0,0,0.95)",
      shadowBlur: 4,
    });
    drawTextWithShadow(ctx, `${hp} / ${MAX_HP}`, x + w - 18, y + h / 2, {
      font: "bold 26px sans-serif",
      color: "#fff",
      align: "right",
      baseline: "middle",
      shadowColor: "rgba(0,0,0,0.95)",
      shadowBlur: 4,
    });
    ctx.restore();
  }

  /**
   * Win-progress flags above the opponent's HP bar (1 flag per win, 5 total).
   * Filled flags wave in royal gold; un-won slots show only a faint pole.
   */
  private drawStripPips(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    progress: number,
    total: number,
  ): void {
    ctx.save();
    const gap = 8;
    const segW = (w - gap * (total - 1)) / total;
    // Flag is roughly 2.4× the pip height to stay readable above the HP bar.
    const flagH = Math.max(20, h * 2.2);
    const flagY = y - (flagH - h);
    for (let i = 0; i < total; i++) {
      const sx = x + i * (segW + gap);
      const filled = i < progress;
      const poleX = sx + 2;
      // Pole.
      ctx.fillStyle = filled ? "#d8d2c0" : "rgba(255,255,255,0.22)";
      ctx.fillRect(poleX, flagY, 2, flagH);
      // Pole finial (small ball at the top).
      ctx.beginPath();
      ctx.arc(poleX + 1, flagY, 3, 0, Math.PI * 2);
      ctx.fillStyle = filled ? "#fff2c0" : "rgba(255,255,255,0.25)";
      ctx.fill();
      if (filled) {
        // Triangular pennant waving to the right.
        const flagW = segW - 6;
        const fx0 = poleX + 2;
        const fy0 = flagY + 2;
        const fy1 = fy0 + flagH * 0.45;
        const fx1 = fx0 + flagW;
        ctx.save();
        ctx.shadowColor = "#ffd54a";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(fx0, fy0);
        ctx.lineTo(fx1, fy0 + (fy1 - fy0) * 0.35);
        ctx.lineTo(fx0, fy1);
        ctx.closePath();
        const grad = ctx.createLinearGradient(fx0, fy0, fx0, fy1);
        grad.addColorStop(0, "#ffe27a");
        grad.addColorStop(1, "#c89638");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  private drawDamagePopups(ctx: CanvasRenderingContext2D): void {
    for (const p of this.damagePopups) {
      const t = p.age / POPUP_LIFE; // 0..1
      const easeOut = 1 - Math.pow(1 - t, 2);
      const alpha = Math.max(0, 1 - Math.pow(t, 2));
      const driftY = -120 * easeOut; // floats up
      const cx = GAME_W / 2;
      const cy = (p.side === "opponent" ? GAME_H * 0.28 : GAME_H * 0.72) + driftY;

      const baseSize = p.variant === "gin" ? 64 : p.variant === "undercut" ? 54 : 44;
      const scale = 0.85 + 0.25 * (1 - alpha); // pop in, settle
      const fontSize = Math.floor(baseSize * scale);

      const color =
        p.variant === "gin"
          ? "#ffd54a"
          : p.variant === "undercut"
            ? "#7fc0ff"
            : "#ff7a8a";

      ctx.save();
      ctx.globalAlpha = alpha;
      drawTextWithShadow(ctx, p.text, cx, cy, {
        font: `900 ${fontSize}px sans-serif`,
        color,
        shadowBlur: 12,
        shadowColor: color,
      });
      ctx.restore();
    }
  }

  private drawOpponentHand(ctx: CanvasRenderingContext2D): void {
    const cw = 88;
    const ch = 128;
    const gap = 6;
    const total = this.opponentHand.length;
    const startX = (GAME_W - (cw * total + gap * (total - 1))) / 2;
    const slotY = 80;
    for (let i = 0; i < total; i++) {
      const card = this.opponentHand[i];
      const slotX = startX + i * (cw + gap);
      const pos = this.dealOffsetFor(card.id, slotX, slotY, cw, ch);
      if (pos === null) continue;
      this.drawCardBack(ctx, pos.x, pos.y, cw, ch);
    }
  }

  private drawCenterPiles(ctx: CanvasRenderingContext2D): void {
    const cw = 140;
    const ch = 200;
    const y = 600;
    const gap = 40;
    const stockX = GAME_W / 2 - cw - gap / 2;
    const discardX = GAME_W / 2 + gap / 2;

    this.stockRect = { x: stockX, y, w: cw, h: ch };
    this.discardRect = { x: discardX, y, w: cw, h: ch };

    // Pulse highlight on drawable piles while waiting for the player to pick.
    const accent = this.stage.accentColor ?? GAME_CONFIG.accentColor;
    const highlight = this.phase === "player_draw";

    // Stock
    if (this.stock.length > 0) {
      if (highlight) this.drawDrawHighlight(ctx, stockX, y, cw, ch, accent);
      this.drawCardBack(ctx, stockX, y, cw, ch);
      drawTextWithShadow(ctx, `${this.stock.length}`, stockX + cw / 2, y + ch + 28, {
        font: "bold 28px sans-serif",
        color: "#fff",
      });
      drawTextWithShadow(ctx, t("deck"), stockX + cw / 2, y - 24, {
        font: "bold 24px sans-serif",
        color: "#ddd",
      });
    } else {
      this.drawCardSlot(ctx, stockX, y, cw, ch, t("empty"));
    }

    // Discard
    // While the opponent's discard is mid-flight, the top card is being
    // animated above the pile — show the previous top underneath instead.
    const hideTop = this.phase === "opponent_discarding" && !!this.cardAnim;
    const topIdx = hideTop ? this.discardPile.length - 2 : this.discardPile.length - 1;
    const top = topIdx >= 0 ? this.discardPile[topIdx] : undefined;
    if (top) {
      const pos = this.dealOffsetFor(top.id, discardX, y, cw, ch);
      if (pos === null) {
        // Top hasn't dealt-flown yet — show empty slot
        this.drawCardSlot(ctx, discardX, y, cw, ch, t("trash"));
      } else {
        if (highlight) this.drawDrawHighlight(ctx, discardX, y, cw, ch, accent);
        drawCardFace(ctx, top, pos.x, pos.y, cw, ch, false);
      }
    } else {
      this.drawCardSlot(ctx, discardX, y, cw, ch, t("trash"));
    }
    drawTextWithShadow(ctx, t("trash"), discardX + cw / 2, y - 24, {
      font: "bold 24px sans-serif",
      color: "#ddd",
    });
  }

  private drawDrawHighlight(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
  ): void {
    const pulse = 0.5 + 0.5 * Math.sin((this.timeAccum / 1.1) * Math.PI * 2);
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 22 + 18 * pulse;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.globalAlpha = 0.55 + 0.45 * pulse;
    roundRect(ctx, x - 3, y - 3, w + 6, h + 6, 10);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5 + 0.4 * pulse;
    roundRect(ctx, x - 7, y - 7, w + 14, h + 14, 13);
    ctx.stroke();
    ctx.restore();
  }

  private drawStatusArea(ctx: CanvasRenderingContext2D): void {
    const y = 540;
    const text = this.currentStatusText();
    drawTextWithShadow(ctx, text, GAME_W / 2, y, {
      font: "bold 32px sans-serif",
      color: "#fff",
    });

    // Prominent Dross meter — placed high enough to clear the meld banners
    // that float above the player's hand. Player hand top = GAME_H - 220;
    // meld banners stack at y = (GAME_H - 220) - n*(bh+6) for n=0..2 (i.e.
    // 1138 / 1096 / 1054 in screen coords). With h=160 and cy = GAME_H - 430,
    // the meter bottom sits at y = 1050 — clearing even the rare 3-banner
    // stagger at row 2 (1054) by 4px.
    const livePlay =
      this.phase === "player_draw" ||
      this.phase === "player_discard" ||
      this.phase === "opponent_thinking" ||
      this.phase === "opponent_drawing" ||
      this.phase === "opponent_discarding" ||
      this.phase === "opponent_casting";
    if (livePlay) {
      this.drawDrossMeter(ctx, GAME_W / 2, GAME_H - 430);
    }
  }

  /**
   * Large "modern mobile RPG"-style indicator above the player's hand.
   * Layered beveled panel: drop shadow → gradient body → glossy top highlight
   * → accent stroke → metallic inner edge. The bar is a recessed track with a
   * gradient fill, glossy top, and an end-knob marker (so the CURRENT VALUE is
   * always distinguishable from the GOAL line). When dross hits 0 the fill
   * fully vanishes (PURE state). Simulates post-banish during discard.
   */
  private drawDrossMeter(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const pRes = bestMelds(this.playerHand);
    let dross = pRes.deadwoodPoints;
    let isSimulated = false;
    if (this.phase === "player_discard" && this.selectedCardId !== null) {
      const simulated = deadwoodAfterDiscard(this.playerHand, this.selectedCardId);
      dross = simulated.deadwoodPoints;
      isSimulated = true;
    }
    const canCast = dross <= this.knockMax;
    const isPure = dross === 0;

    const accent = isPure ? "#fff7c2" : canCast ? "#ffd84a" : "#9aa3b2";
    const numberColor = isPure ? "#fff7c2" : canCast ? "#ffd84a" : "#ff8a4a";
    const stateLabel = isPure
      ? t("pureReady")
      : canCast
        ? t("castReady")
        : t("castThresholdShort", { n: this.knockMax });

    const w = 660;
    const h = 160;
    const x = cx - w / 2;
    const y = cy - h / 2;

    // ---- Frame (modern beveled panel) ----
    // Outer drop shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = "#0a0612";
    roundRect(ctx, x, y, w, h, 22);
    ctx.fill();
    ctx.restore();

    // Body gradient (top brighter, bottom deeper)
    ctx.save();
    const bodyGrad = ctx.createLinearGradient(0, y, 0, y + h);
    bodyGrad.addColorStop(0, "rgba(56,32,84,0.96)");
    bodyGrad.addColorStop(0.55, "rgba(28,16,46,0.96)");
    bodyGrad.addColorStop(1, "rgba(14,8,26,0.98)");
    ctx.fillStyle = bodyGrad;
    roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 18);
    ctx.fill();
    ctx.restore();

    // Glossy top highlight band
    ctx.save();
    const glossGrad = ctx.createLinearGradient(0, y + 4, 0, y + 44);
    glossGrad.addColorStop(0, "rgba(255,255,255,0.18)");
    glossGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glossGrad;
    roundRect(ctx, x + 8, y + 6, w - 16, 38, 14);
    ctx.fill();
    ctx.restore();

    // Outer accent stroke (glows when CAST-ready)
    ctx.save();
    ctx.strokeStyle = canCast ? accent : "#5a4a78";
    ctx.lineWidth = 3;
    if (canCast) {
      ctx.shadowColor = accent;
      ctx.shadowBlur = 22;
    }
    roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 21);
    ctx.stroke();
    ctx.restore();

    // Inner metallic hairline (defines the bevel)
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1;
    roundRect(ctx, x + 7.5, y + 7.5, w - 15, h - 15, 15);
    ctx.stroke();
    ctx.restore();

    // ---- Content layout ----
    const padX = 28;
    const leftX = x + padX;
    const rightX = x + w - padX;

    // Top row: "残り" label (left) + state label (right)
    drawTextWithShadow(ctx, t("drossLabel"), leftX, y + 22, {
      font: "bold 24px sans-serif",
      color: "#cfd6e2",
      align: "left",
    });
    drawTextWithShadow(ctx, stateLabel, rightX, y + 24, {
      font: "bold 28px sans-serif",
      color: accent,
      align: "right",
      shadowBlur: canCast ? 12 : 6,
      shadowColor: canCast ? accent : "rgba(0,0,0,0.8)",
    });

    // Mid-size dross number (left-aligned, with stroke + glow for impact)
    ctx.save();
    ctx.font = "900 60px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(0,0,0,0.9)";
    ctx.strokeText(`${dross}`, leftX, y + 78);
    if (canCast) {
      ctx.shadowColor = numberColor;
      ctx.shadowBlur = 22;
    }
    ctx.fillStyle = numberColor;
    ctx.fillText(`${dross}`, leftX, y + 78);
    ctx.restore();

    // Sub text right (status detail aligned with the big number)
    let subText: string;
    let subColor: string;
    if (isPure) {
      subText = "✦ CRITICAL ✦";
      subColor = accent;
    } else if (canCast) {
      subText = "✓";
      subColor = accent;
    } else {
      subText = t("pointsToCast", { n: dross - this.knockMax });
      subColor = "#ff8a4a";
    }
    drawTextWithShadow(ctx, subText, rightX, y + 78, {
      font: "bold 26px sans-serif",
      color: subColor,
      align: "right",
    });

    // ---- Progress bar ----
    const barH = 20;
    const barX = leftX;
    const barY = y + h - 34;
    const barW = w - padX * 2;
    const DROSS_BAR_MAX = 70;
    const GOAL_DROSS = 10;
    const goalX = barX + barW * (GOAL_DROSS / DROSS_BAR_MAX);

    // Track (recessed)
    ctx.save();
    const trackGrad = ctx.createLinearGradient(0, barY, 0, barY + barH);
    trackGrad.addColorStop(0, "rgba(0,0,0,0.85)");
    trackGrad.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = trackGrad;
    roundRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fill();
    ctx.restore();

    // Track inner edge
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    roundRect(ctx, barX + 0.5, barY + 0.5, barW - 1, barH - 1, barH / 2);
    ctx.stroke();
    ctx.restore();

    // Bar fill — only when dross > 0 (Codex review: PURE must show empty bar)
    const clamped = Math.max(0, Math.min(DROSS_BAR_MAX, dross));
    if (clamped > 0) {
      const fillW = (clamped / DROSS_BAR_MAX) * barW;
      const fillGrad = ctx.createLinearGradient(0, barY, 0, barY + barH);
      if (canCast) {
        fillGrad.addColorStop(0, "#fff5b5");
        fillGrad.addColorStop(0.5, "#ffd84a");
        fillGrad.addColorStop(1, "#c79a18");
      } else {
        fillGrad.addColorStop(0, "#ffae7a");
        fillGrad.addColorStop(0.5, "#ff5a3a");
        fillGrad.addColorStop(1, "#a02818");
      }
      ctx.save();
      ctx.fillStyle = fillGrad;
      if (canCast) {
        ctx.shadowColor = accent;
        ctx.shadowBlur = 16;
      }
      roundRect(ctx, barX, barY, Math.max(barH, fillW), barH, barH / 2);
      ctx.fill();
      ctx.restore();

      // Glossy top stripe on the fill
      ctx.save();
      const fillGloss = ctx.createLinearGradient(0, barY, 0, barY + barH * 0.55);
      fillGloss.addColorStop(0, "rgba(255,255,255,0.55)");
      fillGloss.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = fillGloss;
      roundRect(ctx, barX + 2, barY + 2, Math.max(barH, fillW) - 4, barH * 0.45, barH / 3);
      ctx.fill();
      ctx.restore();

      // End knob — disambiguates CURRENT VALUE from the gold goal line
      const knobX = barX + Math.max(barH / 2, fillW);
      const knobR = barH * 0.7;
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = canCast ? accent : "rgba(255,90,58,0.85)";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(knobX, barY + barH / 2, knobR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.fillStyle = canCast ? accent : "#ff5a3a";
      ctx.beginPath();
      ctx.arc(knobX, barY + barH / 2, knobR - 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Goal marker — vertical gold tick that visibly extends above and below
    // the track. Shape contrast (line) vs. the round end-knob (circle) keeps
    // GOAL and CURRENT VALUE unambiguous. "10" sits below the bar inside the
    // panel; the ▼ is intentionally omitted to keep the number area uncluttered.
    ctx.save();
    ctx.strokeStyle = "#ffd84a";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#ffd84a";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(goalX, barY - 8);
    ctx.lineTo(goalX, barY + barH + 6);
    ctx.stroke();
    ctx.restore();

    drawTextWithShadow(ctx, "10", goalX, barY + barH + 16, {
      font: "bold 14px sans-serif",
      color: "#ffd84a",
    });

    // "AFTER BANISH" preview pill while a discard is selected
    if (isSimulated) {
      const pillW = 200;
      const pillH = 30;
      const px = cx - pillW / 2;
      const py = y - pillH - 6;
      ctx.save();
      ctx.fillStyle = "rgba(60,40,90,0.92)";
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 10;
      roundRect(ctx, px, py, pillW, pillH, 12);
      ctx.fill();
      ctx.restore();
      drawTextWithShadow(ctx, "↓ AFTER BANISH ↓", cx, py + pillH / 2 + 1, {
        font: "bold 16px sans-serif",
        color: "#ffe080",
      });
    }
  }

  /**
   * Compose the status line shown above the player hand.
   * Resolved-hand state takes priority and is built dynamically from outcome
   * so a mid-match language switch updates immediately.
   */
  private currentStatusText(): string {
    if (this.outcome && (this.phase === "hand_over" || this.phase === "match_over")) {
      const winLabel = this.outcome.winner === "player" ? t("youAttacked") : t("youTookDamage");
      const tag = this.outcome.gin
        ? ` — ${t("pure")}`
        : this.outcome.undercut
          ? ` — ${t("counter")}`
          : "";
      return `${winLabel}${tag} — ${this.outcomeDamage} ${t("damage")}`;
    }
    if (!this.messageKey) return "";
    return t(this.messageKey, this.messageVars);
  }

  private drawPlayerHand(ctx: CanvasRenderingContext2D): void {
    const hand = this.playerHand;
    const total = hand.length;
    if (total === 0) {
      this.playerCardRects = [];
      return;
    }
    // Reserve a margin so the meld halo (+5px) and stroke don't clip the safe
    // area edge — and so 11-card hands (10 cards + just-drawn) still fit.
    const sideMargin = 16;
    const ch = 128;
    let cw = 88;
    let gap = 6;
    const maxHandW = GAME_W - sideMargin * 2;
    const naturalW = cw * total + gap * Math.max(0, total - 1);
    if (naturalW > maxHandW) {
      // Compress the gap (and overlap if necessary) so the entire hand fits.
      // pitch = the centre-to-centre spacing between adjacent cards.
      const pitch = (maxHandW - cw) / (total - 1);
      gap = pitch - cw; // becomes negative when overlap is required
    }
    const totalW = cw * total + gap * Math.max(0, total - 1);
    const startX = (GAME_W - totalW) / 2;
    const baseY = GAME_H - 220;

    // Deal phase: render cards flying from the deck in their dealt order.
    // Skip melds / selection / banner — those are for live play only.
    if (this.phase === "deal") {
      this.playerCardRects = [];
      for (let i = 0; i < total; i++) {
        const card = hand[i];
        const slotX = startX + i * (cw + gap);
        const pos = this.dealOffsetFor(card.id, slotX, baseY, cw, ch);
        if (pos === null) continue;
        drawCardFace(ctx, card, pos.x, pos.y, cw, ch, false);
      }
      return;
    }

    // Detect melds and assign each meld an element-matched palette.
    const bestMeld = bestMelds(hand);
    const meldPalettes = bestMeld.melds.map(meldPaletteFor);
    const meldByCardId = new Map<number, { idx: number; meld: Card[] }>();
    bestMeld.melds.forEach((m, idx) => {
      m.forEach((c) => meldByCardId.set(c.id, { idx, meld: m }));
    });

    // Display order: meld cards (grouped by meld idx) on the left, deadwood
    // next, and the just-drawn card pinned to the very right edge so the
    // player can immediately see what they just picked up. Within each group
    // the original sortHand order is preserved.
    //
    // EXCEPTION: when the just-drawn card is itself part of a meld, keep it
    // grouped with its meld instead of pinning it to the right. Splitting it
    // off would stretch the meld banner across the full hand width and make
    // its position jump around between turns.
    const drawnInMeld =
      this.lastDrawnCardId !== null && meldByCardId.has(this.lastDrawnCardId);
    const displayHand: Card[] = [];
    bestMeld.melds.forEach((m) => {
      for (const c of m) {
        if (drawnInMeld || c.id !== this.lastDrawnCardId) displayHand.push(c);
      }
    });
    for (const c of hand) {
      if (c.id !== this.lastDrawnCardId && !meldByCardId.has(c.id)) {
        displayHand.push(c);
      }
    }
    if (this.lastDrawnCardId !== null && !drawnInMeld) {
      const drawn = hand.find((c) => c.id === this.lastDrawnCardId);
      if (drawn) displayHand.push(drawn);
    }

    // Build per-meld pulse phase (for sparkle pulse based on time)
    const pulse = 0.5 + 0.5 * Math.sin(this.timeAccum * 4);

    this.playerCardRects = [];
    const meldRectsByIdx: Array<Array<{ x: number; y: number }>> = [];
    for (let i = 0; i < total; i++) {
      const c = displayHand[i];
      const selected = c.id === this.selectedCardId;
      const x = startX + i * (cw + gap);
      const y = selected ? baseY - 22 : baseY;
      this.playerCardRects.push({ id: c.id, rect: { x, y, w: cw, h: ch } });

      const meldInfo = meldByCardId.get(c.id);
      if (meldInfo) {
        const palette = meldPalettes[meldInfo.idx];
        // Glow halo behind card
        ctx.save();
        ctx.shadowColor = palette.glow;
        ctx.shadowBlur = 18 + 8 * pulse;
        ctx.fillStyle = palette.fill;
        roundRect(ctx, x - 5, y - 5, cw + 10, ch + 10, 12);
        ctx.fill();
        ctx.restore();
        // Bright border on top of card area
        ctx.save();
        ctx.strokeStyle = palette.glow;
        ctx.lineWidth = 3;
        roundRect(ctx, x - 1, y - 1, cw + 2, ch + 2, 9);
        ctx.stroke();
        ctx.restore();

        if (!meldRectsByIdx[meldInfo.idx]) meldRectsByIdx[meldInfo.idx] = [];
        meldRectsByIdx[meldInfo.idx].push({ x, y });
      }

      drawCardFace(ctx, c, x, y, cw, ch, selected);
    }

    // Build per-meld banner geometry first (label + fitted width + base x),
    // then stagger vertically when adjacent banners overlap horizontally so
    // labels never collide.
    const bh = 36;
    const bannerFont = "bold 22px sans-serif";
    type BannerInfo = { idx: number; bx: number; bw: number; by: number; label: string };
    const banners: BannerInfo[] = [];

    ctx.save();
    ctx.font = bannerFont;
    bestMeld.melds.forEach((meld, idx) => {
      const cards = meldRectsByIdx[idx];
      if (!cards || cards.length === 0) return;
      const minX = Math.min(...cards.map((p) => p.x));
      const maxX = Math.max(...cards.map((p) => p.x)) + cw;
      const topY = Math.min(...cards.map((p) => p.y));

      const isSet = meld.every((c) => c.rank === meld[0].rank);
      const label = `★ ${t(isSet ? "coven" : "cascade")} ×${meld.length}`;
      // Fit the banner to the label so it never grows wider than necessary,
      // which gives sibling banners more room to breathe.
      const textW = ctx.measureText(label).width;
      const bw = Math.ceil(textW + 28);
      // Centre over the meld, then clamp inside the safe area so labels never
      // get clipped on either edge of narrow viewports.
      const rawBx = (minX + maxX) / 2 - bw / 2;
      const bx = Math.max(8, Math.min(GAME_W - bw - 8, rawBx));
      banners.push({ idx, bx, bw, by: topY - bh - 6, label });
    });
    ctx.restore();

    // Stagger by adjusting `by` so adjacent banners with overlapping x-ranges
    // sit on separate rows. Iterate left-to-right; each banner picks the
    // lowest row that doesn't horizontally overlap any banner already on it.
    const rowOccupancy: Array<Array<{ bx: number; bw: number }>> = [];
    banners
      .slice()
      .sort((a, b) => a.bx - b.bx)
      .forEach((b) => {
        let row = 0;
        while (true) {
          const used = rowOccupancy[row] ?? [];
          const overlaps = used.some((r) => b.bx < r.bx + r.bw + 6 && b.bx + b.bw + 6 > r.bx);
          if (!overlaps) {
            if (!rowOccupancy[row]) rowOccupancy[row] = [];
            rowOccupancy[row].push({ bx: b.bx, bw: b.bw });
            // Lift each new row above the cards by an extra (bh + 6).
            b.by -= row * (bh + 6);
            break;
          }
          row++;
        }
      });

    banners.forEach((b) => {
      const palette = meldPalettes[b.idx];
      ctx.save();
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = 12;
      ctx.fillStyle = palette.glow;
      roundRect(ctx, b.bx, b.by, b.bw, bh, 8);
      ctx.fill();
      ctx.restore();

      drawTextWithShadow(ctx, b.label, b.bx + b.bw / 2, b.by + bh / 2, {
        font: bannerFont,
        color: "#fff",
        shadowBlur: 2,
      });
    });
  }

  /** Card back: arcane medallion artwork clipped to a rounded card silhouette. */
  private drawCardBack(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    ctx.save();

    // Drop shadow
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    roundRect(ctx, x + 2, y + 3, w, h, 6);
    ctx.fill();

    {
      // Pure-CSS card back: navy/gold royal medallion (no external asset).
      const cx = x + w / 2;
      const cy = y + h / 2;
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(w, h));
      grad.addColorStop(0, "#3b1f5c");
      grad.addColorStop(0.6, "#1a0d2c");
      grad.addColorStop(1, "#0a0512");
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, w, h, 6);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawCardSlot(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string): void {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(label, x + w / 2, y + h / 2);
    ctx.restore();
  }

  // drawCardFace was extracted to ../ui/card-face for tutorial reuse.

  /**
   * Modal asking the player to commit to a CAST after the discard, or pass
   * the turn. Shown only when the post-discard hand is knock-eligible
   * (deadwood ≤ 10).
   */
  private drawCastPromptOverlay(ctx: CanvasRenderingContext2D): void {
    const after = bestMelds(this.playerHand);
    const isPure = after.deadwoodPoints === 0;
    drawDialog(ctx, {
      x: DIALOG_PANEL_X,
      y: DIALOG_PANEL_Y,
      w: DIALOG_PANEL_W,
      h: DIALOG_PANEL_H,
      headerTag: t("cast"),
      headerColor: "#ffd54a",
      title: t("castPromptTitle"),
      titleColor: "#ffd54a",
      subtitle: isPure
        ? t("pure")
        : t("pointsLabel", { points: after.deadwoodPoints }),
      subtitleColor: isPure ? "#ffe18a" : "#fff",
    });
    this.castPassBtn.draw(ctx);
    this.castConfirmBtn.draw(ctx);
  }

  private drawHandOverOverlay(ctx: CanvasRenderingContext2D): void {
    const out = this.outcome;
    const playerWon = !!out && out.winner === "player";
    let title: string;
    let titleColor: string;
    let headerTag: string;
    let headerColor: string;
    let subtitle: string | undefined;
    let body: string[] = [];

    if (out) {
      title = playerWon ? t("attackResult") : t("damageResult");
      titleColor = playerWon ? "#4affd6" : "#ff5f6e";
      headerTag = playerWon ? t("victory") : t("defeat");
      headerColor = playerWon ? "#4affd6" : "#ff5f6e";
      subtitle = out.gin
        ? t("pure")
        : out.undercut
          ? t("counterspell")
          : t("cast");
      body = [
        t("resultDetails", {
          self: out.playerDeadwood,
          opp: out.opponentDeadwood,
          dmg: this.outcomeDamage,
        }),
      ];
    } else {
      title = t("roundDraw");
      titleColor = "#fff";
      headerTag = t("nextRound");
      headerColor = GAME_CONFIG.accentColor;
    }

    drawDialog(ctx, {
      x: DIALOG_PANEL_X,
      y: DIALOG_PANEL_Y,
      w: DIALOG_PANEL_W,
      h: DIALOG_PANEL_H,
      headerTag,
      headerColor,
      title,
      titleColor,
      subtitle,
      subtitleColor: "#ffd54a",
      body,
    });

    const playerVictory =
      this.playerWins >= WINS_TO_VICTORY || this.opponentHp <= 0;
    this.nextHandBtn.label =
      this.phase === "match_over"
        ? playerVictory
          ? t("victory")
          : t("defeat")
        : t("nextRound");
    this.nextHandBtn.draw(ctx);
  }

  // ---------- Input ----------

  onPointerDown(e: PointerInfo): void {
    if (this.phase === "hand_over" || this.phase === "match_over") {
      this.nextHandBtn.handlePointerDown(e);
      return;
    }
    if (this.phase === "cast_prompt") {
      this.castConfirmBtn.handlePointerDown(e);
      this.castPassBtn.handlePointerDown(e);
      return;
    }
  }

  onPointerMove(e: PointerInfo): void {
    this.castConfirmBtn.handlePointerMove(e);
    this.castPassBtn.handlePointerMove(e);
    this.nextHandBtn.handlePointerMove(e);
  }

  onPointerUp(e: PointerInfo): void {
    if (this.phase === "hand_over" || this.phase === "match_over") {
      if (this.nextHandBtn.handlePointerUp(e)) {
        this.onNextHand();
      }
      return;
    }

    if (this.phase === "cast_prompt") {
      if (this.castConfirmBtn.handlePointerUp(e)) {
        this.onCastConfirmed();
        return;
      }
      if (this.castPassBtn.handlePointerUp(e)) {
        this.onCastDeclined();
        return;
      }
      return;
    }

    if (this.phase === "player_draw") {
      if (this.pointInRect(e, this.stockRect)) {
        this.onDrawStock();
      } else if (this.pointInRect(e, this.discardRect) && this.discardPile.length > 0) {
        this.onDrawDiscard();
      }
      return;
    }

    if (this.phase === "player_discard") {
      for (const rc of this.playerCardRects) {
        if (this.pointInRect(e, rc.rect)) {
          if (this.selectedCardId === rc.id) {
            // Second tap on same card = discard it
            this.onDiscardCard(rc.id);
          } else {
            this.selectedCardId = rc.id;
          }
          return;
        }
      }
    }
  }

  onKeyDown(key: string): void {
    if ((this.phase === "hand_over" || this.phase === "match_over") && (key === " " || key === "Enter")) {
      this.onNextHand();
    }
    if (__DEV__) {
      // Dev cheats
      if (key === "w") {
        this.opponentHp = 0;
        this.playerWins = WINS_TO_VICTORY;
        this.phase = "match_over";
        this.setMessage("");
      } else if (key === "l") {
        this.playerHp = 0;
        this.opponentWins = WINS_TO_VICTORY;
        this.phase = "match_over";
        this.setMessage("");
      } else if (key === "g") {
        // Cheat: instant gin hand — 4-set + two 3-runs (deadwood 0).
        // Jumps straight to cast_prompt so a CAST tap resolves as PURE.
        // IDs start at 100 to avoid colliding with the live deck (0-51).
        this.playerHand = [
          { id: 100, suit: 0, rank: 5 },
          { id: 101, suit: 1, rank: 5 },
          { id: 102, suit: 2, rank: 5 },
          { id: 103, suit: 3, rank: 5 },
          { id: 104, suit: 0, rank: 7 },
          { id: 105, suit: 0, rank: 8 },
          { id: 106, suit: 0, rank: 9 },
          { id: 107, suit: 1, rank: 10 },
          { id: 108, suit: 1, rank: 11 },
          { id: 109, suit: 1, rank: 12 },
        ];
        this.lastDrawnCardId = null;
        this.selectedCardId = null;
        this.phase = "cast_prompt";
        this.setMessage("");
      }
    }
  }

  private pointInRect(p: PointerInfo, r: Rect): boolean {
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }
}
