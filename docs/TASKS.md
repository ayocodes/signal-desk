# Tasks

The working checklist for every phase, split by owner. `docs/PLAN.md` says **what** each phase delivers; this file says **who builds which part, in what order**, and how work moves between tools.

## Who does what

| Owner | Tool | Builds | Where |
|---|---|---|---|
| **Claude** | Claude Code (terminal) | The risky parts: schema, RLS, auth, the agent core, scoring, guardrails and grounding, sends, webhooks, deliverability, API routes, data access functions. Also the typed contracts (props, data shapes, helper functions) that Flash builds on, and the tests for its own risky code. | Commits straight to `main` |
| **Flash** | Gemini Flash in Antigravity | Everything else: UI components, pages, themes, empty states, keyboard UX, other tests (UI, contrast, extra cases), docs. | One branch per card, `flash/p<phase>-<slug>` |
| **You** | Browser and terminal | Accounts, keys, dashboards, deploy settings, the demo video, and deciding when a phase is finished. | — |

Claude reviews every Flash card before it is merged into `main`. A card counts as done only when both boxes are ticked.

**Pattern used throughout:** Claude first builds a working but plain version with typed props (for example a bare login form or a bare shell). Flash then makes it match `docs/DESIGN.md` **without changing the props or the server calls**. This way Flash never touches auth, data or secrets.

## Rules for Flash (every card)

1. Do one card at a time. Before starting, read `AGENTS.md`, `docs/DESIGN.md` and the card.
2. Run the card's **Start** git commands exactly as written. If `git status --short` prints anything, stop and tell the user. Don't stash it or clean it up.
3. Change only the files listed under **Touch only**. If the card can't be done without touching another file, stop and say which file and why.
4. Never add a dependency (`npm install`, `pip install`). If you need one, stop and tell the user.
5. Never touch `.env*`, `supabase/`, `middleware.ts`, `lib/supabase/`, `app/api/`, or anything under `agent/` other than test files your card names.
6. No raw hex colors outside `app/themes.css`. No em-dashes or en-dashes in UI copy. No `any`. No empty `catch {}`.
7. When finished, tick **Built (Flash)** on the card, then run the card's **Finish** commands exactly. Report the branch name to the user and stop.
8. **Rework:** if the card has review notes, run `git switch <branch>` from the card, fix every note, then run the same Finish commands with the commit message `flash(pN): address review on <slug>`.

**Prompt to paste into Antigravity** (change the card id):

```
Read AGENTS.md, docs/DESIGN.md, and card F1.1 in docs/TASKS.md. Do only that card.
Run its Start git commands first, exactly as written. Change only the files under "Touch only".
When done, tick "Built (Flash)" on the card, run its Finish commands exactly, then stop and tell me the branch name.
```

## How Claude reviews a Flash card

Always check which branch is checked out before anything else.

```bash
git branch --show-current                        # 1. where am I? (expect main)
git status --short                               # 2. must be empty; if not, stop and ask the user
git switch main                                  # 3. review from main
git log --oneline main..flash/p1-themes          # 4. what Flash committed
git diff --stat main...flash/p1-themes           # 5. files touched must be inside the card's "Touch only"
git diff main...flash/p1-themes                  # 6. read every line
git switch flash/p1-themes && npm run check; git switch main   # 7. checks on Flash's code, then back to main
git branch --show-current                        # 8. confirm main before merging
```

**Review checklist:** touched files are within "Touch only"; props and server calls are unchanged; design tokens only; no new dependencies; no secrets or service-role imports in client code; no em-dashes or en-dashes; empty, loading and error states are present where the card asks for them; types are strict; `npm run check` passes.

**Accept:**

```bash
git merge --no-ff flash/p1-themes -m "Merge F1.1: <card title>"
# tick "Reviewed and merged (Claude)" on the card, then:
git add docs/TASKS.md && git commit -m "Review F1.1: merged"
git branch -d flash/p1-themes
```

Small fixes (a typo, a missing token): merge first, then fix on `main` in a separate commit that says what changed.

**Request changes:**

```bash
git switch flash/p1-themes
# write numbered notes under "Review notes" on the card
git add docs/TASKS.md && git commit -m "review: F1.1 changes requested"
git switch main
git branch --show-current                        # confirm main
```

Then tell the user the card is ready for Flash to rework.

