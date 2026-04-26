import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

const alias = {
  "@shared": resolve("src/shared"),
  "@main": resolve("src/main"),
  "@renderer": resolve("src/renderer/src")
};

export default defineConfig({
  main: {
    resolve: { alias },
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: [
          "@polymarket/builder-relayer-client",
          "@polymarket/clob-client-v2"
        ]
      }
    }
  },
  preload: {
    resolve: { alias },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: resolve("src/renderer"),
    resolve: { alias },
    plugins: [react()]
  }
});
