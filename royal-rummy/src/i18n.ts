import { GAME_CONFIG } from "./game-config";

const TEXTS = {
  en: {
    // Core flow
    tapToStart: "TAP TO START",
    tapToContinue: "TAP TO CONTINUE",
    stageSelect: "OPPONENT SELECT",
    loading: "Loading...",
    back: "< BACK",
    top: "< TOP",

    // Game results
    retry: "RETRY",
    continue: "CONTINUE",
    gameOver: "GAME OVER",
    stageClear: "MATCH WON!",
    roundClear: "ROUND CLEAR!",
    noCleared: "No matches won yet",

    // Settings panel
    settings: "Settings",
    language: "Language",
    bgm: "BGM",
    sfx: "SFX",
    volume: "Volume",
    on: "ON",
    off: "OFF",
    close: "CLOSE",
    goToTop: "Return to Title",
    confirmGoToTop: "Return to title?",
    yes: "YES",
    no: "NO",

    // Royal Rummy match terms
    cast: "ATTACK",
    pass: "PASS",
    castPromptTitle: "ATTACK?",
    pure: "CRITICAL!",
    counter: "COUNTER!",
    counterspell: "COUNTER!",
    coven: "COVEN",
    cascade: "CASCADE",
    deck: "DECK",
    trash: "DISCARD",
    empty: "EMPTY",
    you: "YOU",
    damage: "DAMAGE",
    nextRound: "NEXT ROUND",
    victory: "VICTORY",
    defeat: "DEFEAT",
    attackResult: "ATTACK",
    damageResult: "DAMAGE",
    roundDraw: "Round draws to silence",

    // In-match prompts / status
    drawCardPrompt: "Draw a card (deck or discard).",
    discardPrompt: "Tap a card to discard. ATTACK when LEFT is {n} or less.",
    opponentTurn: "Opponent's turn...",
    opponentThinking: "Opponent is thinking...",
    opponentDrawsDeck: "Opponent drew from the deck.",
    opponentDrawsTrash: "Opponent picked from the discard.",
    opponentDiscards: "Opponent discards a card.",
    opponentCasts: "OPPONENT ATTACKS!",
    yourTurnDraw: "Your turn — draw a card.",
    deckEmptyDraw: "Deck spent — the round pauses.",
    youAttacked: "You attack!",
    youTookDamage: "You take damage.",
    pointsLabel: "Points: {points}",
    pointsIfDiscard: "Points after discard: {points}",
    drossLabel: "LEFT",
    drossSublabel: "lower is better",
    castThresholdShort: "Attack at {n} or less",
    castReady: "Ready! Tap ATTACK",
    pureReady: "CRITICAL! Tap ATTACK",
    pointsToCast: "Reduce {n} more ↓",
    deckSublabel: "DECK",
    trashSublabel: "DISCARD",
    resultDetails: "Your pts {self} — Opp pts {opp} — damage {dmg}",
    startMatchWith: "Duel against {name}?",

    // Tutorial
    tutPage1Title: "Overview",
    tutPage1Body: "Combine cards into melds, lower your LEFT, and ATTACK to damage the opponent. The thrill is in shaping your hand and timing the attack. First to 5 round wins takes the match.",
    tutPage2Title: "ATTACK & LEFT",
    tutPage2Body: "[ATTACK] You can declare an ATTACK when you have melds and your LEFT is at or below the points of the FIRST DISCARD this hand (J/Q/K = 10). Attacking ends the round.\n[LEFT] The total of cards not used in any meld.",
    tutPage3Title: "What is a Meld?",
    tutPage3Body: "A specific combination of cards is called a meld. Cards used in a meld don't count toward your LEFT.",
    tutCovenDesc: "Match 3 or more cards of the same number (COVEN).",
    tutCascadeDesc: "Match 3 or more of the same suit with sequential numbers (CASCADE).",
    tutPage4Title: "Turn Flow",
    tutPage4Body: "(1) Draw 1 card from the deck or discard pile.\n(2) Discard 1 from your hand.\nRepeat to shape your hand.",
    tutFlowDeck: "DECK",
    tutFlowHand: "HAND",
    tutFlowDiscard: "DISCARD",
    tutBack: "BACK",
    tutNext: "NEXT",
    tutSkip: "SKIP",
    tutStart: "START",
    tutPageOf: "{n} / {total}",
  },
  ja: {
    tapToStart: "タップしてスタート",
    tapToContinue: "タップでつづける",
    stageSelect: "対戦相手を選ぶ",
    loading: "読み込み中...",
    back: "< 戻る",
    top: "< TOP",

    retry: "リトライ",
    continue: "つづける",
    gameOver: "ゲームオーバー",
    stageClear: "勝負あり！",
    roundClear: "ラウンドクリア！",
    noCleared: "まだクリアした相手はいません",

    settings: "設定",
    language: "言語",
    bgm: "BGM",
    sfx: "SFX",
    volume: "音量",
    on: "ON",
    off: "OFF",
    close: "閉じる",
    goToTop: "タイトルへ戻る",
    confirmGoToTop: "タイトルに戻りますか？",
    yes: "はい",
    no: "いいえ",

    cast: "アタック",
    pass: "パス",
    castPromptTitle: "アタックしますか？",
    pure: "クリティカル！",
    counter: "カウンター！",
    counterspell: "カウンター！",
    coven: "コヴン",
    cascade: "カスケード",
    deck: "山札",
    trash: "捨て札",
    empty: "空",
    you: "あなた",
    damage: "ダメージ",
    nextRound: "次のラウンド",
    victory: "勝利！",
    defeat: "敗北",
    attackResult: "アタック",
    damageResult: "ダメージ",
    roundDraw: "決着つかず",

    drawCardPrompt: "カードを引いてください（山札か捨て札から）。",
    discardPrompt: "カードをタップして捨てる。残り{n}以下でアタック。",
    opponentTurn: "相手のターン...",
    opponentThinking: "相手は考えている...",
    opponentDrawsDeck: "相手は山札からカードを引いた。",
    opponentDrawsTrash: "相手は捨て札から拾い上げた。",
    opponentDiscards: "相手はカードを捨てた。",
    opponentCasts: "相手のアタック！",
    yourTurnDraw: "あなたの番。カードを引いてください。",
    deckEmptyDraw: "山札が尽きた — ラウンドは休止。",
    youAttacked: "アタック成功！",
    youTookDamage: "ダメージを受けた…",
    pointsLabel: "残り: {points}",
    pointsIfDiscard: "捨て札後の残り: {points}",
    drossLabel: "残り",
    drossSublabel: "少ないほど良い",
    castThresholdShort: "{n}以下でアタック可",
    castReady: "アタックできます！",
    pureReady: "クリティカル！",
    pointsToCast: "あと {n}",
    deckSublabel: "山札",
    trashSublabel: "捨て札",
    resultDetails: "あなた{self}pt / 相手{opp}pt — ダメージ{dmg}",
    startMatchWith: "{name} と決闘しますか？",

    tutPage1Title: "ゲームの概要",
    tutPage1Body: "カードを集めて役を作り、残り点数を減らしてアタックで相手にダメージを与えるカード決闘。役の組み立てとアタックのタイミングで勝負します。先に5勝した方の勝利です。",
    tutPage2Title: "「アタック」と「残り」",
    tutPage2Body: "【アタック】役を作ったうえで、残り点数が**そのラウンド最初の捨て札の点数以下**になると宣言できます（J/Q/K=10点）。アタックするとラウンド終了です。\n【残り】役に使っていないカードの合計を残り点数と呼びます。",
    tutPage3Title: "役とは？",
    tutPage3Body: "特定の組み合わせでそろえたカードを役と呼びます。役に使ったカードは残り点数に含まれません。",
    tutCovenDesc: "同じ数字を3枚以上そろえる（コヴン）。",
    tutCascadeDesc: "同じスートで、数字が連続する3枚以上をそろえる（カスケード）。",
    tutPage4Title: "1ターンの流れ",
    tutPage4Body: "① 山札または捨て札から1枚引く\n② 手札から1枚捨てる\nこれを繰り返して手札を整えます。",
    tutFlowDeck: "山札",
    tutFlowHand: "手札",
    tutFlowDiscard: "捨て札",
    tutBack: "戻る",
    tutNext: "次へ",
    tutSkip: "スキップ",
    tutStart: "はじめる",
    tutPageOf: "{n} / {total}",
  },
} as const;

