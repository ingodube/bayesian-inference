import { defineConfig } from "vite";
export default defineConfig({
  base: "/bayesian-inference/",
  server: { port: 4173 },
  preview: { port: 4173 },
  build: { chunkSizeWarningLimit: 1500 },
});
