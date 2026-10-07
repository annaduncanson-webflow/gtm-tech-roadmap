import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings, invalidateEpics } from "@/lib/service";
import type { CapacitySettings } from "@/lib/capacity";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(await getSettings()); }
export async function PUT(req: NextRequest) {
  const s = (await req.json()) as CapacitySettings;
  if (!s?.quarter?.quarter || !Array.isArray(s.people)) return NextResponse.json({ error: "invalid settings" }, { status: 400 });
  await saveSettings(s); await invalidateEpics();
  return NextResponse.json({ ok: true });
}