export type Lang = keyof typeof TEXTS;
export type TextKey = keyof typeof TEXTS["en"];

const CHARACTER_NAMES: Record<string, { en: string; ja: string }> = {
  Cedric: { en: "Cedric", ja: "セドリック" },
  Elenor: { en: "Elenor", ja: "エレノア" },
  Finn:   { en: "Finn",   ja: "フィン" },
  Vex:    { en: "Vex",    ja: "ヴェクス" },
};

export function getCharacterName(id: string): string {
  const entry = CHARACTER_NAMES[id];
  if (!entry) return id;
  if (currentLang === "ja") return entry.ja;
  return entry.en;
}

const STORAGE_KEY = `${GAME_CONFIG.saveKey}-lang`;

function loadLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ja" || saved === "en") return saved;
  } catch { /* ignore */ }
  const browser = navigator.language.slice(0, 2);
  if (browser === "ja") return "ja";
  return "en";
}

let currentLang: Lang = loadLang();

export function t(key: TextKey, vars?: Record<string, string | number>): string {
  const raw = TEXTS[currentLang][key];
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang): void {
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch { /* ignore */ }
}

export function toggleLang(): void {
  const order: Lang[] = ["en", "ja"];
  const idx = order.indexOf(currentLang);
  setLang(order[(idx + 1) % order.length]);
}
