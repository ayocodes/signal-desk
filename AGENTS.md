# Signal Desk

Rules and context for any AI agent working in this repo (Claude Code, Antigravity, others). Read this file first, every session.

## What this is

A working slice of a precision-outbound platform, built as a portfolio project for a Founding Engineer application at Cardinal (YC W26).

A background agent finds companies that match an ICP, detects public buying signals, scores each lead with an explainable formula, drafts grounded outreach with an LLM, and runs multi-step email sequences with deliverability guardrails. A human approves every first send.

**ICP (who we find leads for):** Cardinal's customers. Seed to Series A B2B software startups, roughly 5 to 60 people, founder-led or early sales team, likely to start or scale outbound.

The name "Signal Desk" is a working title. Keep it in one constant (`lib/brand.ts`) so it can be renamed in one place.

## Hard rules

1. **No LinkedIn.** No LinkedIn data, APIs, scraping, or LinkedIn as a sequence channel. Sequences are email only.
2. **$0 budget.** Only free tiers and keyless public APIs. If something needs a paid plan or a payment card, stop and tell the user. Use a clearly labeled placeholder instead.
3. **Never email real people.** All outbound goes to Resend test addresses (`delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev`, with `+label` suffixes). Real contact names may be shown; real addresses are never sent to.
4. **Polite collection.** Check robots.txt before fetching any HTML page. Send a descriptive User-Agent (`AGENT_USER_AGENT`). Max 1 request per second per host. Timeouts on every request. Never fetch anything behind a login.
5. **Secrets.** Only in `.env.local` (web) and GitHub Actions secrets (agent). Never commit, print, log, or hardcode them. `.env*` except `.env.example` stays in `.gitignore`.
6. **Generated email copy:** no em-dashes or en-dashes, no phrases from `shared/guardrails.json`, must pass grounding checks before it can be approved.
7. **Honest data.** Anything simulated (for example a reply that a test inbox cannot send) is created by an explicit admin action, stored with `source = 'simulated'`, and labeled "Simulated" in the UI.
8. **No Cardinal branding.** Do not use Cardinal's name as the product name or use their logo. The ICP is theirs; the product is ours.
9. **Don't copy brands.** The design takes cues from Linear, Vercel, Attio and Raycast. Never copy their logos, names, icons or exact screens.

## Stack

- **Web:** Next.js (App Router), TypeScript (strict), React, Tailwind CSS. Deployed on Vercel (Hobby).
- **Data and auth:** Supabase: Postgres, Auth (email + password), Row Level Security. Use `@supabase/ssr` in Next.js.
- **Agent worker:** Python 3.12 in `/agent`, run by GitHub Actions on a schedule. Libraries: `httpx`, `pydantic`, `pydantic-settings` (env validation), `supabase` (Python client), `google-genai`. Add others only with a reason.
- **LLM:** Gemini API free tier. Model name comes from `GEMINI_MODEL`, never hardcoded. All LLM calls go through one provider interface (`agent/llm.py`, `lib/llm.ts`) so a free fallback (Groq) can be swapped in with `LLM_PROVIDER`.
- **Email:** Resend free tier. Webhooks verified by signature.
- **UI:** `cmdk` (command palette), `lucide-react` (icons), Geist Sans + Geist Mono via the `geist` package. Small hand-built components on Tailwind + CSS variables. No heavy component kits.
- **Validation:** `zod` on every API route input. `pydantic` models in the agent.
- **Tests:** `vitest` (web), `pytest` (agent). Test scoring, guardrails, sequence branching and webhook handling.

## Repo layout

