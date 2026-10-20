"""The YC companies dataset (community-maintained yc-oss mirror of the YC directory).

One JSON file of every launched company, refreshed daily upstream. We download it at most
once per 24h and keep a local copy (agent/.cache; GitHub Actions caches it by date).
It has no founder names, so contacts start as placeholders (see contacts.py).
"""

from __future__ import annotations

import json
import re
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from agent.http_client import PoliteClient
from agent.settings import REPO_ROOT

DATASET_URL = "https://yc-oss.github.io/api/companies/all.json"
CACHE_FILE = REPO_ROOT / "agent" / ".cache" / "yc-companies.json"
CACHE_MAX_AGE = timedelta(hours=24)

# Month each batch starts, used for "batch age" and the recent-batch signal.
BATCH_START_MONTH = {"Winter": 1, "Spring": 4, "Summer": 6, "Fall": 9}
BATCH_PATTERN = re.compile(r"^(Winter|Spring|Summer|Fall) (\d{4})$")


class YcCompany(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)

    id: int
    name: str
    slug: str
    website: str | None = None
    batch: str
    status: str
    industry: str
    subindustry: str | None = None
    industries: tuple[str, ...] = ()
    tags: tuple[str, ...] = ()
    team_size: int | None = None
    is_hiring: bool = Field(default=False, alias="isHiring")
    nonprofit: bool = False
    one_liner: str | None = None


def batch_start(batch: str) -> date | None:
    """'Summer 2024' -> 2024-06-01. None for anything unrecognized."""
    match = BATCH_PATTERN.match(batch.strip())
    if match is None:
        return None
    return date(int(match.group(2)), BATCH_START_MONTH[match.group(1)], 1)


def batch_age_years(batch: str, today: date) -> float | None:
    """Years since the batch started. Upcoming batches count as 0."""
    start = batch_start(batch)
    if start is None:
        return None
    return max(0.0, (today - start).days / 365.25)


def parse_companies(payload: object) -> tuple[list[YcCompany], int]:
    """Valid companies plus a count of records that didn't match the expected shape."""
    if not isinstance(payload, list):
        raise ValueError("The YC dataset should be a JSON list")
    companies: list[YcCompany] = []
    skipped = 0
    for record in payload:
        try:
            companies.append(YcCompany.model_validate(record))
        except ValidationError:
            skipped += 1
    return companies, skipped


def _cache_is_fresh(path: Path, now: datetime) -> bool:
    if not path.exists():
        return False
    modified = datetime.fromtimestamp(path.stat().st_mtime, UTC)
    return now - modified < CACHE_MAX_AGE


def load_dataset(client: PoliteClient, *, cache_file: Path = CACHE_FILE, now: datetime | None = None) -> object:
    """The raw dataset: from the cache if under 24h old, otherwise downloaded (and cached).

    If the download fails but an older copy exists, the older copy is used.
    """
    now = now or datetime.now(UTC)
    if _cache_is_fresh(cache_file, now):
        return json.loads(cache_file.read_text(encoding="utf-8"))

    try:
        response = client.get(DATASET_URL)
        response.raise_for_status()
        payload = response.json()
    except Exception:
        if cache_file.exists():
            print("YC dataset download failed; using the older cached copy.", flush=True)
            return json.loads(cache_file.read_text(encoding="utf-8"))
        raise

    cache_file.parent.mkdir(parents=True, exist_ok=True)
    temporary = cache_file.with_suffix(".tmp")
    temporary.write_text(json.dumps(payload), encoding="utf-8")
    temporary.replace(cache_file)  # atomic, so a crash never leaves half a file
    return payload
