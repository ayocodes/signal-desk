# Build plan

Seven phases, plus Phase 4.5 (configurable agent) after the cut line. Each one ends with something working that you can see. Tick the boxes as you go (agents tick them too).

**Cut line:** after Phase 4 plus a deploy, you have a real, sendable application: real companies, real signals, real scores, real AI drafts with guardrails, real login with roles. Phases 5 and 6 make it much stronger. Phase 7 is polish.

**Time:** rough agent time, not counting your reviews or waiting on Claude usage limits. Phase 1: 2-3h. Phase 2: 3-4h. Phase 3: 2-3h. Phase 4: 2-3h. Phase 5: 3-4h. Phase 6: 2h. Phase 7: 2h.

## How to run each phase in Claude Code

Paste this at the start of each phase (change N):

```
Read CLAUDE.md, docs/PROGRESS.md, Phase N in docs/PLAN.md and Phase N in docs/TASKS.md,
plus any docs they reference. Enter plan mode and propose a plan for Phase N's C cards only:
files to create or change, migrations, packages to add (with reasons), the contracts Flash
will build on, and how you'll test it. Flag anything that needs me (accounts, keys, decisions).
Wait for my "go" before writing code. Work card by card. After each card: run checks, commit,
tick it in TASKS.md. Stop when the C cards that unblock Flash are done and tell me which F cards can start.
```

Then add the phase's extra notes (below each phase) if any.

## Using Antigravity (Flash) alongside

`docs/TASKS.md` has the owner split, every Flash card with its exact git commands, and Claude's review procedure.

- Never run Claude Code and Antigravity on the repo at the same time. Flash finishes a card (commit on its branch, back on `main`) before Claude starts.
- Each Flash card runs on its own branch, `flash/p<N>-<slug>`. Claude reviews the branch and merges it, or commits review notes onto the branch for Flash to fix.

---

## Phase 0: Setup (you)

- [x] Complete every box in `docs/SETUP.md`
- [x] Repo has this kit committed on `main`

**Done when:** `.env.local` is filled in, `supabase link` worked, and the repo is public on GitHub.

---

## Phase 1: Foundation (app shell, database, real login, themes)

- [x] Next.js app (App Router, TypeScript strict, Tailwind, ESLint) scaffolded into the existing repo without overwriting the kit files
- [x] `npm run check` script (lint + typecheck + vitest)
- [x] Migration 001: all tables from `docs/ARCHITECTURE.md`, enums, indexes, unique constraints
- [x] Migration 002: RLS policies per the roles table in ARCHITECTURE.md, with a helper SQL function for "current user's org and role"
- [x] Seed script (`npm run seed`): one organization ("Demo workspace"), two users created through the Supabase admin API from `DEMO_*` env vars, matching `profiles` rows (admin, rep), 4 logical mailboxes
- [x] Login page with email + password, plus two "Use demo admin / Use demo rep" buttons that fill the form
- [x] Middleware: unauthenticated users go to /login; reps get a 403 page on /ops
- [x] App shell: sidebar (role-aware nav), top bar, user menu with role badge, sign out
- [x] Theme system exactly as in `docs/DESIGN.md`: tokens, 6 themes + System, no-flash script, saved to profile + localStorage
- [x] Command palette (`⌘K`): navigate pages, "Change theme…" with live preview, sign out
- [x] Contrast unit test for all themes
- [x] Placeholder pages for Queue, Leads, Sequences, Ops, Settings with designed empty states

**Who builds what:** see this phase in `docs/TASKS.md` (Claude, Flash and you, card by card).

**Done when:** you can log in as admin and see Ops; log in as rep and Ops is gone from the nav and returns 403 by URL; switching themes in `⌘K` previews live and persists after reload; RLS test: a rep querying `mailboxes` gets zero rows.

**Extra notes for the prompt:** "I haven't used Supabase before. Explain each Supabase step in one line as you do it. Use the remote linked project; if any step needs Docker, tell me before doing it."

---

## Phase 2: The agent (discover, signals, score)

