// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["@supabase/ssr"],
    },
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      TELEGRAM_BOT_TOKEN: envField.string({ context: "server", access: "secret", optional: true }),
      TELEGRAM_WEBHOOK_SECRET: envField.string({ context: "server", access: "secret", optional: true }),
      TELEGRAM_BOT_USERNAME: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
