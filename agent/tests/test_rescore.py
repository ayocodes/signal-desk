"""The re-score-only run started when an admin saves rules (agent/main.py rescore_org)."""

from typing import Any

import pytest

from agent import main
from agent.config import load_config


class FakeDb:
    dry_run = False

    def __init__(self) -> None:
        self.updates: list[dict[str, Any]] = []

    def insert(self, table: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [{**row, "id": "run-1"} for row in rows] if table == "agent_runs" else rows

    def update(self, table: str, values: dict[str, Any], **equals: Any) -> None:
        if table == "agent_runs":
            self.updates.append(values)


def run_with_versions(monkeypatch: pytest.MonkeyPatch, versions: list[int]) -> tuple[FakeDb, list[int]]:
    """Each load_config call returns the next version; score_leads records what it scored with."""
    queue = list(versions)
    scored: list[int] = []
    monkeypatch.setattr(main, "load_config", lambda org_id, db: load_config(org_id).model_copy(update={"version": queue.pop(0)}))
    monkeypatch.setattr(main.steps, "score_leads", lambda ctx: scored.append(ctx.config.version))
    db = FakeDb()
    main.rescore_org(None, db, {"id": "org-1", "name": "Org"})
    return db, scored


def test_one_round_when_nothing_was_saved_meanwhile(monkeypatch: pytest.MonkeyPatch) -> None:
    db, scored = run_with_versions(monkeypatch, [4, 4])
    assert scored == [4]
    assert db.updates[-1]["config_version"] == 4


def test_a_save_during_the_run_is_picked_up_without_another_run(monkeypatch: pytest.MonkeyPatch) -> None:
    db, scored = run_with_versions(monkeypatch, [4, 5, 5])
    assert scored == [4, 5]
    assert db.updates[-1]["config_version"] == 5


def test_the_loop_stops_after_three_rounds(monkeypatch: pytest.MonkeyPatch) -> None:
    _, scored = run_with_versions(monkeypatch, [4, 5, 6, 7])
    assert scored == [4, 5, 6]


def test_rescore_needs_an_org_uuid(capsys: pytest.CaptureFixture[str]) -> None:
    assert main.main(["--rescore", "--org", "not-a-uuid"]) == 2
    assert "need --org" in capsys.readouterr().err
