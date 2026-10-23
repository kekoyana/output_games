import { defineConfig } from "vite";

// itch.io の iframe 内で動作させるために相対パス必須
export default defineConfig({
  base: "./",
  server: {
    // 🔴 scaffold 時に docs/dev-ports.md の末尾から次の空き番号を採番して置き換える。
    //    テンプレは固定ポートを持たない（37タイトルが 5173 を奪い合う事故の再発防止）。
    //    採番後は `mise exec -- node scripts/check-dev-ports.mjs` で検査する。
    port: 5306,
    strictPort: true,
    host: true,
  },
});
