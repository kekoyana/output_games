// 読み込むアセットのキー一覧（キー = ファイル名）
export const BG_KEYS = ["bg_park", "bg_market", "bg_festival"] as const;

export const CHAR_KEYS = [
  "ponta",
  "decoy_a", "decoy_b", "decoy_c", "decoy_d", "decoy_e",
  "mob_tanuki_a", "mob_tanuki_b", "mob_cat_orange", "mob_cat_black", "mob_rabbit",
  "mob_fox", "mob_bear", "mob_shiba", "mob_penguin", "mob_chick",
  "mob_boy", "mob_girl", "mob_granny", "mob_chef",
] as const;

/** キャラごとのポーズ違い（side=横向き歩き, shop=買い物, flee=逃げる, chase=追いかける） */
export const POSES = ["side", "shop", "flee", "chase"] as const;

export const SPRITE_KEYS: string[] = [
  ...CHAR_KEYS,
  ...CHAR_KEYS.flatMap((c) => POSES.map((p) => `${c}_${p}`)),
  "item_straw_hat", "item_balloon",
];

export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}assets/${path}`;
}
