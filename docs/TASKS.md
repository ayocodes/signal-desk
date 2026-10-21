# Tasks

The working checklist for every phase, split by owner. `docs/PLAN.md` says **what** each phase delivers; this file says **who builds which part, in what order**, and how work moves between tools.

## Who does what

| Owner | Tool | Builds | Where |
|---|---|---|---|
| **Claude** | Claude Code (terminal) | The risky parts: schema, RLS, auth, the agent core, scoring, guardrails and grounding, sends, webhooks, deliverability, API routes, data access functions. Also the typed contracts (props, data shapes, helper functions) that Flash builds on, and the tests for its own risky code. | Commits straight to `main` |
| **Flash** | Gemini Flash in Antigravity | Everything else: UI components, pages, themes, empty states, keyboard UX, other tests (UI, contrast, extra cases), docs. | One branch per card, `flash/p<phase>-<slug>` |
| **You** | Browser and terminal | Accounts, keys, dashboards, deploy settings, the demo video, and deciding when a phase is finished. | n/a |

Claude reviews every Flash card before it is merged into `main`. After merging, Claude ticks both of the card's boxes on `main`. **Flash never edits this file.**

**Pattern used throughout:** Claude first builds a working but plain version with typed props (for example a bare login form or a bare shell). Flash then makes it match `docs/DESIGN.md` **without changing the props or the server calls**. This way Flash never touches auth, data or secrets.

## Rules for Flash (every card)

1. Do one card at a time. Before starting, read `AGENTS.md`, `docs/DESIGN.md` and the card.
2. Run the card's **Start** git commands exactly as written. If `git status --short` prints anything, stop and tell the user. Don't stash it or clean it up.
3. Change only the files listed under **Touch only**. If the card can't be done without touching another file, stop and say which file and why.
4. Never add a dependency (`npm install`, `pip install`). If you need one, stop and tell the user.
5. Never touch `.env*`, `supabase/`, `proxy.ts`, `next.config.ts`, any `layout.tsx` or `actions.ts`, `app/forbidden.tsx`, `app/403/`, `app/api/`, files in `lib/` other than ones your card names, `docs/TASKS.md`, `docs/reviews/`, or anything under `agent/` other than test files your card names. Claude ticks the boxes in this file after merging.
6. No raw hex colors outside `app/themes.css`. Use the token utilities from `app/globals.css`: colors (`bg-bg`, `bg-surface`, `bg-surface-2`, `border-border`, `text-text`, `text-muted`, `text-subtle`, `bg-accent`, `text-accent-fg`, `bg-accent-soft`, `text-good`, `text-warn`, `text-bad`, `text-signal`), type (`text-label`, `text-meta`, `text-body`, `text-emphasis`, `text-section`, `text-title`) and radius (`rounded-control`, `rounded-panel`, `rounded-dialog`). Tailwind's default palette is switched off, so classes like `bg-blue-500`, `bg-black` or `text-white` do nothing (for an overlay, use `bg-bg/70`); `lib/design-tokens.test.ts` fails the check if one slips in. No em-dashes or en-dashes in UI copy. No `any`. No empty `catch {}`.
7. **Checks must pass before you commit.** Each Finish block starts with `npm run check` (and `.venv/bin/python -m pytest agent/tests` where listed).
   - If a check fails, fix it by changing only the card's "Touch only" files, then run it again.
   - If it can't be fixed within those files: stop, **don't commit**, leave the changes on the branch, and report the failing command and its full error output to the user.
8. When the checks pass, run the rest of the **Finish** commands exactly. Report the branch name to the user and stop. Never commit on `main`, merge, push, or delete branches: Claude merges after review.
9. **Rework:** Claude writes review notes in `docs/reviews/<card-id>.md` and commits them on your branch.
   - Run `git status --short` (it must print nothing), then `git switch <the card's branch>`.
   - Read the latest round in that file and fix every note, changing only the "Touch only" files. Never edit the review file.
   - Run the same Finish commands, but with the commit message `flash(pN): address review on <slug>`.

**For the user, in Antigravity:** when Flash reports its branch name, click **Accept all** right away. The work is already committed on Flash's branch, so accepting changes nothing on disk. Never click Reject or undo after that: Flash has switched back to `main`, so a revert would land on `main` as stray changes. If you don't like the work, tell Claude, who handles it with review notes.

**Prompt to paste into Antigravity** (change the card id):

```
Read AGENTS.md, docs/DESIGN.md, and card F1.1 in docs/TASKS.md. Do only that card.
Run its Start git commands first, exactly as written. Change only the files under "Touch only".
Never edit docs/TASKS.md. If a check fails and you can't fix it within the "Touch only" files,
stop without committing and show me the error. Otherwise run the Finish commands exactly,
then stop and tell me the branch name.
```

**Rework prompt:**

```
Rework card F1.1 in docs/TASKS.md. Run `git status --short` (it must print nothing), then
switch to the card's branch. Read the latest round in docs/reviews/F1.1.md and fix every note,
changing only the card's "Touch only" files. Then run the card's Finish commands exactly, with
the commit message "flash(pN): address review on <slug>", and tell me the branch name.
```

## How Claude reviews a Flash card

Always check which branch is checked out before anything else.

```bash
git branch --show-current                        # 1. where am I? (expect main)
git status --short                               # 2. must be empty (see below if it isn't)
git switch main                                  # 3. review from main
git log --oneline main..flash/p1-themes          # 4. what Flash committed
git diff --stat main...flash/p1-themes           # 5. files touched must be inside the card's "Touch only"
git diff main...flash/p1-themes                  # 6. read every line
git switch flash/p1-themes && npm run check; git switch main   # 7. checks on Flash's code, then back to main
git branch --show-current                        # 8. confirm main before merging
```

**If step 2 isn't empty:** Flash may have stopped on a failing check (rule 7) and left uncommitted changes on its branch. Look at them with `git diff` on that branch, and ask the user before committing or discarding anything.

**Review checklist:**
- Touched files are within "Touch only". `docs/reviews/<card-id>.md` is Claude's own file and is expected on a rework.
- `docs/TASKS.md` is untouched.
- Props and server calls are unchanged.
- Design tokens only; no new dependencies.
- No secrets, env access or service-role imports in client code.
- No em-dashes or en-dashes.
- Empty, loading and error states are present where the card asks for them.
- Types are strict, and `npm run check` passes.

**Accept:**

```bash
git merge --no-ff flash/p1-themes -m "Merge F1.1: <card title>"
# on main: tick "Built (Flash)" and "Reviewed and merged (Claude)" on the card, then:
git add docs/TASKS.md && git commit -m "Review F1.1: merged"
git branch -d flash/p1-themes
```

The review file, if there is one, merges into `main` with the branch and stays as history.

Small fixes (a typo, a missing token): merge first, then fix on `main` in a separate commit that says what changed.

**Request changes:**

```bash
git switch flash/p1-themes
# write numbered notes in docs/reviews/F1.1.md
#   first time: "# F1.1 review" then "## Round 1"; later: add "## Round 2", never rewrite earlier rounds
git add docs/reviews/F1.1.md && git commit -m "review: F1.1 changes requested"
git switch main
git branch --show-current                        # confirm main
```

Then tell the user the card is ready for Flash's rework prompt.

**Card ids:** `U` = you, `C` = Claude, `F` = Flash. Within a phase, work top to bottom. A Flash card may start only when everything in its **Starts after** line is ticked on `main`.

---

## Phase 0: Setup

