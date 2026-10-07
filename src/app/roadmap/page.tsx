import { roadmapView } from "@/lib/service";
import RoadmapTable from "@/components/RoadmapTable";
export const dynamic = "force-dynamic";

export default async function RoadmapPage() {
  try {
    const view = await roadmapView();
    return <RoadmapTable initial={view} />;
  } catch (e) {
    return <div className="rounded border border-red-200 bg-red-50 p-4 text-sm">Could not load Jira: {String(e)}. Check <a className="underline" href="sync">Sync</a>.</div>;
  }
}
