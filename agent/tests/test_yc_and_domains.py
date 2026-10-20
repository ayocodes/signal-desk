import json
import os
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import httpx
import pytest

from agent.domains import normalize_domain, url_matches_domain
from agent.http_client import PoliteClient
from agent.sources.yc import batch_age_years, batch_start, load_dataset, parse_companies


@pytest.mark.parametrize(
    ("website", "expected"),
    [
        ("https://www.Trigger.dev/pricing", "trigger.dev"),
        ("trigger.dev", "trigger.dev"),
        ("http://app.example.co.uk/", "app.example.co.uk"),
        ("", None),
        (None, None),
        ("localhost", None),
    ],
)
def test_normalize_domain(website: str | None, expected: str | None) -> None:
    assert normalize_domain(website) == expected


def test_url_matches_the_company_domain_and_its_subdomains_only() -> None:
    assert url_matches_domain("https://trigger.dev/blog/launch", "trigger.dev")
    assert url_matches_domain("https://cloud.trigger.dev", "trigger.dev")
    assert not url_matches_domain("https://nottrigger.dev", "trigger.dev")
    assert not url_matches_domain("https://github.com/triggerdotdev/trigger.dev", "trigger.dev")
    assert not url_matches_domain(None, "trigger.dev")


def test_batch_dates_and_ages() -> None:
    assert batch_start("Summer 2024") == date(2024, 6, 1)
    assert batch_start("Fall 2026") == date(2026, 9, 1)
    assert batch_start("IK12") is None
    assert batch_age_years("Winter 2027", date(2026, 10, 20)) == 0.0  # upcoming batch
    assert batch_age_years("Winter 2023", date(2026, 1, 1)) == pytest.approx(3.0, abs=0.01)


def test_parse_companies_keeps_valid_records_and_counts_the_rest() -> None:
    payload = [
        {"id": 1, "name": "Chima", "slug": "chima", "batch": "Winter 2023", "status": "Active",
         "industry": "B2B", "isHiring": True, "team_size": 7, "tags": ["B2B"]},
        {"id": 2, "name": "Broken"},  # missing required fields
    ]
    companies, skipped = parse_companies(payload)
    assert [c.name for c in companies] == ["Chima"]
    assert companies[0].is_hiring is True
    assert skipped == 1


def test_uses_a_fresh_cache_without_downloading(tmp_path: Path) -> None:
    cache = tmp_path / "yc.json"
    cache.write_text(json.dumps([{"cached": True}]))

    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("should not download while the cache is fresh")

    with PoliteClient("t", transport=httpx.MockTransport(handler)) as client:
        assert load_dataset(client, cache_file=cache) == [{"cached": True}]


def test_falls_back_to_a_stale_cache_when_the_download_fails(tmp_path: Path) -> None:
    cache = tmp_path / "yc.json"
    cache.write_text(json.dumps([{"stale": True}]))
    old = (datetime.now(UTC) - timedelta(days=2)).timestamp()
    os.utime(cache, (old, old))

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404 if request.url.path == "/robots.txt" else 503)

    with PoliteClient("t", transport=httpx.MockTransport(handler), sleep=lambda _: None, max_retries=0) as client:
        assert load_dataset(client, cache_file=cache) == [{"stale": True}]
