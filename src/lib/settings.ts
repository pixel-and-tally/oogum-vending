// Owner settings: the everyday facts Stephen and Nancy can change themselves
// from the hub (Settings tab) without a code change: phone, email, where host
// requests go, social links, call hours, their bios, machine locations.
//
// src/site.ts holds the starting values. Whatever the owners save lives in the
// store (Workers KV) under "settings", and applySettings() lays it over the
// site.ts objects at the start of every request (src/middleware.ts), so every
// page and email reads the current values without knowing about this file.
// Hub passwords they set are kept apart, under "logins" (see hubUsers()).
import { availability, family, locations, site } from "../site";
import { hashPassword, parseUsers } from "./auth";
import { getStore, type Store } from "./store";

export const days = [
  { n: 1, name: "Monday" },
  { n: 2, name: "Tuesday" },
  { n: 3, name: "Wednesday" },
  { n: 4, name: "Thursday" },
  { n: 5, name: "Friday" },
  { n: 6, name: "Saturday" },
  { n: 0, name: "Sunday" },
] as const;

export type Hours = Record<string, { from: string; to: string }>;

export type Settings = {
  phone: string;
  email: string;
  /** Where host requests are emailed. Empty = the HOST_TO_EMAIL secret. */
  hostToEmail: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  /** Call hours by weekday number (0 = Sunday). Missing day = no calls. */
  hours: Hours;
  bios: Record<string, string>;
  locations: { name: string; city: string }[];
};

export type Login = { user: string; hash: string; changedAt: string };

const hoursOf = (weekly: typeof availability.weekly): Hours =>
  Object.fromEntries(Object.entries(weekly).flatMap(([d, spans]) => (spans?.[0] ? [[d, { from: spans[0][0], to: spans[0][1] }]] : [])));

/** The site.ts values, captured before any request changes them. */
export const defaults: Settings = structuredClone({
  phone: site.phone,
  email: site.email,
  hostToEmail: "",
  facebook: site.social.facebook,
  instagram: site.social.instagram,
  tiktok: site.social.tiktok,
  hours: hoursOf(availability.weekly),
  bios: Object.fromEntries(family.owners.map((o) => [o.name, o.bio])),
  locations: locations.map((l) => ({ name: l.name, city: l.city })),
});

/** Lays saved settings over site.ts. Safe to call on every request. */
export function apply(saved: Partial<Settings>) {
  const s: Settings = { ...defaults, ...saved };
  const mutableSite = site as { -readonly [K in keyof typeof site]: (typeof site)[K] } & { social: Record<string, string> };
  mutableSite.phone = s.phone as typeof site.phone;
  mutableSite.email = s.email as typeof site.email;
  mutableSite.social = { facebook: s.facebook, instagram: s.instagram, tiktok: s.tiktok };
  availability.weekly = Object.fromEntries(Object.entries(s.hours).map(([d, h]) => [d, [[h.from, h.to] as const]])) as typeof availability.weekly;
  for (const o of family.owners) o.bio = s.bios[o.name] ?? "";
  locations.splice(0, locations.length, ...s.locations);
  return s;
}

// One KV read per Worker instance every 30 seconds keeps page views cheap.
const TTL = 30_000;
let cache: { at: number; value: Settings } | undefined;

export async function loadSettings(store?: Store, now = Date.now()): Promise<Settings> {
  if (cache && now - cache.at < TTL && !store) return cache.value;
  let saved: Partial<Settings> = {};
  try {
    const s = store ?? (await getStore());
    saved = (await s.read<Partial<Settings>>("settings"))[0] ?? {};
  } catch (err) {
    console.error("Settings: read failed, using site.ts", err);
  }
  const value = apply(saved);
  if (!store) cache = { at: now, value };
  return value;
}

export async function saveSettings(s: Settings, store?: Store) {
  await (store ?? (await getStore())).write("settings", [s]);
  cache = { at: Date.now(), value: apply(s) };
}

