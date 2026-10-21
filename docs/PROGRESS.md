# Progress

Agents: add an entry at the end of every working session. Newest at the top. Keep entries short and specific so the next session (or another tool) can continue without guessing.

## Current state

- Phase: 4 in progress (drafts and approval, the cut line). Plan approved 2026-10-21: `/Users/tomiomotola/.claude/plans/wise-drifting-kay.md` (copied in summary below).
- Done: C4.0 (paid-acquisition roles excluded, with tests).
- Next step (exact): docs commit (TASKS.md Phase 4 cards per the plan: C4.0 to C4.5 plus F4.4 Ops budget tile; PLAN.md Phase 4 bullets; ARCHITECTURE.md drafting/guardrails/service-role notes; Phase 4.5 candidate toggle for performance marketing), then C4.1 shared files, C4.2 guardrails (py + ts, shared fixtures), C4.3 migration 007, C4.4 agent drafting, C4.5 web routes. Commit after each.
- Blockers: none. Ashby is checked only on local runs (`npm run agent:local`).

## Log

### 2026-10-21: Phase 4 planned; C4.0 done
- Decisions (and why):
  - Performance marketing, paid acquisition and paid media roles never count (marketing and gtm exclusions): paid-ads work points to paid, inbound acquisition, not outbound. Candidate toggle for the Phase 4.5 rules editor.
  - Offer (one shared file `shared/outreach.json`, editable in 4.5): an AI outbound platform for early-stage B2B teams that watches buying signals, drafts the first email and runs the follow-up sequence. Sender "Sam" at the lib/brand.ts brand. Only listed, generic, non-numeric proof points; the model never invents customers, names, numbers, results or case studies; the peer angle uses proof points.
  - New guardrails: numbers/percentages not in signals or proof points fail; customer claims ("our customers", "teams we work with") fail unless that exact proof point is in the email.
  - LLM budget: Gemini free tier is 20 requests/day (AI Studio). `LLM_DAILY_BUDGET=20`, every call counted per UTC day in `llm_calls`; the agent stops at 80% (16), the app keeps 4. The agent makes one call per lead for 3 angles, retries once at most; the raw baseline ("Unconstrained") is generated on demand through the rate-limited draft route and stored. Budget shown in Ops; the UI says plainly when it's used up.
  - Writes needing server checks (approve, draft) go through a server-only service-role client after user-scoped RLS reads; `approve_lead()` re-checks org, role and assignment in the database.
- Next step (exact): see Current state.

### 2026-10-21: Phase 3 closed (U3.1, C3.4)
- Done: data layer (C3.1), live updates plus per-rep RLS checks (C3.2), second demo rep (C3.0); Flash F3.1 to F3.5 reviewed and merged with fixes. User browser check passed: admin and reps see different lead sets, real lead detail, live status, keyboard, filtered reasons. After the gate: arrow keys alongside J/K, the selected row stays in view, the split view fits the window, and lead pages load in one query (signals embedded, tab counts in one SQL call; queue about 1.0 s down to 0.7 s).
- Decisions (and why):
  - "Date.now() while prerendering" on every signed-in page came from supabase-js checking the session's expiry inside the layout's profile lookup (`partialPrefetching` makes Next flag clock reads in that stage). `createSupabaseServerClient` now calls `connection()` first: everything it reads is per-user, request-time work. Lead pages also take one clock reading (`lib/request-time.ts`) and pass it down as `now`, so server and browser show the same ages.
  - Automatic guards against Flash's repeat mistakes: `lib/design-tokens.test.ts` (default palette, raw hex, dashes, `text-[Npx]`, extra `<h1>`) and `lib/ui-consistency.test.tsx` (signal labels). `npm run check` includes `next build`.
- Not done / known issues: user still to decide on senior performance marketing roles (currently not counted).
- Next step (exact): plan Phase 4.

### 2026-10-21: Phase 2 closed (U2.1, U2.2, C2.12)
- Done: F2.1 (keywords, 78 cases; review removed `cro` and `performance marketing`, excluded `designer`), F2.2 (scoring/ICP example tests), F2.3 (agent README; review corrected 8 factual errors). GitHub runs green and idempotent; user checked the tables. Score bands (Strong 90+, Good 70+, Borderline 50+) added to the rules; the score stays a points total.
- Decisions (and why):
  - Ashby answers 403 to GitHub's runners: scheduled runs use `AGENT_JOB_BOARDS=greenhouse,lever`, local runs check all three, `companies.ats_checked` records per-site checks; nothing routes around the refusal.
  - The user accepts Flash's edits in Antigravity right away and never rejects after its commit (written into TASKS.md).
- Not done / known issues: user to decide whether senior performance marketing roles should count (currently not).
- Next step (exact): plan Phase 3.

