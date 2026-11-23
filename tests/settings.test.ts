import { afterEach, describe, expect, it } from "vitest";
import { checkLogin, hashPassword } from "../src/lib/auth";
import { apply, checkNewPassword, defaults, hubUsers, loadSettings, parseSettings, saveSettings, setPassword } from "../src/lib/settings";
import { memoryStore } from "../src/lib/store";
import { availability, family, locations, site } from "../src/site";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

const good = {
  phone: "704-555-0123",
  email: "hello@example.com",
  hostToEmail: "a@example.com, b@example.com",
  facebook: "",
  instagram: "@oogumvending",
  tiktok: "https://www.tiktok.com/@oogum",
  "from-1": "08:00",
  "to-1": "12:00",
  "bio-Stephen": "Stephen grew up in Belmont.",
  "bio-Nancy": "",
  locations: "Firestone, Belmont, NC\nFirestone, Gastonia, NC",
};

afterEach(() => apply({}));

describe("owner settings", () => {
  it("parses a good form, turning a handle into a link", () => {
    const r = parseSettings(form(good));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.settings.instagram).toBe("https://www.instagram.com/oogumvending");
    expect(r.settings.hours).toEqual({ 1: { from: "08:00", to: "12:00" } });
    expect(r.settings.locations).toEqual([
      { name: "Firestone", city: "Belmont, NC" },
      { name: "Firestone", city: "Gastonia, NC" },
    ]);
  });

  it("flags bad fields and saves nothing", () => {
    const r = parseSettings(form({ ...good, phone: "12", email: "nope", hostToEmail: "a@example.com, x", facebook: "facebook dot com", "from-2": "17:00", "to-2": "09:00", locations: "Just a name" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(["email", "facebook", "from-2", "hostToEmail", "locations", "phone"]);
  });

  it("lays saved values over site.ts and back again", async () => {
    const store = memoryStore();
    const r = parseSettings(form(good));
    if (!r.ok) throw new Error("bad form");
    await saveSettings(r.settings, store);
    expect(site.phone).toBe("704-555-0123");
    expect(site.social.instagram).toBe("https://www.instagram.com/oogumvending");
    expect(availability.weekly).toEqual({ 1: [["08:00", "12:00"]] });
    expect(family.owners[0].bio).toBe("Stephen grew up in Belmont.");
    expect(locations).toHaveLength(2);
    expect((await loadSettings(store)).hostToEmail).toBe("a@example.com, b@example.com");
    apply({});
    expect(site.phone).toBe(defaults.phone);
    expect(locations).toEqual(defaults.locations);
  });

  it("lets an owner change their own password without touching the other", async () => {
    process.env.HUB_USERS = `stephen:${hashPassword("old-password-1")},nancy:${hashPassword("nancy-password")}`;
    const store = memoryStore();
    await setPassword("stephen", "brand-new-password", store);
    const users = await hubUsers(store);
    expect(checkLogin("stephen", "brand-new-password", users)).toBe("stephen");
    expect(checkLogin("stephen", "old-password-1", users)).toBeNull();
    expect(checkLogin("nancy", "nancy-password", users)).toBe("nancy");
    expect(checkNewPassword("short", "short")).not.toBe("");
    expect(checkNewPassword("long-enough-1", "long-enough-2")).not.toBe("");
    expect(checkNewPassword("long-enough-1", "long-enough-1")).toBe("");
    delete process.env.HUB_USERS;
  });
});
