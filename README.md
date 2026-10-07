# GTM Tech Roadmap

Quarterly roadmap, capacity and steer-co decisions for GTM Tech. Jira is the only store; this app is a UI over BTEC.

## How state is stored

| Thing | Where in Jira |
|---|---|
| Roadmap order | Native Rank (Agile API). The BTEC board shows the same order. |
| Complexity, cross-functional score, sponsor, skill hours, roadmap status, carryover hours, intake answers, override log | Issue property `roadmap` on the Epic (JSON). Status is mirrored as label `rm-status-*`. |
| Quarter commit, mid-quarter pivot | BTEC Task labelled `roadmap-decision`, property `roadmap-decision`, linked to the epics. Approvals are comments; the task closes when all steer-co members approve. |
| Capacity settings, 60s epic cache | Webflow Cloud KV `ROADMAP_KV` (file `.data/kv.json` in local dev). |

Epics in scope: `Delivery Quarter` = active quarter, plus prior-quarter epics not Done (shown as Carryover with sunk hours).

## Intake contract (for the intake questionnaire skill)

`POST /api/intake` with the JSON shown on `/intake`. Required: `summary`, `requester`, `requesting_function` (a Jira picklist value such as `RevOps 🔴`), `problem`, `outcome`. Response: `{ ok, key, roadmap }`. The epic is created with Work Type = Roadmap Project, Intake = Jira Intake, Delivery Quarter = `target_quarter` or the active quarter, status Proposed, scores from the rubric on `/intake`.

## Run locally

```bash
cp .env.local.example .env.local   # fill ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN
npm install
npm run dev
```

## Deploy (Webflow Inside)

1. Webflow dashboard, workspace `webflow-inside`, New Project > App, import this GitHub repo, branch `main`.
2. Environment variables: `JIRA_BASE_URL`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN` (secret), `BTEC_BOARD_ID`.
3. Deploy. Okta SSO is applied by the workspace. `wrangler.jsonc` declares the KV binding.

## Known gaps (Builder Day, 2026-10-07)

- Jira writes use one API token, so approvals and comments appear as that user with the approver named in the text. Follow-up: Atlassian OAuth app or Runlayer connector via a Flowbot ticket to Enterprise AI Ops.
- Repo lives under a personal GitHub account because the webflowit org refused creation; transfer it.
- Scores are not Jira custom fields. If a Jira admin adds them, map them in `src/lib/model.ts` and write them alongside the property.
