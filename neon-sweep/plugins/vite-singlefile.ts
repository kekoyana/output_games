import type { Plugin } from "vite";

/**
 * Vite plugin that inlines all JS/CSS into a single HTML file.
 * The output works with file:// protocol (no CORS issues).
 */
export function singleFile(): Plugin {
  return {
    name: "vite-singlefile",
    enforce: "post",
    generateBundle(_, bundle) {
      const htmlKey = Object.keys(bundle).find((k) => k.endsWith(".html"));
      if (!htmlKey) return;

      const htmlChunk = bundle[htmlKey];
      if (htmlChunk.type !== "asset") return;

      let html = htmlChunk.source as string;

      // Inline JS files: remove original <script> tags and insert before </body>
      const inlineScripts: string[] = [];
      for (const [key, chunk] of Object.entries(bundle)) {
        if (chunk.type === "chunk" && key.endsWith(".js")) {
          const srcPattern = new RegExp(
            `<script[^>]*src=["']/?(${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})["'][^>]*>\\s*</script>\\n?`
          );
          html = html.replace(srcPattern, "");
          inlineScripts.push(chunk.code);
          delete bundle[key];
        }
      }
      if (inlineScripts.length > 0) {
        const scriptTag = `<script>${inlineScripts.join("\n")}</script>`;
        html = html.replace("</body>", `${scriptTag}\n</body>`);
      }

      // Inline CSS files
      for (const [key, chunk] of Object.entries(bundle)) {
        if (chunk.type === "asset" && key.endsWith(".css")) {
          const source = chunk.source as string;
          const hrefPattern = new RegExp(
            `<link[^>]*href=["']/?(${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})["'][^>]*>`
          );
          html = html.replace(hrefPattern, `<style>${source}</style>`);
          delete bundle[key];
        }
      }

      htmlChunk.source = html;
    },
  };
}
