import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      "@blackjack-idl": path.resolve(import.meta.dirname, "../blackjack/target/idl/blackjack.json"),
      "@coinflip-idl": path.resolve(import.meta.dirname, "../coinflip/target/idl/coinflip.json"),
      crypto: path.resolve(import.meta.dirname, "node_modules", "crypto-browserify"),
      buffer: path.resolve(import.meta.dirname, "node_modules", "buffer"),
      process: path.resolve(import.meta.dirname, "node_modules", "process", "browser.js"),
      stream: path.resolve(import.meta.dirname, "node_modules", "stream-browserify"),
      "process/": path.resolve(import.meta.dirname, "node_modules", "process", "browser.js"),
    },
  },
  define: {
    global: "globalThis",
    "process.env": {},
    process: {
      env: {},
      browser: true,
    },
  },
  optimizeDeps: {
    include: ["buffer", "crypto-browserify", "process", "stream-browserify"],
    exclude: [],
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: false,
      allow: [
        path.resolve(import.meta.dirname),
        path.resolve(import.meta.dirname, "../blackjack/target/idl"),
        path.resolve(import.meta.dirname, "../coinflip/target/idl"),
      ],
      deny: ["**/.*"],
    },
  },
});
