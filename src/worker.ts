// The Cloudflare Worker's entry point. Pages go through Astro as usual; the
// weekly cron trigger (wrangler.jsonc) refreshes the hub's online prices.
import type { SSRManifest } from "astro";
import { App } from "astro/app";
import { handle } from "@astrojs/cloudflare/handler";
import { refreshOnlinePrices } from "./lib/online-prices";
import { getStore } from "./lib/store";

type Env = Parameters<typeof handle>[3];
type Ctx = Parameters<typeof handle>[4];

export function createExports(manifest: SSRManifest) {
  const app = new App(manifest);
  return {
    default: {
      async fetch(request: Parameters<typeof handle>[2], env: Env, ctx: Ctx) {
        return handle(manifest, app, request, env, ctx);
      },
      async scheduled(_controller: unknown, _env: Env, ctx: Ctx) {
        ctx.waitUntil(getStore().then((records) => refreshOnlinePrices({ records, by: "weekly" })).then(() => undefined));
      },
    },
  };
}
