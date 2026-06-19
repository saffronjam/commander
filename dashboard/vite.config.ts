import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// ----------------------------------------------------------------------

const PORT = 3039;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __BUILD_VERSION__: JSON.stringify(process.env.VITE_BUILD_VERSION || "localbuild"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "~": path.join(process.cwd(), "node_modules"),
      src: path.join(process.cwd(), "src"),
    },
  },
  build: { outDir: path.resolve(__dirname, "../api/web/dist"), emptyOutDir: true },
  server: {
    port: PORT,
    host: true,
    fs: { cachedChecks: false },
    proxy: {
      "/graphql": { target: "http://localhost:8081", changeOrigin: true, ws: true },
    },
  },
  preview: { port: PORT, host: true },
});