**Card ids:** `U` = you, `C` = Claude, `F` = Flash. Within a phase, work top to bottom. A Flash card may start only when everything in its **Starts after** line is ticked on `main`.

---

## Phase 0: Setup

- [x] **U0.1** SETUP.md sections 0 to 3 (tools, GitHub, Supabase, Gemini)
- [ ] **U0.2** SETUP.md section 4, Resend: the key is already in `.env.local`. Confirm it has sending access, then tick it in SETUP.md.
- [ ] **U0.3** Fill in the rest of `.env.local` from `.env.example`. Still missing: `LLM_PROVIDER`, `RESEND_FROM`, `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD`, `DEMO_REP_EMAIL`, `DEMO_REP_PASSWORD`, `AGENT_USER_AGENT` (put your contact email in it), `DRAFTS_PER_RUN`, `DISCOVERY_PROBES_PER_RUN`.
- [ ] **U0.4** SETUP.md section 5, Vercel: import the repo and add env vars. A failed first build is expected.
- [ ] **U0.5** SETUP.md section 7, GitHub Actions secrets. These are needed before Phase 2's first Actions run.
- [x] **C0.1** Add `.gitignore` (`.env*` except `.env.example`, `supabase/.temp/`) and make the first commit on `main`
- [ ] **U0.6** Push `main`: `git push -u origin main`, then check that the repo is public on GitHub

---

## Phase 1: Foundation

### Claude

- [ ] **C1.1** Scaffold Next.js (App Router, TS strict, Tailwind v4, ESLint) into the repo without overwriting kit files. Install `@supabase/ssr`, `@supabase/supabase-js`, `zod`, `geist`, `lucide-react`, `cmdk`, `vitest`. Add the `npm run check` script and `lib/brand.ts`.
- [ ] **C1.2** Migration 001: every table, enum, index and unique constraint from ARCHITECTURE.md.
- [ ] **C1.3** Migration 002: RLS on every table, plus helper functions for the current user's org and role. Add `npm run test:rls`: signing in as the rep, a query on `mailboxes` must return 0 rows.
- [ ] **C1.4** `npm run seed`: the Demo workspace org, admin and rep users via the admin API, matching `profiles` rows, and 4 mailboxes.
- [ ] **C1.5** Auth:
  - Supabase clients in `lib/supabase/`, plus `lib/auth.ts` (`getProfile`, `requireAdmin`).
  - `middleware.ts`: unauthenticated users go to `/login`; `/ops` returns 403 for reps.
  - Server actions `signIn`, `signOut`, `signInAsDemo(role)`. Demo passwords stay on the server and are never sent to the browser.
  - A **bare** login form and a **bare** app shell with typed props: `AppShell({ profile: { fullName, email, role }, children })`.
- [ ] **C1.6** Theme plumbing:
  - `lib/themes.ts`: ids `paper | mist | graphite | midnight | forest | high-contrast | system`, labels, and the system mapping.
  - `app/themes.css` with the token structure and the **Paper** block only.
  - Tailwind `@theme inline` mapping, Geist fonts, and the no-flash script in the root layout.
  - `applyTheme(id)` and `saveTheme(id)` (writes `profiles.theme` and `localStorage`).

### Flash

#### F1.1 Five remaining themes + contrast test
- **Starts after:** C1.6
- **Build:**
  - Add `[data-theme]` blocks for `mist`, `graphite`, `midnight`, `forest` and `high-contrast` to `app/themes.css`. Copy the Paper block's structure and take the values from the DESIGN.md token table. Every token must appear in every block.
  - Write `lib/themes.test.ts`. It parses `app/themes.css` and, for every theme, asserts a WCAG contrast of at least 4.5:1 for these pairs: `--text` on `--bg`, `--text` on `--surface`, `--text-muted` on `--bg`, and `--accent-fg` on `--accent`. A failure message names the theme and the token pair.
  - If a theme fails, adjust that theme's value (stay close to the original) and say which one you changed in the commit message.
- **Touch only:** `app/themes.css`, `lib/themes.test.ts`, `docs/TASKS.md`
- **Done when:** `npm run check` passes, and setting `data-theme` on `<html>` in devtools recolors the whole page for each theme.
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p1-themes
  ```
- **Finish:**
  ```bash
  npm run check
  git add app/themes.css lib/themes.test.ts docs/TASKS.md
  git commit -m "flash(p1): five themes and contrast test"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F1.2 UI primitives
