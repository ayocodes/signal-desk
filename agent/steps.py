"""The steps of one agent tick. main.py runs them in order, each inside run.step(...).

Each step reads what it needs from the database, does its work, and writes back with
upserts on unique keys, so running a step twice never duplicates anything.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

import httpx

from agent.config import AgentConfig
from agent.db import Database, Row
from agent.domains import normalize_domain
from agent.http_client import PoliteClient
from agent.contacts import placeholder_contact
from agent.icp import evaluate
from agent.llm import LlmProvider
from agent.run import RunRecorder
from agent.scoring import SignalFacts, score_lead
from agent.settings import Settings
from agent.signals import hiring_signals, launch_signal, yc_recency_signal
from agent.sources import ats, hn, yc

# Politeness cap on job-board refreshes per tick (separate from the discovery probe budget).
MAX_BOARD_REFRESHES = 30


@dataclass
class Context:
    settings: Settings
    db: Database
    client: PoliteClient
    run: RunRecorder
    org_id: str
    now: datetime
    config: AgentConfig  # loaded once per org run via load_config(org_id)
    llm: LlmProvider | None = None  # None in dry runs: they never call the model
    sleep: Callable[[float], None] = time.sleep  # replaced in tests


def companies(ctx: Context, columns: str) -> list[Row]:
    return ctx.db.select_all("companies", columns, org_id=ctx.org_id, icp_match=True)


def save_signals(ctx: Context, rows: list[dict[str, Any]]) -> int:
    """Inserts signals that aren't stored yet (by fingerprint). Returns how many were new."""
    new = ctx.db.upsert("signals", rows, on_conflict="org_id,fingerprint", ignore_duplicates=True)
    for signal in new:
        ctx.run.audit("signal.detected", "signal", signal.get("id"), type=signal["type"], title=signal["title"])
    ctx.run.count("signals_new", len(new))
    return len(new)


def discover(ctx: Context) -> None:
    """YC dataset -> ICP evaluation -> upsert tracked companies (full and partial matches)."""
    parsed, skipped = yc.parse_companies(yc.load_dataset(ctx.client))
    ctx.run.count("yc_records", len(parsed) + skipped)
    rules = ctx.config.scoring
    today = ctx.now.date()

    rows: dict[str, dict[str, Any]] = {}
    for company in parsed:
        result = evaluate(company, today, rules)
        if result.tier is None:
            continue
        domain = normalize_domain(company.website)
        if domain is None:
            ctx.run.count("skipped_no_domain")
            continue
        if domain in rows and rows[domain]["icp_tier"] == "full":
            continue  # two YC entries share a domain: keep the stronger match
        rows[domain] = {
            "org_id": ctx.org_id,
            "name": company.name,
            "domain": domain,
            "yc_batch": company.batch,
            "yc_slug": company.slug,
            "yc_is_hiring": company.is_hiring,
            "team_size": company.team_size,
            "industries": list(company.industries) or [company.industry],
            "description": company.one_liner,
            "icp_match": True,
            "icp_tier": result.tier,
            "icp_reasons": list(result.reasons),
        }

    ctx.db.upsert("companies", list(rows.values()), on_conflict="org_id,domain")
    ctx.run.count("icp_full", sum(1 for r in rows.values() if r["icp_tier"] == "full"))
    ctx.run.count("icp_partial", sum(1 for r in rows.values() if r["icp_tier"] == "partial"))

    # Companies that no longer match (e.g. now inactive) stop being tracked.
    for row in companies(ctx, "id,domain"):
        if row["domain"] not in rows:
            ctx.db.update("companies", {"icp_match": False, "icp_tier": None}, id=row["id"])
            ctx.run.count("companies_untracked")
            ctx.run.audit("company.untracked", "company", row["id"], domain=row["domain"])


def _probe_order(row: Row) -> tuple[int, int, int, str]:
    """Full matches before partial; then companies YC lists as hiring; then larger teams
    (more likely to run a real job board and to be scaling sales; weeks-old batches mostly don't)."""
    return (
        0 if row.get("icp_tier") == "full" else 1,
        0 if row.get("yc_is_hiring") else 1,
        -(row.get("team_size") or 0),
        row.get("name") or "",
    )


