@AGENTS.md

## Claude Code workflow

- Start every session by reading `docs/PROGRESS.md`, then the current phase in `docs/PLAN.md`.
- Use plan mode for any task that touches more than one file. Show the plan and wait for "go".
- Commit after every working step. Never force-push. Never commit `.env*` files other than `.env.example`.
- Run `npm run check` (and `python -m pytest agent/tests` when the agent changed) before saying a task is done.
- When a phase is finished, tick its checkboxes in `docs/PLAN.md` and add a short entry to `docs/PROGRESS.md`.
- If context or usage is running low, write the exact next steps into `docs/PROGRESS.md` before stopping, so the next session (or another tool) can continue.
- Tasks marked "Flash" in the plan are meant for a smaller model in Antigravity. Don't do them unless asked; leave a clear TODO with the file path instead.