- **Starts after:** C1.6
- **Build:** one file per component in `components/ui/`: Button (primary, secondary, ghost, danger), Input, Textarea, Kbd, Pill (good, warn, bad, neutral), Tag (signal type), ScoreBadge (hi, md, lo), Tabs (with count), SegmentedControl, Panel, EmptyState (icon, title, body, optional action), Avatar (initials), Skeleton (row), Toast (with a small `useToast` hook). Use the sizes, radii and row heights from DESIGN.md. Use `lucide-react` icons only. Every interactive element gets a visible `:focus-visible` ring in `--accent`.
- **Touch only:** `components/ui/*`, `docs/TASKS.md`
- **Done when:** `npm run check` passes, and each component is typed and exported from `components/ui/index.ts`.
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p1-ui-primitives
  ```
- **Finish:**
  ```bash
  npm run check
  git add components/ui docs/TASKS.md
  git commit -m "flash(p1): UI primitives"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F1.3 Designed app shell
- **Starts after:** C1.5, F1.2
- **Build:** restyle the bare `AppShell` into the shell from DESIGN.md "Layout".
  - Sidebar: 240px, collapsible to icons. Workspace name from `lib/brand.ts`. Nav: Queue, Leads, Sequences, Ops (only when `role === 'admin'`), Settings.
  - Top bar: page title slot and a `⌘K` hint.
  - User menu: Avatar, name, role badge Pill, and a Sign out item that calls the existing `signOut` action.
  - On mobile the sidebar becomes a sheet, and nothing overflows sideways at 400px.
  - Keep `AppShell`'s props and the `signOut` import exactly as they are.
- **Touch only:** `components/shell/*`, `docs/TASKS.md`
- **Done when:** the admin sees Ops in the nav, the rep doesn't, sign out works, and `npm run check` passes.
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p1-shell
  ```
- **Finish:**
  ```bash
  npm run check
  git add components/shell docs/TASKS.md
  git commit -m "flash(p1): designed app shell"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F1.4 Login page design + 403 page
- **Starts after:** C1.5, F1.2
- **Build:**
  - Restyle `app/(auth)/login/page.tsx`: email + password form, error message slot, and two buttons, "Use demo admin" and "Use demo rep", that call the existing `signInAsDemo('admin' | 'rep')` action. Keep all action imports and form field names unchanged.
  - Create `components/forbidden.tsx`: a permission-denied state with a short explanation and a link back to Queue.
- **Touch only:** `app/(auth)/login/page.tsx`, `components/forbidden.tsx`, `docs/TASKS.md`
- **Done when:** both demo buttons log in, a wrong password shows an error, and `npm run check` passes.
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p1-login
  ```
- **Finish:**
  ```bash
  npm run check
  git add "app/(auth)/login/page.tsx" components/forbidden.tsx docs/TASKS.md
  git commit -m "flash(p1): login page design and 403 page"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F1.5 Placeholder pages with empty states
- **Starts after:** F1.3
- **Build:** `page.tsx` for Queue, Leads, Sequences, Ops and Settings under `app/(app)/`. Each one gets a page title and an EmptyState that says what will appear there and how. Example for Queue: "Leads appear here after the agent's next run, every 30 minutes." For Ops, render `components/forbidden.tsx` when the profile is a rep, using `getProfile()` from `lib/auth.ts`. Don't edit `lib/auth.ts`.
- **Touch only:** `app/(app)/queue/page.tsx`, `app/(app)/leads/page.tsx`, `app/(app)/sequences/page.tsx`, `app/(app)/ops/page.tsx`, `app/(app)/settings/page.tsx`, `docs/TASKS.md`
- **Done when:** every nav link opens a designed page, and `npm run check` passes.
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p1-placeholder-pages
  ```
- **Finish:**
  ```bash
  npm run check
  git add "app/(app)" docs/TASKS.md
  git commit -m "flash(p1): placeholder pages with empty states"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F1.6 Command palette + theme picker
