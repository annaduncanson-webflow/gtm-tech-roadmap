import { fetchDecisions, type Decision } from "@/lib/jira";
import { getEpics } from "@/lib/service";
import Decisions from "@/components/Decisions";
export const dynamic = "force-dynamic";
export default async function DecisionsPage() {
  let decisions: Decision[] = [];
  let epics: { key: string; summary: string; status: string; hasIntake: boolean }[] = [];
  let error: string | null = null;
  try {
    const [d, r] = await Promise.all([fetchDecisions(), getEpics()]);
    decisions = d;
    epics = r.epics.map((e) => ({ key: e.key, summary: e.summary, status: e.roadmap.status, hasIntake: Boolean(e.roadmap.intake) || e.roadmap.scoreSource === "manual" }));
  } catch (e) { error = String(e); }
  if (error) return <div className="text-sm text-red-700">{error}</div>;
  return <Decisions decisions={decisions} epics={epics} />;
}
