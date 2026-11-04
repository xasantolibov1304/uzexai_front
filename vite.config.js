import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Dev-serverda /api va /health so'rovlari backendga proxy qilinadi — CORS sozlash shart emas.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.BACKEND_URL || "http://localhost:8000";
  // Kalit faqat dev-server (Node) tomonida qo'shiladi; VITE_ prefiksi yo'q — brauzer bundle'iga tushmaydi.
  const headers = env.UZEX_API_KEY ? { "X-API-Key": env.UZEX_API_KEY } : undefined;
  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
            charts: ["recharts"],
            markdown: ["react-markdown", "remark-gfm", "rehype-sanitize"],
          },
        },
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": { target, changeOrigin: true, headers },
        "/health": { target, changeOrigin: true, headers },
      },
    },
  };
});
