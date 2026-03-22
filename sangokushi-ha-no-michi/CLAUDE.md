# 三国志-覇への道

ダイスベースの戦略バトルRPG。蜀の武将を選び、マップを進み、ダイスを振ってスロットに配置して戦う。

## コマンド

| コマンド | 用途 |
|---------|------|
| `npm install` | 依存パッケージのインストール |
| `npx vite --port 5173 --host` | 開発サーバー起動 |
| `npx tsc --noEmit` | 型チェック |
| `npx vite build` | プロダクションビルド |

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
- `battle.ts` → バトルロジック・ダメージ計算（`calcSlotValue`共通関数）
- `data.ts` → 英雄・敵・アイテム等の定数データ
- `types.ts` → 全型定義
- `mapGen.ts` → マップ自動生成
- `utils.ts` → 描画ユーティリティ（drawText, drawPanel, wrapText等）

## 開発時の注意点
- 詳細は `docs/development-guide.md` を参照
