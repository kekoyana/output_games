// 地形タイプ
export type TerrainType = 'plain' | 'forest' | 'mountain' | 'sea';

// 時代
export type Era = 'ancient' | 'medieval' | 'modern' | 'atomic';

// ユニットタイプ
export type UnitType = 'warrior' | 'archer' | 'cavalry' | 'artillery';

// プレイヤーID
export type PlayerId = 'player' | 'ai1' | 'ai2';

// 難易度
export type Difficulty = 'easy' | 'normal' | 'hard';

// 勝利タイプ
export type VictoryType = 'conquest' | 'science' | 'timeout';

// ゲームフェーズ
export type GamePhase = 'resource' | 'city_action' | 'unit_move' | 'combat' | 'ai_turn' | 'end';

// 技術ID
export type TechId =
  | 'agriculture' | 'bronze' | 'archery' | 'calendar'
  | 'iron' | 'fortification' | 'mathematics' | 'printing'
  | 'industrialization' | 'mechanization' | 'electricity' | 'railroad'
  | 'nuclear_power' | 'computers' | 'space_program';

// 建物タイプ
export type BuildingType = 'barracks' | 'library' | 'fortress';

// ヘックス座標
export interface HexCoord {
  q: number;
  r: number;
}

// ヘックスタイル
export interface HexTile {
  coord: HexCoord;
  terrain: TerrainType;
  owner: PlayerId | null;
  cityId: string | null;
  unitId: string | null;
  visible: boolean;   // プレイヤーから見えるか
  explored: boolean;  // 一度でも探索したか
}

// 都市
export interface City {
  id: string;
  name: string;
  coord: HexCoord;
  owner: PlayerId;
  isCapital: boolean;
  production: number;  // 毎ターン産出
  science: number;     // 毎ターン産出
  buildings: BuildingType[];
  actionUsed: boolean; // このターンにアクション使用済みか
}

// ユニットステータス定義
export interface UnitStats {
  type: UnitType;
  attack: number;
  defense: number;
  maxHp: number;
  movement: number;
  range: number;
  productionCost: number;
}

// ユニットインスタンス
export interface Unit {
  id: string;
  type: UnitType;
  owner: PlayerId;
  coord: HexCoord;
  hp: number;
  maxHp: number;
  movesLeft: number;
  hasAttacked: boolean;
}

// 技術ノード
export interface TechNode {
  id: TechId;
  name: string;
  era: Era;
  cost: number;  // 科学力コスト
  description: string;
  requires: TechId[];
}

// プレイヤー状態
export interface PlayerState {
  id: PlayerId;
  name: string;
  color: number;      // Phaserの色数値
  colorHex: string;   // CSS色文字列
  production: number; // 蓄積生産力
  science: number;    // 蓄積科学力
  researchedTechs: Set<TechId>;
  currentEra: Era;
  cities: string[];   // City ID list
  units: string[];    // Unit ID list
  isEliminated: boolean;
}

// 技術ツリー
export interface TechTree {
  nodes: Map<TechId, TechNode>;
}

// ゲーム状態
export interface GameState {
  turn: number;
  maxTurns: number;
  phase: GamePhase;
  currentPlayer: PlayerId;
  players: Map<PlayerId, PlayerState>;
  tiles: Map<string, HexTile>;  // key: "q,r"
  cities: Map<string, City>;
  units: Map<string, Unit>;
  techTree: TechTree;
  difficulty: Difficulty;
  aiPlayerIds: PlayerId[];
  selectedUnitId: string | null;
  gameOver: boolean;
  winner: PlayerId | null;
  victoryType: VictoryType | null;
  pendingCityActions: string[]; // city IDs that need actions
  combatLog: string[];
  stats: GameStats;
}

// ゲーム統計
export interface GameStats {
  tilesOwned: Map<PlayerId, number>;
  techsResearched: Map<PlayerId, number>;
  unitsKilled: Map<PlayerId, number>;
  unitsLost: Map<PlayerId, number>;
}

// 都市アクションタイプ
export type CityActionType = 'build_city' | 'build_barracks' | 'build_library' | 'build_fortress' | 'research' | 'produce';

// 都市アクション
export interface CityAction {
  type: CityActionType;
  techId?: TechId;
  unitType?: UnitType;
  targetCoord?: HexCoord;
}

// AI設定
export interface AIConfig {
  aggressiveness: number;  // 0-1
  expansiveness: number;   // 0-1
  scienceFocus: number;    // 0-1
}
