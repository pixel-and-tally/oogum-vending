import { afterEach, describe, expect, it } from "vitest";
import { bestPrices, shoppingTrip, storeLabel, type PriceEntry } from "../src/lib/prices";
import { ONLINE_KEY, RUNS_KEY, WATCH_KEY, deals, packCount, percentOff, parseWatch, pickPrices, refreshOnlinePrices, storeOf, type Run, type Watch } from "../src/lib/online-prices";
import { memoryStore } from "../src/lib/store";

const coke: Watch = { id: "w1", item: "Coke 12 oz cans", query: "Coca-Cola 12 oz 35 pack", qty: 35, unit: "can" };
let n = 0;
const id = () => `id${++n}`;

describe("reading Google Shopping listings", () => {
  it("knows our stores by their listing names", () => {
    expect(storeOf("Walmart - Seller")).toBe("Walmart");
    expect(storeOf("Sam’s Club")).toBe("Sam's Club");
    expect(storeOf("Amazon.com")).toBe("Amazon");
    expect(storeOf("Target")).toBe("Target");
    expect(storeOf("Kroger")).toBeUndefined();
  });

  it("reads the pack count from a title", () => {
    expect(packCount("Coca-Cola Soda, 12 fl oz, 35 Pack")).toBe(35);
    expect(packCount("Doritos Nacho Cheese 1 oz, 40-ct")).toBe(40);
    expect(packCount("Pack of 24 bottles")).toBe(24);
    expect(packCount("Coca-Cola 24 x 12 fl oz")).toBe(24);
    expect(packCount("Coke 2 liter")).toBeUndefined();
    expect(packCount("Lay's Classic 1 oz bag")).toBeUndefined();
  });

  it("keeps the cheapest per unit at each of our stores, labelled online", () => {
    const got = pickPrices(
      coke,
      [
        { title: "Coca-Cola 12 oz 35 Pack", source: "Walmart", extracted_price: 17.48, product_link: "https://walmart.example/a" },
        { title: "Coca-Cola 12 oz 12 Pack", source: "Walmart", extracted_price: 7.98 }, // 0.665 a can, worse
        { title: "Coca-Cola 12 oz cans", source: "Sam's Club", extracted_price: 16.98 }, // no count: uses 35
        { title: "Coca-Cola 35 pack", source: "Kroger", extracted_price: 15 }, // not a store we compare
        { title: "Coca-Cola 35 pack", source: "Amazon.com", extracted_price: 30, second_hand_condition: "used" },
        { title: "Coca-Cola 35 pack", source: "Target", extracted_price: undefined },
      ],
      "2026-11-24",
      id,
    );
    expect(got.map((e) => [e.store, e.price, e.qty])).toEqual([
      ["Walmart", 17.48, 35],
      ["Sam's Club", 16.98, 35],
    ]);
    expect(got.every((e) => e.source === "online" && e.item === coke.item && e.date === "2026-11-24")).toBe(true);
    expect(got[0].link).toBe("https://walmart.example/a");
  });
});

describe("any pack size", () => {
  const any: Watch = { ...coke, qty: 0 };
  it("compares different pack sizes per unit and skips listings with no count", () => {
    const got = pickPrices(
      any,
      [
        { title: "Coca-Cola 12 oz 12 Pack", source: "Target", extracted_price: 7.49 }, // 0.624
        { title: "Coca-Cola 12 oz 24 Pack", source: "Target", extracted_price: 13.99 }, // 0.583, wins
        { title: "Coca-Cola 12 oz cans", source: "Walmart", extracted_price: 5 }, // no count: skipped
      ],
      "2026-11-24",
      id,
    );
    expect(got.map((e) => [e.store, e.qty])).toEqual([["Target", 24]]);
  });
});

