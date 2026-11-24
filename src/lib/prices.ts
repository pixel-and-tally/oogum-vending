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