- **Starts after:** F1.1, F1.3, F1.5
- **Build:**
  - `components/command-palette.tsx` using `cmdk`, opened with `⌘K` / `Ctrl+K`. Commands: go to each page (role-aware, so no Ops for reps), "Change theme…", and "Sign out" (existing `signOut` action).
  - "Change theme…" opens a list. Arrow keys call `applyTheme(id)` for a live preview, Enter calls `saveTheme(id)`, and Esc reverts to the theme that was active before.
  - `components/theme-picker.tsx`: the same list as a SegmentedControl or radio list for the Settings page. Add it to `app/(app)/settings/page.tsx`.
  - Mount the palette inside `components/shell/`.
- **Touch only:** `components/command-palette.tsx`, `components/theme-picker.tsx`, `components/shell/*`, `app/(app)/settings/page.tsx`, `docs/TASKS.md`
- **Done when:** the theme previews live while arrowing, survives a reload, Esc reverts it, and `npm run check` passes.
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p1-command-palette
  ```
- **Finish:**
  ```bash
  npm run check
  git add components/command-palette.tsx components/theme-picker.tsx components/shell "app/(app)/settings/page.tsx" docs/TASKS.md
  git commit -m "flash(p1): command palette and theme picker"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

### Phase gate

- [ ] **C1.7** Check every "Done when" in PLAN.md Phase 1 by hand, logged in as admin and as rep. Run `npm run test:rls`. Tick PLAN.md, add an entry to PROGRESS.md, commit.

---

## Phase 2: The agent

Almost all of this phase is Claude's: it's the agent core.

### Claude

- [ ] **C2.1** `agent/` package with `requirements.txt` and pydantic models. Includes:
  - `db.py` (service role)
  - `llm.py` (provider interface, Gemini + Groq)
  - a config loader for `shared/`
  - a polite HTTP client: robots.txt check, `AGENT_USER_AGENT`, 1 request per second per host, timeouts
- [ ] **C2.2** `shared/scoring.json` and `shared/hiring_keywords.json`, starting from ARCHITECTURE.md.
- [ ] **C2.3** YC source. **Stop gate:** print the dataset's fields and 3 sample records to the user before writing the ICP filter. If the dataset is unreachable, use the 40-company seed fallback and say so.
- [ ] **C2.4** ICP filter with readable `icp_reasons`.
- [ ] **C2.5** ATS discovery (Greenhouse, Lever, Ashby) with a probe cap, plus hiring signals with excerpts and job URLs, sales/GTM classification and the founding-role bonus.
- [ ] **C2.6** HN launch signals with the strict matching rule; YC recency as a weak funding signal; fingerprints; the `jobs_fetched_at` refresh window.
- [ ] **C2.7** Scoring with `score_parts`, filtered reasons, round-robin assignment, contacts, the buyer check, and test-inbox routing (including the fixed bounce/complaint share).
- [ ] **C2.8** `main.py`: `agent_runs` and `audit_log` writes, per-step timings, errors captured per step, `--once`, `--dry-run`.
- [ ] **C2.9** pytest: scoring, keyword classification, the HN matching rule, fingerprinting, inbox routing.
- [ ] **C2.10** `.github/workflows/agent.yml`: schedule `7,37 * * * *`, `workflow_dispatch`, pip cache, secrets, 15-minute timeout.

### Flash

#### F2.1 Extend hiring keywords + classification cases
- **Starts after:** C2.9
- **Build:**
  - Add sales/GTM title variants to `shared/hiring_keywords.json`: account executive, SDR/BDR, sales lead, head of growth, GTM engineer, revenue ops, founding AE, and so on. Add exclusions that must **not** count, such as "sales engineer" if Claude's notes say so, and "salesforce developer".
  - Write `agent/tests/test_keywords_extra.py`: at least 30 parametrized `(title, expected_category)` cases that call the existing classifier. Import it; don't reimplement it.
- **Touch only:** `shared/hiring_keywords.json`, `agent/tests/test_keywords_extra.py`, `docs/TASKS.md`
- **Done when:** `python -m pytest agent/tests` passes.
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p2-keywords
  ```
- **Finish:**
  ```bash
  python -m pytest agent/tests
  git add shared/hiring_keywords.json agent/tests/test_keywords_extra.py docs/TASKS.md
  git commit -m "flash(p2): extend hiring keywords and classification cases"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F2.2 Extra scoring and ICP test cases
