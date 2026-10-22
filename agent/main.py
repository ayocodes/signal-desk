"""One agent tick.

    python -m agent.main --once                  run one tick (what GitHub Actions does every 30 minutes)
    python -m agent.main --dry-run               same reads and network calls, but no database writes
    python -m agent.main --rescore --org <uuid>  only re-score one org's leads with its newest rules
                                                 (started when an admin saves rules: rescore.yml)

Each organization gets its own run: an agent_runs row, its steps in order, an audit trail.
A failing side source (HN, a job board) is recorded and the tick continues; only the core
steps (discovery and scoring) make the process exit non-zero.
"""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from collections.abc import Callable

from agent import drafting, sequences, steps
from agent.config import load_config
from agent.db import Database
from agent.http_client import PoliteClient
from agent.llm import provider_from_settings
from agent.resend_client import ResendClient
from agent.run import RunRecorder, utc_now
from agent.settings import SettingsError, load_settings

STEPS: list[tuple[str, Callable[[steps.Context], None]]] = [
    ("discover", steps.discover),
    ("probe_job_boards", steps.probe_job_boards),
    ("refresh_hiring", steps.refresh_hiring),
    ("detect_launches", steps.detect_launches),
    ("detect_yc_recency", steps.detect_yc_recency),
    ("score_leads", steps.score_leads),
    ("draft_leads", drafting.draft_leads),
    ("run_sequences", sequences.run_sequences),
]
CORE_STEPS = {"discover", "score_leads"}


def run_org(settings, db: Database, client: PoliteClient, org: dict, dry_run: bool) -> RunRecorder:  # type: ignore[no-untyped-def]
    trigger = f"{settings.trigger}:dry-run" if dry_run else settings.trigger
    run = RunRecorder(db, org["id"], trigger)
    run.start()
    ctx = steps.Context(
        settings=settings, db=db, client=client, run=run, org_id=org["id"], now=utc_now(),
        config=load_config(org["id"], db),
        llm=None if dry_run else provider_from_settings(settings.llm),
        email=None if dry_run else ResendClient(settings.resend_api_key),
    )
    if ctx.config.problem:
        run.errors.append({"step": "load_config", "message": ctx.config.problem})
    for name, step in STEPS:
        with run.step(name):
            step(ctx)
    run.stats["http_requests"] = client.request_count
    run.stats["drafts_per_run"] = settings.drafts_per_run  # a setting, recorded so Ops can show it
    run.config_version = ctx.config.version
    run.job_boards = settings.job_boards
    run.finish()
    return run


# A save made while a re-score runs is picked up by looping, at most this many times.
MAX_RESCORE_ROUNDS = 3


def rescore_org(settings, db: Database, org: dict) -> RunRecorder:  # type: ignore[no-untyped-def,type-arg]
    """Re-scores one org's leads with its newest rules: no fetching, no drafting. Loops while a
    newer rules version was saved during the run, so that save applies without another run."""
    run = RunRecorder(db, org["id"], "rescore")
    run.start()
    done: int | None = None
    for round_number in range(1, MAX_RESCORE_ROUNDS + 1):
        config = load_config(org["id"], db)
        if config.version == done:
            break
        if config.problem:
            run.errors.append({"step": "load_config", "message": config.problem})
        ctx = steps.Context(
            settings=settings, db=db, client=None, run=run, org_id=org["id"], now=utc_now(),  # type: ignore[arg-type]
            config=config,
        )
        with run.step("score_leads" if round_number == 1 else f"score_leads_{round_number}"):
            steps.score_leads(ctx)
        done = config.version
        run.config_version = config.version
    run.finish()
    return run


def sequences_org(settings, db: Database, client: PoliteClient, org: dict) -> RunRecorder:  # type: ignore[no-untyped-def,type-arg]
    """Sends due sequence steps for one org, nothing else (started by fast-forward: rescore.yml)."""
    run = RunRecorder(db, org["id"], "sequences")
    run.start()
    config = load_config(org["id"], db)
    if config.problem:
        run.errors.append({"step": "load_config", "message": config.problem})
    ctx = steps.Context(
        settings=settings, db=db, client=client, run=run, org_id=org["id"], now=utc_now(), config=config,
        llm=provider_from_settings(settings.llm), email=ResendClient(settings.resend_api_key),
    )
    with run.step("run_sequences"):
        sequences.run_sequences(ctx)
    run.config_version = config.version
    run.finish()
    return run


def print_summary(org: dict, run: RunRecorder, db: Database) -> None:  # type: ignore[type-arg]
    print(f"\n== {org['name']} ({run.trigger}, rules: {run.config_version}, job boards: {', '.join(run.job_boards)}) ==")
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
    parser.add_argument("--rescore", action="store_true", help="only re-score leads with the org's newest rules")
    parser.add_argument("--sequences", action="store_true", help="only send due sequence steps")
    parser.add_argument("--org", help="the organization id (with --rescore or --sequences)")
    args = parser.parse_args(argv)
    if args.rescore or args.sequences:
        try:
            org_id = str(uuid.UUID(args.org or ""))
        except ValueError:
            print("--rescore and --sequences need --org <organization uuid>", file=sys.stderr)
            return 2

    try:
        settings = load_settings()
    except SettingsError as error:
        print(error, file=sys.stderr)
        return 2

    db = Database.from_settings(settings, dry_run=args.dry_run)
    if args.rescore or args.sequences:
        orgs = db.select_all("organizations", "id,name", id=org_id)
        if not orgs:
            print(f"No organization {org_id}", file=sys.stderr)
            return 2
        if args.sequences:
            with PoliteClient(settings.user_agent) as client:
                run = sequences_org(settings, db, client, orgs[0])
            print_summary(orgs[0], run, db)
            return 1 if any(error["step"] == "run_sequences" for error in run.errors) else 0
        run = rescore_org(settings, db, orgs[0])
        print_summary(orgs[0], run, db)
        return 1 if any(error["step"].startswith("score_leads") for error in run.errors) else 0

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
