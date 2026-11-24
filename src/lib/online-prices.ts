// Automatic online prices for the hub's Prices page.
//
// The owners keep a short watch list (up to priceLookup.maxItems). For each
// item the hub runs one Google Shopping search through SerpApi and keeps the
// cheapest listing at each store we compare (Walmart, Target, Sam's, Costco,
// Amazon). Runs weekly from the cron trigger (src/worker.ts) and when an owner
// presses Refresh. Off until the SERPAPI_KEY secret is set.
//
// Online prices are the store websites' prices, not the shelf price in a
// warehouse, so they are labelled "Online" and never replace a logged price.
import { priceLookup, type Store } from "../site";
import type { PriceEntry } from "./prices";
import type { Store as Records } from "./store";
import { localDateString } from "./schedule";

export const WATCH_KEY = "price-watch";
export const ONLINE_KEY = "online-prices";
export const RUNS_KEY = "price-refresh";

export type Watch = {
  id: string;
  /** Same name the owners log prices under, so the two line up. */
  item: string;
  /** What to search for. Empty = the item name. */
  query: string;
  /** Count in the pack they buy, used when a listing doesn't say. */
  qty: number;
  unit: string;
};

export type Run = {
  at: string;
  /** Owner who pressed Refresh, or "weekly". */
  by: string;
  searched: number;
  found: number;
  /** Searches left on the SerpApi plan after this run, when known. */
  left?: number;
  error?: string;
};

export type WatchField = "item" | "qty";

export const lookupKey = () => process.env.SERPAPI_KEY?.trim() ?? "";
export const lookupOn = () => lookupKey() !== "";

export function parseWatch(form: FormData, id: string): { ok: true; watch: Watch } | { ok: false; invalid: WatchField[] } {
  const t = (k: string) => String(form.get(k) ?? "").trim().slice(0, 120);
  const qty = t("qty") === "" ? NaN : Number(t("qty"));
  const watch: Watch = { id, item: t("item"), query: t("query"), qty, unit: t("unit") || "unit" };
  const invalid: WatchField[] = [];
  if (!watch.item) invalid.push("item");
  if (!(qty > 0) || !Number.isInteger(qty)) invalid.push("qty");
  return invalid.length ? { ok: false, invalid } : { ok: true, watch };
}

