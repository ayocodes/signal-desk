"""One agent tick.

    python -m agent.main --once        run one tick (what GitHub Actions does every 30 minutes)
    python -m agent.main --dry-run     same reads and network calls, but no database writes

Each organization gets its own run: an agent_runs row, its steps in order, an audit trail.
A failing side source (HN, a job board) is recorded and the tick continues; only the core
steps (discovery and scoring) make the process exit non-zero.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Callable

from agent import steps
from agent.config import load_config
from agent.db import Database
from agent.http_client import PoliteClient
from agent.run import RunRecorder, utc_now
from agent.settings import SettingsError, load_settings

STEPS: list[tuple[str, Callable[[steps.Context], None]]] = [
    ("discover", steps.discover),
    ("probe_job_boards", steps.probe_job_boards),
    ("refresh_hiring", steps.refresh_hiring),
    ("detect_launches", steps.detect_launches),
    ("detect_yc_recency", steps.detect_yc_recency),
    ("score_leads", steps.score_leads),
]
CORE_STEPS = {"discover", "score_leads"}


def run_org(settings, db: Database, client: PoliteClient, org: dict, dry_run: bool) -> RunRecorder:  # type: ignore[no-untyped-def]
    trigger = f"{settings.trigger}:dry-run" if dry_run else settings.trigger
    run = RunRecorder(db, org["id"], trigger)
    run.start()
    ctx = steps.Context(
        settings=settings, db=db, client=client, run=run, org_id=org["id"], now=utc_now(),
        config=load_config(org["id"]),
    )
    for name, step in STEPS:
        with run.step(name):
            step(ctx)
    run.stats["http_requests"] = client.request_count
    run.config_version = ctx.config.version
    run.finish()
    return run


def print_summary(org: dict, run: RunRecorder, db: Database) -> None:  # type: ignore[type-arg]
    print(f"\n== {org['name']} ({run.trigger}, rules: {run.config_version}) ==")
    print("stats:   " + json.dumps(dict(sorted(run.stats.items()))))
    print("step ms: " + json.dumps(run.step_ms))
    if run.errors:
        print("errors:  " + json.dumps(run.errors))
    if db.dry_run:
        print("dry run, writes skipped: " + json.dumps(db.skipped_writes))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m agent.main", description="Run one Signal Desk agent tick.")
    parser.add_argument("--once", action="store_true", help="run one tick (the default)")
    parser.add_argument("--dry-run", action="store_true", help="read and fetch, but write nothing to the database")
    args = parser.parse_args(argv)

    try:
        settings = load_settings()
    except SettingsError as error:
        print(error, file=sys.stderr)
        return 2

    db = Database.from_settings(settings, dry_run=args.dry_run)
    organizations = db.select_all("organizations", "id,name")
    failed_core = False
    with PoliteClient(settings.user_agent) as client:
        for org in organizations:
            run = run_org(settings, db, client, org, args.dry_run)
            print_summary(org, run, db)
            failed_core |= any(error["step"] in CORE_STEPS for error in run.errors)
    return 1 if failed_core else 0


if __name__ == "__main__":
    sys.exit(main())
