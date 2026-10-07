"use client";
import { useState } from "react";
import { call } from "@/lib/client";
import { personCapacity, weeksRemaining, type CapacitySettings, type Person } from "@/lib/capacity";
import { SKILLS, SKILL_LABELS } from "@/lib/model";

export default function CapacityEditor({ initial }: { initial: CapacitySettings }) {
  const [s, setS] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const caps = s.people.map((p) => personCapacity(p, s.quarter));
  const team = Math.round(caps.reduce((a, p) => a + p.netHrs, 0) * 10) / 10;
  const wk = weeksRemaining(s.quarter);

  const upd = (i: number, patch: Partial<Person>) => setS({ ...s, people: s.people.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const num = (i: number, k: keyof Person) => (e: React.ChangeEvent<HTMLInputElement>) => upd(i, { [k]: Number(e.target.value) } as Partial<Person>);
  async function save() { try { await call("/api/capacity", { method: "PUT", body: JSON.stringify(s) }); setMsg("Saved."); } catch (e) { setMsg(String(e)); } }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div><h1 className="text-xl font-semibold">Capacity</h1>
          <p className="text-sm text-neutral-600">{s.quarter.quarter} · {wk.remaining} of {wk.total} weeks remaining · team net {team} h</p></div>
        <button onClick={save} className="rounded bg-neutral-900 px-3 py-1 text-sm text-white">Save</button>
      </div>
      {msg && <div className="rounded border bg-white p-2 text-sm">{msg}</div>}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5 text-sm">
        {(["quarter", "priorQuarter", "start", "end"] as const).map((k) => (
          <label key={k} className="flex flex-col"><span className="text-xs text-neutral-500">{k}</span>
            <input className="rounded border px-2 py-1" value={s.quarter[k]} onChange={(e) => setS({ ...s, quarter: { ...s.quarter, [k]: e.target.value } })} /></label>))}
        <label className="flex flex-col"><span className="text-xs text-neutral-500">SM hrs/sprint</span>
          <input type="number" className="rounded border px-2 py-1" value={s.quarter.smOverheadPerSprint} onChange={(e) => setS({ ...s, quarter: { ...s.quarter, smOverheadPerSprint: Number(e.target.value) } })} /></label>
      </div>
      <table className="w-full bg-white text-sm">
        <thead><tr className="border-b text-left text-xs uppercase text-neutral-500">
          <th className="p-2">Person</th><th className="p-2">FTE %</th><th className="p-2">Hrs/wk</th><th className="p-2">PTO d</th><th className="p-2">Hol d</th><th className="p-2">SM spr</th><th className="p-2">Ad hoc %</th><th className="p-2">Review %</th><th className="p-2 text-right">Net h</th>
          {SKILLS.map((k) => <th key={k} className="p-2" title={SKILL_LABELS[k]}>{k}</th>)}
        </tr></thead>
        <tbody>{s.people.map((p, i) => (
          <tr key={p.name} className="border-b">
            <td className="p-2"><input className="w-36 rounded border px-1" value={p.name} onChange={(e) => upd(i, { name: e.target.value })} /></td>
            {(["ftePct", "baseHrsPerWeek", "ptoDays", "holidayDays", "sprintsAsSM", "adHocPct", "reviewPct"] as const).map((k) => (
              <td key={k} className="p-2"><input type="number" className="w-16 rounded border px-1" value={p[k]} onChange={num(i, k)} /></td>))}
            <td className="p-2 text-right tabular-nums font-medium">{caps[i].netHrs}</td>
            {SKILLS.map((k) => <td key={k} className="p-2"><input type="number" min={0} max={3} className="w-12 rounded border px-1" value={p.skills[k]} onChange={(e) => upd(i, { skills: { ...p.skills, [k]: Number(e.target.value) } })} /></td>)}
          </tr>))}</tbody>
      </table>
      <div className="flex gap-2">
        <button className="rounded border px-3 py-1 text-sm" onClick={() => setS({ ...s, people: [...s.people, { name: "New person", ftePct: 100, baseHrsPerWeek: 30, ptoDays: 0, holidayDays: 0, sprintsAsSM: 0, adHocPct: 40, reviewPct: 0, assignable: true, skills: { Flow: 0, Apex: 0, LWC: 0, CPQ: 0, Integrations: 0, Data: 0 } }] })}>Add person</button>
      </div>
      <p className="text-xs text-neutral-500">Net = hrs/wk × FTE × weeks remaining − (PTO + holidays) × 8 − SM sprints × overhead, then minus ad hoc % and review %. Same formula as the Quarterly Capacity Planner sheet. Skill proficiency 0-3; a person counts as supply for a skill at 2 or above.</p>
    </div>
  );
}