- **Starts after:** C2.9
- **Build:** `agent/tests/test_scoring_extra.py`, using the example companies and signals Claude lists in this card's notes before it starts. Assert the total score, the `score_parts` labels and order, and the filtered reason text. Import the existing functions.
- **Touch only:** `agent/tests/test_scoring_extra.py`, `docs/TASKS.md`
- **Done when:** `python -m pytest agent/tests` passes.
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p2-scoring-tests
  ```
- **Finish:**
  ```bash
  python -m pytest agent/tests
  git add agent/tests/test_scoring_extra.py docs/TASKS.md
  git commit -m "flash(p2): extra scoring and ICP test cases"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F2.3 Agent README
- **Starts after:** C2.10
- **Build:** `agent/README.md`. Cover what one tick does (step by step, from `main.py`), each module in one line, how to run `--once` and `--dry-run` locally, which env vars it reads, and the politeness rules. Read the code; don't guess.
- **Touch only:** `agent/README.md`, `docs/TASKS.md`
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p2-agent-readme
  ```
- **Finish:**
  ```bash
  git add agent/README.md docs/TASKS.md
  git commit -m "flash(p2): agent README"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

### You

- [ ] **U2.1** Run the workflow from the Actions tab (Run workflow) and confirm it finishes green. Run it a second time.

### Phase gate

- [ ] **C2.11** Check PLAN.md Phase 2 "Done when": real rows exist, the second run adds no duplicates, and at least one filtered lead has a readable reason. Tick PLAN.md, add a PROGRESS.md entry, commit.

---

## Phase 3: Workspace UI (read-only)

### Claude

- [ ] **C3.1** Generate DB types into `lib/database.types.ts`. Write `lib/types.ts` with the UI shapes (`LeadListItem`, `LeadDetail`, `SignalView`, `ScorePart`). Write the data functions in `lib/data/leads.ts`: `listLeads({ tab, signalTypes })`, `leadCounts()`, `listFilteredLeads()`, `getLead(id)`. Add `@testing-library/react` and `jsdom` for component tests (reason: to render components in vitest).
- [ ] **C3.2** `useLiveLeads()` hook (Supabase Realtime, falling back to polling). Check RLS by hand: the rep sees only their own leads, even through a direct query.

### Flash

#### F3.1 Lead display components
- **Starts after:** C3.1, F1.2
- **Build:** in `components/leads/`:
  - `SignalCard`: numbered; shows type Tag, title, source, age, excerpt and an external link.
  - `ScoreMath`: renders `ScorePart[]` as "ICP match 40 + Hiring 30 + Fresh 15 = 85" in mono, with the total in a ScoreBadge.
  - `StatusPill`: maps each lead status to a Pill tone.
  - `BuyerCheck`: shows verified, rerouted or unverified, plus the reason.

  Props come only from `lib/types.ts`. Add `components/leads/leads.test.tsx` with render tests for ScoreMath (formatting) and StatusPill (every status).
- **Touch only:** `components/leads/*`, `docs/TASKS.md`
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p3-lead-components
  ```
- **Finish:**
  ```bash
  npm run check
  git add components/leads docs/TASKS.md
  git commit -m "flash(p3): lead display components"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F3.2 Queue page (split view, list side)
- **Starts after:** F3.1, C3.2
- **Build:**
  - `components/queue/QueueList.tsx`: tabs (Ready, Enrolled, Bounced, Replied) with counts from `leadCounts()`; signal filter chips; rows with ScoreBadge, company, contact, top signal and age; a collapsed "N filtered out" section with reasons from `listFilteredLeads()`.
  - `components/queue/SplitView.tsx`: list on the left, detail slot on the right, stacking on mobile.
  - Wire both into `app/(app)/queue/page.tsx`. Use `useLiveLeads()`. The selected lead lives in the URL (`?lead=<id>`).
- **Touch only:** `components/queue/*`, `app/(app)/queue/*`, `docs/TASKS.md`
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p3-queue-list
  ```
- **Finish:**
  ```bash
  npm run check
  git add components/queue "app/(app)/queue" docs/TASKS.md
  git commit -m "flash(p3): queue list and split view"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F3.3 Lead detail (read-only)
- **Starts after:** F3.2
- **Build:** `components/queue/LeadDetail.tsx`, which takes a `LeadDetail` from `getLead(id)`:
  - a header with company, contact, domain (mono) and StatusPill
  - numbered SignalCards
  - a ScoreMath row
  - a BuyerCheck row

  Render it in the SplitView's detail slot.
