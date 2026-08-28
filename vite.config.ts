import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5180 },
  build: { target: "es2022", sourcemap: false },
  test: { environment: "jsdom", globals: false },
});