- [x] `agent/` Python package with `pyproject.toml` or `requirements.txt`, typed with pydantic
- [x] `agent/db.py` using the service-role key; `agent/llm.py` provider interface (used in phase 4)
- [x] `shared/scoring.json`, `shared/hiring_keywords.json` created from ARCHITECTURE.md
- [x] **YC source:** first, fetch the community-maintained YC companies dataset (yc-oss, JSON on GitHub Pages) and print its fields. Report back what fields exist (batch, team size, industries, status, founders?) before writing the ICP filter. If it's unreachable, fall back to a hand-curated `shared/companies.seed.json` of 40 companies and tell me.
- [x] ICP filter with readable `icp_reasons`
- [x] **ATS discovery:** probe Greenhouse, Lever and Ashby public board endpoints with slug guesses; cap per run; store hits
- [x] **Hiring signals** from job boards with excerpt + job URL; classify sales/GTM roles; founding/first sales role bonus
- [x] **Launch signals** from HN Algolia search with the strict matching rule in ARCHITECTURE.md
- [x] **YC recency** as a weak funding signal
- [x] Fingerprint dedupe; companies' `jobs_fetched_at` refresh window
- [x] Scoring + `score_parts`; filtered leads with reasons; round-robin assignment to reps
- [x] **Contacts:** founder names if the dataset has them, else placeholder "Founder"; buyer check; test-inbox routing including the fixed bounce/complaint share
- [x] `agent_runs` + `audit_log` writes, per-step timings, error capture that doesn't crash the whole run
- [x] `--once` CLI and `--dry-run` (no DB writes, prints a summary)
- [x] pytest: scoring, keyword classification, HN matching rule, fingerprinting
- [x] `.github/workflows/agent.yml`: schedule `7,37 * * * *`, `workflow_dispatch`, Python setup with pip cache, secrets from repo settings, 15-minute timeout

**Who builds what:** see this phase in `docs/TASKS.md` (Claude, Flash and you, card by card).

**Done when:** a manual run from the Actions tab finishes green; Supabase shows real companies, signals and scored leads; a second run adds no duplicates; at least one filtered lead has a readable reason.

**Extra notes for the prompt:** "Before building the ICP filter, show me the dataset fields and 3 sample records. Respect robots.txt for any HTML page. Never touch LinkedIn."

---

## Phase 3: Workspace UI (read-only first)

- [x] Queue page: list with tabs (Ready, Enrolled, Bounced, Replied) and counts; signal filter chips; collapsed "N filtered out" section listing reasons
- [x] Lead detail: header with status pill, numbered signal cards (type, title, source, age, excerpt, link out), score math row, buyer check row
- [x] Leads page: dense sortable table (company, contact, score, top signal, status, assigned rep, updated)
- [x] Reps see only their assigned leads (enforced by RLS, not just the UI)
- [x] Keyboard: `J` / `K` in lists, `⌘K` actions for the selected lead
- [x] Loading skeletons, empty and error states
- [x] Realtime or polling refresh so new leads from the agent appear without reload

**Who builds what:** see this phase in `docs/TASKS.md` (Claude, Flash and you, card by card).

**Done when:** everything on screen comes from the database; admin and rep see different lead sets.

---

## Phase 4: Drafts and approval

- [ ] `shared/outreach.json` (sender, offer, allowed proof points), `shared/prompts/draft.md` and `raw.md`, `shared/guardrails.json` from ARCHITECTURE.md
- [ ] Agent drafting step: one call per lead for 3 angles (signal, peer, short), JSON output, at most one retry, cap per run, 429 backoff, tokens and prompt stored
- [ ] LLM budget: every call counted per UTC day (`LLM_DAILY_BUDGET`, 20 on the free tier); the agent stops at 80%, the app keeps the rest; Ops shows calls used today
- [ ] Guardrails in Python AND TypeScript reading the same JSON, including grounding, invented numbers and unlisted customer claims; shared test fixtures so both give identical results
- [ ] Email editor in lead detail: angle picker (the raw baseline shown as "Unconstrained", generated on demand, flagged), From / To / Subject / Body, live checks with named grounded phrases, edited state
- [ ] Regenerate button: server route calls the LLM for one angle (rate-limited per user, inside the budget)
- [ ] Approve and enroll (`⌘↵`): disabled unless checks pass; the server re-checks; creates `sequences` + `sequence_steps` with idempotency keys; audit log; moves to next lead
- [ ] Agent trace and "Prompt sent to the model" collapsibles in lead detail
- [ ] Deploy to Vercel and test with both demo accounts

**Who builds what:** see this phase in `docs/TASKS.md`.

**Done when:** a new lead gets drafts on the next agent run; deleting the signal phrase from a draft disables Approve; approving creates a sequence row; the raw baseline is visibly blocked; the daily LLM budget is never exceeded.

**This is the cut line.** You can apply from here.

---

## Phase 4.5: Configurable agent

The agent's rules (ICP, signal types and weights, keyword lists, threshold, freshness) move from `/shared` files into the database, per organization and versioned, with an admin editor. The agent already reads every rule through `load_config(org_id)` (Phase 2), so only that function changes on the Python side.

- [ ] One validation schema for the rules, shared by TypeScript and Python, with shared accept/reject fixtures that both must agree on
- [ ] Rules stored per org in the database, versioned (who, when, what changed), every change audit logged; `/shared` JSON becomes the default seed (version 1)
- [ ] Signal types can be switched on/off and re-weighted; keyword lists, threshold and freshness editable
- [ ] Each lead records the config version that scored it
- [ ] Agent loads the org's current version each run (falls back to the `/shared` defaults); the next run re-scores `ready`/`filtered` leads; enrolled and later leads keep their score
- [ ] Admin settings page to edit the rules, with version history and revert (a revert creates a new version)
- [ ] Read-only "What our agent looks for" page for reps
- [ ] Optional: preview how many leads a change would surface or filter before saving

