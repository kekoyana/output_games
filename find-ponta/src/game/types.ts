// ゲームロジック共通の型（Phaser 非依存）

export const WORLD_W = 2304;
export const WORLD_H = 1536;

export type EntityKind = "ponta" | "decoy" | "mob" | "bonus";
export type BgKey = "bg_park" | "bg_market" | "bg_festival";
export type DecoyKey = "decoy_a" | "decoy_b" | "decoy_c" | "decoy_d" | "decoy_e";
export type BonusKey = "item_straw_hat" | "item_balloon";

export interface Point {
  x: number;
  y: number;
}

/** 配置エンティティ。x,y は足元（スプライト下端中央）の世界座標。 */
export interface Entity {
  id: number;
  kind: EntityKind;
  /** テクスチャキー（ファイル名と同じ） */
  tex: string;
  x: number;
  y: number;
  flip: boolean;
  scale: number;
}

export interface SceneLayout {
  ponta: Entity;
  decoys: Entity[];
  mobs: Entity[];
  bonuses: Entity[];
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
  fixedSeed: number;
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
}

export interface Box {
  l: number;
  t: number;
  r: number;
  b: number;
}

export type TapResult = "ponta" | "bonus" | "mob" | "decoy" | "empty";
