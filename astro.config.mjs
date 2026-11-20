// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import netlify from "@astrojs/netlify";
import { site } from "./src/site.ts";

// Public pages are prerendered to static HTML. The host form endpoint and the
// owner hub (routes that set `prerender = false`) run as Netlify functions.
export default defineConfig({
  site: site.url,
  output: "static",
  adapter: netlify(),
  trailingSlash: "ignore",
  build: { format: "directory" },
  vite: { plugins: [tailwindcss()] },
});
