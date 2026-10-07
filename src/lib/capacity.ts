import { SKILLS, type Skill, type Epic } from "./model";

export interface Person {
  name: string;
  ftePct: number;        // 0-100
  baseHrsPerWeek: number;
  ptoDays: number;
  holidayDays: number;
  sprintsAsSM: number;
  adHocPct: number;      // 0-100
  reviewPct: number;     // 0-100
  assignable: boolean;
  skills: Record<Skill, number>; // proficiency 0-3
}

export interface QuarterConfig {
  quarter: string;        // Jira Delivery Quarter value
  priorQuarter: string;
  start: string;          // ISO date
  end: string;
  smOverheadPerSprint: number;
}

export interface CapacitySettings {
  quarter: QuarterConfig;
  people: Person[];
}

const sk = (f: number, a: number, l: number, c: number, i: number, d: number): Record<Skill, number> =>
  ({ Flow: f, Apex: a, LWC: l, CPQ: c, Integrations: i, Data: d });

/** Seeded from the Q4 FY27 Planner tab of the Quarterly Capacity Planner sheet. */
export const DEFAULT_SETTINGS: CapacitySettings = {
  quarter: { quarter: "Q4 FY27", priorQuarter: "Q3 FY27", start: "2026-11-01", end: "2027-01-31", smOverheadPerSprint: 4 },
  people: [
    { name: "Aayushi Pankaj", ftePct: 100, baseHrsPerWeek: 30, ptoDays: 5, holidayDays: 5, sprintsAsSM: 2, adHocPct: 40, reviewPct: 0, assignable: true, skills: sk(2, 1, 1, 1, 2, 2) },
    { name: "Anna Duncanson", ftePct: 70, baseHrsPerWeek: 30, ptoDays: 5, holidayDays: 5, sprintsAsSM: 2, adHocPct: 40, reviewPct: 10, assignable: true, skills: sk(3, 3, 2, 2, 3, 3) },
    { name: "Maggie Stewart", ftePct: 100, baseHrsPerWeek: 30, ptoDays: 5, holidayDays: 5, sprintsAsSM: 2, adHocPct: 40, reviewPct: 0, assignable: true, skills: sk(2, 0, 0, 1, 2, 2) },
    { name: "Sneha Cheela", ftePct: 100, baseHrsPerWeek: 30, ptoDays: 5, holidayDays: 5, sprintsAsSM: 2, adHocPct: 40, reviewPct: 5, assignable: true, skills: sk(3, 3, 3, 3, 2, 2) },
    { name: "New Dev (TBH)", ftePct: 50, baseHrsPerWeek: 30, ptoDays: 5, holidayDays: 5, sprintsAsSM: 2, adHocPct: 40, reviewPct: 5, assignable: true, skills: sk(2, 2, 2, 1, 1, 1) },
    { name: "Laura Clontz", ftePct: 0, baseHrsPerWeek: 30, ptoDays: 0, holidayDays: 0, sprintsAsSM: 0, adHocPct: 0, reviewPct: 0, assignable: true, skills: sk(2, 0, 0, 1, 1, 2) },
  ],
};

export function weeksRemaining(q: QuarterConfig, today = new Date()): { remaining: number; total: number } {
  const start = new Date(q.start), end = new Date(q.end);
  const total = Math.max(1, Math.round((end.getTime() - start.getTime()) / 604800000));
  const from = today < start ? start : today;
  const remaining = Math.max(0, Math.round((end.getTime() - from.getTime()) / 604800000));
  return { remaining, total };
}

export interface PersonCapacity extends Person {
  weeklyHrs: number; ptoHrs: number; smHrs: number; adHocHrs: number; reviewHrs: number; netHrs: number;
}

/** Same formula as the Q4 Planner sheet: base × FTE × weeks − PTO − SM − ad hoc − review. */
export function personCapacity(p: Person, q: QuarterConfig, today = new Date()): PersonCapacity {
  const { remaining } = weeksRemaining(q, today);
  const weeklyHrs = p.baseHrsPerWeek * (p.ftePct / 100);
  const gross = weeklyHrs * remaining;
  const ptoHrs = (p.ptoDays + p.holidayDays) * 8 * (p.ftePct > 0 ? 1 : 0);
  const smHrs = p.sprintsAsSM * q.smOverheadPerSprint;
  const afterPto = Math.max(0, gross - ptoHrs - smHrs);
  const adHocHrs = afterPto * (p.adHocPct / 100);
  const reviewHrs = afterPto * (p.reviewPct / 100);
  const netHrs = Math.max(0, Math.round((afterPto - adHocHrs - reviewHrs) * 10) / 10);
  return { ...p, weeklyHrs, ptoHrs, smHrs, adHocHrs: r1(adHocHrs), reviewHrs: r1(reviewHrs), netHrs };
}
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface SkillBalance { skill: Skill; supply: number; demand: number; builders: string[]; ok: boolean }

export function skillBalance(people: PersonCapacity[], epicsAbove: Epic[]): SkillBalance[] {
  return SKILLS.map((skill) => {
    const builders = people.filter((p) => p.skills[skill] >= 2 && p.netHrs > 0);
    const supply = r1(builders.reduce((a, p) => a + p.netHrs, 0));
    const demand = r1(epicsAbove.reduce((a, e) => {
      const sh = e.roadmap.skillHours[skill] ?? 0;
      const share = e.swagMid > 0 ? sh / e.swagMid : 0;
      return a + share * e.remainingHours;
    }, 0));
    return { skill, supply, demand, builders: builders.map((b) => b.name), ok: demand <= supply };
  });
}

/** Cutline: cumulative remaining hours in rank order against team net hours. */
export function applyCutline(epics: Epic[], teamNetHrs: number): { key: string; aboveCutline: boolean; cumulative: number }[] {
  let cum = 0;
  return epics.map((e) => {
    const counts = e.roadmap.status !== "Deprioritized" && e.roadmap.status !== "Done" && e.statusCategory !== "Done";
    if (counts) cum += e.remainingHours;
    return { key: e.key, aboveCutline: counts && cum <= teamNetHrs, cumulative: r1(cum) };
  });
}
