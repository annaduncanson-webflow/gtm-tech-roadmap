"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { call } from "@/lib/client";
import { STEER_CO } from "@/lib/model";
import type { Decision } from "@/lib/jira";

type EpicLite = { key: string; summary: string; status: string; hasIntake: boolean };

export default function Decisions({ decisions, epics }: { decisions: Decision[]; epics: EpicLite[] }) {
  const r = useRouter();
  const [addKey, setAddKey] = useState(""); const [displaceKey, setDisplaceKey] = useState(""); const [reason, setReason] = useState(""); const [by, setBy] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const committed = epics.filter((e) => ["Committed", "Carryover", "Pivot-Added"].includes(e.status));
  const candidates = epics.filter((e) => !["Committed", "Carryover", "Pivot-Added", "Done"].includes(e.status));

  async function pivot(ev: React.FormEvent) {
    ev.preventDefault(); setMsg(null);
    try { const res = await call<{ key: string }>("/api/decisions", { method: "POST", body: JSON.stringify({ kind: "pivot", addKey, displaceKey, reason, by }) }); setMsg(`Pivot ${res.key} opened.`); r.refresh(); }
    catch (e) { setMsg(String(e)); }
  }
  async function approve(key: string, name: string) {
    setMsg(null);
    try { await call(`/api/decisions/${key}/approve`, { method: "POST", body: JSON.stringify({ name }) }); r.refresh(); } catch (e) { setMsg(String(e)); }
  }
  const add = epics.find((e) => e.key === addKey);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Steer-co decisions</h1>
      {msg && <div className="rounded border bg-white p-2 text-sm">{msg}</div>}
      <form onSubmit={pivot} className="space-y-2 rounded border bg-white p-4 text-sm">
        <h2 className="font-medium">Request a mid-quarter pivot</h2>
        <p className="text-xs text-neutral-600">A pivot must name the committed item it displaces and the added item must have a completed intake. Both rules are enforced.</p>
        <div className="flex flex-wrap gap-2">
          <select className="rounded border px-2 py-1" value={addKey} onChange={(e) => setAddKey(e.target.value)} required>
            <option value="">Add epic…</option>{candidates.map((e) => <option key={e.key} value={e.key}>{e.key} {e.summary.slice(0, 60)}{e.hasIntake ? "" : " (no intake)"}</option>)}
          </select>
          <select className="rounded border px-2 py-1" value={displaceKey} onChange={(e) => setDisplaceKey(e.target.value)} required>
            <option value="">Displace committed epic…</option>{committed.map((e) => <option key={e.key} value={e.key}>{e.key} {e.summary.slice(0, 60)}</option>)}
          </select>
          <input className="w-40 rounded border px-2 py-1" placeholder="your name" value={by} onChange={(e) => setBy(e.target.value)} required />
          <input className="min-w-64 flex-1 rounded border px-2 py-1" placeholder="why now" value={reason} onChange={(e) => setReason(e.target.value)} required />
          <button className="rounded bg-neutral-900 px-3 py-1 text-white" disabled={!addKey || !displaceKey || (add && !add.hasIntake)}>Open pivot</button>
        </div>
        {add && !add.hasIntake && <p className="text-xs text-red-700">{add.key} has no intake. Run the intake questionnaire first.</p>}
      </form>

      <section className="space-y-3">
        {decisions.length === 0 && <p className="text-sm text-neutral-500">No decisions yet. Open a commit from the roadmap page.</p>}
        {decisions.map((d) => (
          <div key={d.key} className="rounded border bg-white p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><a href={d.url} target="_blank" className="font-medium hover:underline">{d.key}</a> {d.summary} <span className="text-neutral-500">· {d.status} · {d.created.slice(0, 10)}</span></div>
              <div className="flex flex-wrap gap-1">
                {STEER_CO.map((m) => { const ok = d.record.approvals.some((a) => a.name === m.name); return (
                  <button key={m.name} disabled={ok || d.record.approved} onClick={() => approve(d.key, m.name)} className={`rounded border px-2 py-0.5 text-xs ${ok ? "bg-green-100 text-green-800" : ""}`}>{ok ? "✓ " : ""}{m.name}</button>); })}
              </div>
            </div>
            {d.record.pivot && <p className="mt-1">Add {d.record.pivot.addKey} ({d.record.pivot.addedHours} h) · displace {d.record.pivot.displaceKey} (sunk {d.record.pivot.displacedSunkHours} h) · {d.record.pivot.reason}</p>}
            <p className="mt-1 text-xs text-neutral-500">Snapshot: {d.record.snapshot.ranked.filter((x) => x.aboveCutline).length} above cutline, demand {d.record.snapshot.demandHours} h of {d.record.snapshot.teamNetHours} h. {d.record.approved ? "Approved by all." : `${d.record.approvals.length}/${STEER_CO.length} approvals.`}</p>
          </div>
        ))}
      </section>
      <p className="text-xs text-neutral-500">Approvals are written as Jira comments under the acting user&apos;s token, with the approver&apos;s name in the text. Attribution to the real clicker comes with the Atlassian OAuth follow-up.</p>
    </div>
  );
}
