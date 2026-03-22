# 開発ガイド

## ゲームフロー

```
title → character_select → synopsis → map → [battle/advisor/merchant/rest/event] → reward → map → ... → ending
```

### フェーズ一覧（GamePhase）
| フェーズ | 説明 |
|---------|------|
| title | タイトル画面 |
| character_select | 武将選択（5人から選択、スクロール対応） |
| synopsis | あらすじ表示 |
| map | マップ画面（ノード選択で各イベントへ） |
| battle | ダイスバトル（assign → execute → roll のループ） |
| reward | 勝利報酬（金獲得） |
| advisor | 軍師カード（3択でアップグレード） |
| merchant | 商人（ゴールドで購入、購入済みアイテムはリストから消える） |
| rest | 休息（HP30%回復） |
| event | ランダムイベント |
| game_over | 敗北画面 |
| ending | 全章クリア画面 |

### バトルフェーズ（BattlePhase）
1. **assign** — ダイスをスロット（攻撃/防御/策略）に配置
2. **execute** — 行動確定でダメージ計算実行
3. **roll** — 次ターンのダイスロール
4. **result** — 反撃等による勝利のフォールバック表示（通常勝利は直接reward遷移）

## レイアウトシステム

`game.ts` の `_recalcLayout()` で全UIの座標を計算し、`Rect` として保持。`renderer.ts` はこれを受け取って描画のみ行う。

### バトル画面の構成（下から上へ）
```
[行動確定 / ダイスロール ボタン]  ← confirmBtnRect / rollBtnRect
[スキルボタン]                    ← skillBtnRect
[攻撃] [防御] [策略]              ← slotRects
[ダイス ダイス ダイス ダイス]      ← diceRects
[ヒントテキスト]
─── パネル上端 ───
[バトルログ]                      ← パネルの上に表示
```

全て画面中央揃え。パネル高さ: landscape 48%, portrait 42%。

## 画像アセット管理

1. 画像を `src/assets/` に配置
2. `src/main.ts` でimport文を追加
3. `IMAGE_PATHS` オブジェクトにキーを追加
4. `src/assets/manifest.json` を更新
5. コード内で `getImage('key')` で取得

### 背景画像の表示
`_drawBackground(ctx, w, h, imageKey, overlayAlpha)` で統一的にcover表示 + 暗めオーバーレイ。

## ダメージ計算

`battle.ts` の `calcSlotValue()` が攻撃/防御/策略の全計算を担当。`SLOT_MULTIPLIERS` テーブルで出目×スロットの倍率を一元管理。renderer.tsのプレビュー表示もこの関数を使用。

| スロット | 最適ダイス | 倍率 |
|---------|----------|------|
| 攻撃 | 剣/星(1.0) 弓(1.2) | 馬(0.5) 策(0.3) 盾(0.2) |
| 防御 | 盾/星(1.0) | 馬(0.7) 剣弓(0.3) 策(0.2) |
| 策略 | 策/星(0.6) | 剣弓(0.2) 馬盾(0) |

## チュートリアルシステム

`GameState.tutorialStep` で管理（TutorialStep型: -1=完了, 0=未開始, 1〜5=各ステップ）。

- Step 1〜3: タップで進行（説明のみ）
- Step 4: 全ダイスを配置すると自動進行
- Step 5: 行動確定で完了（tutorialStep=-1）

ハイライトは4矩形方式（くり抜きではなく、ハイライト領域を避けて暗い背景を4つの矩形で塗る）。

## Playwrightでのテスト

```javascript
// ゲーム状態を直接操作してバトルに入る
await page.evaluate(() => {
  const game = window.__game;
  game._startGame('guan_yu');  // 関羽でゲーム開始
});
await page.evaluate(() => {
  const game = window.__game;
  const node = game.state.map.nodes.find(n => n.available && !n.visited);
  if (node) game._enterNode(node);  // 最初のノードに入る
});
// チュートリアルをスキップ
await page.evaluate(() => { window.__game.state.tutorialStep = -1; });
// ダイスやスロットの位置を取得
const layout = await page.evaluate(() => ({
  diceRects: window.__game.diceRects,
  slotRects: window.__game.slotRects,
}));
```

マップのノード位置はランダムなので、ブルートフォースクリックでは不安定。`_enterNode()` で直接遷移するのが確実。

## モジュールスコープ定数

renderer.tsの描画で使う静的データ（`SLOT_LABELS`, `SLOT_COLORS`, `DICE_NAMES`, `CHAPTER_NAMES`等）はモジュールスコープに定義。毎フレーム再生成を避ける。

## 画像生成ルール

### 基本方針
- ポートレートは **WebP形式**（quality=85）で保存する。PNGは `raw/` に元データとして残す
- 生成には `ai-sprites-local/`（ローカルComfyUI、無料）を使用する
- プロダクト固有の生成スクリプトは `scripts/` ディレクトリに配置する
- 汎用モジュール（comfyui_client, workflows等）は `ai-sprites-local/` を `sys.path` 経由で参照する

### ポートレート生成の統一ルール
- **スタイル**: `anime game art, Three Kingdoms era`
- **構図**: `close-up head and shoulders portrait, face centered and large in frame`（顔のクローズアップで統一）
- **サイズ**: 512x512 で生成 → WebP (quality=85) に変換して保存
- **モデル**: AUTO_MODEL（メモリに応じて sdxl/flux/sd15 を自動選択）
- **ネガティブ**: `full body, waist shot, far away, small face` を必ず含める（画角ずれ防止）

### 新キャラ追加手順
1. `scripts/` にキャラ固有の生成スクリプトを作成
2. ComfyUIで生成 → `src/assets/portraits/raw/{name}.png`（元データ）
3. 512x512にリサイズ → `src/assets/portraits/{name}.webp`（WebP変換）
4. `src/assets/manifest.json` の `portraits` にエントリ追加
5. `src/main.ts` に `.webp` のimport文を追加し `IMAGE_PATHS` に登録
6. `src/data.ts` の敵/英雄定義に `portraitKey` を設定

### 背景画像
- JPG形式、960x540 程度
- `src/assets/backgrounds/` に配置
- manifest.json の `backgrounds` に登録

## よくある落とし穴

- **Canvas compositing**: `destination-out` はバトル画面の暗いオーバーレイも消してしまう。くり抜きには4矩形方式を使う
- **スクロール**: キャラ選択のスクロールは `touchmove` イベントで実装。`wheel` はマップ画面のみ対応
- **敵ポートレート**: `portraitKey` が `data.ts` の敵定義と `main.ts` の `IMAGE_PATHS` の両方に必要
