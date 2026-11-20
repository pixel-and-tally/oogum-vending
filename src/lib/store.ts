// Where the hub keeps its records. On Netlify this is Netlify Blobs (free,
// no database to run). Anywhere else (local dev, tests) it is a JSON file
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

async function blobStore(): Promise<Store> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "oogum-hub", consistency: "strong" });
  return {
    async read<T>(key: string) {
      return ((await store.get(key, { type: "json" })) as T[] | null) ?? [];
    },
    async write<T>(key: string, rows: T[]) {
      await store.setJSON(key, rows);
    },
  };
}

let cached: Promise<Store> | undefined;

export function getStore(): Promise<Store> {
  // NETLIFY is set in Netlify builds and functions.
  cached ??= process.env.NETLIFY ? blobStore() : Promise.resolve(fileStore(join(process.cwd(), ".data")));
  return cached;
}

export const newId = () => crypto.randomUUID();
