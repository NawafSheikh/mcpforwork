import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const base = ((globalThis as any).process?.env?.VITE_BASE as string | undefined) ?? "/";

export default defineConfig({
  plugins: [react()],
  base,
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@packages": fileURLToPath(new URL("./packages", import.meta.url)),
    },
  },
  server: { port: 5180 },
  build: { target: "es2022", sourcemap: false },
  test: { environment: "jsdom", globals: false },
});
