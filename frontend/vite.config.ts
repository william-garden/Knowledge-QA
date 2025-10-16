import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_PORT ?? 5173),
      host: env.VITE_HOST ?? "127.0.0.1",
      proxy: {
        "/api": {
          target: env.VITE_API_BASE ?? "http://localhost:8001",
          changeOrigin: true
        }
      }
    },
    resolve: {
      alias: {
        "@": "/src"
      }
    }
  };
});
