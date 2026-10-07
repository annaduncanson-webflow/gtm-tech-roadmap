// Domain model, Jira field map, scoring rubric. Jira is the only store for
// roadmap state: epic-level attributes live in the Jira issue property
// "roadmap"; decisions are BTEC Tasks labelled roadmap-decision with the
// issue property "roadmap-decision".

export const PROJECT_KEY = "BTEC";
export const DECISION_LABEL = "roadmap-decision";
export const ROADMAP_PROPERTY = "roadmap";
export const DECISION_PROPERTY = "roadmap-decision";

export const FIELDS = {
  swag: "customfield_15073",
  swagMid: "customfield_15074",
  quarter: "customfield_12698",
  func: "customfield_14902",
  workType: "customfield_14940",
  changeType: "customfield_10005",
  developer: "customfield_13193",
  rank: "customfield_10019",
  intake: "customfield_14556",
  storyPoints: "customfield_10026",
  stakeholders: "customfield_11698",
} as const;

export const SKILLS = ["Flow", "Apex", "LWC", "CPQ", "Integrations", "Data"] as const;
export type Skill = (typeof SKILLS)[number];
export const SKILL_LABELS: Record<Skill, string> = {
  Flow: "Flow",
  Apex: "Apex",
  LWC: "LWC",
  CPQ: "CPQ",
  Integrations: "Integrations + MCP/AI",
  Data: "Data + Reporting",
};

export const SWAG_MIDPOINT: Record<string, number> = {
  XS: 1, S: 6.5, M: 18, L: 33, XL: 50.5, XXL: 75.5, XXXL: 120.5,
};
export function swagMidpoint(label: string | null | undefined, fieldValue?: number | null): number {
  if (typeof fieldValue === "number" && fieldValue > 0) return fieldValue;
  if (!label) return 0;
  const size = label.split(" ")[0].toUpperCase();
  return SWAG_MIDPOINT[size] ?? 0;
}

export type RoadmapStatus =
  | "Proposed" | "Committed" | "Carryover" | "Pivot-Added" | "Deprioritized" | "Done";

export interface ScoreOverride {
  field: "complexity" | "xfunc" | "skillHours" | "sponsor" | "status";
  from: unknown;
  to: unknown;
  reason: string;
  by: string;
  at: string;
}

/** Stored as Jira issue property "roadmap" on the Epic. */
export interface RoadmapRecord {
  complexity: number | null;      // 1-5
  xfunc: number | null;           // 1-5
  sponsor: string | null;         // display name or email of the exec sponsor
  skillHours: Partial<Record<Skill, number>>;
  status: RoadmapStatus;
  carryoverHours: number;         // sunk hours when carried over
  scoreSource: "intake" | "manual" | null;
  intake?: IntakePayload;
  overrides: ScoreOverride[];
  updatedAt: string;
}

export const emptyRecord = (): RoadmapRecord => ({
  complexity: null, xfunc: null, sponsor: null, skillHours: {},
  status: "Proposed", carryoverHours: 0, scoreSource: null, overrides: [],
  updatedAt: new Date().toISOString(),
});

export interface Epic {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  assignee: string | null;
  developer: string | null;
  priority: string;
  quarter: string | null;
  func: string | null;
  swag: string | null;
  swagMid: number;
  pctComplete: number;            // 0..1
  remainingHours: number;
  rank: string;                   // Jira lexo rank
  labels: string[];
  roadmap: RoadmapRecord;
  carryover: boolean;
  url: string;
}

/** Contract for Maggie's intake questionnaire skill (POST /api/intake). */
export interface IntakePayload {
  summary: string;
  requester: string;
  requesting_function: string;
  sponsor_email?: string;
  problem: string;
  outcome: string;
  people_affected?: number;
  hrs_per_week_impact?: number;
  risk?: "none" | "compliance" | "revenue" | "contract";
  deadline?: string;
  deadline_driver?: string;
  objects_touched?: string[];
  systems_touched?: string[];
  integrations_touched?: string[];
  teams_involved?: string[];
  data_level?: 0 | 1 | 2 | 3;
  needs_cpq?: boolean;
  needs_apex_or_lwc?: boolean;
  needs_flow?: boolean;
  swag?: "XS" | "S" | "M" | "L" | "XL" | "XXL" | "XXXL";
  target_quarter?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function scoreComplexity(p: IntakePayload): number {
  let s = 1;
  s += Math.floor((p.objects_touched?.length ?? 0) / 3);
  if (p.needs_cpq) s += 1;
  if (p.needs_apex_or_lwc) s += 1;
  s += p.integrations_touched?.length ?? 0;
  if ((p.data_level ?? 0) >= 2) s += 1;
  return clamp(s, 1, 5);
}

export function scoreXfunc(p: IntakePayload): number {
  const teams = (p.teams_involved ?? []).filter(
    (t) => t.toLowerCase() !== (p.requesting_function ?? "").toLowerCase().replace(/\s*[^\w\s].*$/, "").trim().toLowerCase(),
  );
  const external = (p.systems_touched ?? []).filter((s) => s.toLowerCase() !== "salesforce");
  let s = 1 + teams.length + external.length;
  const needsReview = teams.some((t) => /data|security/i.test(t)) || (p.data_level ?? 0) >= 2;
  if (needsReview) s += 1;
  return clamp(s, 1, 5);
}

/** Split SWAG midpoint hours across flagged skills. */
export function defaultSkillHours(p: IntakePayload, totalHours: number): Partial<Record<Skill, number>> {
  const weights: Partial<Record<Skill, number>> = {};
  if (p.needs_cpq) weights.CPQ = 0.4;
  if (p.needs_apex_or_lwc) { weights.Apex = 0.2; weights.LWC = 0.1; }
  if (p.needs_flow || Object.keys(weights).length === 0) weights.Flow = 0.2;
  if ((p.integrations_touched?.length ?? 0) > 0) weights.Integrations = 0.2;
  if ((p.data_level ?? 0) >= 1 || (p.teams_involved ?? []).some((t) => /data/i.test(t))) weights.Data = 0.1;
  const sum = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0) || 1;
  const out: Partial<Record<Skill, number>> = {};
  for (const [k, w] of Object.entries(weights)) out[k as Skill] = Math.round((totalHours * (w ?? 0)) / sum * 10) / 10;
  return out;
}

export function weeklyImpact(p: IntakePayload | undefined): number {
  if (!p) return 0;
  return (p.people_affected ?? 0) * (p.hrs_per_week_impact ?? 0);
}

export const STEER_CO = [
  { name: "Laura Clontz", email: "laura.clontz@webflow.com" },
  { name: "Tara Murray", email: "tara.murray@webflow.com" },
  { name: "Kelcie Stokes", email: "kelcie.stokes@webflow.com" },
  { name: "Taylor Magargal", email: "taylor.magargal@webflow.com" },
];

export interface DecisionRecord {
  kind: "commit" | "pivot";
  quarter: string;
  createdBy: string;
  createdAt: string;
  approvals: { name: string; at: string }[];
  approved: boolean;
  snapshot: {
    ranked: { key: string; summary: string; remainingHours: number; aboveCutline: boolean }[];
    teamNetHours: number;
    demandHours: number;
  };
  pivot?: {
    addKey: string;
    displaceKey: string;
    displacedSunkHours: number;
    addedHours: number;
    intakeComplete: boolean;
    reason: string;
  };
}
