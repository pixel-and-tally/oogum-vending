// Where the hub keeps its records. On Cloudflare this is Workers KV (the
// HUB_STORE binding in wrangler.jsonc: free, no database to run). Anywhere else (local dev, tests) it is a JSON file
// under .data/, which git ignores. Each collection is one small JSON list:
// fine for two owners and a few hundred rows.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface Store {
  read<T>(key: string): Promise<T[]>;
  write<T>(key: string, rows: T[]): Promise<void>;
}

export function memoryStore(): Store {
  const data = new Map<string, unknown[]>();
  return {
    async read<T>(key: string) {
      return structuredClone((data.get(key) ?? []) as T[]);
    },
    async write<T>(key: string, rows: T[]) {
      data.set(key, structuredClone(rows));
    },
  };
}

function fileStore(dir: string): Store {
  return {
    async read<T>(key: string) {
      try {
        return JSON.parse(await readFile(join(dir, `${key}.json`), "utf8")) as T[];
      } catch {
        return [];
      }
    },
    async write<T>(key: string, rows: T[]) {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${key}.json`), JSON.stringify(rows, null, 2));
    },
  };
}

interface KV {
  get(key: string, type: "json"): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
}

async function kvStore(): Promise<Store> {
  // `cloudflare:workers` only exists inside the Worker, so it is imported lazily.
  const { env } = await import("cloudflare:workers");
  const kv = env.HUB_STORE as KV | undefined;
  if (!kv) throw new Error("Store: the HUB_STORE KV binding is missing (see wrangler.jsonc)");
  return {
    async read<T>(key: string) {
      return ((await kv.get(key, "json")) as T[] | null) ?? [];
    },
    async write<T>(key: string, rows: T[]) {
      await kv.put(key, JSON.stringify(rows));
    },
  };
}

/** True inside a Cloudflare Worker. */
const onCloudflare = () => typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

let cached: Promise<Store> | undefined;

export function getStore(): Promise<Store> {
  cached ??= onCloudflare() ? kvStore() : Promise.resolve(fileStore(join(process.cwd(), ".data")));
  return cached;
}

export const newId = () => crypto.randomUUID();
