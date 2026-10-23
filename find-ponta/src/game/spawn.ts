// 配置ロジック（Phaser 非依存の純関数）。Node からも import して検証できる。
import { mulberry32, rngRange, shuffle, type Rng } from "./rng";
import { WALK_POLYGONS } from "./stages";
import {
  entityBox, entityCenter, isInFront, pointInPolygon, visibleFraction,
} from "./geometry";
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
      id: ctx.nextId, kind, tex, x: p.x, y: p.y,
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

function generateOnce(stage: StageDef, seed: number): Omit<SceneLayout, "usedSeed" | "attempt"> | null {
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

  const types = stage.mobTypes;
  const mobs: Entity[] = [];
  for (let i = 0; i < stage.mobCount; i++) {
    const tex = i < types.length ? types[i] : types[Math.floor(rng() * types.length)];
    const e = place(ctx, "mob", tex, randomPoint);
    if (!e) return null;
    mobs.push(e);
  }
  return { ponta, decoys, mobs, bonuses };
}

export function countPonta(l: Pick<SceneLayout, "ponta" | "decoys" | "mobs" | "bonuses">): number {
  const all = [l.ponta, ...l.decoys, ...l.mobs, ...l.bonuses];
  return all.filter((e) => e.kind === "ponta" || e.tex === "ponta").length;
}

export function deriveSeed(seed: number, attempt: number): number {
  return attempt === 0 ? seed >>> 0 : (seed ^ Math.imul(attempt, 0x9e3779b1)) >>> 0;
}

/**
 * ステージ定義とシードから全エンティティを配置する。
 * ポンタが厳密に1体でなければ別シードで再生成（最大5回）。
 */
export function generateScene(stage: StageDef, seed: number): SceneLayout {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const used = deriveSeed(seed, attempt);
    const r = generateOnce(stage, used);
    if (r && countPonta(r) === 1) return { ...r, usedSeed: used, attempt };
  }
  throw new Error(`generateScene failed: stage=${stage.id} seed=${seed}`);
}

export function allEntities(l: SceneLayout): Entity[] {
  return [l.ponta, ...l.decoys, ...l.mobs, ...l.bonuses];
}