def _unchecked_sites(row: Row, sites: tuple[ats.Ats, ...]) -> tuple[ats.Ats, ...]:
    checked = row.get("ats_checked") or {}
    return tuple(site for site in sites if site not in checked)


def probe_job_boards(ctx: Context) -> None:
    """Finds public job boards within the per-run request budget, on this run's sites only.

    GitHub runs check Greenhouse and Lever (Ashby refuses GitHub's runners with a 403);
    local runs also check Ashby. Each company remembers which sites were checked and when.
    """
    enabled = ctx.settings.job_boards
    tracked = companies(ctx, "id,name,domain,icp_tier,yc_is_hiring,team_size,ats_type,ats_probed_at,ats_checked")
    no_board = [row for row in tracked if row["ats_type"] is None and row["ats_probed_at"] is None]
    pending = [row for row in no_board if _unchecked_sites(row, enabled)]
    pending.sort(key=_probe_order)
    ctx.run.count("probe_queue", len(pending))
    ctx.run.count("ashby_unchecked", sum(1 for row in no_board if "ashby" not in (row.get("ats_checked") or {})))

    budget_start = ctx.client.request_count
    keywords = ctx.config.keywords
    unavailable: dict[ats.Ats, int] = {}  # job-board site -> status it refused us with, this run
    for row in pending:
        if ctx.client.request_count - budget_start >= ctx.settings.discovery_probes_per_run:
            break
        sites = tuple(site for site in _unchecked_sites(row, enabled) if site not in unavailable)
        if not sites:
            if len(unavailable) == len(enabled):
                break  # every site this run may use refused us; nothing more to learn
            continue
        try:
            result = ats.probe_company(ctx.client, row["name"], row["domain"], sites, unavailable)
        except httpx.HTTPError as error:
            # Network trouble: leave it as it was so the next run tries again.
            ctx.run.count("probe_errors")
            print(f"Probe failed for {row['domain']}: {type(error).__name__}: {error}", flush=True)
            continue

        board = result.board
        if board is None and not result.checked:
            ctx.run.count("probes_incomplete")  # every site refused mid-probe: try again later
            continue
        checked = {**(row.get("ats_checked") or {}), **{site: ctx.now.isoformat() for site in result.checked}}
        update: dict[str, Any] = {"ats_checked": checked}
        ctx.run.count("companies_probed")
        if board is None and set(ats.ATS_ORDER) <= set(checked):
            update["ats_probed_at"] = ctx.now.isoformat()  # every site checked: no public board
        if board is not None:
            update |= {
                "ats_type": board.ats, "ats_token": board.token,
                "ats_probed_at": ctx.now.isoformat(), "jobs_fetched_at": ctx.now.isoformat(),
            }
            ctx.run.count("boards_found")
            ctx.run.audit("company.ats_found", "company", row["id"], ats=board.ats, token=board.token, jobs=len(board.jobs))
            save_signals(ctx, hiring_signals(ctx.org_id, row["id"], board.ats, board.jobs, keywords, ctx.now))
        ctx.db.update("companies", update, id=row["id"])

    ctx.run.count("probe_requests", ctx.client.request_count - budget_start)
    if unavailable:
        # Not silent: a refused site shows up in agent_runs.errors and the log.
        ctx.run.errors.append({
            "step": "probe_job_boards",
            "message": "Job-board sites refused requests this run: "
            + ", ".join(f"{ats.ATS_LABEL[site]} ({status})" for site, status in sorted(unavailable.items())),
        })


