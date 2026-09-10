import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local React frontend for Whop Desktop. Served by Tauri from ../dist in
// production and by the Vite dev server (port 1420) during `pnpm tauri dev`.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { target: "safari15", outDir: "dist", emptyOutDir: true },
});
