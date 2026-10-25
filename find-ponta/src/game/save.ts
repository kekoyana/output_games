// 進行・ベストの保存（core/storage 経由、名前空間 find-ponta）
import { getBool, setBool, getJson, setJson } from "../core/storage";
import type { ScoreBreakdown } from "./score";

export interface GameStartData {
  stage: number;
  /** 配置は毎回ランダム（シードは開始ごとに採番） */
  seed: number;
  /** HARD: キャラが動く + ポンタのほかになかまも探す。省略時は NORMAL（止まった絵） */
  hard?: boolean;
}

export interface ResultData {
  stage: number;
  seed: number;
  hard: boolean;
  cleared: boolean;
  timeLeft: number;
  misses: number;
  hints: number;
  bonusFound: number;
  bonusTotal: number;
  /** HARD のなかま（NORMAL は 0） */
  friendFound: number;
  friendTotal: number;
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

/** HARD モードで遊ぶか（ステージ選択で切り替え、リロード後も保持） */
export function isHardMode(): boolean {
  return getBool("hard", false);
}

export function setHardMode(v: boolean): void {
  setBool("hard", v);
}

/** ベストは NORMAL / HARD 別に保存する */
function bestKey(stageId: number, hard: boolean): string {
  return hard ? `best-hard-${stageId}` : `best-${stageId}`;
}

export function getBest(stageId: number, hard = false): BestRecord | null {
  return getJson<BestRecord>(bestKey(stageId, hard));
}

/** ベスト更新なら true（スコア優先、同点ならスター） */
export function submitBest(stageId: number, rec: BestRecord, hard = false): boolean {
  const cur = getBest(stageId, hard);
  const better = !cur || rec.score > cur.score;
  const stars = Math.max(cur?.stars ?? 0, rec.stars);
  setJson<BestRecord>(bestKey(stageId, hard), {
    score: better ? rec.score : (cur?.score ?? 0),
    stars,
  });
  return better;
}

/** 全ステージ合計のベスト（スコア・スター） */
export function getTotalBest(stageCount: number, hard = false): { score: number; stars: number } {
  let score = 0;
  let stars = 0;
  for (let id = 1; id <= stageCount; id++) {
    const b = getBest(id, hard);
    score += b?.score ?? 0;
    stars += Math.min(3, b?.stars ?? 0);
  }
  return { score, stars };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000) + 1;
}