/** Which of our stores a Google Shopping "source" is, if any. */
export function storeOf(source: string | undefined): Store | undefined {
  const s = (source ?? "").toLowerCase().replace(/[’']/g, "");
  if (s.includes("sams club")) return "Sam's Club";
  if (s.includes("walmart")) return "Walmart";
  if (s.includes("target")) return "Target";
  if (s.includes("costco")) return "Costco";
  if (s.includes("amazon")) return "Amazon";
  return undefined;
}

/** The count in a listing title: "35 Pack", "24-pk", "Pack of 12", "30 ct", "18 Count". */
export function packCount(title: string): number | undefined {
  const m =
    title.match(/\b(\d{1,3})\s*-?\s*(?:pack|pk|ct|count|cans|bottles|bags|pouches|bars)\b/i) ??
    title.match(/\b(?:pack|case|box) of (\d{1,3})\b/i);
  const n = m ? Number(m[1]) : NaN;
  return n > 1 ? n : undefined;
}

type Listing = {
  title?: string;
  source?: string;
  extracted_price?: number;
  link?: string;
  product_link?: string;
  second_hand_condition?: string;
};

/** Cheapest per unit at each store we compare, as price entries. */
export function pickPrices(watch: Watch, listings: Listing[], date: string, id: () => string): PriceEntry[] {
  const best = new Map<Store, PriceEntry>();
  for (const l of listings) {
    const store = storeOf(l.source);
    const price = l.extracted_price;
    if (!store || !priceLookup.stores.includes(store) || !(typeof price === "number" && price > 0) || l.second_hand_condition) continue;
    const title = String(l.title ?? "").slice(0, 200);
    const qty = packCount(title) ?? watch.qty;
    const entry: PriceEntry = {
      id: id(),
      item: watch.item,
      store,
      price,
      qty,
      unit: watch.unit,
      date,
      note: "",
      by: "online",
      source: "online",
      title,
      link: safeLink(l.product_link ?? l.link),
    };
    const prev = best.get(store);
    if (!prev || price / qty < prev.price / prev.qty) best.set(store, entry);
  }
  return [...best.values()];
}

const safeLink = (u: string | undefined) => (u && /^https:\/\//.test(u) ? u.slice(0, 600) : "");

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const api = "https://serpapi.com";

export async function searchesLeft(key: string, get: Fetch = fetch): Promise<number | undefined> {
  try {
    const res = await get(`${api}/account.json?api_key=${encodeURIComponent(key)}`);
    if (!res.ok) return undefined;
    const a = (await res.json()) as { total_searches_left?: number; plan_searches_left?: number };
    const n = a.total_searches_left ?? a.plan_searches_left;
    return typeof n === "number" ? n : undefined;
  } catch {
    return undefined;
  }
}

async function search(watch: Watch, key: string, get: Fetch): Promise<Listing[]> {
  const q = new URLSearchParams({
    engine: "google_shopping",
    q: watch.query || watch.item,
    location: priceLookup.location,
    gl: "us",
    hl: "en",
    api_key: key,
  });
  const res = await get(`${api}/search.json?${q}`);
  if (!res.ok) throw new Error(res.status === 401 ? "The SerpApi key was not accepted." : `SerpApi answered ${res.status}.`);
  const body = (await res.json()) as { shopping_results?: Listing[]; inline_shopping_results?: Listing[]; error?: string };
  if (body.error && !/hasn't returned any results/i.test(body.error)) throw new Error(body.error);
  return [...(body.shopping_results ?? []), ...(body.inline_shopping_results ?? [])];
}

export type RefreshResult = { ok: true; run: Run } | { ok: false; reason: string; run?: Run };

/**
 * Looks up every watched item and replaces the stored online prices for the
 * items it reached. Each item is its own search; one failing doesn't stop the rest.
 */
export async function refreshOnlinePrices(opts: {
  records: Records;
  by: string;
  now?: Date;
  key?: string;
  get?: Fetch;
  id?: () => string;
}): Promise<RefreshResult> {
  const { records, by, now = new Date(), key = lookupKey(), get = fetch, id = () => crypto.randomUUID() } = opts;
  if (!key) return { ok: false, reason: "Online prices are not switched on yet." };
  const watches = (await records.read<Watch>(WATCH_KEY)).slice(0, priceLookup.maxItems);
  if (watches.length === 0) return { ok: false, reason: "Add an item to the watch list first." };

  const runs = await records.read<Run>(RUNS_KEY);
  if (by !== "weekly" && runs[0] && now.getTime() - Date.parse(runs[0].at) < priceLookup.minMinutesBetween * 60_000) {
    return { ok: false, reason: `Prices were refreshed less than ${priceLookup.minMinutesBetween} minutes ago.` };
  }

  const before = await searchesLeft(key, get);
  if (before !== undefined && before < watches.length) {
    const run: Run = { at: now.toISOString(), by, searched: 0, found: 0, left: before, error: `Only ${before} searches left this month, ${watches.length} needed.` };
    await records.write(RUNS_KEY, [run, ...runs].slice(0, 20));
    return { ok: false, reason: run.error!, run };
  }

  const date = localDateString(now, "America/New_York");
  const fresh = new Map<string, PriceEntry[]>();
  const errors: string[] = [];
  // A few at a time: quick, and well under the Worker's subrequest limit.
  for (let i = 0; i < watches.length; i += 4) {
    await Promise.all(
      watches.slice(i, i + 4).map(async (w) => {
        try {
          fresh.set(w.id, pickPrices(w, await search(w, key, get), date, id));
        } catch (e) {
          errors.push(e instanceof Error ? e.message : String(e));
        }
      }),
    );
  }

  // Keep older online prices for items this run couldn't reach; drop items no longer watched.
  const watchedNames = new Set(watches.map((w) => w.item));
  const reached = new Set(watches.filter((w) => fresh.has(w.id)).map((w) => w.item));
  const kept = (await records.read<PriceEntry>(ONLINE_KEY)).filter((e) => watchedNames.has(e.item) && !reached.has(e.item));
  const found = [...fresh.values()].flat();
  await records.write(ONLINE_KEY, [...found, ...kept]);

  const run: Run = {
    at: now.toISOString(),
    by,
    searched: fresh.size,
    found: found.length,
    left: before === undefined ? undefined : Math.max(0, before - watches.length),
    error: errors.length ? `${errors.length} of ${watches.length} lookups failed: ${errors[0]}` : undefined,
  };
  await records.write(RUNS_KEY, [run, ...runs].slice(0, 20));
  return fresh.size === 0 ? { ok: false, reason: run.error ?? "No lookups worked.", run } : { ok: true, run };
}
