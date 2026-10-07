import { NextRequest, NextResponse } from "next/server";
import { createDecisionTask, fetchDecisions, getRoadmap } from "@/lib/jira";
import { roadmapView } from "@/lib/service";
import type { DecisionRecord } from "@/lib/model";
export const dynamic = "force-dynamic";

export async function GET() {
  try { return NextResponse.json(await fetchDecisions()); }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { kind: "commit" | "pivot"; by: string; addKey?: string; displaceKey?: string; reason?: string };
  try {
    const view = await roadmapView(true);
    const ranked = view.epics.map((e, i) => ({ key: e.key, summary: e.summary, remainingHours: e.remainingHours, aboveCutline: view.cut[i].aboveCutline }));
    const record: DecisionRecord = {
      kind: body.kind, quarter: view.settings.quarter.quarter, createdBy: body.by || "roadmap app", createdAt: new Date().toISOString(),
      approvals: [], approved: false, snapshot: { ranked, teamNetHours: view.teamNetHrs, demandHours: view.demandHours },
    };
    let summary: string, related: string[] = [];
    if (body.kind === "commit") {
      summary = `${record.quarter} Commit`;
      related = ranked.filter((r) => r.aboveCutline).map((r) => r.key);
    } else {
      if (!body.addKey || !body.displaceKey) return NextResponse.json({ error: "A pivot must name the added epic and the displaced epic" }, { status: 400 });
      const add = view.epics.find((e) => e.key === body.addKey), disp = view.epics.find((e) => e.key === body.displaceKey);
      if (!disp) return NextResponse.json({ error: `${body.displaceKey} is not on the roadmap` }, { status: 400 });
      const addRec = add?.roadmap ?? (await getRoadmap(body.addKey));
      const intakeComplete = Boolean(addRec?.intake) || addRec?.scoreSource === "manual";
      if (!intakeComplete) return NextResponse.json({ error: `${body.addKey} has no completed intake questionnaire. Run intake first.` }, { status: 400 });
      record.pivot = {
        addKey: body.addKey, displaceKey: body.displaceKey,
        displacedSunkHours: Math.round(disp.swagMid * disp.pctComplete * 10) / 10,
        addedHours: add?.remainingHours ?? 0, intakeComplete, reason: body.reason ?? "",
      };
      summary = `Pivot: add ${body.addKey}, displace ${body.displaceKey}`;
      related = [body.addKey, body.displaceKey];
    }
    const description = [
      `${record.kind === "commit" ? "Quarter commit" : "Mid-quarter pivot"} for ${record.quarter}, raised by ${record.createdBy} via the roadmap app.`,
      record.pivot ? `Add ${record.pivot.addKey} (${record.pivot.addedHours} hrs). Displace ${record.pivot.displaceKey} (sunk ${record.pivot.displacedSunkHours} hrs). Reason: ${record.pivot.reason}` : "",
      `Team net hours ${view.teamNetHrs}; demand above cutline ${view.demandHours}.`,
      "Approvals are recorded as comments by the steer-co members; this task closes when all four have approved.",
      "", "Ranked list at decision time:",
      ...ranked.map((r, i) => `${i + 1}. ${r.key} ${r.summary} (${r.remainingHours} hrs) ${r.aboveCutline ? "ABOVE" : "below"}`),
    ].join("\n");
    const key = await createDecisionTask(summary, description, record, related);
    return NextResponse.json({ ok: true, key });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
