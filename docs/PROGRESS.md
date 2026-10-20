# Progress

Agents: add an entry at the end of every working session. Newest at the top. Keep entries short and specific so the next session (or another tool) can continue without guessing.

## Current state

- Phase: 0 (setup)
- Next step: user finishes U0.2 to U0.6 in docs/TASKS.md, then Claude starts Phase 1 (C1.1)
- Blockers: none

## Log

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
