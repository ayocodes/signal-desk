# Signal Desk Agent

The Signal Desk background agent is an autonomous worker that discovers B2B software companies matching an Ideal Customer Profile (ICP), detects public buying signals (hiring, launches, funding), calculates explainable lead scores, and prepares leads for multi-step outreach.

The agent runs on a schedule (every 30 minutes via GitHub Actions) or on demand locally. Each run is scoped per organization, maintains an audit trail, and persists run statistics in Supabase.

---

## Running Locally

### Setup

Ensure a local Python virtual environment is configured with the dev dependencies:

```bash
python3 -m venv .venv
.venv/bin/pip install -r agent/requirements-dev.txt
```

Environment variables are read automatically from `.env.local` in the project root.

### Commands

- **`npm run agent:local`**  
  Runs one tick locally (`.venv/bin/python -m agent.main --once`). Executes all steps against the database configured in `.env.local`.
- **`npm run agent:local:dry`**  
  Runs one tick in dry-run mode (`.venv/bin/python -m agent.main --dry-run`). Executes reads and network requests normally, but skips all database writes and logs the count of skipped writes per table.
- **`.venv/bin/python -m pytest agent/tests`**  
  Runs the full agent test suite.

---

## What One Tick Does (Step by Step)

`agent/main.py` coordinates each execution tick:

1. **Initialization and Settings Validation**:  
   Loads settings via `load_settings()`. Validates that all required variables are present and non-empty. Fails early with exit code 2 if the configuration is invalid.
2. **Database and Client Setup**:  
   Initializes `Database.from_settings(settings, dry_run=...)` using `SUPABASE_SERVICE_ROLE_KEY` to bypass Row Level Security (RLS). Creates a `PoliteClient` session using `AGENT_USER_AGENT`.
3. **Organization Loop**:  
   Queries all active organizations from `organizations` (`id, name`). For each organization, runs `run_org(...)`:
   - Instantiates a `RunRecorder` and inserts an `agent_runs` record with `trigger` (`local`, `local:dry-run`, `schedule`, or `workflow_dispatch`).
   - Loads organization configuration via `load_config(org_id)` from `/shared` definitions (scoring weights, hiring keywords, guardrails).
   - Executes 6 pipeline steps sequentially inside `run.step(name)` context managers, timing each step and catching non-fatal exceptions:
     1. **`discover`**: Downloads or reads the cached YC dataset (`agent/sources/yc.py`). Evaluates companies against ICP rules (`agent/icp.py`). Normalizes company website domains (`agent/domains.py`). Upserts matched companies into `companies` (`icp_match = True`, tier `"full"` or `"partial"`). Marks previously tracked companies that no longer qualify as untracked.
     2. **`probe_job_boards`**: Selects untracked/unprobed companies prioritized by match tier, hiring status, and team size. Probes public ATS endpoints (Ashby, Greenhouse, Lever) within the configured request budget (`DISCOVERY_PROBES_PER_RUN`). If a board is found, saves board credentials and generates initial hiring signals. Updates `companies.ats_checked` with timestamps for each probed platform.
     3. **`refresh_hiring`**: Finds companies with known job boards whose jobs are older than `jobs_refresh_hours` (default 72h). Fetches open job postings up to `MAX_BOARD_REFRESHES` (30 per tick). Classifies job titles against `shared/hiring_keywords.json` and records new hiring signals. Updates `jobs_fetched_at`.
     4. **`detect_launches`**: Fetches "Show HN" and "Launch HN" stories from the Hacker News Algolia API (`agent/sources/hn.py`) within `launch_lookback_days` (default 180 days). Matches stories to tracked companies by domain or strict Launch HN batch title syntax. Upserts newly detected launch signals.
     5. **`detect_yc_recency`**: Checks tracked companies whose YC batch started within `funding_recent_months` (default 6 months). Upserts a weak funding signal for recent batches.
     6. **`score_leads`**: Gathers all signals for tracked companies. Ensures every tracked company has a placeholder contact (`agent/contacts.py`) linked to deterministic Resend test inboxes (`@resend.dev`). Scores leads using `score_lead(...)` (`agent/scoring.py`), assigning status (`ready` or `filtered`), itemized score math breakdown parts, and filtered reasons. Assigns new leads to sales reps round-robin based on workload. Upserts new leads and persists changes to status, score, and reasons.
   - Finalizes `agent_runs` stats, records HTTP request counts and step durations, flushes batched `audit_log` entries, and prints a summary.
4. **Exit Status**:  
   If any core step (`discover` or `score_leads`) encountered an error, the process exits with code 1. Non-core side errors (such as transient job board or Hacker News network issues) are logged to `agent_runs.errors` and the run completes successfully.

---

## Module Reference

