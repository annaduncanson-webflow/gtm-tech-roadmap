import { NextRequest, NextResponse } from "next/server";
import { rankIssues } from "@/lib/jira";
import { invalidateEpics } from "@/lib/service";
export const dynamic = "force-dynamic";
export async function PUT(req: NextRequest) {
  const { keys } = (await req.json()) as { keys: string[] };
  if (!Array.isArray(keys) || keys.length < 2) return NextResponse.json({ error: "keys[] required" }, { status: 400 });
  try { await rankIssues(keys); await invalidateEpics(); return NextResponse.json({ ok: true, ranked: keys.length }); }
  catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
