import { getString, setString } from "./core/storage";

/**
 * 多言語対応の最小サンプル。
 * - 辞書（DICT）はゲーム実装側で拡張する
 * - functional UI ラベル（START / BACK 等）は英語固定で運用するのを推奨
 * - キャラ名・寸劇セリフは pickLocalized / pickLocalizedLines で別途扱う
 */

const LANGUAGES = ["en", "ja"] as const;
export type Locale = (typeof LANGUAGES)[number];

const LOCALE_KEY = "lang";

function isLocale(v: string): v is Locale {
  return (LANGUAGES as readonly string[]).includes(v);
}

function loadLocale(): Locale {
  const saved = getString(LOCALE_KEY);
  if (saved && isLocale(saved)) return saved;
  const browser = navigator.language.slice(0, 2);
  if (isLocale(browser)) return browser;
  return "en";
}

let currentLocale: Locale = loadLocale();

/**
 * 最小辞書。新規ゲームはこのキーを拡張して使う。
 * 値は { en, ja } の組。未登録キーは key 文字列をそのまま返す。
 */
type Dict = Record<string, { en: string; ja: string }>;

const DICT: Dict = {
  hello: { en: "Hello", ja: "こんにちは" },
  start: { en: "START", ja: "スタート" },
  settings: { en: "Settings", ja: "設定" },
  language: { en: "Language", ja: "言語" },
  back: { en: "BACK", ja: "もどる" },
  close: { en: "CLOSE", ja: "閉じる" },
  reset: { en: "RESET", ja: "リセット" },
  bgm: { en: "BGM", ja: "BGM" },
  sfx: { en: "SFX", ja: "効果音" },
  on: { en: "ON", ja: "ON" },
  off: { en: "OFF", ja: "OFF" },
  loading: { en: "LOADING…", ja: "読み込み中…" },
  // ── Find Ponta!
  gameTitle: { en: "Find Ponta!", ja: "ポンタをさがせ！" },
  tagline: {
    en: "Find the lost tanuki in the busy town!",
    ja: "にぎやかな街で迷子のたぬきをさがそう！",
  },
  play: { en: "PLAY", ja: "あそぶ" },
  stageSelect: { en: "Select Stage", ja: "ステージえらび" },
  locked: { en: "LOCKED", ja: "ロック中" },
  normalMode: { en: "NORMAL", ja: "ノーマル" },
  hardMode: { en: "HARD", ja: "ハード" },
  hardNote: { en: "Characters move! Find friends too!", ja: "キャラが動き回る！ポンタ以外もさがす！" },
  friendsLabel: { en: "FIND ALSO", ja: "いっしょにさがす" },
  friendsIntro: { en: "Find these friends too!", ja: "この なかまも ぜんいん みつけよう！" },
  pontaFound: { en: "Ponta found!", ja: "ポンタ みつけた！" },
  friendFound: { en: "Friend found!", ja: "なかま みつけた！" },
  remaining: { en: "Left", ja: "のこり" },
  scoreFriends: { en: "Friends", ja: "なかま" },
  best: { en: "Best", ja: "ベスト" },
  wanted: { en: "WANTED", ja: "手配書" },
  featLeaf: { en: "Green leaf on his head", ja: "頭に緑の葉っぱ" },
  featBundle: { en: "Orange polka-dot bundle on his back", ja: "背中にオレンジの水玉風呂敷" },
  featScarf: { en: "Blue scarf around his neck", ja: "首に青いマフラー" },
  featCompact1: { en: "Green leaf", ja: "緑の葉っぱ" },
  featCompact2: { en: "Orange dotted bundle", ja: "橙の水玉風呂敷" },
  featCompact3: { en: "Blue scarf", ja: "青いマフラー" },
  introHint: { en: "All three features must match!", ja: "3つぜんぶそろった子がポンタ！" },
  introHow: { en: "Drag to pan / pinch or wheel to zoom / tap to pick", ja: "ドラッグで移動・ピンチ/ホイールで拡大・タップで選ぶ" },
  timeLimit: { en: "Time", ja: "制限時間" },
  pause: { en: "PAUSED", ja: "ポーズ中" },
  resume: { en: "RESUME", ja: "つづける" },
  quit: { en: "STAGES", ja: "ステージへ" },
  hint: { en: "Hint", ja: "ヒント" },
  bonus: { en: "Bonus", ja: "ボーナス" },
  miss: { en: "Miss", ja: "ハズレ" },
  found: { en: "FOUND PONTA!", ja: "ポンタ発見！" },
  timeUp: { en: "TIME UP", ja: "タイムアップ" },
  here: { en: "He was here!", ja: "ここにいたよ！" },
  clear: { en: "STAGE CLEAR!", ja: "ステージクリア！" },
  failed: { en: "TIME'S UP...", ja: "ざんねん…" },
  next: { en: "NEXT", ja: "つぎへ" },
  retry: { en: "RETRY", ja: "もういちど" },
  toStages: { en: "STAGES", ja: "ステージ" },
  toTitle: { en: "TITLE", ja: "タイトル" },
  scoreTotal: { en: "Score", ja: "スコア" },
  totalScoreAll: { en: "Total score", ja: "総スコア" },
  totalStarsAll: { en: "Total stars", ja: "総スター" },
  scoreBase: { en: "Base", ja: "ベース" },
  scoreTime: { en: "Time left", ja: "残り時間" },
  scoreBonus: { en: "Bonus items", ja: "ボーナス" },
  scoreMiss: { en: "Misses", ja: "ハズレ" },
  scoreHint: { en: "Hints", ja: "ヒント" },
  missedBonus: { en: "Missed bonus", ja: "取り逃し" },
  none: { en: "none", ja: "なし" },
  seed: { en: "Seed", ja: "シード" },
  newBest: { en: "NEW BEST!", ja: "ベスト更新！" },
  strawHat: { en: "Straw hat", ja: "麦わら帽子" },
  balloon: { en: "Balloon", ja: "風船" },
  stageLabel: { en: "Stage", ja: "ステージ" },
};

/** DICT に載せない一回きりの文言用。 */
export function tr(en: string, ja: string): string {
  return currentLocale === "ja" ? ja : en;
}

export function t(key: string): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[currentLocale];
}

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  setString(LOCALE_KEY, locale);
}

export const ALL_LOCALES: readonly Locale[] = LANGUAGES;

// ============================================================
// 共通 LocalizedEntry ヘルパ（キャラ名・セリフ用）
// ============================================================
export interface LocalizedTextEntry {
  en: string;
  ja: string;
}

export function pickLocalized<T extends LocalizedTextEntry>(entry: T): string {
  return currentLocale === "ja" ? entry.ja : entry.en;
}

export interface LocalizedLinesEntry {
  en: string[];
  ja: string[];
}

export function pickLocalizedLines<T extends LocalizedLinesEntry>(entry: T): string[] {
  return currentLocale === "ja" ? entry.ja : entry.en;
}
