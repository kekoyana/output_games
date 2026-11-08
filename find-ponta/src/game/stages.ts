import type { BgKey, DecoyKey, Point, StageDef } from "./types";

/** 背景ごとの歩行可能領域（正規化座標 0-1、足元がこの内側に入ること）。 */
export const WALK_POLYGONS: Record<BgKey, Point[]> = {
  bg_park: [
    { x: 0.04, y: 0.28 }, { x: 0.96, y: 0.28 },
    { x: 0.96, y: 0.97 }, { x: 0.04, y: 0.97 },
  ],
  bg_market: [
    { x: 0.0, y: 0.4 }, { x: 0.4, y: 0.4 }, { x: 1.0, y: 0.7 },
    { x: 1.0, y: 0.98 }, { x: 0.0, y: 0.98 },
  ],
  bg_festival: [
    { x: 0.3, y: 0.42 }, { x: 0.66, y: 0.42 },
    { x: 1.0, y: 0.98 }, { x: 0.0, y: 0.98 },
  ],
  // 駅前: 駅舎の手前の石畳（上端 y≈0.46 から下）
  bg_station: [
    { x: 0.03, y: 0.47 }, { x: 0.97, y: 0.47 },
    { x: 0.97, y: 0.97 }, { x: 0.03, y: 0.97 },
  ],
  // 遊園地: 観覧車・メリーゴーランドの手前の石畳と広場（上端 y≈0.5 から下）
  bg_amusement: [
    { x: 0.04, y: 0.5 }, { x: 0.96, y: 0.5 },
    { x: 0.96, y: 0.97 }, { x: 0.04, y: 0.97 },
  ],
};

/** EXTREME の宝物（小さなアイコン。毎回違う組み合わせ・位置で隠す） */
export const TREASURE_KEYS = [
  "treasure_chest", "treasure_crown", "treasure_gem", "treasure_coin", "treasure_key",
] as const;

/** EXTREME のガラクタ（宝物と見分けがつくよう、くすんだ普通の落とし物） */
export const JUNK_KEYS = [
  "junk_boot", "junk_can", "junk_umbrella", "junk_bottle", "junk_paper", "junk_box",
] as const;

const BASE_MOBS = [
  "mob_cat_orange", "mob_cat_black", "mob_rabbit", "mob_fox",
  "mob_bear", "mob_shiba", "mob_penguin", "mob_chick",
];
const MOBS_11 = [...BASE_MOBS, "mob_boy", "mob_tanuki_a", "mob_tanuki_b"];
const MOBS_14 = [
  ...BASE_MOBS, "mob_boy", "mob_girl", "mob_granny", "mob_chef",
  "mob_tanuki_a", "mob_tanuki_b",
];

function rep(list: Array<[DecoyKey, number]>): DecoyKey[] {
  const out: DecoyKey[] = [];
  for (const [k, n] of list) for (let i = 0; i < n; i++) out.push(k);
  return out;
}

