import { describe, expect, it } from "vitest";
import { checkLogin, hashPassword, makeSession, parseUsers, readSession } from "../src/lib/auth";
import { bestPrices, parsePrice, type PriceEntry } from "../src/lib/prices";
import { memoryStore } from "../src/lib/store";

const secret = "test-secret-at-least-16-chars";

describe("hub login", () => {
  const users = parseUsers(`Stephen:${hashPassword("cold-drinks")}, nancy:${hashPassword("stocked")}`);

  it("accepts the right password, any name case", () => {
    expect(checkLogin("STEPHEN", "cold-drinks", users)).toBe("stephen");
    expect(checkLogin("nancy", "stocked", users)).toBe("nancy");
  });

  it("rejects wrong passwords and unknown names", () => {
    expect(checkLogin("stephen", "stocked", users)).toBeNull();
    expect(checkLogin("blake", "cold-drinks", users)).toBeNull();
    expect(checkLogin("stephen", "", users)).toBeNull();
  });

  it("signs sessions that expire and can't be forged", () => {
    const now = Date.parse("2026-11-20T12:00:00Z");
    const token = makeSession("nancy", secret, now);
    expect(readSession(token, secret, now)).toBe("nancy");
    expect(readSession(token, "other-secret-value-123", now)).toBeNull();
    expect(readSession(token, secret, now + 15 * 86_400_000)).toBeNull();
    const [, mac] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ u: "stephen", exp: now + 1e9 })).toString("base64url")}.${mac}`;
    expect(readSession(forged, secret, now)).toBeNull();
    expect(readSession(undefined, secret, now)).toBeNull();
    expect(readSession(token, "", now)).toBeNull();
  });
});

const entry = (p: Partial<PriceEntry>): PriceEntry => ({
  id: crypto.randomUUID(),
  item: "Coke 12 oz cans",
  store: "Costco",
  price: 20,
  qty: 40,
  unit: "can",
  date: "2026-11-01",
  note: "",
  by: "nancy",
  ...p,
});

describe("bestPrices", () => {
  it("picks the cheapest per unit, using each store's latest price", () => {
    const [coke] = bestPrices([
      entry({ store: "Costco", price: 20, qty: 40 }), // 0.50
      entry({ store: "Walmart", price: 9, qty: 24, date: "2026-10-01" }), // 0.375, but older
      entry({ store: "Walmart", price: 14, qty: 24, date: "2026-11-10" }), // 0.583, latest
      entry({ store: "Sam's Club", item: "  coke 12 OZ cans ", price: 17.5, qty: 35 }), // 0.50
    ]);
    expect(coke.byStore.map((e) => e.store)).toEqual(["Costco", "Sam's Club", "Walmart"]);
    expect(coke.best.store).toBe("Costco");
    expect(coke.spread).toBeCloseTo(14 / 24 - 0.5);
  });

  it("is empty with no prices", () => {
    expect(bestPrices([])).toEqual([]);
  });
});

describe("parsePrice", () => {
  const form = (o: Record<string, string>) => {
    const f = new FormData();
    Object.entries(o).forEach(([k, v]) => f.set(k, v));
    return f;
  };

  it("accepts a full entry", () => {
    const r = parsePrice(form({ item: "Doritos", store: "Target", price: "15.49", qty: "30", unit: "bag", date: "2026-11-20" }), "stephen", "x");
    expect(r.ok && r.entry.price).toBe(15.49);
  });

  it("names every bad field", () => {
    const r = parsePrice(form({ item: "", store: "Kroger", price: "0", qty: "", date: "soon" }), "stephen", "x");
    expect(r.ok ? [] : r.invalid).toEqual(["item", "store", "price", "qty", "date"]);
  });
});

describe("memoryStore", () => {
  it("round-trips a list without sharing references", async () => {
    const s = memoryStore();
    const rows = [{ a: 1 }];
    await s.write("x", rows);
    rows[0].a = 2;
    expect(await s.read("x")).toEqual([{ a: 1 }]);
    expect(await s.read("missing")).toEqual([]);
  });
});
