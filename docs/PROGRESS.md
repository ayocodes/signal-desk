# Progress

Agents: add an entry at the end of every working session. Newest at the top. Keep entries short and specific so the next session (or another tool) can continue without guessing.

## Current state

- Phase: 1 (foundation). Claude cards C1.1 to C1.6 done.
- Next step: Flash F1.1 (themes) and F1.2 (UI primitives) can start; user does U1.0.
- Blockers: none

## Log

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
