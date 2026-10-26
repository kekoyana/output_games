// ゲームロジック共通の型（Phaser 非依存）

export const WORLD_W = 2304;
export const WORLD_H = 1536;

export type EntityKind = "ponta" | "decoy" | "mob" | "bonus" | "friend" | "treasure" | "junk" | "junk";
export type BgKey = "bg_park" | "bg_market" | "bg_festival" | "bg_station" | "bg_amusement";
export type DecoyKey = "decoy_a" | "decoy_b" | "decoy_c" | "decoy_d" | "decoy_e";
export type BonusKey = "item_straw_hat" | "item_balloon";
export type TreasureKey =
  | "treasure_chest" | "treasure_crown" | "treasure_gem" | "treasure_coin" | "treasure_key";
export type JunkKey = "junk_boot" | "junk_can" | "junk_umbrella" | "junk_bottle" | "junk_paper" | "junk_box";

export interface Point {
  x: number;
  y: number;
}

/** front=正面立ち / shop=買い物（その場）/ walk=横向き歩き（往復）/ pair=追いかけっこ（2体組の往復） */
export type Pose = "front" | "shop" | "walk" | "pair";

/** 水平方向の往復運動。三角波（等速で往復し、端で向きを変える）。 */
export interface Move {
  /** 振幅(px)。x は hx ± amp の範囲を動く */
  amp: number;
  /** 往復1周の秒数 */
  period: number;
  /** 0-1 の位相 */
  phase: number;
  /** pair のみ: 相方の id と、相方に対する自分の側(+1=右, -1=左) */
  partner?: number;
  slot?: 1 | -1;
}

/** 配置エンティティ。x,y は足元（スプライト下端中央）の世界座標。 */
export interface Entity {
  id: number;
  kind: EntityKind;
  /** 基本テクスチャキー（正面。ポーズ違いは `${tex}_side` 等。ファイル名と同じ） */
  tex: string;
  /** 現在の x（動くキャラは毎フレーム更新される。当たり判定・演出はこれを使う） */
  x: number;
  /** 配置上の基準 x（配置・検証はこれで行う） */
  hx: number;
  y: number;
  pose: Pose;
  move?: Move;
  flip: boolean;
  scale: number;
}

export interface SceneLayout {
  ponta: Entity;
  decoys: Entity[];
  mobs: Entity[];
  bonuses: Entity[];
  /** HARD のみ: ポンタのほかに見つける「なかま」（モブと同じ種類の絵だが、その種類はこの1体だけ） */
  friends: Entity[];
  /** EXTREME のみ: 隠された宝物（小さなアイテム。全部見つけるとクリア） */
  treasures: Entity[];
  /** EXTREME のみ: 落ちているだけのガラクタ（宝物ではない。タップはハズレ） */
  junk: Entity[];
  /** 実際に採用した派生シード */
  usedSeed: number;
  /** 0 始まりの試行回数（ポンタ検証・配置失敗時に増える） */
  attempt: number;
}

export interface LocalText {
  en: string;
  ja: string;
}

export interface StageDef {
  id: number;
  name: LocalText;
  bg: BgKey;
  night: boolean;
  mobCount: number;
  mobTypes: string[];
  decoys: DecoyKey[];
  /** キャラ表示高さ(px) */
  height: number;
  timeLimit: number;
  hints: number;
  /** ポンタ可視面積の下限(0-1) */
  minVisible: number;
  /** 全エンティティ間の最小間隔(px) */
  minGap: number;
  bonuses: BonusKey[];
  /** デコイ-ポンタ最小距離 */
  decoyMinDist: number;
  /** ポンタから 600px 以内に置くデコイ数 */
  decoyNear: number;
  /** HARD で探すなかまの数 */
  hardFriends: number;
  /** EXTREME で隠す宝物の数 */
  treasures: number;
  /** EXTREME で散らすガラクタの数（落ちているものが全部宝物にならないようにする） */
  junk: number;
}

export interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

export type TapResult = "ponta" | "friend" | "treasure" | "junk" | "bonus" | "mob" | "decoy" | "empty";