- **Touch only:** `components/queue/LeadDetail.tsx`, `app/(app)/queue/*`, `docs/TASKS.md`
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p3-lead-detail
  ```
- **Finish:**
  ```bash
  npm run check
  git add components/queue/LeadDetail.tsx "app/(app)/queue" docs/TASKS.md
  git commit -m "flash(p3): read-only lead detail"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F3.4 Leads table page
- **Starts after:** F3.1
- **Build:**
  - `components/ui/Table.tsx`: sortable, sticky header, 32px rows.
  - `app/(app)/leads/page.tsx`: columns for company, contact, score, top signal, status, assigned rep and updated, using `listLeads`. Clicking a row opens `/queue?lead=<id>`.
- **Touch only:** `components/ui/Table.tsx`, `components/ui/index.ts`, `app/(app)/leads/*`, `docs/TASKS.md`
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p3-leads-table
  ```
- **Finish:**
  ```bash
  npm run check
  git add components/ui/Table.tsx components/ui/index.ts "app/(app)/leads" docs/TASKS.md
  git commit -m "flash(p3): leads table"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F3.5 Keyboard, skeletons, empty and error states
- **Starts after:** F3.3, F3.4
- **Build:**
  - `J` / `K` move the selection in the Queue list and the Leads table (ignored while typing in an input).
  - `⌘K` gets "Open next lead" and "Copy company domain" actions for the selected lead.
  - Skeleton rows while loading (`loading.tsx`).
  - An error state that says what failed and what to do (`error.tsx`).
  - Empty states for every tab.
- **Touch only:** `components/queue/*`, `components/command-palette.tsx`, `components/ui/Table.tsx`, `app/(app)/queue/*`, `app/(app)/leads/*`, `docs/TASKS.md`
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p3-keyboard-states
  ```
- **Finish:**
  ```bash
  npm run check
  git add components/queue components/command-palette.tsx components/ui/Table.tsx "app/(app)/queue" "app/(app)/leads" docs/TASKS.md
  git commit -m "flash(p3): keyboard navigation and loading/empty/error states"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

### Phase gate

- [ ] **C3.3** Admin and rep see different lead sets, everything on screen comes from the DB, and a new agent run shows up without a reload. Tick PLAN.md, add a PROGRESS.md entry, commit.

---

## Phase 4: Drafts and approval (the cut line)

### Claude

- [ ] **C4.1** `shared/prompts/draft.md`, `shared/guardrails.json`, and `shared/fixtures/guardrails_cases.json` (input → expected result per check).
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
- **Touch only:** `components/drafts/*`, `components/queue/LeadDetail.tsx`, `docs/TASKS.md`
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p4-email-editor
  ```
- **Finish:**
  ```bash
  npm run check
  git add components/drafts components/queue/LeadDetail.tsx docs/TASKS.md
  git commit -m "flash(p4): email editor with live checks"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F4.2 Approve, regenerate, agent trace
- **Starts after:** F4.1
- **Build:**
  - "Approve and enroll" button with a `⌘↵` Kbd hint. It is disabled unless every check passes. It calls `approveLead()`, shows the toast "{Company} enrolled", and moves to the next lead.
  - "Regenerate" button calls `regenerateDraft()` and shows a loading state and errors (including the rate limit).
  - Two collapsibles: "Agent trace" (the run steps for this lead) and "Prompt sent to the model".
- **Touch only:** `components/drafts/*`, `components/queue/*`, `components/command-palette.tsx`, `docs/TASKS.md`
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p4-approve-ui
  ```
- **Finish:**
  ```bash
  npm run check
  git add components/drafts components/queue components/command-palette.tsx docs/TASKS.md
  git commit -m "flash(p4): approve, regenerate, agent trace"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F4.3 More guardrail fixture cases
- **Starts after:** C4.2
- **Build:** add at least 20 cases to `shared/fixtures/guardrails_cases.json`: em-dashes and en-dashes, every banned phrase, word-count edges (80 and 81), a missing closing question, a grounded phrase that appears in the email but not in the signal, a case-insensitive match, and word-boundary traps. Don't change the guardrail code. If Python and TS disagree on a case, stop and report it; that's a bug for Claude.
- **Touch only:** `shared/fixtures/guardrails_cases.json`, `docs/TASKS.md`
- **Done when:** `npm run check` and `python -m pytest agent/tests` both pass.
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p4-guardrail-cases
  ```
- **Finish:**
  ```bash
  npm run check
  python -m pytest agent/tests
  git add shared/fixtures/guardrails_cases.json docs/TASKS.md
  git commit -m "flash(p4): more guardrail fixture cases"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

