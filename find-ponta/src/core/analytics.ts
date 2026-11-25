import type { Difficulty } from "../game/save";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const GAME_ID = "find-ponta";

function track(name: string, params: Record<string, string | number>): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  try {
    window.gtag("event", name, { game_id: GAME_ID, ...params });
  } catch {
    // 計測失敗でゲーム進行を止めない
  }
}

/** ステージプレイ開始時の計測イベントを送信する。 */
export function trackStageStart(stage: number, difficulty: Difficulty): void {
  track("stage_start", { stage, difficulty });
}

/** ステージクリア時の計測イベントを送信する。 */
export function trackStageClear(params: {
  stage: number;
  difficulty: Difficulty;
  score: number;
  stars: number;
  misses: number;
  hints: number;
  timeLeft: number;
}): void {
  track("stage_clear", {
    stage: params.stage,
    difficulty: params.difficulty,
    score: params.score,
    stars: params.stars,
    misses: params.misses,
    hints: params.hints,
    time_left: Math.round(params.timeLeft),
  });
}

/** タイムアップ失敗時の計測イベントを送信する。 */
export function trackStageFail(params: {
  stage: number;
  difficulty: Difficulty;
  misses: number;
  hints: number;
}): void {
  track("stage_fail", {
    stage: params.stage,
    difficulty: params.difficulty,
    misses: params.misses,
    hints: params.hints,
  });
}

/** ヒント使用時の計測イベントを送信する。 */
export function trackHintUse(stage: number, difficulty: Difficulty, hintsUsed: number): void {
  track("hint_use", { stage, difficulty, hints_used: hintsUsed });
}
