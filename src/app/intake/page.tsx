import IntakeForm from "@/components/IntakeForm";
export default function IntakePage() {
  const sample = {
    summary: "Data Residency SKU", requester: "Tara Murray", requesting_function: "RevOps 🔴", sponsor_email: "tara.murray@webflow.com",
    problem: "EU customers need a data residency SKU quoted and tracked in Salesforce.", outcome: "Reps can quote the SKU; Finance sees it on the order.",
    people_affected: 40, hrs_per_week_impact: 0.5, risk: "revenue", deadline: "2026-12-15", deadline_driver: "EU launch",
    objects_touched: ["Quote", "QuoteLine", "Product2"], systems_touched: ["Salesforce", "Ironclad"], integrations_touched: [], teams_involved: ["RevOps", "Pricing & Packaging"],
    data_level: 1, needs_cpq: true, needs_apex_or_lwc: false, needs_flow: true, swag: "M", target_quarter: "Q4 FY27",
  };
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Intake</h1>
      <p className="text-sm text-neutral-600">Maggie&apos;s intake questionnaire skill posts this JSON to <code>POST {process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/intake</code>. The app creates the BTEC Epic, scores complexity and cross-functionality, splits SWAG hours by skill and sets roadmap status Proposed. Requesting function must be one of the Jira picklist values (e.g. &quot;RevOps 🔴&quot;, &quot;MarketingOps 🟠&quot;, &quot;EntTech ⚫&quot;, &quot;LegalOps 🟡&quot;, &quot;Pricing &amp; Packaging 🟤&quot;).</p>
      <pre className="overflow-auto rounded border bg-white p-3 text-xs">{JSON.stringify(sample, null, 2)}</pre>
      <div className="rounded border bg-white p-4 text-sm">
        <h2 className="mb-1 font-medium">Scoring rubric</h2>
        <ul className="list-disc pl-5 text-xs text-neutral-700">
          <li>Complexity 1-5: +1 per 3 objects, +1 CPQ, +1 Apex/LWC, +1 per integration, +1 data level ≥ 2.</li>
          <li>Cross-functional 1-5: 1 + teams beyond the requester + systems beyond Salesforce, +1 if Data or Security review is needed.</li>
          <li>Skill hours: SWAG midpoint split CPQ 40%, Apex 20%, LWC 10%, Flow 20%, Integrations 20%, Data 10% across flagged skills, normalised.</li>
        </ul>
      </div>
      <IntakeForm sample={JSON.stringify(sample, null, 2)} />
    </div>
  );
}
