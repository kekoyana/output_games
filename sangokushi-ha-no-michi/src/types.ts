// ゲーム全体の型定義

export type GamePhase =
  | 'title'
  | 'character_select'
  | 'synopsis'
  | 'map'
  | 'battle'
  | 'reward'
  | 'merchant'
  | 'rest'
  | 'event'
  | 'advisor'
  | 'game_over'
  | 'ending'
  | 'legacy';

export type Faction = 'shu' | 'wei' | 'wu' | 'other';

export type DiceFace = 'sword' | 'shield' | 'strategy' | 'horse' | 'arrow' | 'star';

export type ActionSlot = 'attack' | 'defense' | 'strategy' | 'skill';

export interface Die {
  id: number;
  face: DiceFace;
  /** ダイスの素の面（この面が出やすい） */
  nativeFace: DiceFace;
  locked: boolean;
  assignedSlot: ActionSlot | null;
}

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  cost: { face: DiceFace; count: number };
  effect: 'all_attack' | 'buff_swords' | 'invincible_counter' | 'stun_enemy' | 'shield_to_attack' | 'heal';
}

export interface HeroStats {
  maxHp: number;
  attack: number;
  defense: number;
  diceCount: number;
}

export interface HeroDef {
  id: string;
  name: string;
  faction: Faction;
  portraitKey: string;
  diceSet: DiceFace[];
  skill: SkillDef;
  stats: HeroStats;
  description: string;
}

export interface Hero extends HeroDef {
  currentHp: number;
  gold: number;
  upgrades: string[];
}

export type NodeType = 'battle' | 'elite' | 'advisor' | 'merchant' | 'rest' | 'event' | 'boss' | 'start';

export interface MapNode {
  id: number;
  type: NodeType;
  x: number;
  y: number;
  connections: number[];
  visited: boolean;
  available: boolean;
}

export interface GameMap {
  nodes: MapNode[];
  currentNodeId: number | null;
  chapter: number;
}

export type EnemyIntent = 'attack' | 'defend' | 'buff' | 'special';

/** ボス固有ギミックID */
export type BossGimmick =
  | 'zhang_jiao_sorcery'    // 妖術: ダイス1個を策に変換
  | 'dong_zhuo_tyranny'     // 暴虐: 3ターンごとに防御無視ダメージ
  | 'lu_bu_halberd'         // 方天画戟: HP50%以下で攻撃永続1.5倍
  | 'yuan_shu_seal'         // 玉璽の威光: 防御スロット効果半減
  | 'cao_cao_scheme';       // 覇者の策謀: スキルコスト+1

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  attack: number;
  defense: number;
  isBoss: boolean;
  portraitKey: string;
  intents: EnemyIntent[];
  chapter?: number;
  gimmick?: BossGimmick;
}

export interface Enemy extends EnemyDef {
  currentHp: number;
  currentIntent: EnemyIntent;
  blockAmount: number;
  buffed: boolean;
  stunned: boolean;
  gimmickActivated: boolean;
}

export type BattlePhase = 'roll' | 'assign' | 'execute' | 'enemy_turn' | 'result';

export interface BattleState {
  enemy: Enemy;
  dice: Die[];
  phase: BattlePhase;
  heroBlock: number;
  skillActivated: boolean;
  turnCount: number;
  message: string;
  invincible: boolean;
  counterPending: boolean;
  log: string[];
}

export interface AdvisorCard {
  id: string;
  name: string;
  description: string;
  effect: AdvisorEffect;
}

export type AdvisorEffect =
  | { type: 'add_dice'; face: DiceFace }
  | { type: 'upgrade_stat'; stat: 'attack' | 'defense' | 'maxHp'; amount: number }
  | { type: 'add_skill_slot' }
  | { type: 'gold'; amount: number };

export interface MerchantItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  effect: AdvisorEffect;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  options: EventOption[];
}

export interface EventOption {
  text: string;
  effect: 'hp_up' | 'hp_down' | 'gold_up' | 'gold_down' | 'buff' | 'nothing';
  value: number;
}

export interface RewardInfo {
  goldEarned: number;
  enemyName: string;
  isBoss: boolean;
}

/** チュートリアルステップ: 0=非表示, 1〜=各ステップ, -1=完了済み */
export type TutorialStep = -1 | 0 | 1 | 2 | 3 | 4 | 5;

/** ローグライト永続アップグレード定義 */
export interface LegacyUpgradeDef {
  id: string;
  maxLevel: number;
  costs: number[];
  effects: number[]; // 各レベルの効果量
  stat: 'maxHp' | 'attack' | 'defense' | 'gold' | 'healPercent' | 'unlockHero';
  heroId?: string; // stat === 'unlockHero' 時の対象武将ID
}

/** ローグライト永続データ（localStorage保存） */
export interface LegacyData {
  version: number;
  totalRuns: number;
  bestChapter: number;
  legacyPoints: number;
  upgrades: Record<string, number>; // upgradeId → 購入レベル
  lastEarnedPoints: number; // 直前のランで獲得したポイント
}

export interface GameState {
  phase: GamePhase;
  hero: Hero | null;
  map: GameMap | null;
  battle: BattleState | null;
  rewardInfo: RewardInfo | null;
  advisorCards: AdvisorCard[];
  merchantItems: MerchantItem[];
  currentEvent: GameEvent | null;
  eventResult: string | null;
  showHelp: boolean;
  battleCount: number;
  tutorialStep: TutorialStep;
  mapTutorialStep: 0 | 1 | 2 | -1;
  lang: 'ja' | 'en' | 'zh';
  legacyData: LegacyData;
  enemiesDefeated: number;
  bossesDefeated: number;
  chaptersReached: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
