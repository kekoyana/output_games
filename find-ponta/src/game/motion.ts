// キャラの動き（Phaser 非依存の純関数）。位置は時刻 t(秒) だけで決まるので、描画と当たり判定が一致する。
import type { Entity } from "./types";

/** 三角波。u の小数部 f が 0..0.5 で -1→+1（右へ）、0.5..1 で +1→-1（左へ）。 */
function wave(u: number): { x: number; dir: 1 | -1 } {
  const f = u - Math.floor(u);
  return f < 0.5 ? { x: 4 * f - 1, dir: 1 } : { x: 3 - 4 * f, dir: -1 };
}

export interface MotionSample {
  x: number;
  /** 進行方向（+1=右）。動かないキャラは 0 */
  dir: 1 | -1 | 0;
  /** 使うテクスチャキー */
  texKey: string;
  /** スプライトの左右反転（素材は右向き） */
  flip: boolean;
  /** 足踏みの上下ぶれ(0-1)。高さに掛けて使う */
  bob: number;
}

export function poseTextureKey(tex: string, pose: "front" | "shop" | "side" | "flee" | "chase"): string {
  return pose === "front" ? tex : `${tex}_${pose}`;
}

export function sampleMotion(e: Entity, t: number): MotionSample {
  const m = e.move;
  if (!m) {
    return { x: e.hx, dir: 0, texKey: poseTextureKey(e.tex, e.pose === "shop" ? "shop" : "front"), flip: false, bob: 0 };
  }
  const w = wave(t / m.period + m.phase);
  const x = e.hx + m.amp * w.x;
  const stepHz = e.pose === "pair" ? 3.4 : 2.2;
  const bob = Math.abs(Math.sin(Math.PI * (t * stepHz + m.phase * 7)));
  if (e.pose === "pair") {
    // 進行方向の前にいる側が「逃げる」、後ろが「追う」。折り返しで役が入れ替わる（鬼ごっこ）
    const pose = w.dir === m.slot ? "flee" : "chase";
    return { x, dir: w.dir, texKey: poseTextureKey(e.tex, pose), flip: w.dir < 0, bob };
  }
  return { x, dir: w.dir, texKey: poseTextureKey(e.tex, "side"), flip: w.dir < 0, bob };
}

/** 止めた絵（NORMAL）: 配置位置に立ち、向き・ポーズは動き出しの瞬間のものを使う。 */
export function stillSample(e: Entity): MotionSample {
  return { ...sampleMotion(e, 0), x: e.hx, bob: 0 };
}

/** 全ての動くキャラを時刻 t の位置に置く（e.x を更新）。 */
export function applyMotions(list: Entity[], t: number): void {
  for (const e of list) if (e.move) e.x = sampleMotion(e, t).x;
}

/** 動きを取り消して正面立ちに戻す（相方がいれば一緒に）。 */
export function cancelMotion(e: Entity, byId: (id: number) => Entity | undefined): void {
  const partner = e.move?.partner;
  e.move = undefined;
  e.pose = "front";
  e.x = e.hx;
  if (partner !== undefined) {
    const o = byId(partner);
    if (o && o.move) cancelMotion(o, byId);
  }
}
