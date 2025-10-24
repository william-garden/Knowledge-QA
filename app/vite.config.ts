import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_API_BASE ?? "";

  return {
    plugins: [react()],
    clearScreen: false,
    resolve: {
      alias: {
        "@": "/src"
      }
    },
    server: {
      port: Number(env.VITE_PORT ?? 1420),
      strictPort: true,
      host: host || env.VITE_HOST || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421
          }
        : undefined,
      proxy:
        apiProxyTarget && apiProxyTarget !== ""
          ? {
              "/api": {
                target: apiProxyTarget,
                changeOrigin: true
              }
            }
          : undefined,
      watch: {
        ignored: ["**/src-tauri/**"]
      }
    }
  };
});
