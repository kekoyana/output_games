export type Lang = 'ja' | 'en';

export interface Texts {
  howToPlay: string;
  rules: string[];
  controls: string;
  controlsList: string[];
  tips: string;
  tipsList: string[];
  startPrompt: string;
  score: string;
  cleared: string;
  clearedCount: string;
  gameOver: string;
  retryPrompt: string;
}

const JA: Texts = {
  howToPlay: '- 遊び方 -',
  rules: [
    'グリッド上を移動してパネルを配置します',
    '同じ色のパネルで別の色を「挟む」と',
    '挟まれたパネルが全て消えます（オセロ式）',
    '',
    '消去中のパネルは約2秒かけて消えます',
    'その間に別のサンドイッチを決めると',
    'チェインコンボ発生！大量ボーナス！',
  ],
  controls: '- 操作方法 -',
  controlsList: [
    '移動 : 矢印キー / WASD / 十字ボタン',
    '配置 : Space / Z / Enter / Aボタン',
  ],
  tips: '- コツ -',
  tipsList: [
    'パネルは時間で増えます。埋まるとゲームオーバー！',
    '消去中のパネルも挟む端として使えます',
    'チェインを繋げて高得点を狙おう！',
  ],
  startPrompt: 'タップ / キーを押してスタート',
  score: 'Score',
  cleared: 'Cleared',
  clearedCount: 'Cleared',
  gameOver: 'GAME OVER',
  retryPrompt: 'タップ / キーでリトライ',
};

const EN: Texts = {
  howToPlay: '- How to Play -',
  rules: [
    'Move on the grid and place panels.',
    'Sandwich different-colored panels',
    'between two of the same color to clear them!',
    '',
    'Cleared panels take ~2 seconds to vanish.',
    'Make another sandwich before they go',
    'for a chain combo and huge bonus!',
  ],
  controls: '- Controls -',
  controlsList: [
    'Move  : Arrow keys / WASD / D-pad',
    'Place : Space / Z / Enter / A button',
  ],
  tips: '- Tips -',
  tipsList: [
    'Panels spawn over time. Board full = game over!',
    'Clearing panels can be used as sandwich ends',
    'Chain combos for high scores!',
  ],
  startPrompt: 'Tap / Press any key to start',
  score: 'Score',
  cleared: 'Cleared',
  clearedCount: 'Cleared',
  gameOver: 'GAME OVER',
  retryPrompt: 'Tap / Press key to retry',
};

const TEXTS: Record<Lang, Texts> = { ja: JA, en: EN };

function detectLang(): Lang {
  const nav = navigator.language || '';
  return nav.startsWith('ja') ? 'ja' : 'en';
}

let currentLang: Lang = detectLang();

export let T: Texts = TEXTS[currentLang];

export function getLang(): Lang {
  return currentLang;
}

export function toggleLang(): void {
  currentLang = currentLang === 'ja' ? 'en' : 'ja';
  T = TEXTS[currentLang];
}

/** Label shown on the toggle button (shows the language to switch TO) */
export function toggleLabel(): string {
  return currentLang === 'ja' ? 'EN' : 'JA';
}
