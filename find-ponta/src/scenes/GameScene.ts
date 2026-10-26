import Phaser from "phaser";
import { STAGES } from "../game/stages";
import { generateScene } from "../game/spawn";
import { entityCenter, hitDistance } from "../game/geometry";
import { mulberry32, rngRange } from "../game/rng";
import {
  BONUS_SCORE, BONUS_TIME, FRIEND_TIME, TREASURE_TIME, HINT_DURATION, computeStars, hintRadius, missPenaltySeconds,
  scoreBreakdown, type MissKind,
} from "../game/score";
import { markCleared, randomSeed, submitBest, type Difficulty, type GameStartData, type ResultData } from "../game/save";
import { registerGameApi } from "../game/debug";
import type { Entity, SceneLayout, StageDef, TapResult } from "../game/types";
import { t } from "../i18n";
import {
  playBonusFound, playFail, playFoundFanfare, playHint, playTapMiss, playTapWrongDecoy,
  playTapWrongMob, playTimerTick,
} from "../core/sfx";
import { playBgm } from "../core/bgm";
import { openSettings } from "../ui/common";
import { CameraRig } from "./game/CameraRig";
import { GestureInput } from "./game/GestureInput";
import { Hud } from "./game/Hud";
import { showFriends, showIntro, showPause, showPoster } from "./game/Modals";
import { WorldView } from "./game/WorldView";
import { createGameApi } from "./game/gameApi";

export type Phase = "intro" | "playing" | "paused" | "cleared" | "failed";
type KeyMap = Record<"w" | "a" | "s" | "d" | "up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;

export class GameScene extends Phaser.Scene {
  stage!: StageDef;
  difficulty: Difficulty = "normal";
  /** HARD 以上: キャラが動く + ポンタのほかになかまも探す */
  hard = false;
  /** EXTREME: さらに隠された宝物を全部探す */
  extreme = false;
  /** 制限時間・ヒント回数（HARD はなかまの数だけ増える） */
  timeLimit = 0;
  hintMax = 0;
  seed = 0;
  layout!: SceneLayout;
  phase: Phase = "intro";
  timeLeft = 0;
  misses = 0;
  hintsUsed = 0;
  score = 0;
  found = new Set<number>();
  /** HARD 以上: 見つけたなかま・宝物の id と、ポンタを見つけたか */
  foundExtras = new Set<number>();
  pontaFound = false;
  rig!: CameraRig;
  hud!: Hud;
  world!: WorldView;
  private gestures!: GestureInput;
  private hudCam!: Phaser.Cameras.Scene2D.Camera;
  private hintLeft = 0;
  private lastTickSec = -1;
  private modalFn: (() => void) | null = null;
  private keys: KeyMap | null = null;
  private lastResult: ResultData | null = null;

  constructor() {
    super("Game");
  }