export const STAGES: StageDef[] = [
  {
    id: 1, name: { en: "Sunny Park", ja: "ひなたの公園" },
    bg: "bg_park", night: false,
    mobCount: 60, mobTypes: BASE_MOBS,
    decoys: rep([["decoy_d", 2], ["decoy_e", 2]]),
    height: 96, timeLimit: 90, hints: 3, minVisible: 0.85, minGap: 70,
    bonuses: [], decoyMinDist: 300, decoyNear: 0, hardFriends: 2, treasures: 3, junk: 4,
  },
  {
    id: 2, name: { en: "Seaside Market", ja: "うみべのマーケット" },
    bg: "bg_market", night: false,
    mobCount: 100, mobTypes: MOBS_11,
    decoys: rep([["decoy_a", 2], ["decoy_b", 2], ["decoy_d", 2], ["decoy_e", 2]]),
    height: 84, timeLimit: 105, hints: 2, minVisible: 0.8, minGap: 55,
    bonuses: [], decoyMinDist: 300, decoyNear: 0, hardFriends: 3, treasures: 4, junk: 6,
  },
  {
    id: 3, name: { en: "Festival Street", ja: "おまつりどおり" },
    bg: "bg_festival", night: false,
    mobCount: 150, mobTypes: MOBS_14,
    decoys: rep([["decoy_a", 3], ["decoy_b", 3], ["decoy_c", 2], ["decoy_d", 2], ["decoy_e", 2]]),
    height: 72, timeLimit: 120, hints: 2, minVisible: 0.75, minGap: 45,
    bonuses: ["item_straw_hat"], decoyMinDist: 150, decoyNear: 3, hardFriends: 3, treasures: 4, junk: 8,
  },
  {
    id: 4, name: { en: "Moonlit Park", ja: "つきよの公園" },
    bg: "bg_park", night: true,
    mobCount: 200, mobTypes: MOBS_14,
    decoys: rep([["decoy_a", 4], ["decoy_b", 4], ["decoy_c", 3], ["decoy_d", 3], ["decoy_e", 2]]),
    height: 64, timeLimit: 150, hints: 1, minVisible: 0.7, minGap: 38,
    bonuses: ["item_straw_hat", "item_balloon"], decoyMinDist: 100, decoyNear: 4, hardFriends: 4, treasures: 5, junk: 10,
  },
  {
    id: 5, name: { en: "Station Square", ja: "えきまえひろば" },
    bg: "bg_station", night: false,
    mobCount: 240, mobTypes: MOBS_14,
    decoys: rep([["decoy_a", 4], ["decoy_b", 4], ["decoy_c", 4], ["decoy_d", 3], ["decoy_e", 3]]),
    height: 58, timeLimit: 165, hints: 1, minVisible: 0.68, minGap: 34,
    bonuses: ["item_straw_hat", "item_balloon"], decoyMinDist: 90, decoyNear: 5, hardFriends: 4, treasures: 5, junk: 12,
  },
  {
    id: 6, name: { en: "Twilight Amusement Park", ja: "ゆうやけの遊園地" },
    bg: "bg_amusement", night: false,
    mobCount: 280, mobTypes: MOBS_14,
    decoys: rep([["decoy_a", 5], ["decoy_b", 5], ["decoy_c", 4], ["decoy_d", 3], ["decoy_e", 3]]),
    height: 54, timeLimit: 180, hints: 1, minVisible: 0.66, minGap: 31,
    bonuses: ["item_straw_hat", "item_balloon"], decoyMinDist: 80, decoyNear: 6, hardFriends: 5, treasures: 5, junk: 14,
  },
  {
    id: 7, name: { en: "Moonlit Night Market", ja: "よいのくちの夜市" },
    bg: "bg_market", night: true,
    mobCount: 300, mobTypes: MOBS_14,
    decoys: rep([["decoy_a", 5], ["decoy_b", 5], ["decoy_c", 4], ["decoy_d", 4], ["decoy_e", 3]]),
    height: 52, timeLimit: 190, hints: 1, minVisible: 0.65, minGap: 29,
    bonuses: ["item_straw_hat", "item_balloon"], decoyMinDist: 75, decoyNear: 6, hardFriends: 5, treasures: 5, junk: 15,
  },
  {
    id: 8, name: { en: "Starry Festival", ja: "ほしぞらのおまつり" },
    bg: "bg_festival", night: true,
    mobCount: 320, mobTypes: MOBS_14,
    decoys: rep([["decoy_a", 5], ["decoy_b", 5], ["decoy_c", 5], ["decoy_d", 4], ["decoy_e", 3]]),
    height: 50, timeLimit: 200, hints: 1, minVisible: 0.64, minGap: 27,
    bonuses: ["item_straw_hat", "item_balloon"], decoyMinDist: 70, decoyNear: 7, hardFriends: 5, treasures: 5, junk: 16,
  },
  {
    id: 9, name: { en: "Midnight Station", ja: "しんやのえき" },
    bg: "bg_station", night: true,
    mobCount: 340, mobTypes: MOBS_14,
    decoys: rep([["decoy_a", 6], ["decoy_b", 5], ["decoy_c", 5], ["decoy_d", 4], ["decoy_e", 4]]),
    height: 48, timeLimit: 210, hints: 1, minVisible: 0.63, minGap: 26,
    bonuses: ["item_straw_hat", "item_balloon"], decoyMinDist: 65, decoyNear: 7, hardFriends: 6, treasures: 5, junk: 17,
  },
  {
    id: 10, name: { en: "Starlit Amusement Park", ja: "ほしあかりの遊園地" },
    bg: "bg_amusement", night: true,
    mobCount: 360, mobTypes: MOBS_14,
    decoys: rep([["decoy_a", 6], ["decoy_b", 6], ["decoy_c", 5], ["decoy_d", 4], ["decoy_e", 4]]),
    height: 46, timeLimit: 220, hints: 1, minVisible: 0.62, minGap: 25,
    bonuses: ["item_straw_hat", "item_balloon"], decoyMinDist: 60, decoyNear: 8, hardFriends: 6, treasures: 5, junk: 18,
  },
  {
    id: 11, name: { en: "Grand Park Fair", ja: "なかよし大市の公園" },
    bg: "bg_park", night: false,
    mobCount: 380, mobTypes: MOBS_14,
    decoys: rep([["decoy_a", 6], ["decoy_b", 6], ["decoy_c", 6], ["decoy_d", 5], ["decoy_e", 4]]),
    height: 44, timeLimit: 230, hints: 1, minVisible: 0.6, minGap: 24,
    bonuses: ["item_straw_hat", "item_balloon"], decoyMinDist: 55, decoyNear: 9, hardFriends: 6, treasures: 5, junk: 20,
  },
  {
    id: 12, name: { en: "Ponta's Grand Finale", ja: "ポンタ大集合フィナーレ" },
    bg: "bg_festival", night: false,
    mobCount: 400, mobTypes: MOBS_14,
    decoys: rep([["decoy_a", 7], ["decoy_b", 7], ["decoy_c", 6], ["decoy_d", 5], ["decoy_e", 5]]),
    height: 42, timeLimit: 240, hints: 1, minVisible: 0.58, minGap: 22,
    bonuses: ["item_straw_hat", "item_balloon"], decoyMinDist: 50, decoyNear: 10, hardFriends: 7, treasures: 5, junk: 22,
  },
];

export const NIGHT_TINT = 0x6677aa;
