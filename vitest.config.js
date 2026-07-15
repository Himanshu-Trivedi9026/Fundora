import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  // Vite 8 uses oxc: include .js files and enable JSX parsing for them
  oxc: {
    include: /\.(m?ts|[jt]sx?)$/,
    exclude: [],
    lang: "jsx",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.js"],
    globals: true,
    css: false,
    include: ["tests/**/*.test.{js,jsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["lib/**", "pages/api/**", "components/**"],
      exclude: ["node_modules/", ".next/"],
    },
  },
});
