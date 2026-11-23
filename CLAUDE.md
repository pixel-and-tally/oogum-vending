# Oogum Vending

Client site built by Pixel & Tally (Blake Turner). Owners: Stephen and Nancy Turner, Belmont, NC.
Refrigerated smart vending machines; first location Firestone in Belmont, goal is the rest of NC's Firestones.

## Stack

- Astro 5, Tailwind 4 (tokens in `src/theme.css`), TypeScript strict, Cloudflare Workers free plan (`@astrojs/cloudflare`, `wrangler.jsonc`, headers in `public/_headers`; moved off Netlify 2026-11-21).
- Every page runs in the Worker (`output: "server"`, only `404` is prerendered) so the owners' hub Settings show up right away. Settings (`src/lib/settings.ts`) are saved in KV and laid over the `src/site.ts` objects by `src/middleware.ts` on each request; site.ts holds the starting values. Hub passwords changed in Settings live in KV `logins` and win over `HUB_USERS`. Env vars come from `process.env` (filled by `nodejs_compat`).
- Hub login: `src/lib/auth.ts` (scrypt hashes in `HUB_USERS`, HMAC-signed cookie with `HUB_SECRET`), enforced in `src/middleware.ts`.
- Hub data: `src/lib/store.ts`, Workers KV (`HUB_STORE` binding) in production, `.data/` JSON files locally.
- Call picker: `src/lib/schedule.ts`, shared with the Pixel & Tally site.
- `vite` is pinned via `overrides` so Tailwind's Vite plugin and Astro share one version.

## Rules

- Copy pitches "a vending machine with more options, upgrade your store". Never frame it as replacing an old machine or "don't have a machine?".

- `npm run verify` must pass before every commit.
- No em dashes in user-facing copy (`tests/no-em-dash.test.ts`).
- Never invent facts about the business: no fake reviews, stats, locations, products or prices. Leave a field empty or a `TODO` and the page hides it.
- The look (Blake, 2026-11-20): professional and light. White page in the flier's navy, lime and white, Outfit headings, flat pill buttons, soft cards. The home page is built on the flier's five cornerstones (`cornerstones` in `src/site.ts`), not a drawn vending machine; Blake rejected the fridge, spiral coils and drawn sodas. Header: logo centered, Home and About Us on the left, phone and Host a machine on the right. Colors and fonts only from theme tokens.
- Every form field gets a label, `autocomplete`, and an inline error; on failure, focus the first bad field and show a form-level message.
- Don't promise integrations (store prices, machine data) until the source is confirmed. See README.
- Commit messages say what changed for the visitor or owner, in plain English.
