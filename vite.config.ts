import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;


// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [vue()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  build: {
    target: "esnext",
    sourcemap: false,
    // 分包后单文件会超过默认 500KB 警告线，调高避免噪音
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        /**
         * v0.4.8 分包策略
         * 只固定「首屏必需」的几个大块（vue / codemirror / markdown / hljs），
         * 便于长期缓存；其余重型依赖（mermaid、chart.js、katex、docx…）
         * 一律不指定，交给 rollup 按动态 import 边界自动拆，保持按需加载。
         */
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("@codemirror") ||
            id.includes("@lezer") ||
            id.includes("style-mod") ||
            id.includes("w3c-keyname") ||
            id.includes("crelt")
          ) {
            return "codemirror";
          }
          if (id.includes("highlight.js")) return "hljs";
          if (id.includes("markdown-it")) return "markdown";
          if (id.includes("pinia") || id.includes("@vue") || id.includes("/vue/")) return "vue";
          // 其余（mermaid / chart.js / katex / docx …）保持默认按需分包
          return undefined;
        },
      },
    },
  },
}));