- [x] **U0.1** SETUP.md sections 0 to 3 (tools, GitHub, Supabase, Gemini)
- [x] **U0.2** SETUP.md section 4, Resend: the key is already in `.env.local`. Confirm it has sending access, then tick it in SETUP.md.
- [x] **U0.3** Fill in the rest of `.env.local` from `.env.example`. Still missing: `LLM_PROVIDER`, `RESEND_FROM`, `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD`, `DEMO_REP_EMAIL`, `DEMO_REP_PASSWORD`, `AGENT_USER_AGENT` (put your contact email in it), `DRAFTS_PER_RUN`, `DISCOVERY_PROBES_PER_RUN`. From C1.1 on, the app refuses to start without `LLM_PROVIDER`, `RESEND_FROM` and the `DEMO_*` values.
- [x] **U0.4** SETUP.md section 5, Vercel: import the repo and add env vars using the exact names from `.env.example`. The web app reads `NEXT_PUBLIC_SUPABASE_URL`, so no rename is needed. Whenever you add a variable to `.env.local`, add it to Vercel too. A failed first build is expected.
- [x] **U0.5** SETUP.md section 7, GitHub Actions secrets. These are needed before Phase 2's first Actions run. `SUPABASE_URL` is the right name here: the agent reads it, and falls back to `NEXT_PUBLIC_SUPABASE_URL` when running locally.
- [x] **C0.1** Add `.gitignore` (`.env*` except `.env.example`, `supabase/.temp/`) and make the first commit on `main`
- [x] **U0.6** Push `main`: `git push -u origin main`, then check that the repo is public on GitHub

---

## Phase 1: Foundation

### Claude

- [x] **C1.1** Scaffold Next.js (App Router, TS strict, Tailwind v4, ESLint) into the repo without overwriting kit files. Install `@supabase/ssr`, `@supabase/supabase-js`, `zod`, `geist`, `lucide-react`, `cmdk`, `vitest`. Add the `npm run check` script and `lib/brand.ts`.

  Then write `lib/env.ts`, which validates environment variables with zod at startup (`next.config.ts` runs the same check, so `next dev` and `next build` fail at once), so a bad config fails on boot instead of mid-request. Rules live in `lib/env-schema.ts`; browser code uses `lib/env.public.ts`:
  - **Empty strings count as missing.**
  - **Required:**
    - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY` (server only)
    - `LLM_PROVIDER` (`gemini` or `groq`), plus the selected provider's key and model: `GEMINI_API_KEY` + `GEMINI_MODEL` when `gemini`, `GROQ_API_KEY` + `GROQ_MODEL` when `groq`
    - `RESEND_API_KEY`, `RESEND_FROM`
    - `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD`, `DEMO_REP_EMAIL`, `DEMO_REP_PASSWORD`
  - **Optional:**
    - `GITHUB_DISPATCH_TOKEN` + `GITHUB_REPO`: if either is missing, the "Run agent now" button is hidden.
    - `RESEND_WEBHOOK_SECRET`: if missing, the webhook route rejects every request.
    - `GROQ_*` while the provider is Gemini.
  - **Errors:** a missing or invalid value fails with a message naming the variable, for example `Missing environment variable GEMINI_MODEL (required when LLM_PROVIDER=gemini)`. List every problem at once. Never print values.
  - **Server vs browser:** the full schema is server-only and fails the build if imported from client code. A separate public export holds only the `NEXT_PUBLIC_*` values.
  - App code reads env only through `lib/env.ts`, never `process.env` directly.
  - vitest: an empty string counts as missing; the provider switch picks the right required pair; errors name the variable.
- [x] **C1.2** Migration 001: every table, enum, index and unique constraint from ARCHITECTURE.md.
- [x] **C1.3** Migration 002: RLS on every table, plus helper functions for the current user's org and role. Add `npm run test:rls`: signing in as the rep, a query on `mailboxes` must return 0 rows.
- [x] **C1.4** `npm run seed`: the Demo workspace org, admin and rep users via the admin API, matching `profiles` rows, and 4 mailboxes.
- [x] **C1.5** Auth:
  - Supabase clients in `lib/supabase/`, plus `lib/auth.ts` (`getProfile`, `requireAdmin`).
  - `proxy.ts` (Next 16's name for middleware): unauthenticated users go to `/login`; `/ops` answers reps with a real 403 by rewriting to `/403`, which calls `forbidden()` while prerendered. `app/(app)/ops/layout.tsx` checks again with `requireAdmin()`.
  - Server actions `signIn`, `signOut`, `signInAsDemo(role)`. Demo passwords stay on the server and are never sent to the browser.
  - A **bare** login form and a **bare** app shell with typed props: `AppShell({ profile: { fullName, email, role }, children })`.
- [x] **C1.6** Theme plumbing:
  - `lib/themes.ts`: ids `paper | mist | graphite | midnight | forest | high-contrast | system`, labels, and the system mapping.
  - `app/themes.css` with the token structure and the **Paper** block only.
  - Tailwind `@theme inline` mapping, Geist fonts, and the no-flash script in the root layout.
  - `lib/theme-client.ts`: `applyTheme(id)` (preview only), `saveTheme(id)` (writes `profiles.theme` and `localStorage`), `readStoredTheme()`. `components/theme-sync.tsx` makes the profile's theme win across devices.

### You

- [x] **U1.0** In the Supabase dashboard: Authentication → Sign In / Providers → Email, turn off "Allow new users to sign up". Only the seeded demo users should exist. (RLS already gives a stranger's account nothing, since it has no profile; this closes the door entirely.)

### Flash

#### F1.1 Five remaining themes + contrast test
- **Starts after:** C1.6
- **Build:**
  - Add `[data-theme]` blocks for `mist`, `graphite`, `midnight`, `forest` and `high-contrast` to `app/themes.css`. Copy the Paper block's structure and take the values from the DESIGN.md token table. Every token must appear in every block.
  - Write `lib/theme-contrast.test.ts` (a new file; `lib/themes.test.ts` is Claude's). It parses `app/themes.css` and, for every theme, asserts a WCAG contrast of at least 4.5:1 for these pairs: `--text` on `--bg`, `--text` on `--surface`, `--text-muted` on `--bg`, and `--accent-fg` on `--accent`. A failure message names the theme and the token pair.
  - If a theme fails, adjust that theme's value (stay close to the original) and say which one you changed in the commit message.
- **Touch only:** `app/themes.css`, `lib/theme-contrast.test.ts`
- **Done when:** `npm run check` passes, and setting `data-theme` on `<html>` in devtools recolors the whole page for each theme.
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p1-themes  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add app/themes.css lib/theme-contrast.test.ts  # only the Touch-only files
  git commit -m "flash(p1): five themes and contrast test"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [x] Built (Flash) · [x] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F1.1.md`, on the card's branch (only exists if Claude asked for changes)

