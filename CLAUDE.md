# Oogum Vending

Client site built by Pixel & Tally (Blake Turner). Owners: Stephen and Nancy Turner, Belmont, NC.
Refrigerated smart vending machines; first location Firestone in Belmont, goal is the rest of NC's Firestones.

## Stack

- Astro 5, Tailwind 4 (tokens in `src/theme.css`), TypeScript strict, Netlify free plan.
- Public pages are static. `src/pages/api/host.ts` and everything under `src/pages/hub/` run as Netlify functions (`prerender = false`).
- Hub login: `src/lib/auth.ts` (scrypt hashes in `HUB_USERS`, HMAC-signed cookie with `HUB_SECRET`), enforced in `src/middleware.ts`.
- Hub data: `src/lib/store.ts`, Netlify Blobs in production, `.data/` JSON files locally.
- Call picker: `src/lib/schedule.ts`, shared with the Pixel & Tally site.
- `vite` is pinned via `overrides` so Tailwind's Vite plugin and Astro share one version.

## Rules

- `npm run verify` must pass before every commit.
- No em dashes in user-facing copy (`tests/no-em-dash.test.ts`).
- Never invent facts about the business: no fake reviews, stats, locations, products or prices. Leave a field empty or a `TODO` and the page hides it.
- The look is their real machine: a big glass-door smart fridge (lit sign, glass door with handle, tap reader, chrome shelves) whose shelves hold the main points as bold cards with slot codes, plus an LED strip. Blake rejected drawn sodas and spiral coils (2026-11-20). Keep it unlike a normal website. Colors and fonts only from theme tokens.
- Every form field gets a label, `autocomplete`, and an inline error; on failure, focus the first bad field and show a form-level message.
- Don't promise integrations (store prices, machine data) until the source is confirmed. See README.
- Commit messages say what changed for the visitor or owner, in plain English.
