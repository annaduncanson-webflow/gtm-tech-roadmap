import { NextRequest, NextResponse } from "next/server";
import { roadmapView } from "@/lib/service";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await roadmapView(req.nextUrl.searchParams.get("fresh") === "1"));
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}
