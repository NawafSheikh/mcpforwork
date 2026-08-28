import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  plugins: [react()],
  base,
  server: { port: 5180 },
  build: { target: "es2022", sourcemap: false },
  test: { environment: "jsdom", globals: false },
});
