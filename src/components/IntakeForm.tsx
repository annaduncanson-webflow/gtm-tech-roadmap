"use client";
import { useState } from "react";
import { call } from "@/lib/client";
export default function IntakeForm({ sample }: { sample: string }) {
  const [text, setText] = useState(sample.replace('"Data Residency SKU"', '"TEST: roadmap app intake"'));
  const [msg, setMsg] = useState<string | null>(null);
  async function submit() {
    setMsg(null);
    try { const r = await call<{ key: string; roadmap: { complexity: number; xfunc: number } }>("/api/intake", { method: "POST", body: text }); setMsg(`Created ${r.key}: complexity ${r.roadmap.complexity}, cross-functional ${r.roadmap.xfunc}.`); }
    catch (e) { setMsg(String(e)); }
  }
  return (
    <div className="space-y-2 text-sm">
      <h2 className="font-medium">Manual submit (creates a real BTEC Epic)</h2>
      <textarea className="h-64 w-full rounded border p-2 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={submit} className="rounded bg-neutral-900 px-3 py-1 text-white">Create epic</button>
      {msg && <div className="rounded border bg-white p-2">{msg}</div>}
    </div>
  );
}
