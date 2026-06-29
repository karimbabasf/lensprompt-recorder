import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vite";

const phoneHttps = process.env.VITE_HTTPS === "1";

export default defineConfig({
  plugins: [react(), phoneHttps ? basicSsl() : undefined].filter(Boolean),
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
