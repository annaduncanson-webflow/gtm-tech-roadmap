import { NextResponse } from "next/server";
import { myself } from "@/lib/jira";
import { getEpics, getSettings } from "@/lib/service";
export const dynamic = "force-dynamic";
export async function GET() {
  const out: Record<string, unknown> = { jiraBase: process.env.JIRA_BASE_URL ?? "https://webflow.atlassian.net", tokenSet: Boolean(process.env.ATLASSIAN_API_TOKEN) };
  try { const me = await myself(); out.actingAs = me.displayName; } catch (e) { out.authError = String(e); }
  try { const s = await getSettings(); out.quarter = s.quarter; const { epics, syncedAt, fromCache } = await getEpics(); out.epicCount = epics.length; out.syncedAt = syncedAt; out.fromCache = fromCache; }
  catch (e) { out.syncError = String(e); }
  return NextResponse.json(out);
}
