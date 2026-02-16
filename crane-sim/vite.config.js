import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/crane-sim-react/",
  build: {
    outDir: "docs",
    emptyOutDir: true,
  },
});
