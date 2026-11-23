# Oogum Vending

Website and owner hub for Oogum Vending (Stephen and Nancy Turner, Belmont, NC).
Built by Pixel & Tally.

- **Public site**: the home page opens with the tagline and a photo of their machine (`public/machine-photo.jpg`, cropped from their flier; swap in real photos when the owners send them), then a big glass-door smart fridge whose shelves hold the main points as cards. Edit the cards in `cards` in `src/site.ts`.
- **Bring vending to my location** (`/host/`): request form for store managers, with an optional call time. Each request is saved for the hub and emailed to the owners.
- **Owner hub** (`/hub/`): login for the owners.
  - Prices: log bulk prices from Costco, Sam's Club, Walmart, Target, Amazon; it shows the cheapest store per unit.
  - Host requests: every form submission, moved through stages (New, Called, Visited, Signed, Not a fit) with notes.
  - Settings: the owners change their phone, email, where host requests are emailed, social links, call hours, bios, machine locations and their own password. Saved to KV and shown on the site within a minute (`src/lib/settings.ts`). A saved "Send host requests to" wins over `HOST_TO_EMAIL`; a changed password wins over that owner's `HUB_USERS` entry.
  - Machines: placeholder until we know the cooler platform and what data it can export.

## Placeholders still to fill

Everything waiting on the owners is marked `TODO` in `src/site.ts` and `src/pages/host/index.astro`:
domain, phone, email, what the machines stock, how checkout works on their model, host terms, call hours, their own words for "Who we are", and the machine platform.

## Run it

Node 22.

```sh
npm install
npm run dev        # http://localhost:4321
npm run verify     # type check, tests, build. Must pass before every commit.
```

Locally the hub stores data in `.data/` (git ignores it). On Cloudflare it uses Workers KV (the `HUB_STORE` binding), free; the first deploy creates it.

To sign in locally:

```sh
npm run hub:hash -- nancy 'some password'   # prints nancy:scrypt$...
HUB_USERS='nancy:scrypt$...' HUB_SECRET='any-long-random-string' npm run dev
```

## Cloudflare setup

Free plan. Workers & Pages > Create > Import a repository > `pixel-and-tally/oogum-vending`. Build command `npm run build`, deploy command `npx wrangler deploy`; `wrangler.jsonc` holds the rest.

Variables (Worker > Settings > Variables and Secrets, type Secret):

| Name | What |
| --- | --- |
| `HUB_USERS` | Owner logins, comma separated, each from `npm run hub:hash -- <name> <password>` |
| `HUB_SECRET` | Long random string that signs the login cookie (16+ characters). Changing it signs everyone out. |
| `RESEND_API_KEY` | Resend key for the host request emails |
| `HOST_TO_EMAIL` | Where host requests go. Comma separate for both owners. |
| `HOST_FROM_EMAIL` | Optional. Sender once their domain is verified in Resend. |

If the email variables are missing, host requests still save to the hub.

## What the hub can and can't automate

- **Store prices**: no store offers a small business a live local price feed. Walmart and Amazon have affiliate APIs that need approval; Target, Costco and Sam's have none. Version 1 is manual entry on purpose. Scraping store sites breaks often and goes against their terms.
- **Machine stock and sales**: depends on the cooler platform. A weekly CSV export is enough for charts; a live connection needs an operator API.

## Rules

See `CLAUDE.md`.
