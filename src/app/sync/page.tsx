import { myself } from "@/lib/jira";
import { getEpics, getSettings } from "@/lib/service";
export const dynamic = "force-dynamic";
export default async function SyncPage() {
  const rows: [string, string][] = [["Jira", process.env.JIRA_BASE_URL ?? "https://webflow.atlassian.net"], ["Token set", String(Boolean(process.env.ATLASSIAN_API_TOKEN))]];
  try { rows.push(["Acting as", (await myself()).displayName]); } catch (e) { rows.push(["Auth error", String(e)]); }
  try { const s = await getSettings(); rows.push(["Quarter", `${s.quarter.quarter} (prior ${s.quarter.priorQuarter})`]); const r = await getEpics(); rows.push(["Epics", String(r.epics.length)], ["Synced", `${r.syncedAt}${r.fromCache ? " (cache)" : ""}`]); }
  catch (e) { rows.push(["Sync error", String(e)]); }
  return (<div className="space-y-3"><h1 className="text-xl font-semibold">Sync</h1>
    <table className="bg-white text-sm">{rows.map(([k, v]) => <tbody key={k}><tr className="border-b"><td className="p-2 text-neutral-500">{k}</td><td className="p-2">{v}</td></tr></tbody>)}</table>
    <p className="text-xs text-neutral-500">Epics come from JQL on Delivery Quarter; roadmap attributes live in the Jira issue property &quot;roadmap&quot;; decisions are BTEC Tasks labelled roadmap-decision. Cache is 60 seconds; Refresh on the roadmap page bypasses it.</p></div>);
}
