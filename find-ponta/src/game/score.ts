// スコア・スター・ペナルティの純関数

export const PENALTY_EMPTY = 2;
export const PENALTY_MOB = 4;
export const PENALTY_DECOY = 8;
export const BONUS_SCORE = 500;
export const BONUS_TIME = 5;
export const MISS_SCORE = 100;
export const HINT_SCORE = 300;
export const HINT_RADIUS_FIRST = 450;
export const HINT_RADIUS_NEXT = 250;
export const HINT_DURATION = 5;

export interface ScoreInput {
  timeLeft: number;
  bonus: number;
  misses: number;
  hints: number;
}

export interface ScoreBreakdown {
  base: number;
  time: number;
  bonus: number;
  missPenalty: number;
  hintPenalty: number;
  total: number;
}

export function scoreBreakdown(a: ScoreInput): ScoreBreakdown {
  const base = 1000;
  const time = Math.max(0, Math.floor(a.timeLeft)) * 20;
  const bonus = a.bonus * BONUS_SCORE;
  const missPenalty = a.misses * MISS_SCORE;
  const hintPenalty = a.hints * HINT_SCORE;
  const total = Math.max(0, base + time + bonus - missPenalty - hintPenalty);
  return { base, time, bonus, missPenalty, hintPenalty, total };
}

export function computeScore(a: ScoreInput): number {
  return scoreBreakdown(a).total;
}

export function computeStars(a: { misses: number; hints: number; timeLeft: number; timeLimit: number }): 1 | 2 | 3 {
  if (a.misses <= 1 && a.hints === 0 && a.timeLeft >= a.timeLimit * 0.4) return 3;
  if (a.misses <= 2 && a.hints <= 1) return 2;
  return 1;
}

export type MissKind = "empty" | "mob" | "decoy";

export function missPenaltySeconds(kind: MissKind): number {
  return kind === "empty" ? PENALTY_EMPTY : kind === "mob" ? PENALTY_MOB : PENALTY_DECOY;
}

export function hintRadius(hintsUsedBefore: number): number {
  return hintsUsedBefore === 0 ? HINT_RADIUS_FIRST : HINT_RADIUS_NEXT;
}
