# Progress

Agents: add an entry at the end of every working session. Newest at the top. Keep entries short and specific so the next session (or another tool) can continue without guessing.

## Current state

- Phase: 4.5. C4.5.8 (apply on save) done; F4.5.7 (its UI) ready for Flash; the user creates the GitHub token (U4.5.0), then reruns U4.5.1; then C4.5.7 closes the phase.
- Blockers: none. Gemini 3.8 Flash's real RPD not confirmed yet; LLM_DAILY_BUDGET stays 20.

## Log

### 2026-10-21: U4.5.1 feedback; apply rules changes right away (C4.5.8)
- User found: the theme reset to Paper after the 403 page (ThemeSync only re-applied when the device and profile disagreed; it now applies on every mount); freshness hours input too narrow (widened); "revert" creating a new version read as wrong (kept append-only, renamed Restore with clear labels, F4.5.7); waiting for a scheduled run felt broken.
- Decisions (and why):
  - Re-score on save via workflow_dispatch (one scoring implementation, Python): token with Actions read/write only, one run per org (concurrency group), join a queued or running run, 2-minute cooldown, audit-logged dispatches, no promised times in the UI, admin "Reset to defaults" so a demo can't be left broken.
  - A local re-score run takes about 13 s; the GitHub one adds runner start-up.
- Next step (exact): user creates the token (U4.5.0) and pushes; Flash builds F4.5.7; Claude reviews; rerun U4.5.1; C4.5.7.

### 2026-10-21: Phase 4.5 Flash cards merged; gate C4.5.6 passed
- Done: F4.5.4 (32 more config cases, 68 total, both validators agree), F4.5.6 (LLM pacing tile), F4.5.1 (rules editor), F4.5.3 ("What our agent looks for" page), F4.5.2 (version history and revert). Review fixes: every validation error is visible (list items, a summary above the form), unique ids for new categories, sentence-case headings, threshold and freshness sentences computed from the rules, the editor resets when a new version arrives.
- Gate: 351 web tests, 365 agent tests, 24 RLS checks; earlier real runs proved re-scoring under a new version, the preview matching the run, enrolled leads untouched, and revert.
- Next step (exact): see Current state.

### 2026-10-21: Phase 4.5 Claude cards (C4.5.1 to C4.5.4)
- Done: the rules document with hand-written validators in Python and TypeScript agreeing on 36 shared cases (C4.5.1); migration 008 (`agent_configs`, `save_agent_config()`, `leads.config_version`, `threshold_preview()`), version 1 seeded, 24 RLS checks (C4.5.2); the agent and web read each org's newest version, ordered switchable hiring categories, re-classification from stored job titles, enrolled leads frozen (C4.5.3); admin routes, data functions, readable change lines, admin guard (C4.5.4). 299 web tests, 365 agent tests.
- Real runs: version 1 loaded, 59 signals relabelled ("Sales hire"), no lead changed status. Threshold 55 saved as version 2: the preview said 14 ready, the run produced 14, every ready/filtered lead got config_version 2, enrolled leads untouched. Revert made version 3 ("Reverted to version 1 ...") and the next run used it. The org is back on the default rules (version 3).
- Decisions (and why):
  - Validators are hand-written walkers in both languages returning `{path, code}` (pydantic and zod name errors differently, so comparing them would be brittle). Pydantic still types the rules in Python.
  - Category order Marketing hire, Sales hire, Paid acquisition hire (off) reproduces today's classification on all 133 known titles (test titles and every real job title). Sales and GTM merged into Sales hire (they already scored the same); tests now expect "sales" where they said "gtm".
  - Labels come from category names: "Hiring" is now "Sales hire", "Founding sales role" is "Founding sales hire". Enrolled leads keep their old score parts.
  - Turning a category on catches existing jobs only when their board is next refreshed (every 12 hours); keyword edits on already-stored signals apply on the next run.
  - The seed's lead split alternated by list position, so re-seeding after enrollments moved 1036 leads to the other rep. Restored the previous owners (checked against the three enrolled leads) and the seed now only assigns leads without a demo rep.
- Next step (exact): see Current state.

