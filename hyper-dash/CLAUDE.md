# ゲーム生成プロジェクト規約

## 概要
このディレクトリはAIが生成するWebゲームのプロジェクトです。
以下の規約に従ってゲームコードを生成してください。

## 技術スタック
- TypeScript (strict mode)
- Vite (ビルドツール)
- Canvas API または DOM ベースのレンダリング
- 外部ライブラリは基本使わない（必要な場合はpackage.jsonに追加）

## 対応端末
- PC（マウス・キーボード操作）
- スマートフォン（タッチ操作）
- レスポンシブ対応必須（画面サイズに応じて自動調整）

## ファイル構成ルール
- エントリポイント: `src/main.ts`
- ゲームロジック: `src/game.ts`
- 型定義: `src/types.ts`（必要に応じて）
- ユーティリティ: `src/utils.ts`（必要に応じて）
- 追加ファイルは `src/` 配下に自由に作成してよい

## コーディング規約
- 全てのファイルはTypeScriptで記述
- any型は禁止
- ゲームループは `requestAnimationFrame` を使用
- 入力はマウス/タッチ両方に対応すること（pointer eventsを推奨）
- 画面サイズは `window.innerWidth / innerHeight` を使い、リサイズに対応
- アセット（画像等）は使わず、Canvas描画やCSS、SVGインラインで表現する

## 生成時の注意
- index.html は変更しないこと（src/main.ts がエントリポイント）
- vite.config.ts は変更しないこと
- package.json は外部ライブラリが必要な場合のみ変更可
- ゲームはブラウザを開いた瞬間から遊べる状態にすること
