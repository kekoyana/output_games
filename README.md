# Game Collection

AIエージェントが自動生成したWebゲームのコレクションです。

**[ゲーム一覧ページを開く](https://kekoyana.github.io/gamelist/)**

ゲームの公開先は `gamelist` に移動しました。このリポジトリの GitHub Pages は旧URLから新URLへの案内に使用します。

## 公開中のゲーム

| ゲーム | 説明 | リンク |
|--------|------|--------|
| Bounce Breaker | ターン制ブロック崩し | [プレイする](https://kekoyana.github.io/gamelist/games/bounce-breaker/) |
| Hex Tower | 六角ブロック積み上げパズル | [プレイする](https://kekoyana.github.io/gamelist/games/hex-tower/) |
| Merge Drop | マージ落下パズル | [プレイする](https://kekoyana.github.io/gamelist/games/merge-drop/) |
| HYPER DASH!! | サイバーパンク風3レーン無限ランナー | [プレイする](https://kekoyana.github.io/gamelist/games/hyper-dash/) |
| Royal Rummy | ジン・ラミーのカードゲーム | [プレイする](https://kekoyana.github.io/gamelist/games/royal-rummy/) |
| CivRush | 10分で遊べるミニ文明戦略ゲーム | [プレイする](https://kekoyana.github.io/gamelist/games/civrush/) |

## 技術スタック

- TypeScript (strict mode)
- Vite (ビルドツール)
- Canvas API によるレンダリング
- 外部画像・音声不使用（Canvas描画/CSS/SVGで表現）
- PC + スマホ両対応（Pointer Events使用）

## 開発

各ゲームのソースは個別のディレクトリにあります。公開用のビルド成果物は `gamelist` リポジトリの `games/` に配置します。

```bash
# ローカルでビルド
./build.sh
```
