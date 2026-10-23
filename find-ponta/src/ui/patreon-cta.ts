// Phaser 用 Patreon CTA ボタン（Subscribe + Shop 2 ボタン併設標準）
//
// ゲーム実装側で URL を差し替えてください:
//   - PATREON_SUBSCRIBE_URL: Patreon Tier ページ（月額サブスク）
//   - PATREON_SHOP_URL:      Patreon Shop 商品ページ（単発購入）
//
// 設計参照: packages/casual_nsfw/src/ui/patreon-cta.ts（Canvas 版）
// テンプレでは Phaser.GameObjects.Container で 1〜2 ボタンを返す。
//
// CTA 動線設計（casual_nsfw CLAUDE.md「Patreon CTA 動線設計」原則）:
//   - reward 画面の CTA は常時表示（dialog 経由禁止 = 1 クリックで Patreon へ）
//   - Subscribe + Shop の 2 ボタン併設を新標準とする（2026-05-16 〜）
//   - CTA 文言は ★ で挟む。ゲームによってカスタム可
//   - GA4 `patreon_click` を `source` と `cta_type` で送る（ゲーム実装側で実装）

import Phaser from "phaser";
import { createButton } from "./theme";

// ============================================================
// プレースホルダー URL — ゲーム実装側で必ず差し替える
// ============================================================
export const PATREON_SUBSCRIBE_URL = "https://patreon.com/yourcampaign";
export const PATREON_SHOP_URL: string | null = null; // 設定すると Shop ボタンが表示される

// 価格の SSOT = packages/casual_nsfw/src/pricing.ts（パッケージ独立のため値を
// 複製している。価格改定時はそちらの変更に追随させる）
const MEMBERSHIP_PRICE = "$5";
const SHOP_PRICE = "$5";

export type CtaSource =
  | "title_cta"
  | "select_cta"
  | "select_locked"
  | "reward_cta";

export type CtaTier = "subscribe" | "shop";

export interface PatreonCtaOptions {
  scene: Phaser.Scene;
  /** バナーの中心 X 座標 */
  x: number;
  /** バナーの中心 Y 座標 */
  y: number;
  width?: number;
  /** Subscribe ラベル（省略時はデフォルト文言） */
  subscribeLabel?: string;
  /** Shop ラベル（省略時はデフォルト文言。SHOP URL が null なら非表示） */
  shopLabel?: string;
  /** GA4 patreon_click イベント source */
  source: CtaSource;
  /** GA4 などへの追加トラッキング。実装は呼び出し側で */
  onTrack?: (tier: CtaTier, source: CtaSource) => void;
  /** URL を上書きしたい場合のみ指定 */
  subscribeUrl?: string;
  shopUrl?: string | null;
}

/**
 * Patreon CTA を生成する。返り値は Container（必要なら .setVisible(false) で非表示にできる）。
 *
 * 例:
 * ```
 * createPatreonCta({
 *   scene: this,
 *   x: w / 2,
 *   y: h - 80,
 *   width: w - 40,
 *   source: "reward_cta",
 *   onTrack: (tier, src) => trackEvent("patreon_click", { source: src, cta_type: tier }),
 * });
 * ```
 */
export function createPatreonCta(opts: PatreonCtaOptions): Phaser.GameObjects.Container {
  const subUrl = opts.subscribeUrl ?? PATREON_SUBSCRIBE_URL;
  const shopUrl = opts.shopUrl === undefined ? PATREON_SHOP_URL : opts.shopUrl;
  const w = opts.width ?? 360;
  const btnH = shopUrl ? 60 : 72;
  const gap = 10;

  const container = opts.scene.add.container(opts.x, opts.y);

  const subscribeLabel = opts.subscribeLabel ?? `★ SUBSCRIBE - ALL GAMES ${MEMBERSHIP_PRICE}/MO ★`;
  const shopLabel = opts.shopLabel ?? `★ UNLOCK ALL + UNCENSORED - ${SHOP_PRICE} ★`;

  // 2 ボタンモード: Subscribe（上）+ Shop（下）
  // 1 ボタンモード: Subscribe のみ
  const subscribeY = shopUrl ? -(btnH / 2 + gap / 2) : 0;
  const shopY = btnH / 2 + gap / 2;

  const subscribeBtn = createButton({
    scene: opts.scene,
    x: 0,
    y: subscribeY,
    width: w,
    height: btnH,
    label: subscribeLabel,
    variant: "red",
    fontSize: 20,
    onClick: () => {
      opts.onTrack?.("subscribe", opts.source);
      window.open(subUrl, "_blank", "noopener");
    },
  });
  container.add(subscribeBtn);

  if (shopUrl) {
    const shopBtn = createButton({
      scene: opts.scene,
      x: 0,
      y: shopY,
      width: w,
      height: btnH,
      label: shopLabel,
      variant: "purple",
      fontSize: 18,
      onClick: () => {
        opts.onTrack?.("shop", opts.source);
        window.open(shopUrl, "_blank", "noopener");
      },
    });
    container.add(shopBtn);
  }

  return container;
}

/**
 * Patreon URL を直接開く（CTA バナー以外、ロックキャラタップ等の単発導線で使う）。
 * @param tier "subscribe" なら Tier ページ、"shop" なら Shop ページ
 */
export function openPatreonDirect(
  source: CtaSource,
  tier: CtaTier = "subscribe",
  onTrack?: (tier: CtaTier, source: CtaSource) => void,
  urls?: { subscribeUrl?: string; shopUrl?: string | null },
): void {
  const subUrl = urls?.subscribeUrl ?? PATREON_SUBSCRIBE_URL;
  const shopUrl = urls?.shopUrl === undefined ? PATREON_SHOP_URL : urls.shopUrl;
  onTrack?.(tier, source);
  const url = tier === "shop" && shopUrl ? shopUrl : subUrl;
  window.open(url, "_blank", "noopener");
}

/**
 * CTA バナーが占有する垂直方向の高さ。レイアウト計算で使う。
 */
export function ctaBannerHeight(hasShop: boolean = !!PATREON_SHOP_URL): number {
  if (hasShop) return 60 * 2 + 10;
  return 72;
}