describe("sales", () => {
  it("shows a sale only when it is the lowest price for the item", () => {
    const got = pickPrices(
      { ...coke, qty: 0 },
      [
        { title: "Coke 35 Pack", source: "Walmart", extracted_price: 15, extracted_old_price: 20 },
        { title: "Coke 35 Pack", source: "Target", extracted_price: 18, extracted_old_price: 20 },
        { title: "Coke 35 Pack", source: "Amazon", extracted_price: 18, extracted_old_price: 17 }, // not a markdown
      ],
      "2026-11-24",
      id,
    );
    // Walmart's sale makes it the cheapest; Target's markdown still loses, so it isn't shown.
    const rows = bestPrices([...got, { ...got[0], id: "t2", store: "Costco", price: 16, wasPrice: undefined, source: undefined }]);
    const sale = deals(rows);
    expect(sale.map((e) => [e.store, percentOff(e)])).toEqual([["Walmart", 25]]);

  });
});

describe("online and logged prices side by side", () => {
  const base = { id: "x", item: "Coke 12 oz cans", unit: "can", date: "2026-11-24", note: "", by: "nancy" };
  it("never lets the website price replace a logged warehouse price", () => {
    const logged: PriceEntry = { ...base, store: "Sam's Club", price: 15.98, qty: 35 };
    const web: PriceEntry = { ...base, store: "Sam's Club", price: 17.98, qty: 35, source: "online" };
    const [row] = bestPrices([logged, web]);
    expect(row.byStore).toHaveLength(2);
    expect(row.best).toBe(logged);
    expect(row.byStore.map(storeLabel)).toEqual(["Sam's Club", "Sam's Club online"]);
  });
});

describe("watch list", () => {
  const form = (o: Record<string, string>) => {
    const f = new FormData();
    Object.entries(o).forEach(([k, v]) => f.set(k, v));
    return f;
  };
  it("takes any pack size when the count is left empty", () => {
    const any = parseWatch(form({ item: "Doritos", qty: "", unit: "bag" }), "w");
    expect(any.ok && any.watch.qty).toBe(0);
  });

  it("needs an item, and a whole number if a count is given", () => {
    const ok = parseWatch(form({ item: "Doritos", qty: "40", unit: "bag", query: "" }), "w");
    expect(ok.ok && ok.watch.qty).toBe(40);
    const bad = parseWatch(form({ item: " ", qty: "2.5" }), "w");
    expect(!bad.ok && bad.invalid).toEqual(["item", "qty"]);
  });
});

