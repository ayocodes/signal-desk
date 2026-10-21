# Architecture

## System overview

```
                 GitHub Actions (every 30 min, + manual dispatch)
                                   |
                                   v
   public sources  ---->  Python agent tick  ---->  Gemini API (drafts)
   YC dataset              discover                       |
   Greenhouse/Lever/Ashby  fetch signals                  |
   HN Algolia search       score + buyer check            |
                           draft + guardrails  <----------+
                           run sequences  ---------->  Resend (send to test inboxes)
                           deliverability                 |
                                   |                      | webhooks
                                   v                      v
                         Supabase Postgres  <----  Next.js on Vercel
                         (RLS, multi-tenant)        UI, auth, approve,
                                                    regenerate, webhook handler
```

**Why GitHub Actions for the agent:** Vercel Hobby cron jobs can only run once per day. GitHub Actions scheduled workflows can run as often as every 5 minutes and are free for public repos. A run every 30 minutes also keeps the free Supabase project from pausing (it pauses after a week of inactivity).

**Schedule:** `7,37 * * * *` (twice an hour, off the top of the hour, when GitHub's scheduler is busiest). Also `workflow_dispatch` for manual runs. Optional: an admin-only "Run agent now" button in Ops that calls the GitHub API (`repository_dispatch`) with a fine-grained token stored server-side.

Note: GitHub silently disables scheduled workflows in public repos after 60 days without commits. Not a problem for the application window.

## One agent tick (`agent/main.py`)

Each tick is idempotent: running it twice in a row changes nothing the second time.

1. **Start run.** Insert `agent_runs` row (trigger, started_at).
2. **Discover.** Load the YC companies dataset (cache for 24h). Apply ICP rules from `shared/scoring.json`. Upsert `companies` with `icp_match` and `icp_reasons`. For new companies, probe ATS boards (Greenhouse, Lever, Ashby) using slug guesses from name and domain; store `ats_type` + `ats_token` when one returns 200, and record per company which sites were checked and when (`ats_checked`). Cap probes per tick (`DISCOVERY_PROBES_PER_RUN`). **Ashby refuses GitHub's runners (403)**, so scheduled runs check Greenhouse and Lever (`AGENT_JOB_BOARDS=greenhouse,lever`) and Ashby is checked when the agent runs locally (`npm run agent:local`). The agent never tries to get around a refusal (no proxies, no other servers); a refusing site is skipped for the rest of the run and reported in `agent_runs.errors`.
3. **Fetch signals.**
   - **Hiring:** for companies with an ATS board and `jobs_fetched_at` older than 12h, fetch jobs. Classify titles with `shared/hiring_keywords.json`. Create a `hiring` signal per matching role with an excerpt (first relevant sentence of the description, HTML stripped, max 220 chars) and the job URL.
   - **Launch:** HN Algolia search for "Show HN" / "Launch HN" posts in the last 30 days (time windows, since Algolia returns at most 1,000 hits per query). Only accept a match when the story URL is on the company domain (or a subdomain, never a shared host like github.com), or it is a "Launch HN: {Company} (YC W24)" post whose batch marker equals the company's YC batch. A Show HN title alone is not enough: on real data, ordinary-word names ("Native", "Agency") matched unrelated projects. Store points and comment count.
   - **Funding (weak):** a YC batch in the last 6 months becomes a low-weight `funding` signal ("YC {batch}"), source "YC directory".
   - Every signal gets a `fingerprint` (type + company + source id). Unique constraint prevents duplicates.
4. **Score.** Compute score and `score_parts` from `shared/scoring.json`. A lead is `ready` when its score is at or above the threshold **and** it has at least one signal that isn't listed in `weakSignalTypes` (a recent YC batch adds points but can't qualify a lead alone). Others get `status = 'filtered'` with a human-readable `filtered_reason`. Scoring never changes the status of a lead that is enrolled, bounced, replied, halted or completed.
5. **Contacts + buyer check.** Use founder names from the dataset if present (see PLAN phase 2 for how to check). Otherwise a placeholder contact "Founder" with `is_placeholder = true`. Buyer check from title rules: founder/CEO at under 30 people, or a sales/growth/revenue leader, is `verified`. Engineering or product titles are `rerouted` to a better contact when one exists. Every contact's sendable address is a Resend test address (`delivered+{lead_short_id}@resend.dev`). A small, fixed share of leads (deterministic by id) route to `bounced+...` or `complained+...` so the deliverability paths get exercised by real events.
6. **Draft.** For `ready` leads without drafts, generate three angles (`signal`, `peer`, `short`) plus one `raw` baseline with no signals and no rules. Cap leads per tick (`DRAFTS_PER_RUN`) to stay inside free-tier limits; back off on 429. The model returns JSON `{subject, body, grounded_phrases[]}`. Guardrails run in code (see below). Store tokens in/out and a hash of the prompt.
7. **Run sequences.** For active sequences, find due steps. Evaluate branch conditions from `email_events`. Pick a mailbox by rotation (healthy, under daily cap, fewest sends today). Send via Resend with the step's idempotency key. Record `message_id`.
8. **Deliverability.** Recompute each mailbox's bounce and complaint rates from events. Auto-pause by the rules in `shared/guardrails.json`. Reset daily counters at UTC midnight.
9. **Finish run.** Write counts, per-step durations and errors to `agent_runs`. Write `audit_log` rows for every meaningful action.

