"""Database access for the agent.

Uses the service-role key, which bypasses RLS (the agent works across the whole org).
In dry-run mode every write is skipped and counted instead, so `--dry-run` never changes data.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import Any

from supabase import Client, create_client

from agent.settings import Settings

Row = dict[str, Any]

PAGE_SIZE = 1000  # PostgREST's default maximum rows per response
WRITE_CHUNK = 500


def _chunks(rows: Sequence[Row], size: int) -> Iterable[Sequence[Row]]:
    for start in range(0, len(rows), size):
        yield rows[start : start + size]


class Database:
    def __init__(self, client: Client, *, dry_run: bool = False) -> None:
        self._client = client
        self.dry_run = dry_run
        self.skipped_writes: dict[str, int] = {}

    @classmethod
    def from_settings(cls, settings: Settings, *, dry_run: bool = False) -> Database:
        return cls(create_client(settings.supabase_url, settings.supabase_service_role_key), dry_run=dry_run)

    def _skip(self, table: str, count: int) -> None:
        self.skipped_writes[table] = self.skipped_writes.get(table, 0) + count

    def select_all(self, table: str, columns: str = "*", **equals: Any) -> list[Row]:
        """Every matching row, paging past PostgREST's 1000-row limit."""
        rows: list[Row] = []
        start = 0
        while True:
            query = self._client.table(table).select(columns)
            for column, value in equals.items():
                query = query.eq(column, value)
            page = query.order("id").range(start, start + PAGE_SIZE - 1).execute().data
            rows.extend(page)
            if len(page) < PAGE_SIZE:
                return rows
            start += PAGE_SIZE

    def upsert(
        self,
        table: str,
        rows: Sequence[Row],
        *,
        on_conflict: str,
        ignore_duplicates: bool = False,
    ) -> list[Row]:
        """Insert or update on the given unique columns. Returns the written rows.

        With ignore_duplicates=True existing rows are left alone and only newly inserted rows
        come back, which is how the agent counts "new" signals.
        """
        if not rows:
            return []
        if self.dry_run:
            self._skip(table, len(rows))
            return [dict(row) for row in rows]
        written: list[Row] = []
        for chunk in _chunks(rows, WRITE_CHUNK):
            result = (
                self._client.table(table)
                .upsert(list(chunk), on_conflict=on_conflict, ignore_duplicates=ignore_duplicates)
                .execute()
            )
            written.extend(result.data)
        return written

    def insert(self, table: str, rows: Sequence[Row]) -> list[Row]:
        if not rows:
            return []
        if self.dry_run:
            self._skip(table, len(rows))
            return [dict(row) for row in rows]
        written: list[Row] = []
        for chunk in _chunks(rows, WRITE_CHUNK):
            written.extend(self._client.table(table).insert(list(chunk)).execute().data)
        return written

    def update(self, table: str, values: Row, **equals: Any) -> None:
        if self.dry_run:
            self._skip(table, 1)
            return
        query = self._client.table(table).update(values)
        for column, value in equals.items():
            query = query.eq(column, value)
        query.execute()