### You + Claude

- [ ] **U4.1** In Vercel, add the env vars, deploy, and log in with both demo accounts on the live URL.
- [ ] **C4.5** Phase gate: a new lead gets drafts on the next run; deleting the signal phrase disables Approve; Approve creates a sequence row; raw is blocked. Tick PLAN.md, add a PROGRESS.md entry, commit. **Cut line: you can apply from here.**

---

## Phase 5: Sending, webhooks, deliverability

### Claude

- [ ] **C5.1** **Stop gate:** verify that the Resend sandbox sends to `delivered@`, `bounced@` and `complained@resend.dev`, and list which webhook events each one produces. Report before building anything.
- [ ] **C5.2** Sequence engine: due steps, branch evaluation, mailbox rotation, sends with idempotency keys.
- [ ] **C5.3** `POST /api/webhooks/resend`:
  - signature verification
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
- **Touch only:** `components/queue/*`, `components/drafts/*`, `docs/TASKS.md`
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p5-bounce-recovery
  ```
- **Finish:**
  ```bash
  npm run check
  git add components/queue components/drafts docs/TASKS.md
  git commit -m "flash(p5): bounce recovery UI"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F5.2 Sequence timeline + Sequences page
- **Starts after:** C5.5
- **Build:**
  - `components/sequences/SequenceTimeline.tsx`: steps from ARCHITECTURE.md's sequence table, with status, scheduled time (mono), the branch taken, mailbox and message id. Simulated events carry a "Simulated" Tag.
  - Show the timeline in LeadDetail for enrolled leads.
  - `app/(app)/sequences/page.tsx`: a table of sequences (company, current step, status, next send) using the data function Claude names in C5.5.
- **Touch only:** `components/sequences/*`, `components/queue/LeadDetail.tsx`, `app/(app)/sequences/*`, `docs/TASKS.md`
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p5-sequences-ui
  ```
- **Finish:**
  ```bash
  npm run check
  git add components/sequences components/queue/LeadDetail.tsx "app/(app)/sequences" docs/TASKS.md
  git commit -m "flash(p5): sequence timeline and sequences page"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F5.3 Simulate controls (admin)
- **Starts after:** F5.2
- **Build:** a "Simulate" menu on enrolled leads with three actions: Simulate reply, Simulate open, Fast-forward to next step. It renders only when `role === 'admin'`, and every action is labeled "Simulated". It calls the C5.5 helpers and refreshes the timeline.
- **Touch only:** `components/sequences/*`, `components/queue/LeadDetail.tsx`, `docs/TASKS.md`
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p5-simulate-ui
  ```
- **Finish:**
  ```bash
  npm run check
  git add components/sequences components/queue/LeadDetail.tsx docs/TASKS.md
  git commit -m "flash(p5): admin simulate controls"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

### Phase gate

- [ ] **C5.7** A `bounced+` lead produces a real webhook and lands in Bounced with a recovery proposal; a complaint pushes a mailbox toward pause; a simulated reply halts a sequence. Tick PLAN.md, add a PROGRESS.md entry, commit.

---

## Phase 6: Ops (admin)

### Claude

- [ ] **C6.1** `lib/data/ops.ts`, admin-only on the server and enforced by RLS, with typed return shapes in `lib/types.ts`:
  - `getKpis()`
  - `getReplyRateBySignal()`
  - `getMailboxHealth()`
  - `getEngineStats()` (p50/p95, leads per run, tokens per lead, error rate, drafts blocked)
  - `listAuditLog({ actorType, action })`

  Simulated-derived numbers carry a `simulated: true` flag.
- [ ] **C6.2** (Optional) `POST /api/agent/run` via GitHub `repository_dispatch`, admin-only, with the token kept on the server. Needs U6.1.

### You

- [ ] **U6.1** (Optional) Create a fine-grained GitHub token with Actions write access on this repo only, and put it in Vercel as `GITHUB_DISPATCH_TOKEN`.

