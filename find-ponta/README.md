# Phaser Template

Phaser 3 + TypeScript + Vite の再利用可能なゲームテンプレート。

## セットアップ

```bash
cd packages/phaser_template
npm install
npm run dev          # ポートは vite.config.ts の server.port（scaffold 時に docs/dev-ports.md から採番）
npm run build        # tsc + vite build
npm run preview      # ビルド成果物をプレビュー
```

## 同梱機能

- PC / スマホ両対応（縦長 / 横長レイアウト自動切替、rotate-overlay）
- 共通 UI: `createButton` / `createPanel` / `createGlowTitle` / 歯車 (`addGearButton`)
- Settings シーン（言語切替 / BGM / SFX / Reset）
- BGM / SFX（WebAudio で SE 合成、BGM は assets/bgm/*.mp3 等を自動検出）
- i18n（en / ja の最小辞書）
- localStorage 抽象（namespace 切替対応）
- Patreon CTA（Subscribe + Shop 2 ボタン併設）

詳細・カスタマイズ手順は `CLAUDE.md` を参照。
