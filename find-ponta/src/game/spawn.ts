// 配置ロジック（Phaser 非依存の純関数）。Node からも import して検証できる。
import { mulberry32, rngRange, shuffle, type Rng } from "./rng";
import { WALK_POLYGONS } from "./stages";
import {
  entityBox, entityCenter, isInFront, pointInPolygon, visibleFraction,
} from "./geometry";
import { applyMotions, cancelMotion } from "./motion";
import {
  WORLD_H, WORLD_W,
  type Entity, type EntityKind, type Point, type SceneLayout, type StageDef,
} from "./types";

export const EDGE_MARGIN = 80;
export const CENTER_MIN_DIST = 250;
export const NEAR_RADIUS = 600;
const MAX_TRIES = 600;
const MAX_ATTEMPTS = 5;
/** 検証時の誤差吸収用マージン */
const VIS_MARGIN = 0.02;
const BONUS_MIN_VISIBLE = 0.6;
/** なかまはポンタ同様に必須の探し物。動いても下限を割らないよう余裕を持たせる */
const FRIEND_VIS_MARGIN = 0.04;
const DIST_MARGIN = 12;

interface Protected {
  e: Entity;
  min: number;
}

interface Ctx {
  stage: StageDef;
  rng: Rng;
  poly: Point[];
  all: Entity[];
  prot: Protected[];
  nextId: number;
}

function overlaps(a: ReturnType<typeof entityBox>, b: ReturnType<typeof entityBox>): boolean {
  return a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
}

function accept(ctx: Ctx, cand: Entity, selfMin: number): boolean {
  const gap = ctx.stage.minGap;
  for (const o of ctx.all) {
    const dx = o.x - cand.x;
    const dy = o.y - cand.y;
    if (dx * dx + dy * dy < gap * gap) return false;
  }
  const cb = entityBox(cand, ctx.stage);
  let withCand: Entity[] | null = null;
  for (const p of ctx.prot) {
    if (!isInFront(cand, p.e) || !overlaps(cb, entityBox(p.e, ctx.stage))) continue;
    withCand = withCand ?? [...ctx.all, cand];
    if (visibleFraction(p.e, withCand, ctx.stage) < p.min) return false;
  }
  if (selfMin > 0 && visibleFraction(cand, ctx.all, ctx.stage) < selfMin) return false;
  return true;
}

function randomPoint(ctx: Ctx): Point {
  return {
    x: rngRange(ctx.rng, EDGE_MARGIN, WORLD_W - EDGE_MARGIN),
    y: rngRange(ctx.rng, EDGE_MARGIN, WORLD_H - EDGE_MARGIN),
  };
}

function place(
  ctx: Ctx,
  kind: EntityKind,
  tex: string,
  sampler: (c: Ctx) => Point,
  extra?: (e: Entity) => boolean,
  selfMin = 0,
): Entity | null {
  for (let i = 0; i < MAX_TRIES; i++) {
    const p = sampler(ctx);
    if (p.x < EDGE_MARGIN || p.x > WORLD_W - EDGE_MARGIN) continue;
    if (p.y < EDGE_MARGIN || p.y > WORLD_H - EDGE_MARGIN) continue;
    if (!pointInPolygon(p.x, p.y, ctx.poly)) continue;
    const e: Entity = {
      id: ctx.nextId, kind, tex, x: p.x, hx: p.x, y: p.y, pose: "front",
      flip: ctx.rng() < 0.5,
      scale: kind === "bonus" ? 1 : rngRange(ctx.rng, 0.9, 1.1),
    };
    if (extra && !extra(e)) continue;
    if (!accept(ctx, e, selfMin)) continue;
    ctx.nextId++;
    ctx.all.push(e);
    return e;
  }
  return null;
}

function isPontaPosOk(ctx: Ctx, e: Entity): boolean {
  const c = entityCenter(e, ctx.stage);
  const cx = WORLD_W / 2;
  const cy = WORLD_H / 2;
  if (Math.hypot(e.x - cx, e.y - cy) < CENTER_MIN_DIST + DIST_MARGIN) return false;
  if (Math.hypot(c.x - cx, c.y - cy) < CENTER_MIN_DIST + DIST_MARGIN) return false;
  return c.x >= EDGE_MARGIN && c.x <= WORLD_W - EDGE_MARGIN && c.y >= EDGE_MARGIN;
}

