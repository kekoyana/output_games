// 進行・ベストの保存（core/storage 経由、名前空間 find-ponta）
import { getBool, setBool, getJson, setJson } from "../core/storage";
import type { ScoreBreakdown } from "./score";

/** normal=止まった絵 / hard=動く+なかま / extreme=hard+隠された宝物 */
export type Difficulty = "normal" | "hard" | "extreme";

export interface GameStartData {
  stage: number;
  /** 配置は毎回ランダム（シードは開始ごとに採番） */
  seed: number;
  /** 省略時は NORMAL */
  difficulty?: Difficulty;
}

export interface ResultData {
  stage: number;
  seed: number;
  difficulty: Difficulty;
  cleared: boolean;
  timeLeft: number;
  misses: number;
  hints: number;
  bonusFound: number;
  bonusTotal: number;
  /** HARD 以上のなかま（NORMAL は 0） */
  friendFound: number;
  friendTotal: number;
  /** EXTREME の宝物（それ以外は 0） */
  treasureFound: number;
  treasureTotal: number;
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

/** 難易度（ステージ選択で切り替え、リロード後も保持）。保存は hard / extreme の2つの真偽値 */
export function getDifficulty(): Difficulty {
  if (getBool("extreme", false)) return "extreme";
  return getBool("hard", false) ? "hard" : "normal";
}

export function setDifficulty(d: Difficulty): void {
  setBool("hard", d === "hard");
  setBool("extreme", d === "extreme");
}

/** ベストは難易度別に保存する（NORMAL の保存キーは従来どおり） */
function bestKey(stageId: number, d: Difficulty): string {
  return d === "normal" ? `best-${stageId}` : `best-${d}-${stageId}`;
}

export function getBest(stageId: number, d: Difficulty = "normal"): BestRecord | null {
  return getJson<BestRecord>(bestKey(stageId, d));
}

/** ベスト更新なら true（スコア優先、同点ならスター） */
export function submitBest(stageId: number, rec: BestRecord, d: Difficulty = "normal"): boolean {
  const cur = getBest(stageId, d);
  const better = !cur || rec.score > cur.score;
  const stars = Math.max(cur?.stars ?? 0, rec.stars);
  setJson<BestRecord>(bestKey(stageId, d), {
    score: better ? rec.score : (cur?.score ?? 0),
    stars,
  });
  return better;
}

/** 全ステージ合計のベスト（スコア・スター） */
export function getTotalBest(stageCount: number, d: Difficulty = "normal"): { score: number; stars: number } {
  let score = 0;
  let stars = 0;
  for (let id = 1; id <= stageCount; id++) {
    const b = getBest(id, d);
    score += b?.score ?? 0;
    stars += Math.min(3, b?.stars ?? 0);
  }
  return { score, stars };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000) + 1;
}