## Guardrails (shared by Python and TypeScript)

`shared/guardrails.json`:

```json
{
  "maxBodyWords": 80,
  "requireClosingQuestion": true,
  "bannedChars": ["—", "–"],
  "bannedPhrases": ["revolutionize", "game-changer", "game changer", "cutting-edge", "synergy",
                    "best-in-class", "unprecedented", "10x", "finds you well", "next level",
                    "transform your business", "circle back", "touch base"],
  "mailbox": { "dailyCap": 50, "pauseBouncePct": 4.0, "pauseComplaintPct": 0.3, "minSendsForRates": 20 }
}
```

**Grounding check (the important one):** the model must list the exact phrases it used from the signals. Code then verifies each phrase appears in BOTH the email AND the signal title or excerpt it came from (case-insensitive, word boundaries). At least one verified phrase is required. This catches the model inventing a signal.

Results are stored per check (`pass` / `fail` / `warn` + message) in `drafts.guardrail_results`. The UI recomputes the same checks live while a user edits.

## Scoring

`shared/scoring.json` (starting weights, admin-editable later):

```json
{
  "threshold": 50,
  "icp": { "full": 40, "partial": 20 },
  "signals": { "hiring_sales": 30, "hiring_founding_sales_bonus": 5, "hiring_marketing": 20, "launch": 18, "funding_yc_recent": 10 },
  "freshness": [ { "maxHours": 24, "points": 15 }, { "maxHours": 48, "points": 11 }, { "maxHours": 72, "points": 8 }, { "maxHours": 168, "points": 4 } ],
  "stackedPerExtraSignalType": 7,
  "icpRules": { "status": "Active", "teamSizeMin": 5, "teamSizeMax": 60, "b2b": true, "maxBatchAgeYears": 3 }
}
```

