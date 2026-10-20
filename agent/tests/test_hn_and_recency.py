from datetime import UTC, date, datetime, timedelta

import httpx
import pytest

from agent.http_client import PoliteClient
from agent.signals import funding_fingerprint, launch_fingerprint, launch_signal, yc_recency_signal
from agent.sources.hn import HITS_PER_PAGE, Story, fetch_launch_stories, match_stories, story_matches, title_names_company

NOW = datetime(2026, 10, 20, 12, tzinfo=UTC)


def story(title: str, url: str | None = None, story_id: str = "1") -> Story:
    return Story(id=story_id, title=title, url=url, points=42, comments=7, created_at=NOW, kind="show_hn")


@pytest.mark.parametrize(
    ("title", "name", "expected"),
    [
        ("Show HN: Drillbit - automate office work for contractors", "Drillbit", True),
        ("Launch HN: Respan (YC W24) - open-source AI gateway", "Respan", True),
        ("show hn: drillbit, now with invoices", "Drillbit", True),
        ("Show HN: Trigger.dev v4", "Trigger.dev", True),
        ("Show HN: Drillbits for everyone", "Drillbit", False),  # longer word
        ("Show HN: I built a Drillbit clone", "Drillbit", False),  # not at the start
        ("Ask HN: Is Drillbit any good?", "Drillbit", False),  # not a launch post
    ],
)
def test_title_rule(title: str, name: str, expected: bool) -> None:
    assert title_names_company(title, name) is expected


def launch(title: str, url: str | None = None, story_id: str = "1") -> Story:
    return Story(id=story_id, title=title, url=url, points=90, comments=40, created_at=NOW, kind="launch_hn")


def test_url_rule_uses_the_company_domain_but_not_shared_hosts() -> None:
    assert story_matches(story("Show HN: A thing", "https://blog.drillbit.com/launch"), "Drillbit", "drillbit.com", None)
    assert not story_matches(story("Show HN: A thing", "https://github.com/drillbit/x"), "Drillbit", "drillbit.com", None)


@pytest.mark.parametrize(
    ("title", "url", "name", "domain"),
    [
        # Real false positives from the live data: ordinary-word names on unrelated projects.
        ("Show HN: Native RSS Reader for Mac, iPhone and iPad", "https://apps.apple.com/us/app/x/1", "Native", "native.no"),
        ("Show HN: Agency - Manage Agents for Your Account", "https://agency.trading/", "Agency", "getagency.com"),
        ("Show HN: Voyager 1 could've lasted much longer", None, "Voyager", "voyager.so"),
    ],
)
def test_a_show_hn_title_alone_is_not_a_match(title: str, url: str | None, name: str, domain: str) -> None:
    assert not story_matches(story(title, url), name, domain, "Summer 2024")


def test_launch_hn_title_needs_the_companys_own_batch_marker() -> None:
    post = launch("Launch HN: Respan (YC W24) - open-source Rust AI gateway", "https://github.com/respan/gw")
    assert story_matches(post, "Respan", "respan.ai", "Winter 2024")
    assert not story_matches(post, "Respan", "respan.ai", "Summer 2024")  # same name, different batch
    assert not story_matches(launch("Launch HN: Respan builds gateways"), "Respan", "respan.ai", "Winter 2024")  # no marker


def test_match_stories_finds_url_and_launch_matches_once_per_company() -> None:
    stories = [
        story("Show HN: Drillbit - office work", "https://drillbit.com", "a"),  # URL
        story("Show HN: Something else", "https://app.chima.dev", "b"),  # URL, subdomain
        launch("Launch HN: Respan (YC W24) - AI gateway", "https://github.com/respan", "c"),  # title + batch
        story("Show HN: Native app for notes", "https://example.org", "d"),  # title only: ignored
    ]
    found = match_stories(stories, [
        ("co1", "Drillbit", "drillbit.com", "Summer 2024"),
        ("co2", "Chima", "chima.dev", "Winter 2023"),
        ("co3", "Respan", "respan.ai", "Winter 2024"),
        ("co4", "Native", "native.no", "Fall 2024"),
    ])
    assert {cid: [s.id for s in ss] for cid, ss in found.items()} == {"co1": ["a"], "co2": ["b"], "co3": ["c"]}


def test_fetch_splits_a_window_that_hits_the_algolia_cap() -> None:
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        filters = request.url.params.get("numericFilters", "")
        calls.append(filters)
        if request.url.params.get("tags") == "show_hn" and len(calls) == 1:
            hits = [{"objectID": str(i), "title": f"Show HN: P{i}", "created_at_i": int(NOW.timestamp())} for i in range(HITS_PER_PAGE)]
            return httpx.Response(200, json={"hits": hits})
        return httpx.Response(200, json={"hits": [{"objectID": "L1", "title": "Launch HN: Acme (YC F26)", "created_at_i": int(NOW.timestamp())}]
                                         if request.url.params.get("query") else []})

    with PoliteClient("t", transport=httpx.MockTransport(handler), sleep=lambda _: None) as client:
        stories = fetch_launch_stories(client, NOW, lookback_days=5)

    show_hn_calls = [c for c in calls if "<" in c]
    assert len(show_hn_calls) == 3  # the capped window, then its two halves
    assert any(s.kind == "launch_hn" and s.id == "L1" for s in stories)


def test_launch_signal_row() -> None:
    row = launch_signal("org", "co", story("Show HN: Drillbit", "https://drillbit.com", "99"))
    assert row["fingerprint"] == launch_fingerprint("co", "99") == "launch:co:hn:99"
    assert row["source_url"] == "https://news.ycombinator.com/item?id=99"
    assert row["meta"]["points"] == 42


def test_yc_recency_only_for_recent_or_upcoming_batches() -> None:
    today = date(2026, 10, 20)
    recent = yc_recency_signal("org", "co", "Fall 2026", "drillbit", today, recent_months=6)
    assert recent is not None and recent["title"] == "YC Fall 2026"
    assert recent["fingerprint"] == funding_fingerprint("co", "Fall 2026") == "funding:co:yc:fall-2026"
    assert yc_recency_signal("org", "co", "Spring 2026", None, today, 6) is not None  # 6 months ago
    assert yc_recency_signal("org", "co", "Winter 2026", None, today, 6) is None  # 9 months ago
    upcoming = yc_recency_signal("org", "co", "Winter 2027", None, today, 6)
    assert upcoming is not None and upcoming["occurred_at"].startswith("2026-10-20")  # not in the future
