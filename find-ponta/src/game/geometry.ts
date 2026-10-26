import type { Box, Entity, Point, StageDef } from "./types";

/** キャラの当たり箱の幅 / 高さ（尻尾を含む見た目の幅） */
export const BODY_W_RATIO = 0.7;
export const BONUS_SIZE = 48;
/** 動くキャラのタップ判定の追加半径(px) */
export const MOVING_TAP_BONUS = 10;
/** スプライト画像(256px)中で可視部分が占める高さ(240px) */
export const SPRITE_VISIBLE_RATIO = 240 / 256;

/** ボーナス・宝物のような小さな置きもの（キャラではない） */
export function isItem(e: Entity): boolean {
  return e.kind === "bonus" || e.kind === "treasure" || e.kind === "junk";
}

export function pointInPolygon(px: number, py: number, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** 表示上の高さ（キャラ=ステージ高さ×個体スケール、ボーナス=固定） */
export function entityHeight(e: Entity, stage: StageDef): number {
  return isItem(e) ? BONUS_SIZE : stage.height * e.scale;
}

export function entityBox(e: Entity, stage: StageDef): Box {
  const h = entityHeight(e, stage);
  const w = isItem(e) ? BONUS_SIZE : h * BODY_W_RATIO;
  return { l: e.x - w / 2, r: e.x + w / 2, t: e.y - h, b: e.y };
}

export function entityCenter(e: Entity, stage: StageDef): Point {
  return { x: e.x, y: e.y - entityHeight(e, stage) / 2 };
}

/** 当たり楕円（キャラ: 箱の幅60%×高さ80%、ボーナス: 円） */
export function hitEllipse(e: Entity, stage: StageDef): { cx: number; cy: number; rx: number; ry: number } {
  const b = entityBox(e, stage);
  const c = entityCenter(e, stage);
  if (isItem(e)) return { cx: c.x, cy: c.y, rx: BONUS_SIZE / 2, ry: BONUS_SIZE / 2 };
  return { cx: c.x, cy: c.y, rx: (b.r - b.l) * 0.3, ry: (b.b - b.t) * 0.4 };
}

/** タップ判定。半径 r の円と楕円を近似的に判定し、正規化距離(<=1でヒット)を返す。 */
export function hitDistance(
  e: Entity, stage: StageDef, px: number, py: number, r: number, animated = true,
): number {
  const el = hitEllipse(e, stage);
  // 動いているキャラは狙いにくいので、判定を少し広げる
  const rr = r + (animated && e.move ? MOVING_TAP_BONUS : 0);
  const dx = (px - el.cx) / (el.rx + rr);
  const dy = (py - el.cy) / (el.ry + rr);
  return dx * dx + dy * dy;
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
}

/** e1 が e2 より手前（後から描画）か。depth=y、同値は id 順。 */
export function isInFront(a: Entity, b: Entity): boolean {
  return a.y > b.y || (a.y === b.y && a.id > b.id);
}

/**
 * target の当たり箱のうち、手前に描画される他エンティティの箱に隠されない割合。
 * 矩形和集合を座標圧縮で厳密に計算する。
 */
export function visibleFraction(target: Entity, others: Entity[], stage: StageDef): number {
  const tb = entityBox(target, stage);
  const rects: Box[] = [];
  for (const o of others) {
    if (o === target || !isInFront(o, target)) continue;
    const ob = entityBox(o, stage);
    if (!boxesOverlap(tb, ob)) continue;
    rects.push({
      l: Math.max(ob.l, tb.l), r: Math.min(ob.r, tb.r),
      t: Math.max(ob.t, tb.t), b: Math.min(ob.b, tb.b),
    });
  }
  const total = (tb.r - tb.l) * (tb.b - tb.t);
  if (rects.length === 0) return 1;
  const xs = Array.from(new Set(rects.flatMap((r) => [r.l, r.r]))).sort((p, q) => p - q);
  let covered = 0;
  for (let i = 0; i + 1 < xs.length; i++) {
    const x0 = xs[i];
    const x1 = xs[i + 1];
    const spans = rects
      .filter((r) => r.l <= x0 && r.r >= x1)
      .map((r): [number, number] => [r.t, r.b])
      .sort((p, q) => p[0] - q[0]);
    let len = 0;
    let curEnd = -Infinity;
    for (const [s, e] of spans) {
      const st = Math.max(s, curEnd);
      if (e > st) len += e - st;
      curEnd = Math.max(curEnd, e);
    }
    covered += len * (x1 - x0);
  }
  return Math.max(0, 1 - covered / total);
}