def refresh_hiring(ctx: Context) -> None:
    """Re-reads known job boards whose jobs are older than the refresh window."""
    window = timedelta(hours=ctx.config.scoring.signal_windows.jobs_refresh_hours)
    due = [
        row
        for row in companies(ctx, "id,domain,ats_type,ats_token,jobs_fetched_at")
        if row["ats_type"]
        and (row["jobs_fetched_at"] is None or datetime.fromisoformat(row["jobs_fetched_at"]) < ctx.now - window)
    ]
    keywords = ctx.config.keywords
    skipped = [row for row in due if row["ats_type"] not in ctx.settings.job_boards]
    ctx.run.count("refresh_skipped_site", len(skipped))  # e.g. Ashby boards on a GitHub run
    due = [row for row in due if row["ats_type"] in ctx.settings.job_boards]
    for row in due[:MAX_BOARD_REFRESHES]:
        try:
            board = ats.fetch_board(ctx.client, row["ats_type"], row["ats_token"])
        except ats.BoardHostUnavailable as refused:
            ctx.run.count("refresh_errors")
            print(f"Job refresh skipped for {row['domain']}: {refused}", flush=True)
            continue
        except httpx.HTTPError as error:
            ctx.run.count("refresh_errors")
            print(f"Job refresh failed for {row['domain']}: {type(error).__name__}", flush=True)
            continue
        ctx.run.count("boards_refreshed")
        if board is not None:
            save_signals(ctx, hiring_signals(ctx.org_id, row["id"], board.ats, board.jobs, keywords, ctx.now))
        ctx.db.update("companies", {"jobs_fetched_at": ctx.now.isoformat()}, id=row["id"])


def detect_launches(ctx: Context) -> None:
    """Show HN / Launch HN stories from the lookback window, matched by the strict rule."""
    window = ctx.config.scoring.signal_windows.launch_lookback_days
    stories = hn.fetch_launch_stories(ctx.client, ctx.now, window)
    ctx.run.count("hn_stories", len(stories))
    tracked = [(r["id"], r["name"], r["domain"], r["yc_batch"]) for r in companies(ctx, "id,name,domain,yc_batch")]
    matches = hn.match_stories(stories, tracked)
    rows = [launch_signal(ctx.org_id, company_id, story) for company_id, found in matches.items() for story in found]
    ctx.run.count("launch_matches", len(rows))
    save_signals(ctx, rows)


def detect_yc_recency(ctx: Context) -> None:
    """A recent YC batch is a weak funding signal."""
    months = ctx.config.scoring.signal_windows.funding_recent_months
    rows = [
        signal
        for r in companies(ctx, "id,yc_batch,yc_slug")
        if r["yc_batch"]
        and (signal := yc_recency_signal(ctx.org_id, r["id"], r["yc_batch"], r["yc_slug"], ctx.now.date(), months))
    ]
    save_signals(ctx, rows)


# Leads in these states belong to the sequence engine; scoring never changes their status.
SCORING_OWNS = {"ready", "filtered"}


def _signal_facts(rows: list[Row]) -> dict[str, list[SignalFacts]]:
    by_company: dict[str, list[SignalFacts]] = {}
    for row in rows:
        by_company.setdefault(row["company_id"], []).append(
            SignalFacts(
                type=row["type"],
                occurred_at=datetime.fromisoformat(row["occurred_at"] or row["detected_at"]),
                title=row["title"],
                founding=bool((row.get("meta") or {}).get("founding")),
                category=(row.get("meta") or {}).get("category"),
            )
        )
    return by_company


def ensure_contacts(ctx: Context, tracked: list[Row]) -> dict[str, str]:
    """A placeholder contact for every tracked company that has none. Returns company id -> contact id."""
    share = ctx.config.guardrails.test_inboxes
    existing = {c["company_id"]: c["id"] for c in ctx.db.select_all("contacts", "id,company_id", org_id=ctx.org_id)}
    missing = [placeholder_contact(ctx.org_id, r["id"], r["team_size"], share) for r in tracked if r["id"] not in existing]
    for contact in ctx.db.upsert("contacts", missing, on_conflict="company_id,name", ignore_duplicates=True):
        if contact.get("id"):
            existing[contact["company_id"]] = contact["id"]
    ctx.run.count("contacts_new", len(missing))
    return existing


