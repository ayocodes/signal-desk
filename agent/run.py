"""RunRecorder: everything one tick writes about itself (AGENTS.md: "Everything is logged").

- an agent_runs row with counts (stats), per-step timings (step_ms) and errors,
- audit_log rows for every meaningful agent action, written in one batch at the end.

A failing step is recorded and the run moves on, so one broken source can't sink the tick.
"""

from __future__ import annotations

import time
import traceback
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Any

from agent.db import Database, Row


def utc_now() -> datetime:
    return datetime.now(UTC)


class RunRecorder:
    def __init__(self, db: Database, org_id: str, trigger: str) -> None:
        self._db = db
        self.org_id = org_id
        self.trigger = trigger
        self.run_id: str | None = None
        self.stats: dict[str, int] = {}
        self.step_ms: dict[str, int] = {}
        self.errors: list[dict[str, str]] = []
        self.config_version: int | None = None
        self.job_boards: tuple[str, ...] = ()
        self._audit: list[Row] = []

    def start(self) -> None:
        rows = self._db.insert(
            "agent_runs",
            [{"org_id": self.org_id, "trigger": self.trigger, "started_at": utc_now().isoformat()}],
        )
        self.run_id = rows[0].get("id") if rows else None

    @contextmanager
    def step(self, name: str) -> Iterator[None]:
        """Times a step. An exception is recorded under the step's name and not re-raised."""
        started = time.perf_counter()
        try:
            yield
        except Exception as error:  # noqa: BLE001 - deliberate: record and continue with the next step
            self.errors.append({"step": name, "message": f"{type(error).__name__}: {error}"})
            print(f"[{name}] failed:\n{traceback.format_exc()}", flush=True)
        finally:
            self.step_ms[name] = round((time.perf_counter() - started) * 1000)

    def count(self, key: str, amount: int = 1) -> None:
        self.stats[key] = self.stats.get(key, 0) + amount

    def audit(self, action: str, entity_type: str, entity_id: str | None = None, **detail: Any) -> None:
        self._audit.append(
            {
                "org_id": self.org_id,
                "actor_type": "agent",
                "actor_id": None,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "detail": detail,
            }
        )

    def finish(self) -> None:
        self.audit(
            "agent.run_finished", "agent_run", self.run_id,
            stats=self.stats, errors=len(self.errors), config_version=self.config_version,
            job_boards=list(self.job_boards),
        )
        if self.run_id is not None:
            self._db.update(
                "agent_runs",
                {
                    "finished_at": utc_now().isoformat(),
                    "stats": self.stats,
                    "step_ms": self.step_ms,
                    "errors": self.errors,
                },
                id=self.run_id,
            )
        self._db.insert("audit_log", self._audit)
