import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== "production"),
  },
  build: {
    outDir: "dist",
    target: "es2022",
  },
});
