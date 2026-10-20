@AGENTS.md

## Claude Code workflow

- Start every session by reading `docs/PROGRESS.md`, then the current phase in `docs/PLAN.md`.
- Use plan mode for any task that touches more than one file. Show the plan and wait for "go".
- Commit after every working step. Never force-push. Never commit `.env*` files other than `.env.example`.
- Run `npm run check` (and `.venv/bin/python -m pytest agent/tests` when the agent changed) before saying a task is done.
- When a phase is finished, tick its checkboxes in `docs/PLAN.md` and add a short entry to `docs/PROGRESS.md`.
- If context or usage is running low, write the exact next steps into `docs/PROGRESS.md` before stopping, so the next session (or another tool) can continue.
- `docs/TASKS.md` splits every phase into cards: `C` (Claude), `F` (Gemini Flash in Antigravity), `U` (the user). Build only `C` cards. Don't build `F` cards unless asked; if a `C` card needs something Flash will build, define the typed contract (props, data shape, helper) and leave the UI to Flash.
- Claude commits to `main`. Flash works on one branch per card (`flash/p<N>-<slug>`).
- Review every Flash card before it merges, following "How Claude reviews a Flash card" in `docs/TASKS.md`. Always run `git branch --show-current` and `git status --short` before reviewing, and again before merging.