describe("refreshOnlinePrices", () => {
  const listing = { title: "Coca-Cola 35 Pack", source: "Walmart", extracted_price: 17.5 };
  const fakeApi = (left = 90, fail = false) => {
    const urls: string[] = [];
    const get = async (url: string) => {
      urls.push(url);
      if (url.includes("/account.json")) return { ok: true, status: 200, json: async () => ({ total_searches_left: left }) };
      if (fail) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ shopping_results: [listing] }) };
    };
    return { get, urls };
  };
  const now = new Date("2026-11-24T11:00:00Z");

  afterEach(() => {
    delete process.env.SERPAPI_KEY;
  });

  it("stays off without a key and spends nothing", async () => {
    const records = memoryStore();
    await records.write(WATCH_KEY, [coke]);
    const api = fakeApi();
    const r = await refreshOnlinePrices({ records, by: "weekly", now, get: api.get });
    expect(r.ok).toBe(false);
    expect(api.urls).toEqual([]);
  });

  it("looks up each watched item once and saves the prices and a run note", async () => {
    const records = memoryStore();
    await records.write(WATCH_KEY, [coke, { ...coke, id: "w2", item: "Doritos", query: "" }]);
    const api = fakeApi(90);
    const r = await refreshOnlinePrices({ records, by: "weekly", now, key: "k", get: api.get, id });
    expect(r.ok).toBe(true);
    const searches = api.urls.filter((u) => u.includes("/search.json"));
    expect(searches).toHaveLength(2);
    expect(searches.some((u) => new URL(u).searchParams.get("q") === "Doritos")).toBe(true);
    expect(new URL(searches[0]).searchParams.get("location")).toContain("Belmont");
    const saved = await records.read<PriceEntry>(ONLINE_KEY);
    expect(saved.map((e) => e.item).sort()).toEqual(["Coke 12 oz cans", "Doritos"]);
    const [run] = await records.read<Run>(RUNS_KEY);
    expect(run).toMatchObject({ by: "weekly", searched: 2, found: 2, left: 88 });
  });

  it("won't start when the month's searches would run out", async () => {
    const records = memoryStore();
    await records.write(WATCH_KEY, [coke, { ...coke, id: "w2" }]);
    const api = fakeApi(1);
    const r = await refreshOnlinePrices({ records, by: "nancy", now, key: "k", get: api.get });
    expect(r.ok).toBe(false);
    expect(api.urls.filter((u) => u.includes("/search.json"))).toEqual([]);
  });

  it("ignores a second Refresh tap within the hour, but not the weekly run", async () => {
    const records = memoryStore();
    await records.write(WATCH_KEY, [coke]);
    await records.write(RUNS_KEY, [{ at: "2026-11-24T10:30:00Z", by: "nancy", searched: 1, found: 1 }]);
    expect((await refreshOnlinePrices({ records, by: "stephen", now, key: "k", get: fakeApi().get })).ok).toBe(false);
    expect((await refreshOnlinePrices({ records, by: "weekly", now, key: "k", get: fakeApi().get })).ok).toBe(true);
  });

  it("keeps last week's prices when a lookup fails", async () => {
    const records = memoryStore();
    await records.write(WATCH_KEY, [coke]);
    const old: PriceEntry = { id: "o", item: coke.item, store: "Target", price: 18, qty: 35, unit: "can", date: "2026-11-17", note: "", by: "online", source: "online" };
    await records.write(ONLINE_KEY, [old]);
    const r = await refreshOnlinePrices({ records, by: "weekly", now, key: "k", get: fakeApi(90, true).get });
    expect(r.ok).toBe(false);
    expect(await records.read<PriceEntry>(ONLINE_KEY)).toEqual([old]);
    const [run] = await records.read<Run>(RUNS_KEY);
    expect(run.error).toContain("1 of 1 lookups failed");
  });
});

describe("shoppingTrip", () => {
  const e = (item: string, store: PriceEntry["store"], price: number, qty = 10): PriceEntry => ({
    id: item + store, item, store, price, qty, unit: "can", date: "2026-11-24", note: "", by: "nancy",
  });

  it("sends each item to its cheapest store, and skips a stop that saves little in total", () => {
    const rows = bestPrices([
      e("Coke", "Costco", 5), e("Coke", "Walmart", 8),
      e("Sprite", "Costco", 5), e("Sprite", "Walmart", 8),
      e("Doritos", "Target", 9), e("Doritos", "Costco", 10), // $1 more at Costco: moves
      e("Water", "Walmart", 3), e("Water", "Costco", 9), // $6 more: Walmart stays
    ]);
    const { stops: trip, skipped } = shoppingTrip(rows, 5);
    expect(skipped).toEqual([{ store: "Target", items: ["Doritos"], extra: 1 }]);
    expect(trip.map((s) => [s.store, s.items.map((t) => t.item)])).toEqual([
      ["Costco", ["Coke", "Doritos", "Sprite"]],
      ["Walmart", ["Water"]],
    ]);
    const doritos = trip[0].items.find((t) => t.item === "Doritos")!;
    expect(doritos.extra).toBeCloseTo(1);
    expect(doritos.cheapestAt).toBe("Target");
  });

  it("keeps a stop when skipping it would cost too much in total", () => {
    const rows = bestPrices([
      e("Coke", "Costco", 5), e("Coke", "Walmart", 11), // $6 more
      e("Water", "Walmart", 3), e("Water", "Costco", 6), // $3 more
      e("Tea", "Walmart", 3), e("Tea", "Costco", 6), // $3 more: $6 together, over $5
    ]);
    expect(shoppingTrip(rows, 5).stops.map((s) => s.store).sort()).toEqual(["Costco", "Walmart"]);
  });

  it("is empty with no prices", () => {
    expect(shoppingTrip([], 5)).toEqual({ stops: [], skipped: [] });
  });
});
