"""The steps of one agent tick. main.py runs them in order, each inside run.step(...).

Each step reads what it needs from the database, does its work, and writes back with
upserts on unique keys, so running a step twice never duplicates anything.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

import httpx

from agent import config
from agent.db import Database, Row
from agent.domains import normalize_domain
from agent.http_client import PoliteClient
from agent.icp import evaluate
from agent.run import RunRecorder
from agent.settings import Settings
from agent.signals import hiring_signals, launch_signal, yc_recency_signal
from agent.sources import ats, hn, yc
from agent.sources.yc import batch_start

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
    rules = config.scoring()
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


def _probe_order(row: Row) -> tuple[int, int, int]:
    """Full matches before partial; then companies YC lists as hiring; then newest batch."""
    start = batch_start(row.get("yc_batch") or "")
    return (
        0 if row.get("icp_tier") == "full" else 1,
        0 if row.get("yc_is_hiring") else 1,
        -(start.toordinal() if start else 0),
    )


def probe_job_boards(ctx: Context) -> None:
    """Finds public job boards for companies not probed yet, within the per-run request budget."""
    pending = [
        row
        for row in companies(ctx, "id,name,domain,icp_tier,yc_is_hiring,yc_batch,ats_probed_at")
        if row["ats_probed_at"] is None
    ]
    pending.sort(key=_probe_order)
    ctx.run.count("probe_queue", len(pending))

    budget_start = ctx.client.request_count
    keywords = config.hiring_keywords()
    for row in pending:
        if ctx.client.request_count - budget_start >= ctx.settings.discovery_probes_per_run:
            break
        try:
            board = ats.probe_company(ctx.client, row["name"], row["domain"])
        except httpx.HTTPError as error:
            # Network trouble: leave it unprobed so the next run tries again.
            ctx.run.count("probe_errors")
            print(f"Probe failed for {row['domain']}: {type(error).__name__}", flush=True)
            continue

        ctx.run.count("companies_probed")
        update: dict[str, Any] = {"ats_probed_at": ctx.now.isoformat()}
        if board is not None:
            update |= {"ats_type": board.ats, "ats_token": board.token, "jobs_fetched_at": ctx.now.isoformat()}
            ctx.run.count("boards_found")
            ctx.run.audit("company.ats_found", "company", row["id"], ats=board.ats, token=board.token, jobs=len(board.jobs))
            save_signals(ctx, hiring_signals(ctx.org_id, row["id"], board.ats, board.jobs, keywords, ctx.now))
        ctx.db.update("companies", update, id=row["id"])

    ctx.run.count("probe_requests", ctx.client.request_count - budget_start)


def refresh_hiring(ctx: Context) -> None:
    """Re-reads known job boards whose jobs are older than the refresh window."""
    window = timedelta(hours=config.scoring().signal_windows.jobs_refresh_hours)
    due = [
        row
        for row in companies(ctx, "id,domain,ats_type,ats_token,jobs_fetched_at")
        if row["ats_type"]
        and (row["jobs_fetched_at"] is None or datetime.fromisoformat(row["jobs_fetched_at"]) < ctx.now - window)
    ]
    keywords = config.hiring_keywords()
    for row in due[:MAX_BOARD_REFRESHES]:
        try:
            board = ats.fetch_board(ctx.client, row["ats_type"], row["ats_token"])
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
    window = config.scoring().signal_windows.launch_lookback_days
    stories = hn.fetch_launch_stories(ctx.client, ctx.now, window)
    ctx.run.count("hn_stories", len(stories))
    tracked = [(r["id"], r["name"], r["domain"], r["yc_batch"]) for r in companies(ctx, "id,name,domain,yc_batch")]
    matches = hn.match_stories(stories, tracked)
    rows = [launch_signal(ctx.org_id, company_id, story) for company_id, found in matches.items() for story in found]
    ctx.run.count("launch_matches", len(rows))
    save_signals(ctx, rows)


def detect_yc_recency(ctx: Context) -> None:
    """A recent YC batch is a weak funding signal."""
    months = config.scoring().signal_windows.funding_recent_months
    rows = [
        signal
        for r in companies(ctx, "id,yc_batch,yc_slug")
        if r["yc_batch"]
        and (signal := yc_recency_signal(ctx.org_id, r["id"], r["yc_batch"], r["yc_slug"], ctx.now.date(), months))
    ]
    save_signals(ctx, rows)
