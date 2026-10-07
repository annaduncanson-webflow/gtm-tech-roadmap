import { NextRequest, NextResponse } from "next/server";
import { addComment, getDecision, getRoadmap, setDecision, setRoadmap, transitionToDone } from "@/lib/jira";
import { invalidateEpics } from "@/lib/service";
import { STEER_CO, emptyRecord } from "@/lib/model";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const { name } = (await req.json()) as { name: string };
  if (!STEER_CO.some((m) => m.name === name)) return NextResponse.json({ error: "Not a steer-co member" }, { status: 400 });
  try {
    const rec = await getDecision(key);
    if (!rec) return NextResponse.json({ error: "No decision record" }, { status: 404 });
    if (rec.approvals.some((a) => a.name === name)) return NextResponse.json({ ok: true, rec });
    rec.approvals.push({ name, at: new Date().toISOString() });
    await addComment(key, `Approved by ${name} via roadmap app, ${new Date().toISOString().slice(0, 10)}.`);
    if (rec.approvals.length >= STEER_CO.length && !rec.approved) {
      rec.approved = true;
      if (rec.kind === "commit") {
        for (const r of rec.snapshot.ranked.filter((x) => x.aboveCutline)) {
          const rm = { ...emptyRecord(), ...((await getRoadmap(r.key)) ?? {}) };
          if (rm.status === "Proposed" || rm.status === "Carryover") { rm.status = rm.status === "Carryover" ? "Carryover" : "Committed"; await setRoadmap(r.key, rm); }
        }
      } else if (rec.pivot) {
        const a = { ...emptyRecord(), ...((await getRoadmap(rec.pivot.addKey)) ?? {}) }; a.status = "Pivot-Added"; await setRoadmap(rec.pivot.addKey, a);
        const d = { ...emptyRecord(), ...((await getRoadmap(rec.pivot.displaceKey)) ?? {}) }; d.status = "Deprioritized"; await setRoadmap(rec.pivot.displaceKey, d);
        await addComment(rec.pivot.displaceKey, `Deprioritized by steer-co pivot ${key}: displaced by ${rec.pivot.addKey}. Sunk hours ${rec.pivot.displacedSunkHours}.`);
      }
      await transitionToDone(key);
      await invalidateEpics();
    }
    await setDecision(key, rec);
    return NextResponse.json({ ok: true, rec });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
