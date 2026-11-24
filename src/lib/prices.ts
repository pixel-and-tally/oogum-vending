// Bulk price tracker. The owners log a price when they see one (receipt,
// shelf tag, app); the hub works out the cheapest place for each item.
// Online prices from Google Shopping (src/lib/online-prices.ts) sit beside the
// logged ones and are labelled "Online", so an in-warehouse Costco or Sam's
// price the owners log never gets overwritten by the website price.
import { stores, type Store } from "../site";

export type PriceEntry = {
  id: string;
  item: string;
  store: Store;
  /** Total paid for the pack, in dollars. */
  price: number;
  /** How many units are in the pack (e.g. 24 cans). */
  qty: number;
  /** What a unit is, e.g. "can", "bottle", "bag". */
  unit: string;
  /** "YYYY-MM-DD" */
  date: string;
  note: string;
  by: string;
  /** "online" = looked up automatically. Missing = logged by an owner. */
  source?: "online";
  /** Online only: the product title Google matched and where to buy it. */
  title?: string;
  link?: string;
  /** Online only: the price before a markdown, when Google shows one. */
  wasPrice?: number;
};

export const isOnline = (e: Pick<PriceEntry, "source">) => e.source === "online";
/** "Walmart online" or "Costco" (logged), for the comparison lists. */
export const storeLabel = (e: Pick<PriceEntry, "store" | "source">) => (isOnline(e) ? `${e.store} online` : e.store);

export type PriceField = "item" | "store" | "price" | "qty" | "unit" | "date";

export const unitPrice = (e: Pick<PriceEntry, "price" | "qty">) => e.price / e.qty;

export const itemKey = (item: string) => item.trim().toLowerCase().replace(/\s+/g, " ");

export type BestPrice = {
  item: string;
  unit: string;
  /** Latest price at each store (logged and online kept apart), cheapest per unit first. */
  byStore: PriceEntry[];
  best: PriceEntry;
  /** Per-unit saving of the best store over the most expensive one. */
  spread: number;
};

export function bestPrices(entries: PriceEntry[]): BestPrice[] {
  const groups = new Map<string, Map<string, PriceEntry>>();
  for (const e of entries) {
    const g = groups.get(itemKey(e.item)) ?? new Map<string, PriceEntry>();
    const slot = `${e.store}|${e.source ?? "logged"}`;
    const prev = g.get(slot);
    if (!prev || e.date >= prev.date) g.set(slot, e);
    groups.set(itemKey(e.item), g);
  }
  return [...groups.values()]
    .map((g) => {
      const byStore = [...g.values()].sort((a, b) => unitPrice(a) - unitPrice(b));
      const best = byStore[0];
      return {
        item: best.item,
        unit: best.unit,
        byStore,
        best,
        spread: unitPrice(byStore[byStore.length - 1]) - unitPrice(best),
      };
    })
    .sort((a, b) => a.item.localeCompare(b.item));
}

const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

export function parsePrice(
  form: FormData,
  by: string,
  id: string,
): { ok: true; entry: PriceEntry } | { ok: false; invalid: PriceField[] } {
  const t = (k: string) => String(form.get(k) ?? "").trim().slice(0, 200);
  const entry = {
    id,
    item: t("item"),
    store: t("store") as Store,
    price: num(t("price")),
    qty: num(t("qty")),
    unit: t("unit") || "unit",
    date: t("date"),
    note: t("note"),
    by,
  };
  const invalid: PriceField[] = [];
  if (!entry.item) invalid.push("item");
  if (!stores.includes(entry.store)) invalid.push("store");
  if (!(entry.price > 0)) invalid.push("price");
  if (!(entry.qty > 0)) invalid.push("qty");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) invalid.push("date");
  return invalid.length ? { ok: false, invalid } : { ok: true, entry };
}

export const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 3 : 2 });

export type TripItem = {
  item: string;
  /** What to buy: the entry picked for this stop. */
  pick: PriceEntry;
  /** Extra per pack over the item's cheapest price, when moved here to save a stop. */
  extra: number;
  /** Where it would have been cheapest, when moved. */
  cheapestAt?: string;
};
export type TripStop = { store: Store; items: TripItem[] };
/** A store left off the trip, what was cheaper there and what skipping it costs per pack in total. */
export type SkippedStop = { store: Store; items: string[]; extra: number };

const packExtra = (alt: PriceEntry, best: PriceEntry) => (unitPrice(alt) - unitPrice(best)) * best.qty;

/**
 * Where to buy everything with the fewest stops. Each item starts at its
 * cheapest store; then a stop is skipped when buying its items at stores
 * already on the trip costs at most maxExtraPerStop more in total (one pack of
 * each). The smallest stops are tried first. Logged and online prices at the
 * same store are one stop.
 */
export function shoppingTrip(rows: BestPrice[], maxExtraPerStop: number): { stops: TripStop[]; skipped: SkippedStop[] } {
  const stops = new Map<Store, TripItem[]>();
  const skipped: SkippedStop[] = [];
  const add = (store: Store, t: TripItem) => stops.set(store, [...(stops.get(store) ?? []), t]);
  for (const r of rows) add(r.best.store, { item: r.item, pick: r.best, extra: 0 });
  const rowOf = new Map(rows.map((r) => [r.item, r]));

  let changed = true;
  while (changed && stops.size > 1) {
    changed = false;
    const bySize = [...stops.entries()].sort((a, b) => a[1].length - b[1].length);
    for (const [store, items] of bySize) {
      const moves = items.map((t) => {
        const r = rowOf.get(t.item)!;
        const alt = r.byStore
          .filter((e) => e.store !== store && stops.has(e.store))
          .sort((a, b) => unitPrice(a) - unitPrice(b))[0];
        return alt ? { t, alt, extra: packExtra(alt, r.best) } : undefined;
      });
      if (!moves.every(Boolean)) continue;
      const cost = moves.reduce((sum, m) => sum + m!.extra - m!.t.extra, 0);
      if (cost > maxExtraPerStop) continue;
      stops.delete(store);
      const own = items.filter((t) => t.extra === 0).map((t) => t.item);
      if (own.length) skipped.push({ store, items: own, extra: Math.round(cost * 100) / 100 });
      for (const m of moves) {
        add(m!.alt.store, { item: m!.t.item, pick: m!.alt, extra: m!.extra, cheapestAt: storeLabel(rowOf.get(m!.t.item)!.best) });
      }
      changed = true;
      break;
    }
  }
  return {
    stops: [...stops.entries()]
      .map(([store, items]) => ({ store, items: items.sort((a, b) => a.item.localeCompare(b.item)) }))
      .sort((a, b) => b.items.length - a.items.length || a.store.localeCompare(b.store)),
    skipped,
  };
}