def score_leads(ctx: Context) -> None:
    """Scores every tracked company and creates or updates its lead. Writes only what changed."""
    tracked = companies(ctx, "id,name,icp_tier,team_size")
    tracked_ids = {r["id"] for r in tracked}
    signals = _signal_facts(ctx.db.select_all("signals", "company_id,type,occurred_at,detected_at,title,meta", org_id=ctx.org_id))
    leads = {lead["company_id"]: lead for lead in ctx.db.select_all(
        "leads", "id,company_id,status,score,score_parts,filtered_reason,assigned_to", org_id=ctx.org_id)}
    contacts = ensure_contacts(ctx, tracked)

    reps = [p["id"] for p in ctx.db.select_all("profiles", "id,role,created_at", org_id=ctx.org_id) if p["role"] == "rep"]
    load = {rep: sum(1 for lead in leads.values() if lead["assigned_to"] == rep) for rep in reps}
    rules = ctx.config.scoring

    new_rows: list[dict[str, Any]] = []
    status_rows: list[dict[str, Any]] = []
    score_rows: list[dict[str, Any]] = []
    for company in sorted(tracked, key=lambda c: c["name"]):
        result = score_lead(company["icp_tier"], signals.get(company["id"], []), ctx.now, rules)
        status = "ready" if result.ready else "filtered"
        parts = [[label, points] for label, points in result.parts]
        lead = leads.get(company["id"])

        if lead is None:
            assignee = min(load, key=lambda rep: load[rep]) if load else None  # round-robin in effect
            if assignee:
                load[assignee] += 1
            new_rows.append({
                "org_id": ctx.org_id, "company_id": company["id"], "contact_id": contacts.get(company["id"]),
                "assigned_to": assignee, "score": result.score, "score_parts": parts,
                "status": status, "filtered_reason": result.filtered_reason,
            })
        elif lead["status"] in SCORING_OWNS:
            if (lead["score"], lead["score_parts"], lead["status"], lead["filtered_reason"]) != (
                result.score, parts, status, result.filtered_reason
            ):
                status_rows.append({
                    "org_id": ctx.org_id, "company_id": company["id"], "score": result.score,
                    "score_parts": parts, "status": status, "filtered_reason": result.filtered_reason,
                })
                if lead["status"] != status:
                    ctx.run.audit("lead.status_changed", "lead", lead["id"], from_status=lead["status"], to_status=status, score=result.score)
                    ctx.run.count("leads_status_changed")
        elif (lead["score"], lead["score_parts"]) != (result.score, parts):
            score_rows.append({"org_id": ctx.org_id, "company_id": company["id"], "score": result.score, "score_parts": parts})

    # Leads whose company stopped matching the ICP leave the queue.
    for company_id, lead in leads.items():
        if company_id not in tracked_ids and lead["status"] == "ready":
            status_rows.append({
                "org_id": ctx.org_id, "company_id": company_id, "score": lead["score"], "score_parts": lead["score_parts"],
                "status": "filtered", "filtered_reason": "No longer matches the ICP",
            })

    for lead in ctx.db.upsert("leads", new_rows, on_conflict="org_id,company_id"):
        ctx.run.audit("lead.created", "lead", lead.get("id"), score=lead["score"], status=lead["status"])
    # Each batch has one column set, so an upsert never blanks columns it doesn't mention.
    ctx.db.upsert("leads", status_rows, on_conflict="org_id,company_id")
    ctx.db.upsert("leads", score_rows, on_conflict="org_id,company_id")

    ctx.run.count("leads_new", len(new_rows))
    ctx.run.count("leads_updated", len(status_rows) + len(score_rows))
    final = {company_id: lead["status"] for company_id, lead in leads.items()}
    final.update({row["company_id"]: row["status"] for row in new_rows + status_rows})
    ctx.run.count("leads_ready", sum(1 for s in final.values() if s == "ready"))
    ctx.run.count("leads_filtered", sum(1 for s in final.values() if s == "filtered"))