  create(data: GameStartData): void {
    const d: GameStartData = data && data.stage ? data : { stage: 1, seed: randomSeed() };
    this.stage = STAGES[Math.max(0, Math.min(STAGES.length - 1, d.stage - 1))];
    this.difficulty = d.difficulty ?? "normal";
    this.hard = this.difficulty !== "normal";
    this.extreme = this.difficulty === "extreme";
    this.seed = d.seed;
    this.layout = generateScene(this.stage, this.seed, this.hard, this.extreme);
    const nf = this.layout.friends.length;
    const nt = this.layout.treasures.length;
    this.timeLimit = this.stage.timeLimit + nf * FRIEND_TIME + nt * TREASURE_TIME;
    this.hintMax = this.stage.hints + (nf > 0 ? 1 : 0) + (nt > 0 ? 1 : 0);
    this.phase = "intro";
    this.timeLeft = this.timeLimit;
    this.misses = 0;
    this.hintsUsed = 0;
    this.score = 0;
    this.found = new Set<number>();
    this.foundExtras = new Set<number>();
    this.pontaFound = false;
    this.hintLeft = 0;
    this.lastTickSec = -1;
    this.modalFn = null;
    this.lastResult = null;

    const w = this.scale.width;
    const h = this.scale.height;
    this.world = new WorldView(this, this.stage, this.layout, this.hard);
    this.hud = new Hud(this, this.stage, this.extras().map((f) => f.tex), {
      zoomIn: () => this.zoomBy(1.3),
      zoomOut: () => this.zoomBy(1 / 1.3),
      hint: () => this.useHint(),
      pause: () => this.pause(),
      poster: () => this.openPoster(),
      friends: () => this.openFriends(),
    });
    this.hudCam = this.cameras.add(0, 0, w, h);
    this.cameras.main.ignore(this.hud.layer);
    this.hudCam.ignore(this.world.layer);
    this.rig = new CameraRig(this.cameras.main);
    this.rig.setView(Math.max(this.rig.minZoom, 0.75), 1152, 768);

    this.gestures = new GestureInput(this, this.rig, {
      enabled: () => this.phase === "playing",
      onTap: (sx, sy) => {
        const p = this.rig.screenToWorld(sx, sy);
        this.handleTap(p.x, p.y, Math.min(60, 22 / this.rig.zoom));
      },
    });
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.hud.press(p.x, p.y)) return;
      this.gestures.down(p);
    });
    this.setupKeys();

    this.hud.build();
    this.showModal(() => showIntro(this.hud, this.stage, this.info(), () => this.startPlay()));
    playBgm(this.stage.night ? "night" : "day");
    this.cameras.main.fadeIn(250, 0, 0, 0);

    const onResize = (): void => this.onResize();
    this.scale.on("resize", onResize);
    const onResume = (): void => {
      this.hud.build();
      if (this.modalFn) this.modalFn();
    };
    this.events.on("resume", onResume);
    registerGameApi(createGameApi(this));
    this.events.once("shutdown", () => {
      this.scale.off("resize", onResize);
      this.events.off("resume", onResume);
      registerGameApi(null);
      this.world.clearHint();
    });
  }

  private setupKeys(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.keys = kb.addKeys({
      w: "W", a: "A", s: "S", d: "D", up: "UP", down: "DOWN", left: "LEFT", right: "RIGHT",
    }) as KeyMap;
    kb.on("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (this.phase === "playing") this.pause();
        else if (this.phase === "paused") this.resumePlay();
      } else if (e.key === "h" || e.key === "H") this.useHint();
      else if (e.key === "+" || e.key === "=") this.zoomBy(1.3);
      else if (e.key === "-" || e.key === "_") this.zoomBy(1 / 1.3);
    });
  }

  private showModal(fn: () => void): void {
    this.modalFn = fn;
    fn();
  }

  private clearModal(): void {
    this.modalFn = null;
    this.hud.clearModal();
  }

  private onResize(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.hudCam.setSize(w, h);
    this.rig.setViewport(w, h);
    this.hud.build();
    if (this.modalFn) this.modalFn();
  }

  startPlay(): void {
    if (this.phase !== "intro") return;
    this.clearModal();
    this.phase = "playing";
  }

  private pause(): void {
    if (this.phase !== "playing") return;
    this.phase = "paused";
    this.gestures.cancelAll();
    this.showModal(() => showPause(this.hud, {
      resume: () => this.resumePlay(),
      settings: () => openSettings(this, true),
      quit: () => this.scene.start("StageSelect"),
    }));
  }

  /** 手配書の拡大表示。表示中は時間を止める（pause と同じ扱い）。 */
  private openPoster(): void {
    if (this.phase !== "playing") return;
    this.phase = "paused";
    this.gestures.cancelAll();
    this.showModal(() => showPoster(this.hud, this.extras().map((f) => f.tex), () => this.resumePlay()));
  }

  /** HARD: いっしょにさがすなかまの拡大表示（手配書と同じく時間を止める）。 */
  private openFriends(): void {
    if (this.phase !== "playing" || this.extras().length === 0) return;
    this.phase = "paused";
    this.gestures.cancelAll();
    this.showModal(() => showFriends(
      this.hud, this.extras().map((f) => ({ tex: f.tex, found: this.foundExtras.has(f.id) })), () => this.resumePlay(),
    ));
  }

  private resumePlay(): void {
    if (this.phase !== "paused") return;
    this.clearModal();
    this.phase = "playing";
  }

  private zoomBy(f: number): void {
    if (this.phase !== "playing") return;
    this.rig.zoomTo(this.rig.zoom * f, this.rig.viewW / 2, this.rig.viewH / 2);
  }

  private useHint(): void {
    if (this.phase !== "playing" || this.hintsUsed >= this.hintMax) return;
    const r = hintRadius(this.hintsUsed);
    const rng = mulberry32((this.seed * 31 + this.hintsUsed * 977 + 7) >>> 0);
    const ang = rngRange(rng, 0, Math.PI * 2);
    const off = r * rngRange(rng, 0.25, 0.7);
    // まだ見つけていないもの（ポンタ/なかま）からランダムに1つ示す
    const left = this.remainingTargets();
    const target = left[Math.floor(rng() * left.length)] ?? this.layout.ponta;
    const pc = entityCenter(target, this.stage);
    const cx = pc.x + Math.cos(ang) * off;
    const cy = pc.y + Math.sin(ang) * off;
    this.hintsUsed++;
    this.hintLeft = HINT_DURATION;
    this.world.showHint(cx, cy, r);
    playHint();
    const s = this.rig.worldToScreen(cx, cy);
    if (s.x < 40 || s.y < 80 || s.x > this.rig.viewW - 40 || s.y > this.rig.viewH - 40) {
      this.rig.moveTo(this.rig.zoom, cx, cy, 500);
    }
  }

  /** 世界座標のタップ判定。hit した種別を返す。 */
  handleTap(wx: number, wy: number, radius: number): TapResult {
    if (this.phase !== "playing") return "empty";
    const L = this.layout;
    const best = (list: Entity[]): Entity | null => {
      let b: Entity | null = null;
      let bd = 1;
      for (const e of list) {
        const d = hitDistance(e, this.stage, wx, wy, radius, this.hard);
        if (d <= bd) { bd = d; b = e; }
      }
      return b;
    };
    const bonus = best(L.bonuses.filter((e) => !this.found.has(e.id)));
    if (bonus) {
      this.collectBonus(bonus);
      return "bonus";
    }
    const extra = best(this.extras().filter((e) => !this.foundExtras.has(e.id)));
    if (extra) {
      this.collectExtra(extra);
      return extra.kind === "treasure" ? "treasure" : "friend";
    }
    if (hitDistance(L.ponta, this.stage, wx, wy, radius, this.hard) <= 1 && !this.pontaFound) {
      this.pontaFound = true;
      if (this.allFound()) this.clearStage(L.ponta);
      else this.markFound(L.ponta, t("pontaFound"));
      return "ponta";
    }
    const decoy = best(L.decoys);
    const mob = best(L.mobs);
    const dd = decoy ? hitDistance(decoy, this.stage, wx, wy, radius, this.hard) : 2;
    const md = mob ? hitDistance(mob, this.stage, wx, wy, radius, this.hard) : 2;
    // 見つけ済みのポンタ/なかまを押し直しても、ミスにはしない
    const done = best([...L.friends.filter((e) => this.foundExtras.has(e.id)), ...(this.pontaFound ? [L.ponta] : [])]);
    if (done && hitDistance(done, this.stage, wx, wy, radius, this.hard) <= Math.min(dd, md)) return "empty";
    const junk = best(L.junk);
    const jd = junk ? hitDistance(junk, this.stage, wx, wy, radius, this.hard) : 2;
    if (junk && jd < Math.min(dd, md)) { this.miss("mob", wx, wy); return "junk"; }
    if (decoy && dd <= md) { this.miss("decoy", wx, wy); return "decoy"; }
    if (mob) { this.miss("mob", wx, wy); return "mob"; }
    this.miss("empty", wx, wy);
    return "empty";
  }

  /** ポンタ（見つけ済みなら除く）となかまのうち、まだ見つけていないもの */
  remainingTargets(): Entity[] {
    return [
      ...(this.pontaFound ? [] : [this.layout.ponta]),
      ...this.extras().filter((e) => !this.foundExtras.has(e.id)),
    ];
  }

  /** ポンタのほかに探すもの（HARD=なかま、EXTREME=なかま+宝物） */
  private extras(): Entity[] {
    return [...this.layout.friends, ...this.layout.treasures];
  }

  private foundOf(list: Entity[]): number {
    return list.filter((e) => this.foundExtras.has(e.id)).length;
  }

  private allFound(): boolean {
    return this.pontaFound && this.foundExtras.size >= this.extras().length;
  }

  private info(): { timeLimit: number; hints: number; friends: string[]; junk: boolean } {
    return {
      timeLimit: this.timeLimit, hints: this.hintMax, friends: this.extras().map((f) => f.tex),
      junk: this.layout.junk.length > 0,
    };
  }

  /** 見つけた印をつけて止める（全部そろうまでの途中経過） */
  private markFound(e: Entity, text: string): void {
    this.world.markFound(e);
    this.toastLeft(text);
  }

  private toastLeft(text: string): void {
    this.hud.toast(`${text}  ${t("remaining")} ${this.remainingTargets().length}`, "#9af0a8", this.hud.h * 0.34);
    playBonusFound();
  }

  private collectExtra(e: Entity): void {
    this.foundExtras.add(e.id);
    if (e.kind === "treasure") this.world.removeBonus(e);
    if (this.allFound()) this.clearStage(e);
    else if (e.kind === "treasure") this.toastLeft(t("treasureFound"));
    else this.markFound(e, t("friendFound"));
  }

  private collectBonus(e: Entity): void {
    this.found.add(e.id);
    this.timeLeft += BONUS_TIME;
    this.world.removeBonus(e);
    this.hud.toast(`+${BONUS_TIME}s  +${BONUS_SCORE}`, "#ffd966");
    playBonusFound();
  }

  private miss(kind: MissKind, wx: number, wy: number): void {
    this.misses++;
    const sec = missPenaltySeconds(kind);
    this.timeLeft -= sec;
    this.world.missMark(wx, wy, this.rig.zoom);
    this.hud.toast(`-${sec}s`, "#ff7a7a");
    this.cameras.main.shake(120, 0.003);
    if (kind === "empty") playTapMiss();
    else if (kind === "mob") playTapWrongMob();
    else playTapWrongDecoy();
    if (this.timeLeft <= 0) this.failStage();
  }

  private buildResult(cleared: boolean): ResultData {
    const bonusTotal = this.layout.bonuses.length;
    const bd = scoreBreakdown({
      timeLeft: cleared ? this.timeLeft : 0, bonus: this.found.size, friends: this.foundOf(this.layout.friends),
      treasures: this.foundOf(this.layout.treasures),
      misses: this.misses, hints: this.hintsUsed,
    });
    const stars = cleared
      ? computeStars({ misses: this.misses, hints: this.hintsUsed, timeLeft: this.timeLeft, timeLimit: this.timeLimit })
      : 0;
    return {
      stage: this.stage.id, seed: this.seed, difficulty: this.difficulty, cleared,
      timeLeft: Math.max(0, this.timeLeft), misses: this.misses, hints: this.hintsUsed,
      bonusFound: this.found.size, bonusTotal,
      friendFound: this.foundOf(this.layout.friends), friendTotal: this.layout.friends.length,
      treasureFound: this.foundOf(this.layout.treasures), treasureTotal: this.layout.treasures.length,
      missedBonus: this.layout.bonuses.filter((b) => !this.found.has(b.id)).map((b) => b.tex),
      score: cleared ? bd.total : 0, stars, newBest: false, breakdown: bd,
    };
  }

  /** last: 最後に見つけたキャラ（ポンタとは限らない）。ジャンプとカメラはそのキャラに向ける。 */
  private clearStage(last: Entity): void {
    this.phase = "cleared";
    this.world.freeze(last);
    this.world.clearHint();
    const res = this.buildResult(true);
    this.score = res.score;
    markCleared(this.stage.id);
    res.newBest = submitBest(this.stage.id, { score: res.score, stars: res.stars }, this.difficulty);
    this.lastResult = res;
    playFoundFanfare();
    this.world.jump(last);
    const pc = entityCenter(last, this.stage);
    this.rig.moveTo(Math.max(this.rig.zoom, 1.3), pc.x, pc.y, 600);
    this.hud.banner(t(this.hard ? "allFound" : "found"), "#ffd966");
    this.hud.confetti();
    this.time.delayedCall(2600, () => this.toResult());
  }

  private failStage(): void {
    this.timeLeft = 0;
    this.phase = "failed";
    this.world.freeze(this.layout.ponta);
    this.world.clearHint();
    this.lastResult = this.buildResult(false);
    playFail();
    // 見つけられなかったもの（HARD ではなかまも）の位置を示す
    const left = this.remainingTargets();
    const pc = entityCenter(left[0] ?? this.layout.ponta, this.stage);
    this.rig.moveTo(Math.max(this.rig.zoom, 1.2), pc.x, pc.y, 700);
    for (const e of left) {
      const c = entityCenter(e, this.stage);
      this.world.pulseRing(c.x, c.y, this.stage.height * 0.7);
    }
    this.hud.banner(t("timeUp"), "#ff7a7a");
    this.hud.toast(t("here"), "#ffffff", this.hud.h * 0.5);
    this.modalFn = null;
    this.hud.addButton("results", this.hud.w / 2, this.hud.h - 60, 200, 52, t("next"), 0xd4892a,
      () => this.toResult(), () => true, true, 22);
    this.time.delayedCall(3600, () => this.toResult());
  }

  private toResult(): void {
    if (!this.lastResult || !this.scene.isActive("Game")) return;
    const r = this.lastResult;
    this.lastResult = null;
    this.scene.start("Result", r);
  }

  update(time: number, delta: number): void {
    this.world.update(time / 1000);
    this.rig.update(delta);
    this.panByKeys(delta);
    if (this.phase === "playing" && !document.hidden) {
      const dt = Math.min(delta, 100) / 1000;
      this.timeLeft -= dt;
      if (this.hintLeft > 0) {
        this.hintLeft -= dt;
        if (this.hintLeft <= 0) this.world.clearHint();
      }
      const sec = Math.ceil(this.timeLeft);
      if (this.timeLeft <= 10 && sec !== this.lastTickSec && sec > 0) playTimerTick();
      this.lastTickSec = sec;
      if (this.timeLeft <= 0) this.failStage();
    }
    this.hud.setHintEnabled(this.phase === "playing" && this.hintsUsed < this.hintMax);
    this.hud.update({
      timeLeft: Math.max(0, this.timeLeft), misses: this.misses,
      hintsLeft: this.hintMax - this.hintsUsed, bonusFound: this.found.size,
      bonusTotal: this.layout.bonuses.length,
      pontaFound: this.pontaFound,
      friendsFound: this.extras().map((f) => this.foundExtras.has(f.id)),
    });
  }

  private panByKeys(delta: number): void {
    const k = this.keys;
    if (!k || this.phase !== "playing") return;
    const sp = (700 * Math.min(delta, 100)) / 1000;
    const dx = (k.left.isDown || k.a.isDown ? 1 : 0) - (k.right.isDown || k.d.isDown ? 1 : 0);
    const dy = (k.up.isDown || k.w.isDown ? 1 : 0) - (k.down.isDown || k.s.isDown ? 1 : 0);
    if (dx !== 0 || dy !== 0) this.rig.panByScreen(dx * sp, dy * sp);
  }
}