### Flash

#### F6.1 KPI strip + reply rate by signal
- **Starts after:** C6.1
- **Build:** in `components/ops/`:
  - `KpiStrip`: mono numbers, labels, and a "Simulated" Tag on flagged values.
  - `ReplyRateBySignal`: horizontal bars drawn with plain divs and CSS width (no chart library), with a "Simulated" note when applicable.
- **Touch only:** `components/ops/*`, `docs/TASKS.md`
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p6-kpis
  ```
- **Finish:**
  ```bash
  npm run check
  git add components/ops docs/TASKS.md
  git commit -m "flash(p6): KPI strip and reply rate by signal"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F6.2 Mailbox health + engine panel + audit log
- **Starts after:** F6.1
- **Build:** in `components/ops/`:
  - `MailboxHealthTable`: auth (SPF, DMARC, DKIM), a sent/cap bar, bounce %, complaint %, and a status Pill with every pause reason.
  - `EnginePanel`: last run, p50/p95, leads per run, tokens per lead, error rate, drafts blocked.
  - `AuditLogStream`: filters for agent/user and action type, mono timestamps.
- **Touch only:** `components/ops/*`, `docs/TASKS.md`
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p6-ops-panels
  ```
- **Finish:**
  ```bash
  npm run check
  git add components/ops docs/TASKS.md
  git commit -m "flash(p6): mailbox health, engine panel, audit log"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F6.3 Ops page assembly
- **Starts after:** F6.2 (and C6.2, if the "Run agent now" button is wanted)
- **Build:** `app/(app)/ops/page.tsx`. Lay out the five sections in the order DESIGN.md gives, with a skeleton (`loading.tsx`) and an error state. Keep the existing rep check that renders `forbidden.tsx`. If C6.2 exists, add a "Run agent now" button.
- **Touch only:** `app/(app)/ops/*`, `docs/TASKS.md`
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p6-ops-page
  ```
- **Finish:**
  ```bash
  npm run check
  git add "app/(app)/ops" docs/TASKS.md
  git commit -m "flash(p6): ops page"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

### Phase gate

- [ ] **C6.3** Every number traces back to a query; a rep gets 403 from the page, the data functions and RLS. Tick PLAN.md, add a PROGRESS.md entry, commit.

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
- **Touch only:** `README.md`, `docs/TASKS.md`
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p7-readme
  ```
- **Finish:**
  ```bash
  git add README.md docs/TASKS.md
  git commit -m "flash(p7): README and design decisions"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F7.2 Accessibility, keyboard, mobile, theme pass
- **Starts after:** C6.3
- **Build:** run Lighthouse on Queue, Leads and Ops. Tab through every page. Check every theme and a 400px width. Fix UI-only issues in `components/` and `app/(app)/`. Write any issue that needs a change outside those folders into this card's notes for Claude, and don't fix it yourself.
- **Touch only:** `components/**`, `app/(app)/**`, `app/themes.css`, `docs/TASKS.md`
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p7-a11y-pass
  ```
- **Finish:**
  ```bash
  npm run check
  git add components "app/(app)" app/themes.css docs/TASKS.md
  git commit -m "flash(p7): accessibility, keyboard, mobile and theme fixes"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

#### F7.3 Screenshot captions
- **Starts after:** F7.1
- **Build:** `docs/screenshots.md`, with one short caption per screenshot the user provides. Use plain, active voice.
- **Touch only:** `docs/screenshots.md`, `docs/TASKS.md`
- **Start:**
  ```bash
  git status --short
  git switch main
  git switch -c flash/p7-captions
  ```
- **Finish:**
  ```bash
  git add docs/screenshots.md docs/TASKS.md
  git commit -m "flash(p7): screenshot captions"
  git switch main
  ```
- [ ] Built (Flash) · [ ] Reviewed and merged (Claude)
- **Review notes:** none yet

### Claude

- [ ] **C7.1** `npm run seed:reset` for a clean demo state. It is destructive, so it asks for confirmation and only targets the demo org.
- [ ] **C7.2** Check every claim in the README against the code (part of the F7.1 review).
- [ ] **C7.3** Final deploy; check both logins on the live URL. Tick PLAN.md, add a PROGRESS.md entry, commit.

### You

- [ ] **U7.1** Record the walkthrough video.
