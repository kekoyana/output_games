// 進行・ベストの保存（core/storage 経由、名前空間 find-ponta）
import { getBool, setBool, getJson, setJson } from "../core/storage";
import type { ScoreBreakdown } from "./score";

export type PlayMode = "fixed" | "random";

export interface GameStartData {
  stage: number;
  mode: PlayMode;
  seed: number;
}

export interface ResultData {
  stage: number;
  mode: PlayMode;
  seed: number;
  cleared: boolean;
  timeLeft: number;
  misses: number;
  hints: number;
  bonusFound: number;
  bonusTotal: number;
  /** 取り逃したボーナスのテクスチャキー */
  missedBonus: string[];
  score: number;
  stars: number;
  newBest: boolean;
  breakdown: ScoreBreakdown;
}

export interface BestRecord {
  score: number;
  stars: number;
}

export function isCleared(stageId: number): boolean {
  return getBool(`cleared-${stageId}`, false);
}

export function markCleared(stageId: number): void {
  setBool(`cleared-${stageId}`, true);
}

/** ステージ N+1 は N クリアで解放（ステージ1は常時解放） */
export function isUnlocked(stageId: number): boolean {
  return stageId <= 1 || isCleared(stageId - 1);
}

export function getBest(stageId: number, mode: PlayMode): BestRecord | null {
  return getJson<BestRecord>(`best-${mode}-${stageId}`);
}

/** ベスト更新なら true（スコア優先、同点ならスター） */
export function submitBest(stageId: number, mode: PlayMode, rec: BestRecord): boolean {
  const cur = getBest(stageId, mode);
  const better = !cur || rec.score > cur.score;
  const stars = Math.max(cur?.stars ?? 0, rec.stars);
  setJson<BestRecord>(`best-${mode}-${stageId}`, {
    score: better ? rec.score : (cur?.score ?? 0),
    stars,
  });
  return better;
}

/**
 * 全ステージ合計のベスト。ステージ選択画面は固定・ランダムのベストを並べて表示するため、
 * 各ステージで両者のうち高い方（スコア・スターそれぞれ）を採用する。
 */
export function getTotalBest(stageCount: number): { score: number; stars: number } {
  let score = 0;
  let stars = 0;
  for (let id = 1; id <= stageCount; id++) {
    const f = getBest(id, "fixed");
    const r = getBest(id, "random");
    score += Math.max(f?.score ?? 0, r?.score ?? 0);
    stars += Math.min(3, Math.max(f?.stars ?? 0, r?.stars ?? 0));
  }
  return { score, stars };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000) + 1;
}
