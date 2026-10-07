export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const api = (p: string) => `${basePath}${p}`;
export async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(api(path), { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}