### 2026-10-21: Phase 2 build (C2.1 to C2.11) plus product changes
- Done: Python agent (settings, polite HTTP client, db, run recorder, YC source, ICP, ATS discovery, hiring/launch/YC signals, scoring, contacts, leads, main, workflow), migration 003, 126 offline tests. Real runs: 1,060 companies/contacts/leads, re-runs add no duplicates. Repo variables DISCOVERY_PROBES_PER_RUN=150 and DRAFTS_PER_RUN=5 (the two "secrets" didn't exist on GitHub, so nothing was deleted).
- Decisions (and why):
  - ICP: full (418) + near-miss partial (643); full probed first; B2B by industry or tag, with the reason saying which.
  - HN launches: URL on the company domain, or a Launch HN title with the company's own YC batch marker. Show HN titles alone matched unrelated projects for ordinary-word names (33 mostly false matches down to 7 genuine).
  - Ready = score >= 50 AND at least one non-weak signal (a recent YC batch alone can't qualify; user decision).
  - Marketing hires: own category worth 20, labelled "Marketing hire" (user decision); senior/demand gen/growth marketing only.
  - Job-board probing: legal suffixes stripped, generic trailing word dropped, larger teams first (measured: ~30% of companies have an Ashby board; weeks-old batches rarely do).
  - All agent rules go through load_config(org_id), guarded by an ast-based test, so Phase 4.5 can move rules into the database without touching scoring.
  - Phase 4.5 "Configurable agent" added to PLAN.md and TASKS.md after the cut line.
- Not done / known issues: the workflow hasn't run on GitHub yet (needs a push). Signals for closed job postings stay; freshness handles recency.
- Next step (exact): user pushes, runs the workflow twice (U2.1), inspects Supabase (U2.2); Flash F2.1 to F2.3; then C2.12 closes Phase 2.

### 2026-10-20: Phase 1 closed (C1.7, U1.1, C1.8)
- Done: all six Flash cards (F1.1 to F1.6) reviewed and merged, with small fixes on main (a11y roles, inert mobile drawer, link-styled buttons, theme save no longer waits on the network, SSR-safe theme picker). Automated gate: 72 tests, 11 RLS checks, build. User browser walkthrough passed. `audit_log` shows real sign-in/out rows. Pushed; Vercel deploy succeeded (env validation passed there too).
- Decisions (and why):
  - `lib/design-tokens.test.ts` fails the check on default-palette classes or raw hex: Flash used `bg-black` twice, which renders nothing with the palette off.
  - `vercel.json` pins functions to `dub1`, next to Supabase `eu-west-1`.
  - Local slowness measured: this machine's connection (1.5 to 10 s TCP connects, even to github.com); the app makes one Supabase round trip per page.
- Next step (exact): plan Phase 2 C cards.

### 2026-10-20: Phase 1, Claude cards C1.1 to C1.6
- Done: Next 16.4.2 scaffold with `npm run check`; env validation (`lib/env-schema.ts`, fails `next dev`/`next build` naming the variable); migrations 001 (schema) and 002 (RLS) pushed to the remote project; `npm run seed` (idempotent); `npm run test:rls` (11 checks pass); auth with `proxy.ts`, real 403 on /ops for reps; bare login, shell and stub pages; theme tokens, no-flash script, save to profile; DB types generated.
- Decisions (and why):
  - Next 16 renamed middleware to `proxy.ts`. Cache Components stays on (user's choice), so session reads sit inside `<Suspense>`.
  - Real 403: pages stream with 200 before `forbidden()` runs inside Suspense, so `proxy.ts` checks the role on `/ops` only (one query) and rewrites to `/403`, which calls `forbidden()` while prerendered. `Cache-Control: private, no-store` on that response. `requireAdmin()` in the ops layout and RLS remain as the other layers.
  - RLS helpers live in a non-exposed `private` schema; profile updates limited to `theme` and `full_name` by column grants.
  - Tailwind's default palette is disabled so only design tokens exist.
  - `@types/node` bumped to ^22 to match the Node 22 runtime (vitest 5 needs it).
  - `shared/guardrails.json` created early for the mailbox cap; DB types generated early (`npm run db:types`).
- Not done / known issues: login form submission not exercised from the terminal (server actions need a browser); verify in U1.1, then check `audit_log` has `auth.sign_in` rows. The rep-leads RLS check is vacuous until leads exist (re-tested in C3.3). Local Python is 3.13 (Actions uses 3.12).
- Next step (exact): user does U1.0; Flash runs F1.1 and F1.2 (one at a time); Claude reviews each branch.

### 2026-10-20: Phase 0, task board revisions
- Done:
  - Flash never edits TASKS.md: removed it from every card's file list and `git add` line. Claude ticks both boxes on `main` after merging.
  - Review notes now go in `docs/reviews/<card-id>.md`, committed on Flash's branch.
  - Flash rule: fix failing checks within the "Touch only" files, or stop without committing and report.
  - Each phase gate is now three cards: Claude's automated checks, the user's browser check (admin and rep), then Claude closes the phase.
  - Added `lib/env.ts` (C1.1) and `agent/settings.py` (C2.1) env validation.
- Decisions (and why):
  - Added `pydantic-settings` (official, built for env validation).
  - The agent reads `SUPABASE_URL` and falls back to `NEXT_PUBLIC_SUPABASE_URL`, so the GitHub secrets and `.env.local` both work without renames.
  - The selected `LLM_PROVIDER`'s key and model are required; the other provider's are optional.
- Next step (exact): user completes U0.2 to U0.6; then run the Phase 1 prompt from PLAN.md.

### 2026-10-20: Phase 0, owner split and task board
- Done: added `.gitignore` and made the first commit; created `docs/TASKS.md` with C (Claude), F (Flash), U (user) cards for every phase, each F card with exact git commands; updated AGENTS.md, CLAUDE.md and PLAN.md to point to it.
- Decisions (and why):
  - Flash works on one branch per card, so a bad card can be rejected without touching `main`.
  - Claude writes the tests for its own risky code. Flash writes UI/contrast tests and extra cases.
  - Claude builds a plain, wired version first and Flash designs it with the same props, so Flash never touches auth, data or secrets.
  - Demo login uses a `signInAsDemo(role)` server action, so demo passwords never reach the browser.
- Not done / known issues: SETUP.md sections 4 to 7 are still open (see U0.2 to U0.6); `main` is not pushed yet.
- Next step (exact): user completes U0.2 to U0.6; then run the Phase 1 prompt from PLAN.md.

<!--
### YYYY-MM-DD: Phase N, task name
- Done:
- Decisions (and why):
- Not done / known issues:
- Next step (exact):
-->
