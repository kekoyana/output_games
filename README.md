# Game Collection

AIエージェントが自動生成したWebゲームのコレクションです。

**[ゲーム一覧ページを開く](https://kekoyana.github.io/output_games/)**

## 公開中のゲーム

| ゲーム | 説明 | リンク |
|--------|------|--------|
| Bounce Breaker | ターン制ブロック崩し | [プレイする](https://kekoyana.github.io/output_games/bounce-breaker/) |
| Hex Tower | 六角ブロック積み上げパズル | [プレイする](https://kekoyana.github.io/output_games/hex-tower/) |
| Merge Drop | マージ落下パズル | [プレイする](https://kekoyana.github.io/output_games/merge-drop/) |
| HYPER DASH!! | サイバーパンク風3レーン無限ランナー | [プレイする](https://kekoyana.github.io/output_games/hyper-dash/) |
| Neon Sweep | オセロ式サンドイッチパズル | [プレイする](https://kekoyana.github.io/output_games/neon-sweep/) |

## 技術スタック

- TypeScript (strict mode)
- Vite (ビルドツール)
- Canvas API によるレンダリング
- 外部画像・音声不使用（Canvas描画/CSS/SVGで表現）
- PC + スマホ両対応（Pointer Events使用）

## 開発

各ゲームは個別のディレクトリに格納されており、GitHub Actions によって自動的にビルド・デプロイされます。

```bash
# ローカルでビルド
./build.sh
```
