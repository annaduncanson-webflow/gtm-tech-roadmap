// Composes Jira + KV into the views. Epic list cached 60s in KV.
import { fetchEpics } from "./jira";
import { kvGet, kvPut } from "./kv";
import { DEFAULT_SETTINGS, applyCutline, personCapacity, skillBalance, type CapacitySettings } from "./capacity";
import type { Epic } from "./model";

const EPIC_CACHE = "epics:cache";
const SETTINGS = "capacity:settings";

export async function getSettings(): Promise<CapacitySettings> {
  return (await kvGet<CapacitySettings>(SETTINGS)) ?? DEFAULT_SETTINGS;
}
export async function saveSettings(s: CapacitySettings): Promise<void> {
  await kvPut(SETTINGS, s);
}

export async function getEpics(opts: { fresh?: boolean } = {}): Promise<{ epics: Epic[]; syncedAt: string; fromCache: boolean }> {
  const cached = opts.fresh ? null : await kvGet<{ epics: Epic[]; syncedAt: string }>(EPIC_CACHE);
  if (cached && Date.now() - new Date(cached.syncedAt).getTime() < 60_000) return { ...cached, fromCache: true };
  const s = await getSettings();
  const epics = await fetchEpics(s.quarter.quarter, s.quarter.priorQuarter);
  const syncedAt = new Date().toISOString();
  await kvPut(EPIC_CACHE, { epics, syncedAt });
  return { epics, syncedAt, fromCache: false };
}

export async function invalidateEpics(): Promise<void> {
  await kvPut(EPIC_CACHE, { epics: [], syncedAt: "1970-01-01T00:00:00Z" });
}

export async function roadmapView(fresh = false) {
  const [{ epics, syncedAt, fromCache }, settings] = await Promise.all([getEpics({ fresh }), getSettings()]);
  const people = settings.people.map((p) => personCapacity(p, settings.quarter));
  const teamNetHrs = Math.round(people.reduce((a, p) => a + p.netHrs, 0) * 10) / 10;
  const cut = applyCutline(epics, teamNetHrs);
  const above = epics.filter((e, i) => cut[i].aboveCutline);
  const skills = skillBalance(people, above);
  const demandHours = Math.round(above.reduce((a, e) => a + e.remainingHours, 0) * 10) / 10;
  return { epics, cut, people, teamNetHrs, demandHours, skills, settings, syncedAt, fromCache };
}
