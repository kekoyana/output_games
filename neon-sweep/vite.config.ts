import { defineConfig } from "vite";
import { singleFile } from "./plugins/vite-singlefile";

export default defineConfig({
  build: {
    outDir: "dist",
    target: "es2022",
  },
  plugins: [singleFile()],
});