- `agent/config.py`: Loads and parses versioned agent configuration and rules (`load_config(org_id)`) from `/shared` JSON files.
- `agent/contacts.py`: Manages placeholder contacts and deterministic test inbox routing for deliverability testing.
- `agent/db.py`: Database client using Supabase service-role credentials with batching, pagination, and dry-run write tracking.
- `agent/domains.py`: Normalizes domains from URLs and tests domain matching against shared host blocklists.
- `agent/http_client.py`: Polite HTTP client enforcing robots.txt, host rate limits, retry backoffs, and descriptive user agents.
- `agent/icp.py`: Evaluates whether a company matches the Ideal Customer Profile (full, partial, or untracked) with reason strings.
- `agent/llm.py`: Common LLM interface for structured completions, connecting Gemini and Groq providers.
- `agent/main.py`: Entry point for one agent tick, orchestrating step execution, error handling, and reporting across organizations.
- `agent/run.py`: `RunRecorder` context manager recording run stats, per-step timing, errors, and batched audit logs.
- `agent/scoring.py`: Computes lead scores from ICP tier, signal types, freshness, and signal stacking with structured breakdown parts.
- `agent/settings.py`: Validates and loads environment variables from `.env.local` or execution environment with consolidated error reporting.
- `agent/signals.py`: Extracts and fingerprints structured signal rows (hiring, launch, funding) from source data.
- `agent/steps.py`: Implements the 6 pipeline steps executed in sequence during each tick.
- `agent/sources/ats.py`: Discovers and scrapes public job boards for Greenhouse, Lever, and Ashby.
- `agent/sources/hn.py`: Queries Hacker News Algolia search API and strictly matches launch stories to tracked companies.
- `agent/sources/yc.py`: Downloads, parses, and caches the YC company directory dataset.

---

## Environment Variables

The agent validates all environment variables at startup via `agent/settings.py`. Empty strings count as missing.

### Required Variables

- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`): The Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (bypasses RLS).
- `LLM_PROVIDER`: Active LLM provider (`gemini` or `groq`).
- `GEMINI_API_KEY`: API key for Google Gemini (required when `LLM_PROVIDER=gemini`).
- `GEMINI_MODEL`: Model name for Gemini, e.g. `gemini-2.5-flash` (required when `LLM_PROVIDER=gemini`).
- `GROQ_API_KEY`: API key for Groq (required when `LLM_PROVIDER=groq`).
- `GROQ_MODEL`: Model name for Groq, e.g. `llama-3.3-70b-versatile` (required when `LLM_PROVIDER=groq`).
- `RESEND_API_KEY`: API key for Resend email service.
- `RESEND_FROM`: From address configured in Resend (e.g. `Outbound <onboarding@resend.dev>`).
- `AGENT_USER_AGENT`: Descriptive User-Agent string sent with all HTTP requests (e.g. `SignalDeskBot/1.0 (+https://example.com/bot)`).

### Optional Variables

- `DRAFTS_PER_RUN`: Number of drafts to generate per tick (whole number, default: `5`).
- `DISCOVERY_PROBES_PER_RUN`: Maximum job-board probe requests per tick (whole number, default: `40`).
- `AGENT_JOB_BOARDS`: Comma-separated list of ATS platforms to check (`ashby`, `greenhouse`, `lever`). Defaults to all three. GitHub Actions sets this to `greenhouse,lever`.
- `GITHUB_EVENT_NAME`: Workflow event trigger name (`schedule`, `workflow_dispatch`). Defaults to `"local"` when running outside GitHub Actions.

---

## Politeness Rules

All outbound network requests are routed strictly through `PoliteClient` (`agent/http_client.py`), adhering to hard rules for respectful data collection:

1. **robots.txt Compliance**:  
   Before requesting any URL on a host, `PoliteClient` fetches and parses `/robots.txt` using RFC 9309 rules. If `/robots.txt` is unreachable or returns a 5xx server error, fetching is disallowed (`DisallowedByRobots`). If `/robots.txt` returns a 4xx code (e.g. 404 or 403), RFC 9309 treats it as "no rules" and allows requests.
2. **Descriptive User-Agent**:  
   The `AGENT_USER_AGENT` header is sent on every HTTP request so site operators can identify and contact us.
3. **Rate Limiting**:  
   Enforces a strict minimum delay of 1.0 second between consecutive requests to the same hostname (`min_interval_seconds = 1.0`). At most one request per second per host.
4. **Timeouts**:  
   Every request enforces a 20-second timeout.
5. **Exponential Backoff and Retries**:  
   Transient failures (HTTP 429 and 5xx status codes: 500, 502, 503, 504) are retried up to 2 times with exponential backoff (`min(2.0**attempt, 30.0)` seconds). If a response includes a numeric `Retry-After` header, the client honors that duration up to a 30-second cap.
6. **No Logins or Authenticated Scraping**:  
   The agent only fetches public, keyless endpoints. It never attempts to access pages behind logins or paywalls.
7. **Per-Run Request Budgets**:  
   Probe volume is bounded by `DISCOVERY_PROBES_PER_RUN` (default 40 requests per run), and job board refreshes are capped at `MAX_BOARD_REFRESHES` (30 companies per tick).
8. **Graceful Handling of Refusals**:  
   If an external host returns 401, 403, or persists in returning 429/5xx after retries, the agent catches the error, marks the site unavailable for the remainder of that tick, and records the failure in `agent_runs.errors` instead of failing the run.

---

## Why Ashby is checked only on local runs

Ashby's public job-board API answers 403 to requests from GitHub's runners, while the same requests from a normal connection get normal answers. So the GitHub workflow sets `AGENT_JOB_BOARDS=greenhouse,lever`, local runs check all three, and each company records which sites were checked and when (`companies.ats_checked`).

The agent never tries to work around a refusal (no proxies, no other servers, no disguised requests): a site that refuses is skipped for the rest of the run and reported in `agent_runs.errors`.
