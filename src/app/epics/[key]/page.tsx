import { getEpics } from "@/lib/service";
import ScoreForm from "@/components/ScoreForm";
import { weeklyImpact } from "@/lib/model";
export const dynamic = "force-dynamic";

export default async function EpicPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { epics } = await getEpics();
  const e = epics.find((x) => x.key === key);
  if (!e) return <div className="text-sm">{key} is not on the current roadmap query. <a className="underline" href="../roadmap">Back</a></div>;
  const it = e.roadmap.intake;
  const row = (l: string, v: React.ReactNode) => (<div className="flex gap-2 text-sm"><span className="w-44 shrink-0 text-neutral-500">{l}</span><span>{v}</span></div>);
  return (
    <div className="space-y-6">
      <div><a href={e.url} target="_blank" className="text-sm text-neutral-500 hover:underline">{e.key} ↗</a><h1 className="text-xl font-semibold">{e.summary}</h1></div>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-1 rounded border bg-white p-4">
          <h2 className="mb-2 font-medium">Jira</h2>
          {row("Status", e.status)}{row("Delivery quarter", e.quarter ?? "-")}{row("Requesting function", e.func ?? "-")}
          {row("Owner", e.developer ?? e.assignee ?? "-")}{row("Priority", e.priority)}
          {row("SWAG", `${e.swag ?? "-"} (${e.swagMid} h)`)}{row("% complete", `${Math.round(e.pctComplete * 100)}%`)}
          {row("Remaining", `${e.remainingHours} h`)}{e.carryover && row("Carryover sunk", `${e.roadmap.carryoverHours} h`)}
        </section>
        <section className="space-y-1 rounded border bg-white p-4">
          <h2 className="mb-2 font-medium">Roadmap</h2>
          {row("Roadmap status", e.roadmap.status)}{row("Sponsor", e.roadmap.sponsor ?? "-")}
          {row("Complexity", e.roadmap.complexity ?? "-")}{row("Cross-functional", e.roadmap.xfunc ?? "-")}
          {row("Score source", e.roadmap.scoreSource ?? "none")}
          {row("Skill hours", JSON.stringify(e.roadmap.skillHours))}
          {it && row("Weekly impact", `${weeklyImpact(it)} h/wk (${it.people_affected} people × ${it.hrs_per_week_impact})`)}
          {it && row("Risk", it.risk ?? "none")}{it?.deadline && row("Deadline", `${it.deadline} ${it.deadline_driver ?? ""}`)}
        </section>
      </div>
      {it && <section className="rounded border bg-white p-4 text-sm"><h2 className="mb-2 font-medium">Intake</h2><p><b>Problem.</b> {it.problem}</p><p className="mt-1"><b>Outcome.</b> {it.outcome}</p></section>}
      <ScoreForm epicKey={e.key} current={e.roadmap} />
      {e.roadmap.overrides.length > 0 && (
        <section className="rounded border bg-white p-4 text-sm"><h2 className="mb-2 font-medium">Override log</h2>
          <ul className="space-y-1">{e.roadmap.overrides.map((o, i) => <li key={i}>{o.at.slice(0, 16)} · {o.by} · {o.field}: {JSON.stringify(o.from)} → {JSON.stringify(o.to)} · {o.reason}</li>)}</ul></section>)}
    </div>
  );
}
