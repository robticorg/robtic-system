import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * envDir points at the repo root so the shared .env is the single source of env vars;
 * Vite only exposes VITE_-prefixed values to the client.
 * The /.proxy prefix mirrors Discord's production proxy: inside Discord it is rewritten
 * by their URL mappings, in local dev this proxy forwards it to apps/api.
 */
export default defineConfig({
    plugins: [react()],
    envDir: "../..",
    server: {
        port: 5173,
        allowedHosts: [".trycloudflare.com"],
        proxy: {
            "/.proxy": {
                target: `http://localhost:${process.env.API_PORT ?? 3001}`,
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/\.proxy/, ""),
            },
            "/api": {
                target: `http://localhost:${process.env.API_PORT ?? 3001}`,
                changeOrigin: true,
            },
        },
    },
});
