"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { call } from "@/lib/client";
import { SKILLS, type RoadmapRecord, type ScoreOverride } from "@/lib/model";

export default function ScoreForm({ epicKey, current }: { epicKey: string; current: RoadmapRecord }) {
  const r = useRouter();
  const [field, setField] = useState<ScoreOverride["field"]>("complexity");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [by, setBy] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const statuses = ["Proposed", "Committed", "Carryover", "Pivot-Added", "Deprioritized", "Done"];

  async function submit(ev: React.FormEvent) {
    ev.preventDefault(); setMsg(null);
    let v: unknown = value;
    if (field === "complexity" || field === "xfunc") v = Number(value);
    if (field === "skillHours") { try { v = JSON.parse(value); } catch { setMsg("Skill hours must be JSON like {\"Flow\":20,\"CPQ\":13}"); return; } }
    try { await call(`/api/epics/${epicKey}/scores`, { method: "PATCH", body: JSON.stringify({ field, value: v, reason, by }) }); setMsg("Saved to Jira."); setReason(""); r.refresh(); }
    catch (e) { setMsg(String(e)); }
  }
  return (
    <form onSubmit={submit} className="space-y-2 rounded border bg-white p-4 text-sm">
      <h2 className="font-medium">Override a score or status (writes a Jira comment with the reason)</h2>
      <div className="flex flex-wrap gap-2">
        <select className="rounded border px-2 py-1" value={field} onChange={(e) => { setField(e.target.value as ScoreOverride["field"]); setValue(""); }}>
          <option value="complexity">Complexity (1-5)</option><option value="xfunc">Cross-functional (1-5)</option><option value="sponsor">Sponsor</option><option value="status">Roadmap status</option><option value="skillHours">Skill hours (JSON)</option>
        </select>
        {field === "status" ? (
          <select className="rounded border px-2 py-1" value={value} onChange={(e) => setValue(e.target.value)}><option value="">choose</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
        ) : field === "complexity" || field === "xfunc" ? (
          <select className="rounded border px-2 py-1" value={value} onChange={(e) => setValue(e.target.value)}><option value="">choose</option>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select>
        ) : (
          <input className="w-72 rounded border px-2 py-1" placeholder={field === "skillHours" ? `{"${SKILLS[0]}":20}` : "name or email"} value={value} onChange={(e) => setValue(e.target.value)} />
        )}
        <input className="w-40 rounded border px-2 py-1" placeholder="your name" value={by} onChange={(e) => setBy(e.target.value)} required />
        <input className="min-w-64 flex-1 rounded border px-2 py-1" placeholder="reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} required />
        <button className="rounded bg-neutral-900 px-3 py-1 text-white" disabled={!value || !reason}>Save</button>
      </div>
      <p className="text-xs text-neutral-500">Current: complexity {current.complexity ?? "-"}, cross-functional {current.xfunc ?? "-"}, status {current.status}.</p>
      {msg && <div className="text-xs">{msg}</div>}
    </form>
  );
}