```
proxy.ts                session refresh, login redirects, 403 on admin paths (Next 16's middleware)
app/                    Next.js routes (App Router)
  (auth)/login/
  (app)/queue/          split list + detail workspace
  (app)/leads/          dense table of all leads
  (app)/sequences/
  (app)/ops/            admin only
  (app)/settings/       theme, profile; ICP + scoring are admin only
  api/                  route handlers (drafts, approve, webhooks, agent dispatch)
components/
lib/                    supabase clients, auth helpers, llm.ts, guardrails.ts, brand.ts
agent/                  Python worker
  main.py               one agent "tick"
  sources/              yc.py, ats.py (greenhouse, lever, ashby), hn.py
  scoring.py  drafting.py  guardrails.py  sequences.py  deliverability.py  llm.py  db.py
  tests/
shared/                 single source of truth, read by BOTH Python and TypeScript
  defaults/rules.json   each org's editable rules, version 1 (orgs save newer versions in agent_configs)
  prompts/              draft.md, raw.md, draft_schema.json
  guardrails.json       locked checks (built-in banned phrases, dashes, claims)
  outreach.json         locked outreach parts (sender company, angles, LLM pacing)
  sequence.json
  fixtures/             cases both languages must agree on (guardrails, prompts, rules)
supabase/
  migrations/
  seed.sql
.github/workflows/agent.yml
docs/                   PLAN, TASKS, PROGRESS, ARCHITECTURE, DESIGN, SETUP, reference-mockup.html
```

## Conventions

- **Shared logic lives once.** Prompt template, guardrail rules, score weights and keyword lists are files in `/shared`. Python and TypeScript both read them. Never duplicate these values in code.
- **Everything is logged.** Every agent action and user action writes an `audit_log` row. Every agent run writes an `agent_runs` row with counts, durations and errors.
- **Idempotency.** Every send has an idempotency key with a unique constraint. Every signal has a fingerprint with a unique constraint. Re-running the agent must never duplicate rows or sends.
- **Migrations only.** Schema changes go in `supabase/migrations/`. Never change the schema by hand in the dashboard.
- **Security in two layers.** RLS on every table, plus server-side role checks on admin routes.
- **Multi-tenant from day one.** Every business table has `org_id`; every RLS policy filters by the user's org.
- **Env is validated at startup.** Web code reads variables only through `lib/env.ts` (zod) and the agent only through `agent/settings.py` (pydantic-settings). Never read `process.env` or `os.environ` directly. Empty strings count as missing.
- Small, typed functions. Explicit error handling. No silent `catch {}`.
- Use the design tokens from `docs/DESIGN.md`. Never write a raw hex color in a component.

## Commands

```
npm run dev          # web app
npm run check        # lint + typecheck + tests (run before calling any task done)
supabase db push     # apply migrations to the linked project
python3 -m venv .venv && .venv/bin/pip install -r agent/requirements-dev.txt   # once
.venv/bin/python -m agent.main --once           # run one agent tick locally
.venv/bin/python -m agent.main --dry-run        # same, but writes nothing
.venv/bin/python -m pytest agent/tests
```

## Who builds what

Two agents share this repo, never at the same time. `docs/TASKS.md` is the owner-tagged checklist for every phase.

- **Claude Code** (`C` cards) builds the risky parts: schema, RLS, auth, the agent core, scoring, guardrails, sends, webhooks, deliverability, API routes and data functions. It also defines the typed contracts the UI builds on, and reviews all Flash work. It commits to `main`.
- **Gemini Flash in Antigravity** (`F` cards) builds UI components, pages, themes, empty states, keyboard UX, extra tests and docs. It does one card per branch (`flash/p<N>-<slug>`), runs the card's git commands exactly, touches only the files the card lists, and never edits `docs/TASKS.md`. It doesn't commit while checks fail. Review notes arrive in `docs/reviews/<card-id>.md` on its branch.
- **The user** (`U` cards) handles accounts, keys, dashboards and deploy settings.

## Working agreement

- At the start of a session, read `docs/PROGRESS.md`, then the current phase in `docs/PLAN.md` and `docs/TASKS.md`.
- One phase task at a time. Plan before coding. Wait for approval on the plan.
- After each task: `npm run check` (and pytest if the agent changed), update `docs/PROGRESS.md`, commit with a clear message.
- If blocked by something that needs the user's account, a key, or money, stop and say exactly what the user needs to do.
- Don't add a dependency without saying why.
- Prefer boring, readable code. The user must be able to explain every part in an interview.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