/** 足元・中心の両方でポンタとの距離を測る（最小値/最大値）。 */
function pontaDistances(ctx: Ctx, ponta: Entity, e: Entity): { min: number; max: number } {
  const a = Math.hypot(e.x - ponta.x, e.y - ponta.y);
  const pc = entityCenter(ponta, ctx.stage);
  const ec = entityCenter(e, ctx.stage);
  const b = Math.hypot(ec.x - pc.x, ec.y - pc.y);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

function generateOnce(stage: StageDef, seed: number, hard: boolean): Omit<SceneLayout, "usedSeed" | "attempt"> | null {
  const rng = mulberry32(seed);
  const poly = WALK_POLYGONS[stage.bg].map((p) => ({ x: p.x * WORLD_W, y: p.y * WORLD_H }));
  const ctx: Ctx = { stage, rng, poly, all: [], prot: [], nextId: 1 };

  const ponta = place(ctx, "ponta", "ponta", randomPoint, (e) => isPontaPosOk(ctx, e));
  if (!ponta) return null;
  ctx.prot.push({ e: ponta, min: stage.minVisible + VIS_MARGIN });

  const decoys: Entity[] = [];
  const near = (c: Ctx): Point => {
    const ang = rngRange(c.rng, 0, Math.PI * 2);
    const r = rngRange(c.rng, stage.decoyMinDist + DIST_MARGIN, NEAR_RADIUS - DIST_MARGIN);
    return { x: ponta.x + Math.cos(ang) * r, y: ponta.y + Math.sin(ang) * r };
  };
  const decoyKinds = shuffle(rng, stage.decoys);
  for (let i = 0; i < decoyKinds.length; i++) {
    const isNear = i < stage.decoyNear;
    const e = place(ctx, "decoy", decoyKinds[i], isNear ? near : randomPoint, (d) => {
      const dist = pontaDistances(ctx, ponta, d);
      if (dist.min < stage.decoyMinDist + DIST_MARGIN) return false;
      return !isNear || dist.max <= NEAR_RADIUS - DIST_MARGIN / 2;
    });
    if (!e) return null;
    decoys.push(e);
  }

  const bonuses: Entity[] = [];
  for (const b of stage.bonuses) {
    const e = place(ctx, "bonus", b, randomPoint, undefined, BONUS_MIN_VISIBLE);
    if (!e) return null;
    ctx.prot.push({ e, min: BONUS_MIN_VISIBLE });
    bonuses.push(e);
  }

  // HARD: ポンタのほかに探す「なかま」。モブと同じ種類の絵から選び、その種類はなかま1体だけにする
  // （同じ見た目のモブが他にいると、どれがなかまか分からなくなるため）
  const friends: Entity[] = [];
  const friendTypes = hard ? shuffle(rng, stage.mobTypes).slice(0, stage.hardFriends) : [];
  for (const tex of friendTypes) {
    const e = place(ctx, "friend", tex, randomPoint, undefined, stage.minVisible + FRIEND_VIS_MARGIN);
    if (!e) return null;
    ctx.prot.push({ e, min: stage.minVisible + FRIEND_VIS_MARGIN });
    friends.push(e);
  }

  const types = stage.mobTypes.filter((m) => !friendTypes.includes(m));
  const mobs: Entity[] = [];
  for (let i = 0; i < stage.mobCount; i++) {
    const tex = i < types.length ? types[i] : types[Math.floor(rng() * types.length)];
    const e = place(ctx, "mob", tex, randomPoint);
    if (!e) return null;
    mobs.push(e);
  }
  assignMotions(ctx, seed, [ponta, ...decoys, ...friends, ...mobs], bonuses);
  return { ponta, decoys, mobs, bonuses, friends };
}

/** 動き（往復・買い物・追いかけっこ）の割り当て比率 */
const PAIR_RATIO = 0.14;
const WALK_RATIO = 0.24;
const SHOP_RATIO = 0.13;
/** 往復の速さ(px/秒)。タップできる速さに抑える */
const WALK_SPEED: [number, number] = [26, 40];
const PAIR_SPEED: [number, number] = [58, 82];
const MIN_AMP = 30;
/** 動いたときの可視面積を調べる時刻の数 */
const MOTION_SAMPLES = 160;
const MOTION_SAMPLE_SPAN = 120;

/** 端・歩行領域からはみ出さない最大の振幅（MIN_AMP 未満なら 0） */
function fitAmp(ctx: Ctx, e: Entity, want: number): number {
  let amp = want;
  while (amp >= MIN_AMP) {
    const ok = [e.hx - amp, e.hx + amp].every(
      (x) => x >= EDGE_MARGIN && x <= WORLD_W - EDGE_MARGIN && pointInPolygon(x, e.y, ctx.poly),
    );
    if (ok) return amp;
    amp *= 0.85;
  }
  return 0;
}

/**
 * 配置後に各キャラの動きを決める（配置の乱数列は変えない）。
 * 動いたときにポンタ・ボーナスの可視面積が下限を割るなら、その動きは取り消して正面立ちに戻す。
 */
function assignMotions(ctx: Ctx, seed: number, chars: Entity[], bonuses: Entity[]): void {
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const byId = (id: number): Entity | undefined => chars.find((c) => c.id === id);
  const order = shuffle(rng, chars);
  const assigned = new Set<number>();
  const pairTarget = Math.round((chars.length * PAIR_RATIO) / 2);
  let pairs = 0;
  for (const a of order) {
    if (pairs >= pairTarget) break;
    if (assigned.has(a.id)) continue;
    let b: Entity | null = null;
    for (const c of chars) {
      if (c === a || assigned.has(c.id)) continue;
      const dx = Math.abs(c.hx - a.hx);
      if (Math.abs(c.y - a.y) > 30 || dx < 90 || dx > 220) continue;
      if (!b || dx < Math.abs(b.hx - a.hx)) b = c;
    }
    if (!b) continue;
    const speed = rngRange(rng, PAIR_SPEED[0], PAIR_SPEED[1]);
    const amp = Math.min(fitAmp(ctx, a, rngRange(rng, 80, 130)), fitAmp(ctx, b, 130));
    if (amp < MIN_AMP) continue;
    const period = (4 * amp) / speed;
    const phase = rng();
    const side: 1 | -1 = a.hx > b.hx ? 1 : -1;
    a.pose = b.pose = "pair";
    a.move = { amp, period, phase, partner: b.id, slot: side };
    b.move = { amp, period, phase, partner: a.id, slot: side === 1 ? -1 : 1 };
    assigned.add(a.id);
    assigned.add(b.id);
    pairs++;
  }
  for (const e of order) {
    if (assigned.has(e.id)) continue;
    const r = rng();
    if (r < WALK_RATIO) {
      const amp = fitAmp(ctx, e, rngRange(rng, 40, 90));
      if (amp < MIN_AMP) continue;
      e.pose = "walk";
      e.move = { amp, period: (4 * amp) / rngRange(rng, WALK_SPEED[0], WALK_SPEED[1]), phase: rng() };
    } else if (r < WALK_RATIO + SHOP_RATIO) {
      e.pose = "shop";
    }
  }
  stabilizeMotions(ctx, seed, chars, bonuses, byId);
}

/** 動きの全時刻でポンタ/ボーナスの可視面積が下限以上になるまで、邪魔な動きを取り消す。 */
function stabilizeMotions(
  ctx: Ctx, seed: number, chars: Entity[], bonuses: Entity[], byId: (id: number) => Entity | undefined,
): void {
  const everyone = [...chars, ...bonuses];
  const rng = mulberry32((seed ^ 0x85ebca6b) >>> 0);
  const times = Array.from({ length: MOTION_SAMPLES }, () => rng() * MOTION_SAMPLE_SPAN);
  for (let pass = 0; pass < 40; pass++) {
    let violated = false;
    for (const t of times) {
      applyMotions(chars, t);
      for (const p of ctx.prot) {
        if (visibleFraction(p.e, everyone, ctx.stage) >= p.min) continue;
        violated = true;
        const pb = entityBox(p.e, ctx.stage);
        const blockers = chars.filter((c) => c.move && c !== p.e && isInFront(c, p.e) && overlaps(pb, entityBox(c, ctx.stage)));
        for (const c of blockers) cancelMotion(c, byId);
        if (blockers.length === 0 && p.e.move) cancelMotion(p.e, byId);
        break;
      }
      if (violated) break;
    }
    for (const c of chars) c.x = c.hx;
    if (!violated) return;
  }
  // 収束しなければ全て取り消す（安全側）
  for (const c of chars) if (c.move) cancelMotion(c, byId);
}

export function countPonta(l: Pick<SceneLayout, "ponta" | "decoys" | "mobs" | "bonuses" | "friends">): number {
  const all = [l.ponta, ...l.decoys, ...l.mobs, ...l.bonuses, ...l.friends];
  return all.filter((e) => e.kind === "ponta" || e.tex === "ponta").length;
}

export function deriveSeed(seed: number, attempt: number): number {
  return attempt === 0 ? seed >>> 0 : (seed ^ Math.imul(attempt, 0x9e3779b1)) >>> 0;
}

/**
 * ステージ定義とシードから全エンティティを配置する。
 * ポンタが厳密に1体でなければ別シードで再生成（最大5回）。
 */
export function generateScene(stage: StageDef, seed: number, hard = false): SceneLayout {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const used = deriveSeed(seed, attempt);
    const r = generateOnce(stage, used, hard);
    if (r && countPonta(r) === 1) return { ...r, usedSeed: used, attempt };
  }
  throw new Error(`generateScene failed: stage=${stage.id} seed=${seed}`);
}

export function allEntities(l: SceneLayout): Entity[] {
  return [l.ponta, ...l.decoys, ...l.friends, ...l.mobs, ...l.bonuses];
}