The score is a points total, not a percentage (no fixed maximum; 152 with today's weights). `scoreBands` give ready leads a word for a quick read (Strong 90+, Good 70+, Borderline 50+). `score_parts` is stored as an ordered array of `[label, points]` so the UI can show "ICP match 40 + Hiring 30 + Fresh 15 + 2 signals 7 = 92".

Hiring signals carry a category from `shared/hiring_keywords.json`. Sales and GTM roles score `hiring_sales` ("Hiring"); senior marketing, demand generation and growth marketing roles score the lower `hiring_marketing` ("Marketing hire"). Junior, product and brand marketing roles don't count. Both kinds can appear on one lead, but they stack as one signal type (hiring).

## Sequence engine

Email only. Steps and branches for the default sequence:

| Step | When | Action |
|---|---|---|
| `d1_open` | on approval | Send the approved email (signal 1) |
| `d3_check` | day 3 | If replied: halt. If opened 2+: go to `d4_followup_signal2`. Else: `d4_new_subject` |
| `d4_followup_signal2` | day 4 | Short follow-up built on signal 2 (or a different angle if only one signal) |
| `d4_new_subject` | day 4 | Same thread, new subject line |
| `d7_case` | day 7 | One case study from a similar team |
| `d11_close` | day 11 | Close-the-loop note |

Any `replied` event halts the sequence immediately, at any step. A `bounced` event pauses it and moves the lead to bounce recovery. For the demo, an admin can "fast-forward" a sequence (labeled), so branches can be shown without waiting days.

## Webhooks and bounce recovery

`POST /api/webhooks/resend`:

1. Verify the signature with `RESEND_WEBHOOK_SECRET`. Reject if invalid.
2. Insert into `email_events` (unique on provider event id, so retries are harmless).
3. Update the step and mailbox counters.
4. `bounced`: set the lead to `bounced`, store the bounce code, create a recovery proposal (`bounced+x@` to `delivered+x@`, with the reason), audit log. Nothing resends until a human approves.
5. `complained`: count against the mailbox; deliverability may pause it.

**Replies and opens:** test inboxes cannot reply. In phase 5, first verify which event types the test addresses actually emit. Any event that cannot happen naturally (replies, and opens if needed) is created through an admin-only "Simulate" action, stored with `source = 'simulated'`, and handled by the exact same code path as a real event.

## Data model (Postgres)

All tables have `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`, and `org_id uuid not null references organizations` unless noted.

| Table | Key columns |
|---|---|
| `organizations` (no org_id) | name, icp_description |
| `profiles` (id = auth.users.id) | org_id, full_name, role (`admin` / `rep`), theme |
| `companies` | name, domain (unique per org), yc_batch, team_size, industries, description, ats_type, ats_token, icp_match, icp_reasons jsonb, jobs_fetched_at |
| `contacts` | company_id, name, title, is_placeholder, send_address, buyer_status (`verified` / `rerouted` / `unverified`), buyer_reason |
| `signals` | company_id, type (`hiring` / `launch` / `funding`), title, excerpt, source_name, source_url, occurred_at, detected_at, fingerprint (unique), meta jsonb |
| `leads` | company_id, contact_id, assigned_to (profile), score, score_parts jsonb, status (`ready` / `filtered` / `enrolled` / `bounced` / `replied` / `halted` / `completed`), filtered_reason |
| `drafts` | lead_id, angle (`signal` / `peer` / `short` / `raw`), subject, body, grounded_phrases jsonb, guardrail_results jsonb, passed, model, prompt_hash, tokens_in, tokens_out |
| `sequences` | lead_id, draft_id, approved_by, approved_at, edited, final_subject, final_body, status, current_step |
| `sequence_steps` | sequence_id, step_key, scheduled_for, status (`pending` / `sent` / `skipped` / `cancelled`), signal_id, mailbox_id, message_id, idempotency_key (unique) |
| `mailboxes` | label, send_via, daily_cap, sent_today, status (`healthy` / `near_cap` / `paused` / `held`), pause_reason, auth jsonb |
| `email_events` | step_id, provider_event_id (unique, nullable for simulated), type, source (`resend` / `simulated`), payload jsonb |
| `agent_runs` | trigger, started_at, finished_at, stats jsonb, step_ms jsonb, errors jsonb |
| `audit_log` | actor_type (`agent` / `user`), actor_id, action, entity_type, entity_id, detail jsonb |

**Mailboxes:** with no owned domain, every mailbox sends through the Resend sandbox sender (`RESEND_FROM`). The pool is 4 logical mailboxes with real per-mailbox caps, counters, health and auto-pause driven by real events. The auth column runs a real DNS TXT lookup (SPF, DMARC) on the actual sending domain; DKIM shows "managed by provider".

## Roles and RLS

| | admin | rep |
|---|---|---|
| Queue, lead detail, drafts | all leads in org | leads assigned to them |
| Approve / edit / regenerate | yes | own leads |
| Leads table | all | own |
| Sequences | all | own |
| Ops (KPIs, mailboxes, engine, audit log) | yes | no access (hidden in nav, 403 on server, RLS denies) |
| Settings: theme, profile | yes | yes |
| Settings: ICP, scoring, simulate actions, run agent | yes | no |

The agent uses the service-role key and bypasses RLS. The web app never uses the service-role key in the browser. Server routes use it only for the webhook handler and the seed script.

Leads are assigned to reps round-robin at creation.
