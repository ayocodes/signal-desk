# Progress

Agents: add an entry at the end of every working session. Newest at the top. Keep entries short and specific so the next session (or another tool) can continue without guessing.

## Current state

- Phase: 0 (setup)
- Next step: Phase 0 complete. Run the Phase 1 prompt from docs/PLAN.md (starts with C1.1)
- Blockers: none

## Log

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
