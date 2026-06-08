import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The component lives at repo root as a .jsx file; tell esbuild to treat .js
// import-resolution loosely so the root .jsx resolves cleanly.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
