import { describe, expect, it } from "vitest";
import { honeypotField, hostEmailText, parseHost } from "../src/lib/host";
import { availability } from "../src/site";

// Monday Nov 16 2026, 9:00 AM Eastern.
const now = new Date("2026-11-16T14:00:00Z");

const good = {
  name: "Dana Lee",
  role: "Store manager",
  email: "dana@example.com",
  phone: "(704) 555-0100",
  business: "Firestone",
  address: "123 Main St, Gastonia, NC",
  traffic: "50 to 150 a day",
};
const form = (o: Record<string, string>) => {
  const f = new FormData();
  Object.entries(o).forEach(([k, v]) => f.set(k, v));
  return f;
};

describe("parseHost", () => {
  it("accepts a full request without a call", () => {
    const r = parseHost(form(good), availability, now);
    expect(r.ok).toBe(true);
  });

  it("accepts an open call time and rejects a closed one", () => {
    expect(parseHost(form({ ...good, callDate: "2026-11-18", callTime: "10:00" }), availability, now).ok).toBe(true);
    const sunday = parseHost(form({ ...good, callDate: "2026-11-22", callTime: "10:00" }), availability, now);
    expect(!sunday.ok && !sunday.spam && sunday.invalid).toEqual(["callTime"]);
  });

  it("names bad fields", () => {
    const r = parseHost(form({ ...good, email: "nope", phone: "555", traffic: "lots" }), availability, now);
    expect(!r.ok && !r.spam && r.invalid).toEqual(["email", "phone", "traffic"]);
  });

  it("flags bots that fill the hidden field", () => {
    const r = parseHost(form({ ...good, [honeypotField]: "http://spam" }), availability, now);
    expect(!r.ok && r.spam).toBe(true);
  });

  it("writes an email the owners can act on", () => {
    const r = parseHost(form(good), availability, now);
    if (!r.ok) throw new Error("expected ok");
    const body = hostEmailText(r.message);
    expect(body).toContain("Phone: (704) 555-0100");
    expect(body).toContain("None picked");
  });
});