#### F1.2 UI primitives
- **Starts after:** C1.6
- **Build:** one file per component in `components/ui/`: Button (primary, secondary, ghost, danger), Input, Textarea, Kbd, Pill (good, warn, bad, neutral), Tag (signal type), ScoreBadge (hi, md, lo), Tabs (with count), SegmentedControl, Panel, EmptyState (icon, title, body, optional action), Avatar (initials), Skeleton (row), Toast (with a small `useToast` hook). Use the sizes, radii and row heights from DESIGN.md. Use `lucide-react` icons only. Every interactive element gets a visible `:focus-visible` ring in `--accent`.
- **Touch only:** `components/ui/*`
- **Done when:** `npm run check` passes, and each component is typed and exported from `components/ui/index.ts`.
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p1-ui-primitives  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add components/ui  # only the Touch-only files
  git commit -m "flash(p1): UI primitives"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [x] Built (Flash) · [x] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F1.2.md`, on the card's branch (only exists if Claude asked for changes)

#### F1.3 Designed app shell
- **Starts after:** C1.5, F1.2
- **Build:** restyle the bare `AppShell` into the shell from DESIGN.md "Layout".
  - Sidebar: 240px, collapsible to icons. Workspace name from `lib/brand.ts`. Nav: Queue, Leads, Sequences, Ops (only when `role === 'admin'`), Settings.
  - Top bar: page title slot and a `⌘K` hint.
  - User menu: Avatar, name, role badge Pill, and a Sign out item that calls the existing `signOut` action.
  - On mobile the sidebar becomes a sheet, and nothing overflows sideways at 400px.
  - Keep `AppShell`'s props and the `signOut` import exactly as they are.
- **Touch only:** `components/shell/*`
- **Done when:** the admin sees Ops in the nav, the rep doesn't, sign out works, and `npm run check` passes.
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p1-shell  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add components/shell  # only the Touch-only files
  git commit -m "flash(p1): designed app shell"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [x] Built (Flash) · [x] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F1.3.md`, on the card's branch (only exists if Claude asked for changes)

#### F1.4 Login page design + 403 page
- **Starts after:** C1.5, F1.2
- **Build:**
  - Restyle `app/(auth)/login/page.tsx`: email + password form, error message slot, and two buttons, "Use demo admin" and "Use demo rep", that call the existing `signInAsDemo('admin' | 'rep')` action. Keep all action imports and form field names unchanged.
  - Restyle `components/forbidden.tsx` (it already exists, bare): a permission-denied state with a short explanation and a link back to Queue. It is rendered by `app/forbidden.tsx`; don't edit that file or `app/403/`.
- **Touch only:** `app/(auth)/login/page.tsx`, `components/forbidden.tsx`
- **Done when:** both demo buttons log in, a wrong password shows an error, and `npm run check` passes.
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p1-login  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add "app/(auth)/login/page.tsx" components/forbidden.tsx  # only the Touch-only files
  git commit -m "flash(p1): login page design and 403 page"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [x] Built (Flash) · [x] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F1.4.md`, on the card's branch (only exists if Claude asked for changes)

#### F1.5 Placeholder pages with empty states
- **Starts after:** F1.3
- **Build:** replace the stub `page.tsx` for Queue, Leads, Sequences, Ops and Settings under `app/(app)/`. The shell's top bar already shows the page title as the `<h1>`, so pages don't add their own heading. Each one gets an EmptyState that says what will appear there and how. Example for Queue: "Leads appear here after the agent's next run, every 30 minutes." Ops access is already enforced by `proxy.ts` and `app/(app)/ops/layout.tsx`; don't touch them.
- **Touch only:** `app/(app)/queue/page.tsx`, `app/(app)/leads/page.tsx`, `app/(app)/sequences/page.tsx`, `app/(app)/ops/page.tsx`, `app/(app)/settings/page.tsx`
- **Done when:** every nav link opens a designed page, and `npm run check` passes.
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p1-placeholder-pages  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add "app/(app)"  # only the Touch-only files
  git commit -m "flash(p1): placeholder pages with empty states"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [x] Built (Flash) · [x] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F1.5.md`, on the card's branch (only exists if Claude asked for changes)

#### F1.6 Command palette + theme picker
- **Starts after:** F1.1, F1.3, F1.5
- **Build:**
  - `components/command-palette.tsx` using `cmdk`, opened with `⌘K` / `Ctrl+K`. Commands: go to each page (role-aware, so no Ops for reps), "Change theme…", and "Sign out" (existing `signOut` action).
  - "Change theme…" opens a list of `THEME_CHOICES` from `lib/themes.ts`. Arrow keys call `applyTheme(id)` for a live preview, Enter calls `saveTheme(id)`, and Esc calls `applyTheme(readStoredTheme())` to revert. All three come from `lib/theme-client.ts`; don't edit it.
  - `components/theme-picker.tsx`: the same list as a SegmentedControl or radio list for the Settings page. Add it to `app/(app)/settings/page.tsx`.
  - Mount the palette inside `components/shell/`, and make the existing "Search... ⌘K" button in the top bar open it.
- **Touch only:** `components/command-palette.tsx`, `components/theme-picker.tsx`, `components/shell/*`, `app/(app)/settings/page.tsx`
- **Done when:** the theme previews live while arrowing, survives a reload, Esc reverts it, and `npm run check` passes.
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p1-command-palette  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add components/command-palette.tsx components/theme-picker.tsx components/shell "app/(app)/settings/page.tsx"  # only the Touch-only files
  git commit -m "flash(p1): command palette and theme picker"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [x] Built (Flash) · [x] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F1.6.md`, on the card's branch (only exists if Claude asked for changes)

### Phase gate

- [x] **C1.7** Automated checks on `main`: `npm run check`, `npm run test:rls` (the rep gets 0 rows from `mailboxes`) and `npm run build`. Report the results to the user.
- [x] **U1.1** In the browser (`npm run dev`), check PLAN.md Phase 1 "Done when":
  - As admin ("Use demo admin"): Ops is in the nav and opens.
  - As rep ("Use demo rep"): Ops is missing from the nav, and typing `/ops` shows the 403 page.
  - `⌘K` → "Change theme…": arrowing previews live, Enter keeps the theme after a reload, Esc reverts.
  - Tell Claude what passed and what didn't.
- [x] **C1.8** After U1.1 passes: tick PLAN.md Phase 1, add a PROGRESS.md entry, commit.

---

## Phase 2: The agent

Almost all of this phase is Claude's: it's the agent core.

### Claude

- [x] **C2.1** `agent/` package with `requirements.txt` and pydantic models. Includes:
  - `db.py` (service role)
  - `llm.py` (provider interface, Gemini + Groq)
  - a config loader for `shared/`
  - a polite HTTP client: robots.txt check, `AGENT_USER_AGENT`, 1 request per second per host, timeouts
  - `agent/settings.py`: env validated with `pydantic-settings` at the start of every run, following the same rules as `lib/env.ts`. Empty strings count as missing; errors name the variable; values are never printed; `.env.local` is loaded when running locally.
    - **Required:**
      - `SUPABASE_URL` (falls back to `NEXT_PUBLIC_SUPABASE_URL`)
      - `SUPABASE_SERVICE_ROLE_KEY`
      - `LLM_PROVIDER`, plus the selected provider's key and model
      - `RESEND_API_KEY`, `RESEND_FROM`
      - `AGENT_USER_AGENT`
    - **Optional with defaults:** `DRAFTS_PER_RUN` (5), `DISCOVERY_PROBES_PER_RUN` (40).
    - The agent doesn't read `DEMO_*` or the GitHub/webhook values.
    - pytest: an empty string counts as missing; the provider switch; errors name the variable; the URL fallback.
- [x] **C2.2** `shared/scoring.json` and `shared/hiring_keywords.json`, starting from ARCHITECTURE.md.
- [x] **C2.3** YC source. **Stop gate:** print the dataset's fields and 3 sample records to the user before writing the ICP filter. If the dataset is unreachable, use the 40-company seed fallback and say so.
- [x] **C2.4** ICP filter with readable `icp_reasons`.
- [x] **C2.5** ATS discovery (Greenhouse, Lever, Ashby) with a probe cap, plus hiring signals with excerpts and job URLs, sales/GTM classification and the founding-role bonus.
- [x] **C2.6** HN launch signals with the strict matching rule; YC recency as a weak funding signal; fingerprints; the `jobs_fetched_at` refresh window.
- [x] **C2.7** Scoring with `score_parts`, filtered reasons, round-robin assignment, contacts, the buyer check, and test-inbox routing (including the fixed bounce/complaint share).
- [x] **C2.8** `main.py`: `agent_runs` and `audit_log` writes, per-step timings, errors captured per step, `--once`, `--dry-run`.
- [x] **C2.9** pytest: scoring, keyword classification, the HN matching rule, fingerprinting, inbox routing.
- [x] **C2.10** `.github/workflows/agent.yml`: schedule `7,37 * * * *`, `workflow_dispatch`, pip cache, secrets, 15-minute timeout.

### Flash

#### F2.1 Extend hiring keywords + classification cases
- **Starts after:** C2.9
- **Build:**
  - How the file works (read `agent/signals.py` `classify_title`): `categories` are checked **in order** (sales, then gtm, then marketing) and the first match wins; `categoryExclude` disqualifies a title from one category only (gtm skips "marketing" titles, so they fall through to marketing); `exclude` drops a title entirely unless it matches `excludeExceptions`; `founding` marks founding/first roles. Phrases match whole words, case-insensitive, with spaces or hyphens between words.
  - Add title variants that real job boards use, e.g. "AE", "account exec", "enterprise account executive", "inside sales", "sales development rep", "head of revenue", "RevOps lead", "growth marketer". Keep the user's marketing scope: senior marketing (Head / VP / Director / Lead / Founding / First), demand generation and growth marketing count; junior roles (coordinator, associate, content writer, social media), product marketing and brand don't.
  - Don't change category order, weights, or move a phrase to another category without saying so in the commit message.
  - Write `agent/tests/test_keywords_extra.py`: at least 30 parametrized `(title, expected_category or None)` cases calling `classify_title(title, load_config("test-org").keywords)` from `agent.signals` / `agent.config`. Import them; don't reimplement them. Include titles that must **not** count.
- **Touch only:** `shared/hiring_keywords.json`, `agent/tests/test_keywords_extra.py`
- **Done when:** `.venv/bin/python -m pytest agent/tests` passes.
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p2-keywords  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  .venv/bin/python -m pytest agent/tests  # must pass before committing (rule 7)
  git add shared/hiring_keywords.json agent/tests/test_keywords_extra.py  # only the Touch-only files
  git commit -m "flash(p2): extend hiring keywords and classification cases"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [x] Built (Flash) · [x] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F2.1.md`, on the card's branch (only exists if Claude asked for changes)

#### F2.2 Extra scoring and ICP test cases
- **Starts after:** C2.9
- **Examples** (computed by the real code; `NOW = datetime(2026, 10, 20, 12, tzinfo=UTC)`, signal ages are "hours before NOW"):

  | Tier | Signals | Score | Ready | Parts, in order | Filtered reason |
  |---|---|---|---|---|---|
  | full | none | 40 | no | ICP match 40 | Score 40, under 50: no buying signals yet |
  | partial | sales hire, 30 days | 50 | **yes** | Partial ICP match 20, Hiring 30 | (none) |
  | partial | launch, 30h | 49 | no | Partial ICP match 20, Launch 18, Fresh (under 2 days) 11 | Score 49, under 50: partial ICP match needs a stronger signal |
  | full | funding "YC Fall 2026", 40 days | 50 | **no** | ICP match 40, YC recent 10 | Score 50: only a weak signal (YC Fall 2026) |
  | full | sales hire 10h + funding 40 days | 102 | yes | ICP match 40, Hiring 30, YC recent 10, Fresh (under 24h) 15, 2 signal types 7 | (none) |
  | partial | sales hire 60h + launch 200h | 83 | yes | Partial ICP match 20, Hiring 30, Launch 18, Fresh (under 3 days) 8, 2 signal types 7 | (none) |
  | full | founding sales hire 80h + launch 300h + funding 40 days | 121 | yes | ICP match 40, Hiring 30, Founding sales role 5, Launch 18, YC recent 10, Fresh (under 7 days) 4, 3 signal types 14 | (none) |
  | full | marketing hire, 30 days | 60 | yes | ICP match 40, Marketing hire 20 | (none) |

  ICP (`evaluate(company, date(2026, 10, 20), cfg.scoring)` with a `YcCompany`):
  - Fintech, tags `["B2B"]`, team 70, Summer 2025 → `partial`, reasons `["Active", "B2B tag, filed under Fintech", "Team of 70, outside 5 to 60", "YC Summer 2025 (within 3 years)"]`
  - same but team 2 → not tracked (`tier` is `None`)
  - industry B2B, subindustry "B2B -> Sales", team 22, Winter 2025 → `full`, reasons `["Active", "B2B industry (Sales)", "Team of 22 (5 to 60)", "YC Winter 2025 (within 3 years)"]`
- **Build:** `agent/tests/test_scoring_extra.py`, one test per row above. Build signals with `SignalFacts(type=..., occurred_at=NOW - timedelta(hours=...), title=..., founding=..., category=...)` (category `"sales"` or `"marketing"` for hiring) and call `score_lead(tier, signals, NOW, load_config("test-org").scoring)` from `agent.scoring`. Assert the score, ready, the parts (labels, points, order) and the reason. Import the existing functions; don't reimplement them.
- **Touch only:** `agent/tests/test_scoring_extra.py`
- **Done when:** `.venv/bin/python -m pytest agent/tests` passes.
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p2-scoring-tests  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  .venv/bin/python -m pytest agent/tests  # must pass before committing (rule 7)
  git add agent/tests/test_scoring_extra.py  # only the Touch-only files
  git commit -m "flash(p2): extra scoring and ICP test cases"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [x] Built (Flash) · [x] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F2.2.md`, on the card's branch (only exists if Claude asked for changes)

#### F2.3 Agent README
- **Starts after:** C2.10
- **Build:** `agent/README.md`. Cover what one tick does (step by step, from `main.py`), each module in one line, how to run it locally (`npm run agent:local`, `npm run agent:local:dry`), which env vars it reads, and the politeness rules. Read the code; don't guess.
  - Include a section **"Why Ashby is checked only on local runs"**: Ashby's public job-board API answers 403 to requests from GitHub's runners, while the same requests from a normal connection get normal answers. So the GitHub workflow sets `AGENT_JOB_BOARDS=greenhouse,lever`, local runs check all three, and each company records which sites were checked and when (`companies.ats_checked`). State plainly that the agent never tries to work around a refusal (no proxies, no other servers, no disguised requests): a site that refuses is skipped for the rest of the run and reported in `agent_runs.errors`.
- **Touch only:** `agent/README.md`
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p2-agent-readme  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  git add agent/README.md  # only the Touch-only files
  git commit -m "flash(p2): agent README"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [x] Built (Flash) · [x] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F2.3.md`, on the card's branch (only exists if Claude asked for changes)

### Phase gate

- [x] **C2.11** Automated checks:
  - `.venv/bin/python -m pytest agent/tests`
  - `.venv/bin/python -m agent.main --dry-run`
  - `.venv/bin/python -m agent.main --once` twice, comparing row counts in `companies`, `signals` and `leads` (the second run must add 0)
  - print one filtered lead's reason

  Report the results to the user.
- [x] **U2.1** On GitHub, go to Actions → agent → "Run workflow". Confirm it finishes green, then run it a second time.
- [x] **U2.2** In the Supabase dashboard (Table Editor), check PLAN.md Phase 2 "Done when". Phase 2 has no app UI, so there's no admin/rep check.
  - `companies`, `signals` and `leads` have real rows, and nothing was duplicated by the second run.
  - Open one lead with `status = filtered` and confirm its `filtered_reason` reads clearly.
  - Tell Claude what passed and what didn't.
- [x] **C2.12** After U2.1 and U2.2 pass: tick PLAN.md Phase 2, add a PROGRESS.md entry, commit.

---

## Phase 3: Workspace UI (read-only)

### Claude

- [ ] **C3.1** Regenerate DB types (`npm run db:types`; first generated in C1.5). Give each list item a `scoreBand` from `shared/scoring.json` `scoreBands` (Strong 90+, Good 70+, Borderline 50+; filtered leads are "Filtered") plus the matching `ScoreBadge` `tier` (Strong → `hi`, Good → `md`, Borderline and Filtered → `lo`); ScoreBadge's built-in 75/50 cutoffs are only a fallback. The score stays a points total (no percentage): the word gives the quick read, the math stays visible. Write `lib/types.ts` with the UI shapes (`LeadListItem`, `LeadDetail`, `SignalView`, `ScorePart`). Write the data functions in `lib/data/leads.ts`: `listLeads({ tab, signalTypes })`, `leadCounts()`, `listFilteredLeads()`, `getLead(id)`. Add `@testing-library/react` and `jsdom` for component tests (reason: to render components in vitest).
- [ ] **C3.2** `useLiveLeads()` hook (Supabase Realtime, falling back to polling). Check RLS by hand: the rep sees only their own leads, even through a direct query.

### Flash

#### F3.1 Lead display components
- **Starts after:** C3.1, F1.2
- **Build:** in `components/leads/`:
  - `SignalCard`: numbered; shows type Tag, title, source, age, excerpt and an external link.
  - `ScoreMath`: renders `ScorePart[]` as "ICP match 40 + Hiring 30 + Fresh 15 = 85" in mono, with the total in a ScoreBadge and the band word next to it ("85 · Good").
  - `StatusPill`: maps each lead status to a Pill tone.
  - `BuyerCheck`: shows verified, rerouted or unverified, plus the reason.

  Props come only from `lib/types.ts`. Add `components/leads/leads.test.tsx` with render tests for ScoreMath (formatting) and StatusPill (every status).
- **Touch only:** `components/leads/*`
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p3-lead-components  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add components/leads  # only the Touch-only files
  git commit -m "flash(p3): lead display components"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F3.1.md`, on the card's branch (only exists if Claude asked for changes)

#### F3.2 Queue page (split view, list side)
- **Starts after:** F3.1, C3.2
- **Build:**
  - `components/queue/QueueList.tsx`: tabs (Ready, Enrolled, Bounced, Replied) with counts from `leadCounts()`; signal filter chips; rows with ScoreBadge, company, contact, top signal and age; a collapsed "N filtered out" section with reasons from `listFilteredLeads()`.
  - `components/queue/SplitView.tsx`: list on the left, detail slot on the right, stacking on mobile.
  - Wire both into `app/(app)/queue/page.tsx`. Use `useLiveLeads()`. The selected lead lives in the URL (`?lead=<id>`).
- **Touch only:** `components/queue/*`, `app/(app)/queue/*`
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p3-queue-list  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add components/queue "app/(app)/queue"  # only the Touch-only files
  git commit -m "flash(p3): queue list and split view"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F3.2.md`, on the card's branch (only exists if Claude asked for changes)

#### F3.3 Lead detail (read-only)
- **Starts after:** F3.2
- **Build:** `components/queue/LeadDetail.tsx`, which takes a `LeadDetail` from `getLead(id)`:
  - a header with company, contact, domain (mono) and StatusPill
  - numbered SignalCards
  - a ScoreMath row
  - a BuyerCheck row

  Render it in the SplitView's detail slot.
- **Touch only:** `components/queue/LeadDetail.tsx`, `app/(app)/queue/*`
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p3-lead-detail  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add components/queue/LeadDetail.tsx "app/(app)/queue"  # only the Touch-only files
  git commit -m "flash(p3): read-only lead detail"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F3.3.md`, on the card's branch (only exists if Claude asked for changes)

#### F3.4 Leads table page
- **Starts after:** F3.1
- **Build:**
  - `components/ui/Table.tsx`: sortable, sticky header, 32px rows.
  - `app/(app)/leads/page.tsx`: columns for company, contact, score, top signal, status, assigned rep and updated, using `listLeads`. Clicking a row opens `/queue?lead=<id>`.
- **Touch only:** `components/ui/Table.tsx`, `components/ui/index.ts`, `app/(app)/leads/*`
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p3-leads-table  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add components/ui/Table.tsx components/ui/index.ts "app/(app)/leads"  # only the Touch-only files
  git commit -m "flash(p3): leads table"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F3.4.md`, on the card's branch (only exists if Claude asked for changes)

#### F3.5 Keyboard, skeletons, empty and error states
- **Starts after:** F3.3, F3.4
- **Build:**
  - `J` / `K` move the selection in the Queue list and the Leads table (ignored while typing in an input).
  - `⌘K` gets "Open next lead" and "Copy company domain" actions for the selected lead.
  - Skeleton rows while loading (`loading.tsx`).
  - An error state that says what failed and what to do (`error.tsx`).
  - Empty states for every tab.
- **Touch only:** `components/queue/*`, `components/command-palette.tsx`, `components/ui/Table.tsx`, `app/(app)/queue/*`, `app/(app)/leads/*`
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p3-keyboard-states  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add components/queue components/command-palette.tsx components/ui/Table.tsx "app/(app)/queue" "app/(app)/leads"  # only the Touch-only files
  git commit -m "flash(p3): keyboard navigation and loading/empty/error states"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F3.5.md`, on the card's branch (only exists if Claude asked for changes)

### Phase gate

- [ ] **C3.3** Automated checks: `npm run check`, plus an RLS script that signs in as the rep and as the admin with the anon key. The rep must get only leads assigned to them; the admin must get all of the org's leads. Report the counts to the user.
- [ ] **U3.1** In the browser, check PLAN.md Phase 3 "Done when":
  - As admin, then as rep: Queue and Leads show different lead sets; the rep sees only their assigned leads.
  - Open a lead: the signal cards, score math and buyer check show real data, and the source links work.
  - With Queue open, run the agent (Actions → Run workflow). New leads appear without a reload.
  - `J` / `K` move the selection; the tabs show counts; the filtered-out section lists reasons.
  - Tell Claude what passed and what didn't.
- [ ] **C3.4** After U3.1 passes: tick PLAN.md Phase 3, add a PROGRESS.md entry, commit.

---

## Phase 4: Drafts and approval (the cut line)

### Claude

- [ ] **C4.1** `shared/prompts/draft.md`, `shared/fixtures/guardrails_cases.json` (input → expected result per check), and a review of `shared/guardrails.json` (created in C1.4 for the mailbox cap).
- [ ] **C4.2** Guardrails in `agent/guardrails.py` and `lib/guardrails.ts`, both reading the same JSON. Includes the grounding check. Both test suites run the shared fixtures and must agree.
- [ ] **C4.3** Agent drafting step: 3 angles plus the raw baseline, JSON output, a cap per run, 429 backoff, tokens stored, prompt hash.
- [ ] **C4.4** `lib/llm.ts`. Routes (zod input + role/ownership check + audit log):
  - `POST /api/leads/[id]/regenerate`: one angle, rate-limited per user.
  - `POST /api/leads/[id]/approve`: re-runs the guardrails on the server; creates `sequences` and `sequence_steps` with idempotency keys.

  Client helpers in `lib/api.ts`: `regenerateDraft(leadId, angle)` and `approveLead(leadId, { draftId, subject, body })`.

### Flash

#### F4.1 Email editor
- **Starts after:** C4.2, C4.4, F3.3
- **Build:** `components/drafts/EmailEditor.tsx`, inside LeadDetail:
  - Angle picker (SegmentedControl). The raw angle is shown as "Unconstrained", flagged in `--bad`, and can never be approved.
  - From / To (read-only, mono), Subject and Body fields.
  - A live checks list that calls `runGuardrails()` from `lib/guardrails.ts` on every change and shows pass, fail or warn per check, naming the grounded phrases that were found.
  - An "Edited" marker once the text differs from the draft.
- **Touch only:** `components/drafts/*`, `components/queue/LeadDetail.tsx`
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p4-email-editor  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add components/drafts components/queue/LeadDetail.tsx  # only the Touch-only files
  git commit -m "flash(p4): email editor with live checks"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F4.1.md`, on the card's branch (only exists if Claude asked for changes)

#### F4.2 Approve, regenerate, agent trace
- **Starts after:** F4.1
- **Build:**
  - "Approve and enroll" button with a `⌘↵` Kbd hint. It is disabled unless every check passes. It calls `approveLead()`, shows the toast "{Company} enrolled", and moves to the next lead.
  - "Regenerate" button calls `regenerateDraft()` and shows a loading state and errors (including the rate limit).
  - Two collapsibles: "Agent trace" (the run steps for this lead) and "Prompt sent to the model".
- **Touch only:** `components/drafts/*`, `components/queue/*`, `components/command-palette.tsx`
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p4-approve-ui  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add components/drafts components/queue components/command-palette.tsx  # only the Touch-only files
  git commit -m "flash(p4): approve, regenerate, agent trace"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F4.2.md`, on the card's branch (only exists if Claude asked for changes)

#### F4.3 More guardrail fixture cases
- **Starts after:** C4.2
- **Build:** add at least 20 cases to `shared/fixtures/guardrails_cases.json`: em-dashes and en-dashes, every banned phrase, word-count edges (80 and 81), a missing closing question, a grounded phrase that appears in the email but not in the signal, a case-insensitive match, and word-boundary traps. Don't change the guardrail code. If Python and TS disagree on a case, stop and report it; that's a bug for Claude.
- **Touch only:** `shared/fixtures/guardrails_cases.json`
- **Done when:** `npm run check` and `.venv/bin/python -m pytest agent/tests` both pass.
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p4-guardrail-cases  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  .venv/bin/python -m pytest agent/tests  # must pass before committing (rule 7)
  git add shared/fixtures/guardrails_cases.json  # only the Touch-only files
  git commit -m "flash(p4): more guardrail fixture cases"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F4.3.md`, on the card's branch (only exists if Claude asked for changes)

### You

- [ ] **U4.1** In Vercel, check that every required variable from `lib/env.ts` is set (same names as `.env.example`). Push `main` and wait for the deploy to go green.

### Phase gate

- [ ] **C4.5** Automated checks:
  - `npm run check` and `.venv/bin/python -m pytest agent/tests`; both guardrail suites must agree on every shared fixture.
  - Route tests: the approve route rejects the `raw` angle and any draft whose grounding check fails.
  - One `--once` run creates drafts for at least one ready lead.

  Report the results to the user.
- [ ] **U4.2** On the live Vercel URL, as admin and then as rep, check PLAN.md Phase 4 "Done when":
  - A lead from the latest run has a draft for each angle.
  - Deleting the signal phrase from the body fails the grounding check and disables "Approve and enroll".
  - The raw angle shows "Unconstrained" and can't be approved.
  - Approving with `⌘↵` shows a toast, opens the next lead, and adds a row to `sequences` (Supabase Table Editor).
  - The rep can approve only their own leads.
  - Tell Claude what passed and what didn't.
- [ ] **C4.6** After U4.2 passes: tick PLAN.md Phase 4, add a PROGRESS.md entry, commit. **Cut line: you can apply from here.**

---

## Phase 4.5: Configurable agent

Rules move into the database per org, versioned. The agent already reads them only through `load_config(org_id)` (`agent/config.py`), so the scoring code doesn't change.

### Claude

- [ ] **C4.5.1** One rules schema for both languages:
  - the schema for the full rule set (ICP rules, partial rules, signal types with `enabled` + weight, keyword categories and exclusions, threshold, weak signal types, score bands, freshness steps, signal windows); format decided in the phase plan. Bands must run high to low and the lowest must equal the threshold.
  - `shared/fixtures/config_cases.json` with valid and invalid rule sets and the expected error per invalid case
  - a TypeScript validator (`lib/agent-config.ts`) and the Python validator (`agent/config.py`) both run the fixtures and must agree
- [ ] **C4.5.2** Migration: `agent_configs` (org_id, version, rules jsonb, created_by, created_at, change_summary jsonb; unique (org_id, version)) plus the org's current version; `leads.config_version`. RLS: every member reads their org's rules; only admins can create a version. Version 1 per org is seeded from `/shared`.
- [ ] **C4.5.3** Agent: `load_config(org_id)` reads the org's current version (falls back to the `/shared` defaults); scoring skips disabled signal types; every scored lead records `config_version`; when the version changed since a lead was scored, the next run re-scores it if it's `ready`/`filtered`, and never changes enrolled or later leads.
- [ ] **C4.5.4** Server: `lib/data/agent-config.ts` (`getCurrentConfig()`, `listConfigVersions()`), and admin-only routes (zod input + role check + audit log): `POST /api/agent-config` (validate, compute a readable change summary, create the next version) and `POST /api/agent-config/revert` (copies an old version into a new one). Client helpers in `lib/api.ts`. Admin guard on `app/(app)/settings/agent/layout.tsx`.
- [ ] **C4.5.5** (Optional) Preview: `previewConfigChange(draft)` returns how many leads would become ready or filtered. Either the scoring formula in TypeScript with parity fixtures shared with Python, or a preview computed by the agent; decided in the phase plan.

### Flash

#### F4.5.1 Admin rules editor
- **Starts after:** C4.5.4, F1.2
- **Build:**
  - `app/(app)/settings/agent/page.tsx` and `components/agent-config/*`: a form with sections for ICP rules (status, team size range, batch age, B2B), partial-match rules, signal types (on/off switch + weight each), keyword lists (add/remove chips per category and exclusion list), threshold, weak signal types, score bands (label + minimum score), and the freshness table.
  - Validate on every change with the shared TypeScript validator from `lib/agent-config.ts` and show each error next to its field. "Save new version" is disabled while there are errors; it calls the save helper from `lib/api.ts` and shows a toast with the new version number.
  - Unsaved changes are highlighted; "Discard changes" restores the current version.
- **Touch only:** `app/(app)/settings/agent/page.tsx`, `components/agent-config/*`
- **Done when:** an admin can change the threshold and save a new version; an invalid value shows its error and blocks saving; `npm run check` passes.
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p45-rules-editor  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add "app/(app)/settings/agent/page.tsx" components/agent-config  # only the Touch-only files
  git commit -m "flash(p4.5): admin rules editor"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F4.5.1.md`, on the card's branch (only exists if Claude asked for changes)

#### F4.5.2 Version history and revert
- **Starts after:** F4.5.1
- **Build:**
  - `components/agent-config/VersionHistory.tsx`, shown on the editor page: one row per version with number, who, when (mono) and the change summary ("Threshold 50 → 55; Launch weight 18 → 20"). The current version is marked.
  - "Revert to this version" asks for confirmation inside the page (no browser dialogs), then calls the revert helper and refreshes.
- **Touch only:** `components/agent-config/*`, `app/(app)/settings/agent/page.tsx`
- **Done when:** history lists every saved version and a revert creates a new version; `npm run check` passes.
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p45-version-history  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add components/agent-config "app/(app)/settings/agent/page.tsx"  # only the Touch-only files
  git commit -m "flash(p4.5): version history and revert"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F4.5.2.md`, on the card's branch (only exists if Claude asked for changes)

#### F4.5.3 "What our agent looks for" page
- **Starts after:** C4.5.4, F1.2
- **Build:**
  - `app/(app)/agent/page.tsx`: a read-only, plain-language view of the current rules for every member, from `getCurrentConfig()`. Example sentences: "We look for active B2B startups with 5 to 60 people from YC batches in the last 3 years." "A sales or GTM hire adds 30 points; a senior marketing hire adds 20." "A lead reaches your queue at 50 points with at least one hiring or launch signal." "90 or more is Strong, 70 or more is Good, 50 or more is Borderline."
  - Show the version number and when it changed. Admins also see an "Edit rules" link to `/settings/agent`.
  - Add the page to the sidebar and the command palette for everyone.
- **Touch only:** `app/(app)/agent/page.tsx`, `components/agent-config/*`, `components/shell/*`, `components/command-palette.tsx`
- **Done when:** a rep sees the rules in plain language and no edit link; `npm run check` passes.
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p45-rules-page  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add "app/(app)/agent" components/agent-config components/shell components/command-palette.tsx  # only the Touch-only files
  git commit -m "flash(p4.5): what our agent looks for page"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F4.5.3.md`, on the card's branch (only exists if Claude asked for changes)

#### F4.5.4 More config fixture cases
- **Starts after:** C4.5.1
- **Build:**
  - Add at least 20 cases to `shared/fixtures/config_cases.json`: negative and swapped team size ranges, a threshold of 0 or above the maximum possible score, an empty keyword category, a duplicate phrase, every signal type disabled, unsorted freshness steps, unknown fields. Don't change either validator. If TypeScript and Python disagree on a case, stop and report it: that's a bug for Claude.
- **Touch only:** `shared/fixtures/config_cases.json`
- **Done when:** `npm run check` and `.venv/bin/python -m pytest agent/tests` both pass.
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p45-config-cases  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  .venv/bin/python -m pytest agent/tests  # must pass before committing (rule 7)
  git add shared/fixtures/config_cases.json  # only the Touch-only files
  git commit -m "flash(p4.5): more config fixture cases"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F4.5.4.md`, on the card's branch (only exists if Claude asked for changes)

#### F4.5.5 (Optional) Change preview panel
- **Starts after:** C4.5.5, F4.5.1
- **Build:**
  - On the editor, a "Preview" button calls the preview helper with the unsaved draft and shows "This would move N leads into the queue and M out of it", with a loading state and an error state.
- **Touch only:** `components/agent-config/*`
- **Done when:** the preview shows counts for an unsaved change; `npm run check` passes.
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p45-preview  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add components/agent-config  # only the Touch-only files
  git commit -m "flash(p4.5): change preview panel"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F4.5.5.md`, on the card's branch (only exists if Claude asked for changes)

### Phase gate

- [ ] **C4.5.6** Automated checks: `npm run check` and `.venv/bin/python -m pytest agent/tests` (both validators agree on every fixture); RLS tests: a rep can read the rules but can't insert a version; an agent run after a threshold change re-scores `ready`/`filtered` leads, records the new `config_version`, and leaves an enrolled lead's score alone. Report the results to the user.
- [ ] **U4.5.1** In the browser, check PLAN.md Phase 4.5 "Done when":
  - As admin: change the threshold (and one weight), save, and see the change in the history with your name.
  - Run the agent (Actions → Run workflow); the queue reflects the new rules, and a lead's detail shows the new version.
  - As rep: the "What our agent looks for" page shows the new rules in plain language; `/settings/agent` shows the 403 page.
  - Tell Claude what passed and what didn't.
- [ ] **C4.5.7** After U4.5.1 passes: tick PLAN.md Phase 4.5, add a PROGRESS.md entry, commit.

---

## Phase 5: Sending, webhooks, deliverability

### Claude

- [ ] **C5.1** **Stop gate:** verify that the Resend sandbox sends to `delivered@`, `bounced@` and `complained@resend.dev`, and list which webhook events each one produces. Report before building anything.
- [ ] **C5.2** Sequence engine: due steps, branch evaluation, mailbox rotation, sends with idempotency keys.
- [ ] **C5.3** `POST /api/webhooks/resend`:
  - signature verification; rejects every request when `RESEND_WEBHOOK_SECRET` isn't set (see C1.1)
  - event storage (unique provider id)
  - step and mailbox updates
  - bounce recovery proposal
  - a reply halts the sequence
- [ ] **C5.4** Deliverability: per-mailbox rates, auto-pause, daily reset, DNS TXT auth lookup.
- [ ] **C5.5** Admin-only routes `POST /api/simulate/{reply,open,fast-forward}`, which use the same handler as real events and store `source = 'simulated'`. Plus `POST /api/leads/[id]/resend` (human-approved bounce recovery). Client helpers in `lib/api.ts`.
- [ ] **C5.6** pytest + vitest: branching, idempotent sends, webhook dedupe, auto-pause thresholds.

### You

- [ ] **U5.1** In Resend, add a webhook pointing to `https://<vercel-url>/api/webhooks/resend`. Put the signing secret into Vercel and `.env.local` as `RESEND_WEBHOOK_SECRET`.

### Flash

#### F5.1 Bounced tab + recovery UI
- **Starts after:** C5.5, F4.2
- **Build:** in LeadDetail for bounced leads, a recovery panel showing the bounce code, the original address, the proposed corrected address (all mono) and the reason, plus a "Resend to corrected address" button. The button calls the resend helper and is never automatic. Add an empty state for the Bounced tab.
- **Touch only:** `components/queue/*`, `components/drafts/*`
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p5-bounce-recovery  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add components/queue components/drafts  # only the Touch-only files
  git commit -m "flash(p5): bounce recovery UI"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F5.1.md`, on the card's branch (only exists if Claude asked for changes)

#### F5.2 Sequence timeline + Sequences page
- **Starts after:** C5.5
- **Build:**
  - `components/sequences/SequenceTimeline.tsx`: steps from ARCHITECTURE.md's sequence table, with status, scheduled time (mono), the branch taken, mailbox and message id. Simulated events carry a "Simulated" Tag.
  - Show the timeline in LeadDetail for enrolled leads.
  - `app/(app)/sequences/page.tsx`: a table of sequences (company, current step, status, next send) using the data function Claude names in C5.5.
- **Touch only:** `components/sequences/*`, `components/queue/LeadDetail.tsx`, `app/(app)/sequences/*`
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p5-sequences-ui  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add components/sequences components/queue/LeadDetail.tsx "app/(app)/sequences"  # only the Touch-only files
  git commit -m "flash(p5): sequence timeline and sequences page"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F5.2.md`, on the card's branch (only exists if Claude asked for changes)

#### F5.3 Simulate controls (admin)
- **Starts after:** F5.2
- **Build:** a "Simulate" menu on enrolled leads with three actions: Simulate reply, Simulate open, Fast-forward to next step. It renders only when `role === 'admin'`, and every action is labeled "Simulated". It calls the C5.5 helpers and refreshes the timeline.
- **Touch only:** `components/sequences/*`, `components/queue/LeadDetail.tsx`
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p5-simulate-ui  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add components/sequences components/queue/LeadDetail.tsx  # only the Touch-only files
  git commit -m "flash(p5): admin simulate controls"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F5.3.md`, on the card's branch (only exists if Claude asked for changes)

### Phase gate

- [ ] **C5.7** Automated checks:
  - `npm run check` and `.venv/bin/python -m pytest agent/tests` (branching, idempotent sends, webhook dedupe, auto-pause).
  - Webhook tests: a bad signature is rejected, and so is any request when `RESEND_WEBHOOK_SECRET` is missing.
  - After one `--once` run, `email_events` holds real Resend events for a `bounced+` and a `complained+` address.

  Report the results to the user.
- [ ] **U5.2** In the browser, check PLAN.md Phase 5 "Done when":
  - As admin: the lead routed to `bounced+…` is in the Bounced tab with the bounce code and a proposed corrected address. Nothing resends until you click "Resend to corrected address".
  - As admin: the mailbox that got the complaint shows a higher complaint rate in Supabase `mailboxes` (Ops shows this from Phase 6).
  - As admin: on an enrolled lead, "Simulate reply" halts the sequence, and the timeline labels it "Simulated".
  - As rep: there's no Simulate menu anywhere.
  - Tell Claude what passed and what didn't.
- [ ] **C5.8** After U5.2 passes: tick PLAN.md Phase 5, add a PROGRESS.md entry, commit.

---

## Phase 6: Ops (admin)

### Claude

- [ ] **C6.1** `lib/data/ops.ts`, admin-only on the server and enforced by RLS, with typed return shapes in `lib/types.ts`:
  - `getKpis()`
  - `getReplyRateBySignal()`
  - `getMailboxHealth()`
  - `getEngineStats()` (p50/p95, leads per run, tokens per lead, error rate, drafts blocked)
  - `getBoardCoverage()`: "Ashby checked for X of Y companies, last local run <time>" (from `companies.ats_checked` and the latest `agent_runs` row with trigger `local`), plus the same for Greenhouse and Lever
  - `listAuditLog({ actorType, action })`

  Simulated-derived numbers carry a `simulated: true` flag.
- [ ] **C6.2** (Optional) `POST /api/agent/run` via GitHub `repository_dispatch`, admin-only, with the token kept on the server. Needs U6.1. The page gets `canRunAgent: true` only when `GITHUB_DISPATCH_TOKEN` and `GITHUB_REPO` are both set (see C1.1).

### You

- [ ] **U6.1** (Optional) Create a fine-grained GitHub token with Actions write access on this repo only, and put it in Vercel as `GITHUB_DISPATCH_TOKEN`.

### Flash

#### F6.1 KPI strip + reply rate by signal
- **Starts after:** C6.1
- **Build:** in `components/ops/`:
  - `KpiStrip`: mono numbers, labels, and a "Simulated" Tag on flagged values.
  - `ReplyRateBySignal`: horizontal bars drawn with plain divs and CSS width (no chart library), with a "Simulated" note when applicable.
- **Touch only:** `components/ops/*`
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p6-kpis  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add components/ops  # only the Touch-only files
  git commit -m "flash(p6): KPI strip and reply rate by signal"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F6.1.md`, on the card's branch (only exists if Claude asked for changes)

#### F6.2 Mailbox health + engine panel + audit log
- **Starts after:** F6.1
- **Build:** in `components/ops/`:
  - `MailboxHealthTable`: auth (SPF, DMARC, DKIM), a sent/cap bar, bounce %, complaint %, and a status Pill with every pause reason.
  - `EnginePanel`: last run, p50/p95, leads per run, tokens per lead, error rate, drafts blocked, and job-board coverage from `getBoardCoverage()` (e.g. "Ashby checked for 120 of 1,060 companies, last local run 2 hours ago", with a note that Ashby is checked only on local runs).
  - `AuditLogStream`: filters for agent/user and action type, mono timestamps.
- **Touch only:** `components/ops/*`
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p6-ops-panels  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add components/ops  # only the Touch-only files
  git commit -m "flash(p6): mailbox health, engine panel, audit log"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F6.2.md`, on the card's branch (only exists if Claude asked for changes)

#### F6.3 Ops page assembly
- **Starts after:** F6.2 (and C6.2, if the "Run agent now" button is wanted)
- **Build:** `app/(app)/ops/page.tsx`. Lay out the five sections in the order DESIGN.md gives, with a skeleton (`loading.tsx`) and an error state. The rep check lives in `proxy.ts` and `app/(app)/ops/layout.tsx`; don't touch them. If C6.2 exists, add a "Run agent now" button that renders only when the page gets `canRunAgent: true`.
- **Touch only:** `app/(app)/ops/*`
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p6-ops-page  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add "app/(app)/ops"  # only the Touch-only files
  git commit -m "flash(p6): ops page"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F6.3.md`, on the card's branch (only exists if Claude asked for changes)

### Phase gate

- [ ] **C6.3** Automated checks:
  - `npm run check`.
  - Tests that every `lib/data/ops.ts` function refuses a rep (server check), and that RLS returns nothing to a rep querying `agent_runs`, `audit_log` and `mailboxes`.
  - Give the user the SQL behind two KPIs so they can spot-check them.

  Report the results to the user.
- [ ] **U6.2** In the browser, check PLAN.md Phase 6 "Done when":
  - As admin: Ops shows the KPI strip, reply rate by signal, mailbox health, the engine panel and the audit log. Numbers derived from simulated events carry a "Simulated" label.
  - Run the two SQL queries from C6.3 in the Supabase SQL editor; the numbers match Ops.
  - The "Run agent now" button starts a workflow run if it's set up, and is hidden if the GitHub variables aren't set.
  - As rep: Ops isn't in the nav, and `/ops` shows the 403 page.
  - Tell Claude what passed and what didn't.
- [ ] **C6.4** After U6.2 passes: tick PLAN.md Phase 6, add a PROGRESS.md entry, commit.

---

## Phase 7: Polish and ship

### Flash

#### F7.1 README + design decisions
- **Starts after:** C6.3
- **Build:** `README.md`. Cover:
  - what it is
  - an architecture diagram (Mermaid)
  - how the agent works
  - what's real and what's simulated, and why
  - how to run it locally
  - demo logins (emails only, never passwords)
  - a "Design decisions" section: no LinkedIn, test inboxes, the grounding check, GitHub Actions scheduling, RLS multi-tenancy

  Take facts from `docs/` and the code only. Write "TODO(verify)" next to anything you are unsure of.
- **Touch only:** `README.md`
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p7-readme  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  git add README.md  # only the Touch-only files
  git commit -m "flash(p7): README and design decisions"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F7.1.md`, on the card's branch (only exists if Claude asked for changes)

#### F7.2 Accessibility, keyboard, mobile, theme pass
- **Starts after:** C6.3
- **Build:** run Lighthouse on Queue, Leads and Ops. Tab through every page. Check every theme and a 400px width. Fix UI-only issues in `components/` and `app/(app)/`. If an issue needs a change outside those folders, list it in your report to the user for Claude, and don't fix it yourself.
- **Touch only:** `components/**`, `app/(app)/**`, `app/themes.css`
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p7-a11y-pass  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  npm run check  # must pass before committing (rule 7)
  git add components "app/(app)" app/themes.css  # only the Touch-only files
  git commit -m "flash(p7): accessibility, keyboard, mobile and theme fixes"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F7.2.md`, on the card's branch (only exists if Claude asked for changes)

#### F7.3 Screenshot captions
- **Starts after:** F7.1
- **Build:** `docs/screenshots.md`, with one short caption per screenshot the user provides. Use plain, active voice.
- **Touch only:** `docs/screenshots.md`
- **Start:**
  ```bash
  git status --short  # must print nothing; if it does, stop and tell the user
  git switch main  # stand on the latest main (no commits ever happen here)
  git switch -c flash/p7-captions  # create this card's own branch and move onto it
  ```
- **Finish:**
  ```bash
  git add docs/screenshots.md  # only the Touch-only files
  git commit -m "flash(p7): screenshot captions"  # commits to the card's branch, not main
  git switch main  # step off the branch; the commit stays on it for Claude to review
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** `docs/reviews/F7.3.md`, on the card's branch (only exists if Claude asked for changes)

### Claude

- [ ] **C7.1** `npm run seed:reset` for a clean demo state. It is destructive, so it asks for confirmation and only targets the demo org.
- [ ] **C7.2** Check every claim in the README against the code (part of the F7.1 review).
### Phase gate

- [ ] **C7.3** Automated checks:
  - `npm run check`, `.venv/bin/python -m pytest agent/tests` and `npm run build`.
  - The latest Vercel deploy and the latest Actions run are both green.
  - With the user's OK, run `npm run seed:reset` so the demo starts clean.

  Report the results to the user.
- [ ] **U7.1** On the live URL, check PLAN.md Phase 7:
  - As admin and as rep: log in with the demo buttons; every page loads with no console errors.
  - Switch through every theme, and check one page at phone width; nothing overflows sideways.
  - Read the README top to bottom; the demo logins it describes work.
  - Tell Claude what passed and what didn't.
- [ ] **C7.4** After U7.1 passes: tick PLAN.md Phase 7, add a PROGRESS.md entry, commit.
- [ ] **U7.2** Record the walkthrough video.
