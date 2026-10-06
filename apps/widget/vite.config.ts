import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    react(),

    visualizer({
      filename: "dist/stats.html",
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ],

  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },

  build: {
    lib: {
      entry: "src/bootstrap.tsx",
      name: "BugReporter",
      formats: ["iife"],
      fileName: () => "widget.js",
    },
  },
});
