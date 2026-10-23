# phaser_template — Phaser 3 ベース再利用テンプレート

Phaser 3 + TypeScript + Vite で書くゲーム用の最小スケルトン。
**PC + スマホ両対応**（縦長 / 横長レイアウト自動切替、rotate-overlay 警告、`ResizeObserver` 安全リサイズ）を最初から内蔵する。

Canvas 直描画系の `packages/casual_nsfw/`（NSFW カジュアル量産用 Canvas テンプレ）とは独立。
**Phaser 系の新規タイトルはこのテンプレを起点に作る**。

## 制作モード

制作開始時にルート基準の `docs/game-production-modes.md` を読む。本書のテンプレート固定と共通UIの踏襲は省力制作の既定。品質重視では作品に必要な実装方式と画面を設計し、このテンプレートは必要な基盤の再利用に使える。共通の保存・入力・i18n・固定ポート・配信等の規約は維持する。

対応言語・音量調整・設定保存等の製品仕様は同文書「両モードで維持する製品仕様」と対象の規約に従う。同梱のen/jaは最小サンプルであり、NSFW新作の7言語標準を縮小する指定ではない。

## 同梱機能

| カテゴリ | モジュール | 主要 API |
|---|---|---|
| 環境検出 | `src/layout.ts` | `detectLayoutMode` / `getDesignSize` / `isLandscape` |
| UI ベース | `src/ui/theme.ts` | `createButton` / `createPanel` / `createOrnatePanel` / `createGlowTitle` / `paintFantasyBackground` / `fadeToScene` |
| 設定起動 | `src/ui/gear.ts` | `addGearButton` |
| エフェクト | `src/ui/effects.ts` | `spawnDamageText` / `spawnKillBurst` / `spawnHitSpark` / `flashScreen` / `shakeScreen` 他 |
| Patreon CTA | `src/ui/patreon-cta.ts` | `createPatreonCta` / `openPatreonDirect` / `ctaBannerHeight` |
| 設定シーン | `src/scenes/SettingsScene.ts` | 言語 / BGM / SFX / Reset / Close |
| Preload | `src/scenes/PreloadScene.ts` | プログレスバー + サンプルテクスチャ |
| サンプル | `src/scenes/ExampleHomeScene.ts` | テンプレ動作確認用ホーム |
| BGM / SFX | `src/core/bgm.ts` / `src/core/sfx.ts` | 多トラック BGM + WebAudio 合成 SE |
| ストレージ | `src/core/storage.ts` | `setStorageNamespace` + `getString` / `setNumber` / `clearAll` 等 |
| i18n | `src/i18n.ts` | `t(key)` / `setLocale` / `getLocale` / `pickLocalized` |

## 使い方（新規タイトル開発フロー）

1. ディレクトリごとコピー
   ```bash
   cp -r packages/phaser_template/ awork/<new-title>/
   cd awork/<new-title>
   ```
2. `package.json` の `name` を `@create-game/<new-title>` 等に変更
3. `index.html` の `<title>` をゲーム名に変更
4. `src/main.ts` の `setStorageNamespace("<your-game-slug>")` をゲーム名に変更
5. `src/i18n.ts` の `DICT` にゲーム固有テキストを追加（必要なら ru / de / fr も）
6. `src/ui/patreon-cta.ts` の `PATREON_SUBSCRIBE_URL` / `PATREON_SHOP_URL` を実 URL に差し替え
7. `src/scenes/` に独自シーン（Title / Game / Reward 等）を追加し、`src/main.ts` の `scene` 配列に登録
8. `npm install && npm run dev` で動作確認

## カスタマイズポイントまとめ

| ファイル | 変更箇所 |
|---|---|
| `index.html` | `<title>` をゲーム名に |
| `src/main.ts` | `setStorageNamespace(...)` / `scene` 配列に独自シーン追加 |
| `src/i18n.ts` | `DICT` を拡張（最小は en / ja のみ） |
| `src/ui/patreon-cta.ts` | `PATREON_SUBSCRIBE_URL` / `PATREON_SHOP_URL` を実 URL に |
| `src/scenes/PreloadScene.ts` | `preload()` 内でゲームアセットを `this.load.*` で読み込み |
| `src/assets/bgm/*.mp3` | BGM ファイルを配置（複数トラック対応、ファイル名がトラック名） |

## レイアウト仕様

- 縦長 (`portrait`): 540 × 960（短辺 < 500px のスマホ向け）
- 横長 (`landscape`): 1280 × 720（PC / タブレット横向け）
- 起動時に `detectLayoutMode()` で判定 → `getDesignSize()` で Phaser に渡す
- スマホ横持ち時は CSS `@media (orientation: landscape) and (max-height: 500px)` で `#rotate-overlay` 警告を表示
- 起動後のリサイズで縦横モードが切り替わったら `#reload-hint` を表示してリロードを促す

シーン内で「縦長 / 横長で配置を切り替える」場合は `isLandscape()` を使う。`ExampleHomeScene` を参照。

## リサイズ周りの注意（参照: 親 CLAUDE.md）

- canvas を `document.body` の直下に置かない（無限ループ化を防ぐ）。`#game-root` を `position: fixed; inset: 0` で固定し、Phaser の `parent` をそれに向ける（テンプレで実装済み）
- `window.resize` ではなく `ResizeObserver` で `#game-root.clientWidth/Height` を観測する（`src/main.ts` で実装済み）

## Patreon CTA 設計（要点）

`packages/casual_nsfw` で確立した「Subscribe + Shop の 2 ボタン併設」を Phaser 用に再実装している。

- 標準: Subscribe（上）+ Shop（下）の縦並び 2 ボタン
- `PATREON_SHOP_URL` が `null` の場合は Subscribe のみの 1 ボタン
- GA4 `patreon_click` イベントは `onTrack` コールバック経由でゲーム実装側に通知（テンプレ側は GA4 を持たない）
- 詳細: `packages/casual_nsfw/CLAUDE.md` 「Patreon CTA 動線設計」セクション

## 既存タイトル例

- **Demon Lord's Harem**（`awork/demon-lords-harem/`）— Phaser ベース最初のテンプレ採用例

## 注意

- Canvas 直描画系（`packages/casual_nsfw`）とは独立した別系統。混在させない
- TypeScript strict + `noUnusedLocals` + `noUnusedParameters` 有効。テンプレを継承するゲーム側でも同じ設定を維持する
- 外部画像・音声は使わない方針（親 CLAUDE.md 準拠）。アセットはローカル ComfyUI / agy(Gemini) / codex 等で自前生成する（無料バックエンド）
- BGM ファイルは `src/assets/bgm/<track>.mp3` 等に配置。`playBgm("opening")` で再生
