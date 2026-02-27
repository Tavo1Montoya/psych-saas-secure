import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // Para desarrollo local
  server: {
    host: true,
    allowedHosts: "all",
  },

  // Para Railway (vite preview)
  preview: {
    host: true,
    allowedHosts: "all",
  },
});