/** Hub logins: HUB_USERS from Cloudflare, with any password an owner changed in the hub on top. */
export async function hubUsers(store?: Store): Promise<Record<string, string>> {
  const users = parseUsers(process.env.HUB_USERS);
  try {
    for (const l of await (store ?? (await getStore())).read<Login>("logins")) if (users[l.user]) users[l.user] = l.hash;
  } catch (err) {
    console.error("Settings: logins read failed, using HUB_USERS", err);
  }
  return users;
}

export async function setPassword(user: string, password: string, store?: Store) {
  const s = store ?? (await getStore());
  const rows = (await s.read<Login>("logins")).filter((l) => l.user !== user);
  rows.push({ user, hash: hashPassword(password), changedAt: new Date().toISOString() });
  await s.write("logins", rows);
}

// Form checks, shared by the Settings page and the tests.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[\d\s().+-]{10,}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type SettingsErrors = Record<string, string>;

const field = (form: FormData, key: string, max = 300) => String(form.get(key) ?? "").trim().slice(0, max);

/** A social link: a full https address, or empty. A bare @handle becomes the profile link. */
function social(value: string, host: string) {
  if (!value) return "";
  if (/^@?[\w.]+$/.test(value)) return `https://www.${host}/${host === "tiktok.com" ? "@" : ""}${value.replace(/^@/, "")}`;
  return /^https:\/\/\S+$/.test(value) ? value : null;
}

export function parseSettings(form: FormData): { ok: true; settings: Settings } | { ok: false; errors: SettingsErrors } {
  const errors: SettingsErrors = {};
  const phone = field(form, "phone");
  if (phone && !PHONE.test(phone)) errors.phone = "Enter a phone number with area code, like 704-555-0123.";
  const email = field(form, "email");
  if (email && !EMAIL.test(email)) errors.email = "Enter an email address, like you@example.com.";
  const hostToEmail = field(form, "hostToEmail", 500);
  if (hostToEmail && !hostToEmail.split(",").every((e) => EMAIL.test(e.trim()))) errors.hostToEmail = "Enter one or more email addresses, separated by commas.";

  const socials = { facebook: "facebook.com", instagram: "instagram.com", tiktok: "tiktok.com" } as const;
  const links = {} as Record<keyof typeof socials, string>;
  for (const [key, host] of Object.entries(socials) as [keyof typeof socials, string][]) {
    const v = social(field(form, key), host);
    if (v === null) errors[key] = `Paste the full link (starting with https://) or just the handle.`;
    links[key] = v ?? "";
  }

  const hours: Hours = {};
  for (const d of days) {
    const from = field(form, `from-${d.n}`);
    const to = field(form, `to-${d.n}`);
    if (!from && !to) continue;
    if (!TIME.test(from) || !TIME.test(to) || from >= to) errors[`from-${d.n}`] = `Give ${d.name} a start time before the end time, or clear both for no calls.`;
    else hours[d.n] = { from, to };
  }

  const bios = Object.fromEntries(family.owners.map((o) => [o.name, field(form, `bio-${o.name}`, 1200)]));

  const spots: Settings["locations"] = [];
  const lines = field(form, "locations", 3000).split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const i = line.indexOf(",");
    const name = i > 0 ? line.slice(0, i).trim() : "";
    const city = i > 0 ? line.slice(i + 1).trim() : "";
    if (!name || !city) {
      errors.locations = `Write each location as "Name, City", like "Firestone, Belmont, NC". Check: ${line}`;
      break;
    }
    spots.push({ name, city });
  }

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, settings: { phone, email, hostToEmail, ...links, hours, bios, locations: spots } };
}

export function checkNewPassword(next: string, confirm: string): string {
  if (next.length < 10) return "Use at least 10 characters.";
  if (next !== confirm) return "The two new passwords don't match.";
  return "";
}
