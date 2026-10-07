"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { call } from "@/lib/client";
import type { roadmapView } from "@/lib/service";
import { SKILL_LABELS } from "@/lib/model";

type View = Awaited<ReturnType<typeof roadmapView>>;

const statusColor: Record<string, string> = {
  Proposed: "bg-neutral-100 text-neutral-700", Committed: "bg-green-100 text-green-800", Carryover: "bg-amber-100 text-amber-800",
  "Pivot-Added": "bg-blue-100 text-blue-800", Deprioritized: "bg-red-100 text-red-800", Done: "bg-neutral-200 text-neutral-600",
};

export default function RoadmapTable({ initial }: { initial: View }) {
  const [view, setView] = useState(initial);
  const [order, setOrder] = useState(initial.epics.map((e) => e.key));
  const [func, setFunc] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);

  const byKey = useMemo(() => new Map(view.epics.map((e) => [e.key, e])), [view]);
  const dirty = order.some((k, i) => view.epics[i]?.key !== k);
  const funcs = Array.from(new Set(view.epics.map((e) => e.func ?? "Unknown"))).sort();

  // Recompute cutline client-side from the current order.
  const cut = useMemo(() => {
    let cum = 0;
    return order.map((k) => {
      const e = byKey.get(k)!;
      const counts = !["Deprioritized", "Done"].includes(e.roadmap.status) && e.statusCategory !== "Done";
      if (counts) cum += e.remainingHours;
      return { key: k, above: counts && cum <= view.teamNetHrs, cum: Math.round(cum * 10) / 10 };
    });
  }, [order, byKey, view.teamNetHrs]);
  const demand = cut.filter((c) => c.above).reduce((a, c) => a + byKey.get(c.key)!.remainingHours, 0);

  function move(key: string, dir: -1 | 1) {
    setOrder((o) => { const i = o.indexOf(key), j = i + dir; if (j < 0 || j >= o.length) return o; const n = [...o]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  }
  function dropOn(target: string) {
    if (!drag || drag === target) return;
    setOrder((o) => { const n = o.filter((k) => k !== drag); n.splice(n.indexOf(target), 0, drag); return n; });
    setDrag(null);
  }
  async function refresh() {
    setBusy("refresh"); setMsg(null);
    try { const v = await call<View>("/api/epics?fresh=1"); setView(v); setOrder(v.epics.map((e) => e.key)); }
    catch (e) { setMsg(String(e)); } finally { setBusy(null); }
  }
  async function pushRank() {
    setBusy("rank"); setMsg(null);
    try { const r = await call<{ ranked: number }>("/api/rank", { method: "PUT", body: JSON.stringify({ keys: order }) }); setMsg(`Rank pushed to Jira for ${r.ranked + 1} epics.`); await refresh(); }
    catch (e) { setMsg(String(e)); } finally { setBusy(null); }
  }
  async function openCommit() {
    if (dirty) { setMsg("Push the rank to Jira before opening a commit, so the snapshot matches the board."); return; }
    setBusy("commit"); setMsg(null);
    try { const r = await call<{ key: string }>("/api/decisions", { method: "POST", body: JSON.stringify({ kind: "commit", by: "roadmap app" }) }); setMsg(`Commit ${r.key} opened for steer-co approval.`); }
    catch (e) { setMsg(String(e)); } finally { setBusy(null); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{view.settings.quarter.quarter} roadmap</h1>
          <p className="text-sm text-neutral-600">{view.epics.length} epics · team net {view.teamNetHrs} h · above cutline {Math.round(demand * 10) / 10} h · synced {new Date(view.syncedAt).toLocaleTimeString()}{view.fromCache ? " (cache)" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="rounded border px-2 py-1 text-sm" value={func} onChange={(e) => setFunc(e.target.value)}>
            <option value="">All functions</option>{funcs.map((f) => <option key={f}>{f}</option>)}
          </select>
          <button onClick={refresh} disabled={!!busy} className="rounded border px-3 py-1 text-sm">Refresh from Jira</button>
          <button onClick={pushRank} disabled={!!busy || !dirty} className="rounded bg-neutral-900 px-3 py-1 text-sm text-white disabled:opacity-40">Push rank to Jira</button>
          <button onClick={openCommit} disabled={!!busy} className="rounded bg-green-700 px-3 py-1 text-sm text-white disabled:opacity-40">Open commit for approval</button>
        </div>
      </div>
      {msg && <div className="rounded border bg-white p-2 text-sm">{msg}</div>}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        {view.skills.map((s) => (
          <div key={s.skill} className={`rounded border p-2 text-xs ${s.ok ? "bg-white" : "border-red-300 bg-red-50"}`}>
            <div className="font-medium">{SKILL_LABELS[s.skill]}</div>
            <div>{s.demand} h needed / {s.supply} h available</div>
            <div className="text-neutral-500">{s.builders.join(", ") || "no builder ≥2"}</div>
          </div>
        ))}
      </div>

      <table className="w-full border-collapse bg-white text-sm">
        <thead><tr className="border-b text-left text-xs uppercase text-neutral-500">
          <th className="p-2">#</th><th className="p-2">Epic</th><th className="p-2">Function</th><th className="p-2">Owner</th><th className="p-2">Sponsor</th>
          <th className="p-2">SWAG</th><th className="p-2 text-right">Left h</th><th className="p-2 text-right">Cum h</th><th className="p-2">Cx</th><th className="p-2">XF</th><th className="p-2">Skills</th><th className="p-2">Status</th><th className="p-2"></th>
        </tr></thead>
        <tbody>
          {order.map((k, i) => {
            const e = byKey.get(k)!; const c = cut[i];
            if (func && (e.func ?? "Unknown") !== func) return null;
            const firstBelow = !c.above && (i === 0 || cut[i - 1].above);
            return (
              <tr key={k} draggable onDragStart={() => setDrag(k)} onDragOver={(ev) => ev.preventDefault()} onDrop={() => dropOn(k)}
                className={`border-b ${firstBelow ? "border-t-4 border-t-red-400" : ""} ${c.above ? "" : "bg-neutral-50 text-neutral-500"}`}>
                <td className="p-2 tabular-nums">{i + 1}</td>
                <td className="p-2"><Link href={`/epics/${k}`} className="font-medium hover:underline">{k}</Link> <span>{e.summary}</span>
                  {e.carryover && <span className="ml-2 rounded bg-amber-100 px-1 text-xs text-amber-800">carryover · sunk {e.roadmap.carryoverHours} h</span>}</td>
                <td className="p-2">{e.func ?? "-"}</td><td className="p-2">{e.developer ?? e.assignee ?? "-"}</td><td className="p-2">{e.roadmap.sponsor ?? "-"}</td>
                <td className="p-2">{e.swag?.split(" ")[0] ?? "-"} <span className="text-neutral-400">{Math.round(e.pctComplete * 100)}%</span></td>
                <td className="p-2 text-right tabular-nums">{e.remainingHours}</td><td className="p-2 text-right tabular-nums">{c.cum}</td>
                <td className="p-2">{e.roadmap.complexity ?? "-"}</td><td className="p-2">{e.roadmap.xfunc ?? "-"}</td>
                <td className="p-2 text-xs">{Object.entries(e.roadmap.skillHours).map(([s, h]) => `${s} ${h}`).join(", ") || "-"}</td>
                <td className="p-2"><span className={`rounded px-1.5 py-0.5 text-xs ${statusColor[e.roadmap.status] ?? ""}`}>{e.roadmap.status}</span></td>
                <td className="p-2 whitespace-nowrap"><button onClick={() => move(k, -1)} className="px-1">▲</button><button onClick={() => move(k, 1)} className="px-1">▼</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-neutral-500">Drag rows or use the arrows. The red line is the cutline where cumulative remaining hours exceed team net hours. Rank is only saved when you push it to Jira.</p>
    </div>
  );
}
