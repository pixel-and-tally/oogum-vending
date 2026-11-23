import { defineMiddleware } from "astro:middleware";
import { SESSION_COOKIE, hubConfig, readSession } from "./lib/auth";
import { loadSettings } from "./lib/settings";

// Every page runs in the Worker so the owners' saved settings (phone, hours...)
// show up right away. Every /hub/ page except the login page needs a signed-in owner.
export const onRequest = defineMiddleware(async (ctx, next) => {
  if (ctx.isPrerendered) return next();
  await loadSettings();
  const path = ctx.url.pathname;
  if (!path.startsWith("/hub")) return next();

  // Hub forms only accept posts from this site.
  const origin = ctx.request.headers.get("origin");
  if (ctx.request.method === "POST" && origin && origin !== ctx.url.origin) {
    return new Response("Forbidden", { status: 403 });
  }
  if (path.startsWith("/hub/login")) return next();

  const user = readSession(ctx.cookies.get(SESSION_COOKIE)?.value, hubConfig().secret);
  if (!user) return ctx.redirect(`/hub/login/?next=${encodeURIComponent(path)}`, 303);
  ctx.locals.user = user;
  const res = await next();
  res.headers.set("Cache-Control", "private, no-store");
  return res;
});
