# Royal Rummy

> 中世王宮トーナメント。**4人の挑戦者**と **ジン・ラミー** で勝負し、王に認められろ。`awork/rummia-night` (NSFW) からの全年齢移植版。

## 1. 世界観

中世の王宮で開催されるカードトーナメント。プレイヤーは王の御前で4人の挑戦者と勝負し、5勝先取または相手のHPを0にして勝ち上がる。勝つたびに自分の **旗** が1本ずつ立っていく演出。

## 2. ゲームコア

ジン・ラミー10枚変種（`src/game/gin-rummy.ts`）。ロジックは標準ルール準拠。

### スート

| シンボル | 意味 |
|---|---|
| 剣 (Sword) | — |
| 杖 (Wand) | — |
| 盾 (Shield) | — |
| 王冠 (Crown) | — |

### 用語

| ジン・ラミー | Royal Rummy |
|---|---|
| Knock | **ATTACK** |
| Gin | **CRITICAL!** |
| Meld (Set) | **COVEN ×3** |
| Meld (Run) | **CASCADE ×4** |
| Undercut | **COUNTER!** |

### HP・勝敗

- HP MAX 100 / 可変ダメージ（Rummia Night の式を流用）
- 試合終了条件: **5勝先取** または **HP 0** のどちらか先
- 勝ち負けカウントの進行は HP から独立（1勝 = 旗1本）

## 3. キャラクター（4人）

各キャラに AI プレイスタイル（Aggressive / Defensive / Tricky / Adaptive）を1人ずつ割り当てる。

| # | 画像 | 仮称 | プレイスタイル |
|---|---|---|---|
| 1 | `src/assets/characters/player1.jpg`（金髪剣士） | TBD | Aggressive |
| 2 | `src/assets/characters/player2.jpg`（緑髪聖女） | TBD | Defensive |
| 3 | `src/assets/characters/player3.jpg`（魔法使い少年） | TBD | Tricky |
| 4 | `src/assets/characters/player4.jpg`（黒髪斥候） | TBD | Adaptive |

スートシンボルは `src/assets/symbols/suits.png`（1254×1254 sprite sheet、左上=剣 / 右上=杖 / 左下=盾 / 右下=王冠、各 627×627）。

## 4. 削除した要素（NSFW版から）

- 脱衣システム / 衣装変化画像 → 旗ピップに置換
- reward / dialogue / gallery シーン
- モザイク / free-paid 分岐 / Patreon URL / CTA
- GA4 計測

## 5. 主要ファイル

| ファイル | 役割 |
|---|---|
| `src/game/gin-rummy.ts` | ジン・ラミーのコアロジック・AI |
| `src/scenes/title-scene.ts` | タイトル画面 |
| `src/scenes/select-scene.ts` | キャラ選択（4分割UI） |
| `src/scenes/tutorial-scene.ts` | How to Play |
| `src/scenes/game-scene.ts` | メインゲーム画面 |
| `src/scenes/gameover-scene.ts` | ゲームオーバー |
| `src/i18n.ts` | 多言語ラベル |

## 6. コマンド

| コマンド | 用途 |
|---|---|
| `npm install` | 依存パッケージインストール |
| `npm run dev` | 開発サーバー起動 |
| `npx tsc --noEmit` | 型チェック |
| `npm run build` | プロダクションビルド |
