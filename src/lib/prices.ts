// Bulk price tracker. The owners log a price when they see one (receipt,
// shelf tag, app); the hub works out the cheapest place for each item.
// No store gives a small business a live local price feed, so this starts
// manual on purpose. See README for what could be automated later.
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
};

export type PriceField = "item" | "store" | "price" | "qty" | "unit" | "date";

export const unitPrice = (e: Pick<PriceEntry, "price" | "qty">) => e.price / e.qty;

export const itemKey = (item: string) => item.trim().toLowerCase().replace(/\s+/g, " ");

export type BestPrice = {
  item: string;
  unit: string;
  /** Latest price at each store, cheapest per unit first. */
  byStore: PriceEntry[];
  best: PriceEntry;
  /** Per-unit saving of the best store over the most expensive one. */
  spread: number;
};

export function bestPrices(entries: PriceEntry[]): BestPrice[] {
  const groups = new Map<string, Map<Store, PriceEntry>>();
  for (const e of entries) {
    const g = groups.get(itemKey(e.item)) ?? new Map<Store, PriceEntry>();
    const prev = g.get(e.store);
    if (!prev || e.date >= prev.date) g.set(e.store, e);
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
