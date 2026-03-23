# 三国志-覇への道

ダイスベースの戦略バトルRPG。蜀の武将を選び、マップを進み、ダイスを振ってスロットに配置して戦う。

## コマンド

| コマンド | 用途 |
|---------|------|
| `npm install` | 依存パッケージのインストール |
| `npx vite --port 5173 --host` | 開発サーバー起動 |
| `npx tsc --noEmit` | 型チェック |
| `npx vite build` | プロダクションビルド |
| `npm run balance [回数]` | バランスシミュレーター実行（デフォルト500回） |

## 技術ルール
- TypeScript strict mode、any禁止
- index.html / vite.config.ts は変更禁止
- PC + スマホ両対応（Pointer Events使用、`touch-action: none`）
- 画像アセットは `src/assets/` 配下、`main.ts` でimportして `loadImages()` に渡す
- ゲームオブジェクトは `window.__game` でアクセス可能（Playwrightテスト用）

## アーキテクチャ概要
- `main.ts` → アセット読み込み・Game初期化
- `game.ts` → ゲームループ・入力処理・状態管理（`GameState`）・レイアウト計算
- `renderer.ts` → 全画面のCanvas描画（drawTitle, drawMap, drawBattle等）
- `battle.ts` → バトルロジック・ダメージ計算（`calcSlotValue`、`SLOT_MULTIPLIERS`）
- `data.ts` → 英雄・敵・アイテム等の定数データ（`HERO_DEFS`、`ENEMY_DEFS`、`rollDie`等）
- `types.ts` → 全型定義
- `mapGen.ts` → マップ自動生成（`pickNodeType`、`generateMap`）
- `utils.ts` → 描画ユーティリティ（drawText, drawPanel, wrapText等）
- `audio.ts` → Web Audio APIによるBGM・効果音
- `i18n.ts` → 多言語対応（日本語/English/中文）

## バランスシミュレーター

`scripts/balance-sim.ts` はゲームバランス検証用のシミュレーター。
`src/` のデータ（英雄・敵・アイテム・倍率テーブル等）を直接 import して使用するため、
ゲーム本体のデータを変更すればシミュレーション結果にも自動的に反映される。

### 使い方
```bash
npm run balance        # デフォルト500回
npm run balance 1000   # 試行回数指定
```

### 出力内容
- **全5章クリア率** — 各英雄の全章クリア率と章別死亡率
- **章別ボス撃破率** — 各章のボスに到達した者のうち撃破できた割合
- **クリア時の平均ステータス** — クリア時の攻撃力・防御力・MaxHP・ダイス数・残HP
- **レガシーレベル別クリア率** — 永続強化なし/中間/MAXでのクリア率比較

### 注意事項
- `scripts/` はViteのビルド対象外。デプロイ時に含まれない
- シミュレーターのバトルAIは簡易的なもの（人間プレイヤーより弱い想定）
- バランス目標: レガシーLv0で全英雄クリア率 15-40%、Lv MAXで 80%以上

## 開発時の注意点
- 詳細は `docs/development-guide.md` を参照
