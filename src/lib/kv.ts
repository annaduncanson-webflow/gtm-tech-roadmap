// KV access with a local file fallback for `next dev` without wrangler.
import { getCloudflareContext } from "@opennextjs/cloudflare";

type KVLike = { get(k: string): Promise<string | null>; put(k: string, v: string): Promise<void> };

async function binding(): Promise<KVLike | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as unknown as { ROADMAP_KV?: KVLike }).ROADMAP_KV;
    return kv ?? null;
  } catch {
    return null;
  }
}

async function fileStore(): Promise<KVLike> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const file = path.join(process.cwd(), ".data", "kv.json");
  async function read(): Promise<Record<string, string>> {
    try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return {}; }
  }
  return {
    async get(k) { return (await read())[k] ?? null; },
    async put(k, v) {
      const all = await read(); all[k] = v;
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(all, null, 2));
    },
  };
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const kv = (await binding()) ?? (await fileStore());
  const raw = await kv.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function kvPut(key: string, value: unknown): Promise<void> {
  const kv = (await binding()) ?? (await fileStore());
  await kv.put(key, JSON.stringify(value));
}
