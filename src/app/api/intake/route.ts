import { NextRequest, NextResponse } from "next/server";
import { createEpic, setRoadmap } from "@/lib/jira";
import { getSettings, invalidateEpics } from "@/lib/service";
import { defaultSkillHours, emptyRecord, scoreComplexity, scoreXfunc, swagMidpoint, type IntakePayload } from "@/lib/model";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const p = (await req.json()) as IntakePayload;
  for (const f of ["summary", "requester", "requesting_function", "problem", "outcome"] as const)
    if (!p[f]) return NextResponse.json({ error: `${f} is required` }, { status: 400 });
  try {
    const settings = await getSettings();
    const quarter = p.target_quarter ?? settings.quarter.quarter;
    const swagLabel = p.swag ? { XS: "XS (1-2 hrs)", S: "S (3-10 hrs)", M: "M (11-25 hrs)", L: "L (26-40 hrs)", XL: "XL (41-60 hrs)", XXL: "XXL (61-90 hrs)", XXXL: "XXXL (91-150 hrs)" }[p.swag] : null;
    const hours = swagMidpoint(p.swag ?? null);
    const rec = { ...emptyRecord(), complexity: scoreComplexity(p), xfunc: scoreXfunc(p), sponsor: p.sponsor_email ?? null,
      skillHours: defaultSkillHours(p, hours), scoreSource: "intake" as const, intake: p };
    const description = [
      `Requester: ${p.requester} (${p.requesting_function})`, p.sponsor_email ? `Executive sponsor: ${p.sponsor_email}` : "",
      "", "Problem", p.problem, "", "Outcome", p.outcome, "",
      `People affected: ${p.people_affected ?? "?"}; hrs/week impact per person: ${p.hrs_per_week_impact ?? "?"}; risk: ${p.risk ?? "none"}`,
      p.deadline ? `Deadline: ${p.deadline} (${p.deadline_driver ?? ""})` : "",
      `Objects: ${(p.objects_touched ?? []).join(", ") || "-"}; systems: ${(p.systems_touched ?? []).join(", ") || "-"}; integrations: ${(p.integrations_touched ?? []).join(", ") || "-"}; teams: ${(p.teams_involved ?? []).join(", ") || "-"}`,
      `Scores from intake: complexity ${rec.complexity}/5, cross-functional ${rec.xfunc}/5. Skill hours: ${JSON.stringify(rec.skillHours)}`,
      "", "Created by the roadmap app intake endpoint.",
    ].join("\n");
    const key = await createEpic({ summary: p.summary, description, quarter, func: p.requesting_function, swag: swagLabel, labels: ["roadmap-intake"] });
    await setRoadmap(key, rec);
    await invalidateEpics();
    return NextResponse.json({ ok: true, key, roadmap: rec });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
