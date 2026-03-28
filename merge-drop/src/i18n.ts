interface Texts {
  score: string;
  best: string;
  maxValue: string;
  dangerLine: string;
  subtitle: string;
  howToPlay1: string;
  howToPlay2: string;
  comboHint: string;
  tapToStart: string;
  scoreLabel: string;
  highScoreLabel: string;
  maxValueLabel: string;
  megaMerge: string;
  retry: string;
  langLabel: string;
}

const ja: Texts = {
  score: "スコア",
  best: "ベスト",
  maxValue: "最大値",
  dangerLine: "危険ライン",
  subtitle: "数字合体パズル",
  howToPlay1: "同じ数字のボールをぶつけて合体！",
  howToPlay2: "1.5秒以内に連続合体でコンボ！",
  comboHint: "連続合体でスコアUP",
  tapToStart: "タップ / クリックでスタート",
  scoreLabel: "スコア",
  highScoreLabel: "ハイスコア",
  maxValueLabel: "最大値",
  megaMerge: "MEGA MERGE 達成！",
  retry: "もう一回！",
  langLabel: "EN",
};

const en: Texts = {
  score: "SCORE",
  best: "BEST",
  maxValue: "MAX",
  dangerLine: "DANGER",
  subtitle: "Number Merge Puzzle",
  howToPlay1: "Merge same-numbered balls!",
  howToPlay2: "Chain merges within 1.5s for combos!",
  comboHint: "Chain merges for bonus",
  tapToStart: "Tap / Click to Start",
  scoreLabel: "SCORE",
  highScoreLabel: "HIGH SCORE",
  maxValueLabel: "MAX VALUE",
  megaMerge: "MEGA MERGE!",
  retry: "Retry!",
  langLabel: "JP",
};

type Lang = "ja" | "en";

let currentLang: Lang = navigator.language.startsWith("ja") ? "ja" : "en";
const langs: Record<Lang, Texts> = { ja, en };

export let t: Texts = langs[currentLang];

export function toggleLang(): void {
  currentLang = currentLang === "ja" ? "en" : "ja";
  t = langs[currentLang];
}

export function getLangButtonRect(canvasW: number): { x: number; y: number; w: number; h: number } {
  return { x: canvasW - 52, y: 8, w: 44, h: 28 };
}
