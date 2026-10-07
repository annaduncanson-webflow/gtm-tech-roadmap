import { fetchDecisions } from "@/lib/jira";
import { getEpics } from "@/lib/service";
import Decisions from "@/components/Decisions";
export const dynamic = "force-dynamic";
export default async function DecisionsPage() {
  try {
    const [decisions, { epics }] = await Promise.all([fetchDecisions(), getEpics()]);
    return <Decisions decisions={decisions} epics={epics.map((e) => ({ key: e.key, summary: e.summary, status: e.roadmap.status, hasIntake: Boolean(e.roadmap.intake) || e.roadmap.scoreSource === "manual" }))} />;
  } catch (e) { return <div className="text-sm text-red-700">{String(e)}</div>; }
}
