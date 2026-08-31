import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://dearpaw.rip",
  output: "server",
  session: false,
  vite: {
    ssr: {
      optimizeDeps: {
        exclude: ["astro/assets/services/noop"],
      },
    },
  },
  adapter: cloudflare({
    imageService: "passthrough",
  }),
  integrations: [react()],
});
