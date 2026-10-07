import { roadmapView } from "@/lib/service";
import RoadmapTable from "@/components/RoadmapTable";
export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  let view: Awaited<ReturnType<typeof roadmapView>> | null = null;
  let error: string | null = null;
  try { view = await roadmapView(); } catch (e) { error = String(e); }
  if (!view) return <div className="rounded border border-red-200 bg-red-50 p-4 text-sm">Could not load Jira: {error}. Check <a className="underline" href="sync">Sync</a>.</div>;
  return <RoadmapTable initial={view} />;
}