### 2026-10-21: Phase 4.5 planned
- Decisions (and why):
  - Schema: two validators (pydantic, zod) agreeing on one fixture file, like the guardrails; no new dependencies, and cross-field rules live naturally in both.
  - Preview: threshold only, from stored scores ("N leads in the queue at this threshold, was M"), because it's a query, not a port. Other changes say "Effect shows after the next agent run (every 30 min)". The full preview (TypeScript port of the ICP filter, classifier and scoring with parity fixtures) is a Stretch card after Phase 6, next to the AI-guided setup.
  - Hiring categories are admin-defined (name, keywords, exclusions, points, on/off), seeded Sales hire, Marketing hire and Paid acquisition hire (off), instead of a separate paid-acquisition toggle. Sales signals are now labelled "Sales hire".
  - Admins can add banned phrases and set max body words (40 to 150). Grounding, the invented-facts checks and the dash ban are always on and shown locked with a reason.
  - Offer, sender name and proof points are editable. LLM pacing stays a deploy setting, shown in Ops.
  - Enrolled and later leads keep their score (today they still got re-scored).

### 2026-10-21: Phase 4 closed (F4.1 to F4.4, U4.1, C4.6, U4.2, C4.7)
- Done: Flash F4.1 (editor, live checks), F4.2 (approve with Cmd+Enter, regenerate, agent trace, prompt), F4.3 (27 more fixture cases, 60 total, both languages agree), F4.4 (Ops budget tile), each reviewed and merged. Review fixes: the editor reset per lead (it kept the previous lead's drafts), check messages wrap, no router.refresh() racing the next-lead push, the trace lists only failed angles, Regenerate off on Unconstrained.
- Gate: 247 web tests, 317 agent tests, 20 RLS checks. A GitHub Actions run (workflow_dispatch) drafted 4 leads, 12 drafts, all passing, in 6 calls, and stopped at the agent's share (16 of 20). The user tested the full flow on localhost (approved FurtherAI); on the live Vercel URL Claude checked over HTTP: the editor renders for admin and rep, a rep gets 403 on Ops and 404 on another rep's lead, signed-out API calls get 401, a body without its signal phrase gets 422 (grounding), the Ops tile reads the budget.
- Decisions (and why):
  - Google's 503 ("high demand") is common on gemini-3.8-flash: one retry after 5 s inside the reserved call; a lead that still fails is skipped and picked up by a later run.
  - A Safari reload loop on localhost after several branches merged at once was stale dev state; restarting `npm run dev` fixed it. Restart the dev server after merging several branches.
- Not done / known issues: the RPD for gemini-3.8-flash; the Groq fallback is a stub.
- Next step (exact): plan Phase 4.5.

### 2026-10-21: Phase 4 Claude cards (C4.1 to C4.5)
- Done: shared outreach/prompts/fixtures (C4.1); guardrails and prompt rendering in Python and TypeScript agreeing on 33 + 4 shared cases (C4.2); migration 007 with `llm_calls`, `reserve_llm_call()`, `llm_calls_today()`, `approve_lead()` and 4 new RLS checks, 20 total (C4.3); agent drafting step (C4.4); draft and approve routes, `lib/llm.ts`, draft workspace data, client helpers, 13 route tests (C4.5). 203 web tests, 290 agent tests.
- Real runs: the agent drafted 2 leads in 2 calls (all 6 angles passed first try). End to end on the dev server: regenerate, Unconstrained once then reused, a rep refused on another rep's lead (404), a body without its signal phrase refused (422), approval created a sequence with 4 idempotent steps and moved the lead to enrolled, a second approval got 409.
- Decisions (and why):
  - `gemini-2.5-flash` is retired for new keys (404); GEMINI_MODEL is now `gemini-3.8-flash` (user choice) in .env.local and the GitHub secret; Vercel still needs it.
  - Failed calls still count against the daily budget (conservative); Google's 500/503 gets one retry inside the same reserved call so a busy moment costs nothing extra.
  - The prompt now forbids copying the company's own "we/our/us" phrases (the first real draft quoted "our enterprise pipeline engine").
  - `getLead` is unchanged; `getDraftWorkspace(leadId)` returns the editor's data, so existing lead-detail tests stay valid. F4.1 wires it into the Queue page.
  - Signed-out `/api/*` calls get a 401 JSON from the proxy instead of a login redirect.
- Not done / known issues: Groq provider is still a stub (no key). "Founding GTM Recruiter" counts as a GTM hire; arguably right (they're building a GTM team), worth a look in Phase 4.5.
- Next step (exact): see Current state.

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
