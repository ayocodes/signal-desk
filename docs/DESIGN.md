# Design

## Direction

Take cues from Linear, Vercel, Attio and Raycast, without copying any of their logos, names, icons or exact screens:

- **Quiet surfaces.** Flat backgrounds, 1px hairline borders, almost no shadows. Elevation only for popovers, the command palette and toasts.
- **Dense but calm.** 13px base text, tight rows, clear hierarchy through weight and color, not size jumps.
- **Keyboard first.** `⌘K` command palette for everything (navigate, switch theme, run actions). Shortcuts shown inline as small `kbd` chips. `J` / `K` move through lists. `⌘↵` approves.
- **Records as tables.** The Leads page is a dense, sortable table with sticky header and inline status pills, like a CRM record view.
- **One accent per theme.** Used for the primary action, focus rings and the selected row. Status colors (good / warn / bad / signal) are separate from the accent.
- **Monospace for machine values.** Scores, IDs, timestamps, counts, domains, idempotency keys.

## Layout

- **Left sidebar (240px, collapsible to icons):** workspace name at the top, then Queue, Leads, Sequences, Ops (admin only), Settings. User menu with role badge at the bottom.
- **Top bar per page:** page title, contextual filters, `⌘K` hint.
- **Queue page:** split view. List on the left (Ready / Enrolled / Bounced / Replied tabs, signal filter chips, collapsed "filtered out" section). Detail on the right (signal cards with source + excerpt, score math, buyer check, angle picker, email editor with live checks, sequence with branches, agent trace, prompt).
- **Ops page (admin):** KPI strip, reply rate by signal, mailbox health table, engine stats from `agent_runs`, audit log stream.
- **Mobile:** sidebar becomes a sheet; split view stacks. It doesn't need to be great on mobile, but nothing may overflow sideways.

## Typography

- Geist Sans for UI, Geist Mono for machine values (via the `geist` package, `next/font`).
- Scale (px): 11 (labels, uppercase, letter-spacing 0.04em), 12 (meta), 13 (base), 14 (emphasis, inputs), 16 (section titles), 20 (page titles), 24 (rare).
- `font-variant-numeric: tabular-nums` anywhere numbers line up.

## Spacing and shape

- 4px grid. Common gaps: 4, 8, 12, 16, 24.
- Radius: 6px (controls, pills are fully rounded), 8px (panels), 12px (palette, dialogs).
- Row height: 36px in lists, 32px in dense tables.

## Theme system (VS Code style)

Users pick a theme in Settings or from `⌘K` → "Change theme…". Like VS Code, arrowing through the list previews each theme live; Enter keeps it, Esc reverts.

**Implementation:**

- Themes are sets of CSS variables in `app/themes.css`, one block per `[data-theme="..."]` on `<html>`.
- Tailwind maps utilities to the variables (Tailwind v4: `@theme inline { --color-bg: var(--bg); ... }`), so components use `bg-bg`, `text-muted`, `border-border` and never raw hex values.
- The choice is saved to `profiles.theme` (follows the user across devices) and mirrored in `localStorage` for instant load.
- A tiny inline script in the root layout sets `data-theme` before first paint, so there is no flash of the wrong theme.
- "System" follows `prefers-color-scheme` and maps to Paper (light) or Graphite (dark).
- Every theme must keep body text at WCAG AA contrast (4.5:1) against `--bg` and `--surface`. Add a unit test that checks this for every theme.

**Tokens:**

| Token | Use |
|---|---|
| `--bg` | app background |
| `--surface` | panels, sidebar, table body |
| `--surface-2` | hover rows, sunken areas, code blocks |
| `--border` | hairlines |
| `--border-strong` | inputs, focused containers |
| `--text` | primary text |
| `--text-muted` | secondary text |
| `--text-subtle` | placeholders, disabled |
| `--accent` | primary button, focus ring, selected row marker |
| `--accent-fg` | text on accent |
| `--accent-soft` | selected row background, subtle accent fills |
| `--good` `--warn` `--bad` | status |
| `--signal` | signal type labels and tags |

**Starting themes** (tune freely, keep contrast):

| Token | Paper (light) | Mist (light) | Graphite (dark) | Midnight (dark) | Forest (dark) | High Contrast (dark) |
|---|---|---|---|---|---|---|
| `--bg` | #FFFFFF | #F6F7F9 | #0A0A0A | #0E0F13 | #0F1513 | #000000 |
| `--surface` | #FAFAFA | #FFFFFF | #111111 | #14161C | #151D1A | #0A0A0A |
| `--surface-2` | #F3F3F4 | #EEF0F3 | #1A1A1A | #1B1E26 | #1C2622 | #141414 |
| `--border` | #E6E6E8 | #DFE3E8 | #262626 | #262A35 | #283530 | #5A5A5A |
| `--border-strong` | #D4D4D8 | #C9CED6 | #333333 | #343949 | #33443D | #8A8A8A |
| `--text` | #18181B | #111827 | #EDEDED | #E6E8EE | #E2EAE7 | #FFFFFF |
| `--text-muted` | #52525B | #4B5563 | #A1A1A1 | #9BA1B0 | #94A69F | #D4D4D4 |
| `--text-subtle` | #71717A | #6B7280 | #737373 | #6B7180 | #6C7D77 | #B3B3B3 |
| `--accent` | #2F6FEB | #0F766E | #FAFAFA | #7C83FF | #4FC1AD | #4DA3FF |
| `--accent-fg` | #FFFFFF | #FFFFFF | #0A0A0A | #0E0F13 | #0B1412 | #000000 |
| `--accent-soft` | #EAF1FE | #DDF3EF | #1F1F1F | #232650 | #183A34 | #0D2540 |
| `--good` | #15803D | #15803D | #4ADE80 | #5BD48A | #6FCF8B | #3DFF8B |
| `--warn` | #A16207 | #A16207 | #FACC15 | #E8C35A | #E8C25A | #FFD60A |
| `--bad` | #DC2626 | #B91C1C | #F87171 | #F2777A | #F08A80 | #FF5C5C |
| `--signal` | #C2410C | #B45309 | #FB923C | #F0A35E | #F0A54A | #FF9F43 |

## Components to build once and reuse

Button (primary / secondary / ghost / danger), Input, Textarea, Kbd, Pill (status), Tag (signal type), ScoreBadge, Tabs, SegmentedControl, Table (sortable, sticky header), SplitView, Panel, EmptyState, Toast, CommandPalette, ThemePicker, Sidebar, Avatar (initials).

## States every screen needs

Loading (skeleton rows, not spinners), empty (says what will appear and how), error (what failed and what to do), and permission denied (for reps on admin pages, with a link back to Queue).

## Copy

Plain, specific, active voice. Buttons say what happens ("Approve and enroll", "Resend to corrected address"). Toasts confirm ("Ledgerline enrolled"). No em-dashes in UI copy either.
