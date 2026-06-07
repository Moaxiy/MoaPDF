import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          pdf: ["pdf-lib", "pdfjs-dist"],
          zip: ["jszip"],
        },
      },
    },
  },
});
