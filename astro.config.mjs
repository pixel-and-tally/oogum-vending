// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
import { site } from "./src/site.ts";

// Every page runs in the Cloudflare Worker (src/worker.ts, wrangler.jsonc), so what the
// owners save in the hub's Settings (phone, hours, bios...) shows up right away.
// Only the 404 page is prerendered.
export default defineConfig({
  site: site.url,
  output: "server",
  adapter: cloudflare({
    imageService: "compile",
    platformProxy: { enabled: false },
    // Adds the weekly price refresh (cron) next to the usual page handler.
    workerEntryPoint: { path: "src/worker.ts", namedExports: [] },
  }),
  trailingSlash: "ignore",
  build: { format: "directory" },
  vite: { plugins: [tailwindcss()] },
});
