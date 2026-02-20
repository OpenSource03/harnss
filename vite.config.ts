import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-markdown": ["react-markdown", "remark-gfm"],
          "vendor-syntax": ["react-syntax-highlighter"],
          "vendor-xterm": ["@xterm/xterm", "@xterm/addon-fit"],
          "vendor-diff": ["diff"],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
});
