// ゲーム全体の型定義

export type GamePhase =
  | 'title'
  | 'character_select'
  | 'map'
  | 'battle'
  | 'reward'
  | 'merchant'
  | 'rest'
  | 'event'
  | 'advisor'
  | 'game_over'
  | 'ending';

export type Faction = 'shu' | 'wei' | 'wu' | 'other';

export type DiceFace = 'sword' | 'shield' | 'strategy' | 'horse' | 'arrow' | 'star';

export type ActionSlot = 'attack' | 'defense' | 'strategy' | 'skill';

export interface Die {
  id: number;
  face: DiceFace;
  locked: boolean;
  assignedSlot: ActionSlot | null;
}

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  cost: { face: DiceFace; count: number };
  effect: 'all_attack' | 'buff_swords' | 'invincible_counter' | 'stun_enemy' | 'shield_to_attack';
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

export type NodeType = 'battle' | 'elite' | 'advisor' | 'merchant' | 'rest' | 'event' | 'boss';

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

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  attack: number;
  defense: number;
  isBoss: boolean;
  portraitKey: string;
  intents: EnemyIntent[];
  chapter?: number; // 出現する章（1=黄巾, 2=董卓軍, 3=曹操軍）
}

export interface Enemy extends EnemyDef {
  currentHp: number;
  currentIntent: EnemyIntent;
  blockAmount: number;
  buffed: boolean;
  stunned: boolean;
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

export interface GameState {
  phase: GamePhase;
  hero: Hero | null;
  map: GameMap | null;
  battle: BattleState | null;
  rewardInfo: RewardInfo | null;
  advisorCards: AdvisorCard[];
  merchantItems: MerchantItem[];
  currentEvent: GameEvent | null;
  showHelp: boolean;
  battleCount: number;
  tutorialStep: TutorialStep;
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
