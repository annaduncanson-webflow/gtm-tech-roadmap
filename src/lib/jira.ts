// Server-only Jira client. Credentials come from env; never log them.
import {
  FIELDS, PROJECT_KEY, ROADMAP_PROPERTY, DECISION_PROPERTY, DECISION_LABEL,
  emptyRecord, swagMidpoint, type Epic, type RoadmapRecord, type DecisionRecord,
} from "./model";

const base = () => (process.env.JIRA_BASE_URL ?? "https://webflow.atlassian.net").replace(/\/$/, "");

function authHeader(): string {
  const email = process.env.ATLASSIAN_EMAIL, token = process.env.ATLASSIAN_API_TOKEN;
  if (!email || !token) throw new Error("ATLASSIAN_EMAIL / ATLASSIAN_API_TOKEN not set");
  return "Basic " + btoa(`${email}:${token}`);
}

export class JiraError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function jira<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(base() + path, {
    ...init,
    headers: { Authorization: authHeader(), Accept: "application/json", "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new JiraError(res.status, `Jira ${init.method ?? "GET"} ${path} -> ${res.status}: ${text.slice(0, 500)}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ---------- search ----------
interface JiraIssue {
  key: string;
  fields: Record<string, unknown> & {
    summary: string;
    status: { name: string; statusCategory: { name: string } };
    assignee: { displayName: string } | null;
    priority: { name: string } | null;
    labels: string[];
    parent?: { key: string };
  };
  properties?: Record<string, unknown>;
}

async function searchAll(jql: string, fields: string[], properties?: string[]): Promise<JiraIssue[]> {
  const out: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  do {
    const body: Record<string, unknown> = { jql, fields, maxResults: 100, nextPageToken };
    if (properties?.length) body.properties = properties;
    const page = await jira<{ issues: JiraIssue[]; nextPageToken?: string; isLast?: boolean }>(
      "/rest/api/3/search/jql", { method: "POST", body: JSON.stringify(body) });
    out.push(...(page.issues ?? []));
    nextPageToken = page.isLast ? undefined : page.nextPageToken;
  } while (nextPageToken);
  return out;
}

const sel = (v: unknown): string | null =>
  v && typeof v === "object" && "value" in (v as object) ? String((v as { value: unknown }).value) : null;

export function epicJql(quarter: string, prior: string): string {
  return `project = ${PROJECT_KEY} AND issuetype = Epic AND (` +
    `"Delivery Quarter" = "${quarter}" OR ("Delivery Quarter" = "${prior}" AND statusCategory != Done)` +
    `) ORDER BY Rank ASC`;
}

export async function fetchEpics(quarter: string, prior: string): Promise<Epic[]> {
  const fields = ["summary", "status", "assignee", "priority", "labels", FIELDS.swag, FIELDS.swagMid,
    FIELDS.quarter, FIELDS.func, FIELDS.developer, FIELDS.rank];
  const issues = await searchAll(epicJql(quarter, prior), fields, [ROADMAP_PROPERTY]);
  if (issues.length === 0) return [];

  // Child progress: resolved story points / total, fallback to issue counts.
  const keys = issues.map((i) => i.key);
  const children = await searchAll(`parent in (${keys.join(",")})`, ["status", "parent", FIELDS.storyPoints]);
  const progress = new Map<string, { done: number; total: number; dc: number; tc: number }>();
  for (const c of children) {
    const pk = c.fields.parent?.key; if (!pk) continue;
    const p = progress.get(pk) ?? { done: 0, total: 0, dc: 0, tc: 0 };
    const sp = Number(c.fields[FIELDS.storyPoints] ?? 0) || 0;
    const isDone = c.fields.status.statusCategory.name === "Done";
    p.total += sp; p.tc += 1; if (isDone) { p.done += sp; p.dc += 1; }
    progress.set(pk, p);
  }

  return issues.map((i) => {
    const f = i.fields;
    const rec = (i.properties?.[ROADMAP_PROPERTY] as RoadmapRecord | undefined) ?? emptyRecord();
    const swag = sel(f[FIELDS.swag]);
    const swagMid = swagMidpoint(swag, f[FIELDS.swagMid] as number | null);
    const pr = progress.get(i.key);
    const statusDone = f.status.statusCategory.name === "Done";
    const pct = statusDone ? 1 : pr ? (pr.total > 0 ? pr.done / pr.total : pr.tc > 0 ? pr.dc / pr.tc : 0) : 0;
    const q = sel(f[FIELDS.quarter]);
    const carryover = q === prior && !statusDone;
    const remaining = Math.round(swagMid * (1 - pct) * 10) / 10;
    if (carryover && rec.status === "Proposed") rec.status = "Carryover";
    if (carryover) rec.carryoverHours = Math.round(swagMid * pct * 10) / 10;
    return {
      key: i.key, summary: f.summary, status: f.status.name, statusCategory: f.status.statusCategory.name,
      assignee: f.assignee?.displayName ?? null,
      developer: (f[FIELDS.developer] as { displayName?: string } | null)?.displayName ?? null,
      priority: f.priority?.name ?? "Unprioritized", quarter: q, func: sel(f[FIELDS.func]),
      swag, swagMid, pctComplete: Math.round(pct * 100) / 100, remainingHours: remaining,
      rank: String(f[FIELDS.rank] ?? ""), labels: f.labels ?? [], roadmap: { ...emptyRecord(), ...rec },
      carryover, url: `${base()}/browse/${i.key}`,
    };
  });
}

// ---------- properties ----------
export async function getProperty<T>(key: string, prop: string): Promise<T | null> {
  try { return (await jira<{ value: T }>(`/rest/api/3/issue/${key}/properties/${prop}`)).value; }
  catch (e) { if (e instanceof JiraError && e.status === 404) return null; throw e; }
}
export async function setProperty(key: string, prop: string, value: unknown): Promise<void> {
  await jira(`/rest/api/3/issue/${key}/properties/${prop}`, { method: "PUT", body: JSON.stringify(value) });
}
export const getRoadmap = (key: string) => getProperty<RoadmapRecord>(key, ROADMAP_PROPERTY);
export async function setRoadmap(key: string, rec: RoadmapRecord): Promise<void> {
  rec.updatedAt = new Date().toISOString();
  await setProperty(key, ROADMAP_PROPERTY, rec);
  // Mirror status as a label so boards and JQL can filter without the app.
  const issue = await jira<{ fields: { labels: string[] } }>(`/rest/api/3/issue/${key}?fields=labels`);
  const labels = issue.fields.labels.filter((l) => !l.startsWith("rm-status-"));
  labels.push("rm-status-" + rec.status.toLowerCase().replace(/[^a-z]+/g, "-"));
  await jira(`/rest/api/3/issue/${key}`, { method: "PUT", body: JSON.stringify({ fields: { labels } }) });
}

// ---------- comments ----------
export async function addComment(key: string, text: string): Promise<void> {
  const body = { body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text }] }] } };
  await jira(`/rest/api/3/issue/${key}/comment`, { method: "POST", body: JSON.stringify(body) });
}

