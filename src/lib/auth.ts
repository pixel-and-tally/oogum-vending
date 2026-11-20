// Owner hub login. No accounts service: the owners' logins live in two
// Netlify environment variables.
//   HUB_USERS  = "stephen:scrypt$<salt>$<hash>,nancy:scrypt$<salt>$<hash>"
//                (make each with `npm run hub:hash -- <password>`)
//   HUB_SECRET = any long random string; signs the login cookie.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "oogum_hub";
export const SESSION_DAYS = 14;

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")): string {
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** "stephen:scrypt$..,nancy:scrypt$.." -> { stephen: "scrypt$..", nancy: "scrypt$.." } */
export function parseUsers(raw: string | undefined): Record<string, string> {
  const users: Record<string, string> = {};
  for (const pair of (raw ?? "").split(",")) {
    const i = pair.indexOf(":");
    if (i > 0) users[pair.slice(0, i).trim().toLowerCase()] = pair.slice(i + 1).trim();
  }
  return users;
}

export function checkLogin(username: string, password: string, users: Record<string, string>): string | null {
  const name = username.trim().toLowerCase();
  const stored = users[name];
  if (!stored || !password) return null;
  return verifyPassword(password, stored) ? name : null;
}

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function makeSession(user: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ u: user, exp: now + SESSION_DAYS * 86_400_000 })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the user name for a valid, unexpired session token. */
export function readSession(token: string | undefined, secret: string, now = Date.now()): string | null {
  if (!token || !secret) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { u: string; exp: number };
    return typeof u === "string" && exp > now ? u : null;
  } catch {
    return null;
  }
}

export const hubConfig = () => ({
  users: parseUsers(process.env.HUB_USERS),
  secret: process.env.HUB_SECRET ?? "",
});