**Who builds what:** see this phase in `docs/TASKS.md`. Storage, versioning, RLS, validation and agent loading are Claude's; the settings form, history and rep page UI are Flash's.

**Done when:** an admin changes the threshold and saves; history shows who changed what; the next agent run re-scores and leads show the new version; enrolled leads keep their score; a rep can read the rules page but can't open the editor (403) or write a version (RLS); both validators reject the same bad fixture.

**Open decisions for the phase plan:** schema format (one JSON Schema file read by both languages, or a schema generated from one side); whether the optional preview ports the scoring formula to TypeScript (with parity fixtures) or asks the agent to compute it.

---

## Phase 5: Sending, webhooks, deliverability

- [ ] **First, verify:** can the Resend sandbox sender (`onboarding@resend.dev`) send to `delivered@`, `bounced@` and `complained@resend.dev`? Which webhook events does each produce (delivered, opened, bounced, complained)? Report before building. If the sandbox blocks test addresses, stop and tell me.
- [ ] Sequence engine in the agent: due steps, branch evaluation, mailbox rotation, Resend send with idempotency key
- [ ] Webhook route with signature verification, event storage (unique provider id), step and mailbox updates
- [ ] You: add the webhook in Resend pointing at `https://<your-vercel-url>/api/webhooks/resend`, copy the signing secret into Vercel + `.env.local`
- [ ] Bounce recovery: lead moves to Bounced tab with the bounce code and a proposed corrected address; "Approve and resend" requires a human
- [ ] Deliverability: per-mailbox rates from real events, auto-pause rules, daily reset, DNS auth lookup for the sending domain
- [ ] Admin-only Simulate actions (reply, open, fast-forward sequence), labeled "Simulated", using the same code paths as real events
- [ ] Reply halts the sequence at any step
- [ ] pytest + vitest: branching, idempotent sends, webhook dedupe, auto-pause thresholds

**Done when:** a lead routed to `bounced+...` produces a real webhook, lands in Bounced with recovery; a complaint pushes a mailbox toward pause; a simulated reply halts a sequence.

---

## Phase 6: Ops (admin)

- [ ] KPI strip from real data (leads scored today, enrolled, edited-before-send %, bounces recovered, reply rate) with simulated-derived numbers labeled
- [ ] Reply rate by signal type (from events, simulated replies labeled)
- [ ] Mailbox health table: auth, sent/cap bar, bounce %, complaint %, status with every pause reason
- [ ] Engine panel from `agent_runs`: last run, p50/p95 duration, leads per run, LLM tokens per lead, error rate, drafts blocked by guardrails
- [ ] Audit log stream with filters (agent / user, action type)
- [ ] Optional: "Run agent now" button via GitHub `repository_dispatch`

**Who builds what:** see this phase in `docs/TASKS.md` (Claude, Flash and you, card by card).

**Done when:** every number on Ops traces back to a query; reps can't reach any of it.

---

## Stretch: AI-guided rules setup (after Phase 6)

A nice extra, not a core feature: built only if everything before it works. Needs Phase 4.5 (rules in the database, the shared schema, the editor).

- [ ] In Settings, the admin clicks "Set up with AI" and answers five plain questions: what you sell; who buys it (company type and size); what makes a company ready to buy now; which roles you sell to; companies or industries to avoid. A fixed set of questions, not a chat that keeps asking follow-ups.
- [ ] One Gemini call (two if the first output fails validation) turns the answers into a rule set in the editor's format (team size range, industries, which signals count and their weights, threshold), each rule with a one-line "why".
- [ ] The draft opens in the normal rules editor with the AI-suggested values marked; the admin edits anything. Nothing changes until Save, which creates a new config version, audit logged like any other change.
- [ ] Honest coverage warning when the ICP mostly falls outside what the agent can search: "Your ICP mostly falls outside what this agent can search (YC startups). You'd need another company source." (For example, dental clinics in Texas.)

**Who builds what:** see "Stretch" in `docs/TASKS.md`.

**Done when:** an admin answers the five questions, gets a validated draft with a reason per rule, edits one value, saves a new version; an out-of-scope ICP shows the coverage warning; nothing is saved without clicking Save.

---

## Phase 7: Polish and ship

- [ ] README: what it is, architecture diagram, how the agent works, what's real vs simulated and why, how to run locally, demo logins
- [ ] Short "Design decisions" section: no LinkedIn, test inboxes, grounding check, GitHub Actions scheduling, RLS multi-tenancy
- [ ] Lighthouse / a11y pass, keyboard pass, mobile overflow pass, every theme checked
- [ ] Seed reset script for a clean demo state
- [ ] Record the walkthrough video
- [ ] Final deploy, check both logins on the live URL

**Who builds what:** see this phase in `docs/TASKS.md` (Claude, Flash and you, card by card).
