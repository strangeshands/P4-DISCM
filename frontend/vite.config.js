import { defineConfig } from "vite";
export default defineConfig({
    server: {
        port: 5174,
        proxy: { "/api": process.env.API_URL || "http://localhost:8081" },
    },
});