// ---------- rank (Agile API, 50 issues per call) ----------
export async function rankIssues(orderedKeys: string[]): Promise<void> {
  for (let i = 1; i < orderedKeys.length; i += 50) {
    const chunk = orderedKeys.slice(i, i + 50);
    await jira("/rest/agile/1.0/issue/rank", {
      method: "PUT", body: JSON.stringify({ issues: chunk, rankAfterIssue: orderedKeys[i - 1] }),
    });
  }
}

// ---------- create ----------
const adf = (text: string) => ({ type: "doc", version: 1, content: text.split("\n").map((line) => ({ type: "paragraph", content: line ? [{ type: "text", text: line }] : [] })) });

export async function createEpic(input: { summary: string; description: string; quarter: string; func?: string | null; swag?: string | null; labels?: string[] }): Promise<string> {
  const fields: Record<string, unknown> = {
    project: { key: PROJECT_KEY }, issuetype: { name: "Epic" }, summary: input.summary, description: adf(input.description),
    labels: input.labels ?? [],
    [FIELDS.quarter]: { value: input.quarter },
    [FIELDS.workType]: { value: "Roadmap Project" },
    [FIELDS.intake]: { value: "Jira Intake" },
  };
  if (input.func) fields[FIELDS.func] = { value: input.func };
  if (input.swag) fields[FIELDS.swag] = { value: input.swag };
  const res = await jira<{ key: string }>("/rest/api/3/issue", { method: "POST", body: JSON.stringify({ fields }) });
  return res.key;
}

export async function createDecisionTask(summary: string, description: string, record: DecisionRecord, relatedKeys: string[]): Promise<string> {
  const fields = { project: { key: PROJECT_KEY }, issuetype: { name: "Task" }, summary, description: adf(description), labels: [DECISION_LABEL] };
  const res = await jira<{ key: string }>("/rest/api/3/issue", { method: "POST", body: JSON.stringify({ fields }) });
  await setProperty(res.key, DECISION_PROPERTY, record);
  for (const k of relatedKeys) {
    await jira("/rest/api/3/issueLink", { method: "POST", body: JSON.stringify({ type: { name: "Relates" }, inwardIssue: { key: res.key }, outwardIssue: { key: k } }) }).catch(() => undefined);
  }
  return res.key;
}

export interface Decision { key: string; summary: string; status: string; created: string; record: DecisionRecord; url: string }

export async function fetchDecisions(): Promise<Decision[]> {
  const issues = await searchAll(`project = ${PROJECT_KEY} AND labels = ${DECISION_LABEL} ORDER BY created DESC`, ["summary", "status", "created"], [DECISION_PROPERTY]);
  return issues.filter((i) => i.properties?.[DECISION_PROPERTY]).map((i) => ({
    key: i.key, summary: i.fields.summary, status: i.fields.status.name, created: String(i.fields.created),
    record: i.properties![DECISION_PROPERTY] as DecisionRecord, url: `${base()}/browse/${i.key}`,
  }));
}
export const getDecision = (key: string) => getProperty<DecisionRecord>(key, DECISION_PROPERTY);
export const setDecision = (key: string, rec: DecisionRecord) => setProperty(key, DECISION_PROPERTY, rec);

export async function transitionToDone(key: string): Promise<void> {
  const t = await jira<{ transitions: { id: string; to: { statusCategory: { key: string } } }[] }>(`/rest/api/3/issue/${key}/transitions`);
  const done = t.transitions.find((x) => x.to.statusCategory.key === "done");
  if (done) await jira(`/rest/api/3/issue/${key}/transitions`, { method: "POST", body: JSON.stringify({ transition: { id: done.id } }) });
}

export async function myself(): Promise<{ displayName: string; emailAddress?: string }> {
  return jira("/rest/api/3/myself");
}
