import { NextRequest, NextResponse } from "next/server";
import { addComment, getRoadmap, setRoadmap } from "@/lib/jira";
import { invalidateEpics } from "@/lib/service";
import { emptyRecord, type RoadmapRecord, type ScoreOverride } from "@/lib/model";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const body = (await req.json()) as { field: ScoreOverride["field"]; value: unknown; reason: string; by: string };
  if (!body.reason?.trim()) return NextResponse.json({ error: "reason is required" }, { status: 400 });
  try {
    const rec: RoadmapRecord = { ...emptyRecord(), ...((await getRoadmap(key)) ?? {}) };
    const from = rec[body.field];
    (rec as unknown as Record<string, unknown>)[body.field] = body.value;
    if (body.field === "complexity" || body.field === "xfunc") rec.scoreSource = "manual";
    rec.overrides.push({ field: body.field, from, to: body.value, reason: body.reason, by: body.by || "roadmap app", at: new Date().toISOString() });
    await setRoadmap(key, rec);
    await addComment(key, `Roadmap app: ${body.field} changed from ${JSON.stringify(from ?? null)} to ${JSON.stringify(body.value)} by ${body.by || "unknown"}. Reason: ${body.reason}`);
    await invalidateEpics();
    return NextResponse.json({ ok: true, roadmap: rec });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
