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
];

export const NIGHT_TINT = 0x6677aa;
