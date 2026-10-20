from datetime import UTC, datetime

import httpx
import pytest

from agent import config
from agent.http_client import PoliteClient
from agent.signals import classify_title, excerpt_for, hiring_fingerprint, hiring_signals
from agent.sources.ats import html_to_text, parse_jobs, probe_company, slug_guesses

NOW = datetime(2026, 10, 20, 12, tzinfo=UTC)


@pytest.mark.parametrize(
    ("name", "domain", "expected"),
    [
        ("Trigger.dev", "trigger.dev", ["triggerdev", "trigger", "trigger-dev"]),
        ("DeepReach Inc.", "deepreach.ai", ["deepreach", "deepreachai"]),
        ("Prescience, Inc.", "getprescience.com", ["prescience", "getprescience", "getpresciencecom"]),
        ("Gojiberry AI", "gojiberry.ai", ["gojiberryai", "gojiberry", "gojiberry-ai"]),
        ("TryNearby", "trynearby.com", ["trynearby", "trynearbycom"]),
        ("Chima", "withchima.com", ["chima", "withchima", "withchimacom"]),
        ("Acme AI", "app.acme.ai", ["acmeai", "acme", "acme-ai"]),
    ],
)
def test_slug_guesses(name: str, domain: str, expected: list[str]) -> None:
    assert slug_guesses(name, domain) == expected


def test_slug_guesses_are_capped() -> None:
    assert len(slug_guesses("Some Long Name Labs Inc", "getsomelongname.io")) <= 4


@pytest.mark.parametrize(
    ("title", "category", "founding"),
    [
        ("Founding Account Executive", "sales", True),
        ("SDR (Remote)", "sales", False),
        ("Head of Sales, EMEA", "sales", False),
        ("Sales Development Representative", "sales", False),
        ("GTM Engineer", "gtm", False),
        ("Head of Growth", "gtm", False),
        ("Revenue Operations Lead", "gtm", False),
        ("First Sales Hire", "sales", True),
    ],
)
def test_sales_and_gtm_titles_are_classified(title: str, category: str, founding: bool) -> None:
    match = classify_title(title, config.hiring_keywords())
    assert match is not None
    assert (match.category, match.founding) == (category, founding)


@pytest.mark.parametrize(
    "title",
    ["Senior Software Engineer", "Salesforce Developer", "Sales Engineer", "Product Designer", "Sales Intern", "Wholesale Buyer"],
)
def test_other_titles_are_not_sales_signals(title: str) -> None:
    assert classify_title(title, config.hiring_keywords()) is None


def test_excerpt_picks_the_first_relevant_sentence_and_caps_length() -> None:
    text = "We are a small team in Austin. You will own outbound pipeline from first touch to close. Benefits are great."
    assert excerpt_for(text, config.hiring_keywords()) == "You will own outbound pipeline from first touch to close."
    long = "Sales " + "word " * 80 + "end."
    excerpt = excerpt_for(long, config.hiring_keywords())
    assert excerpt is not None and len(excerpt) <= 220 and excerpt.endswith("…")


def test_html_is_unescaped_and_stripped() -> None:
    assert html_to_text("&lt;p&gt;Own the &lt;b&gt;sales&lt;/b&gt; motion.&lt;/p&gt;&lt;p&gt;Remote.&lt;/p&gt;") == "Own the sales motion. Remote."


def test_each_provider_payload_parses_to_jobs() -> None:
    greenhouse = parse_jobs("greenhouse", {"jobs": [{"id": 7, "title": "AE", "absolute_url": "https://x/7",
                                                     "updated_at": "2026-10-19T10:00:00-04:00", "content": "&lt;p&gt;Hi&lt;/p&gt;",
                                                     "location": {"name": "NYC"}}]})
    lever = parse_jobs("lever", [{"id": "abc", "text": "SDR", "hostedUrl": "https://y", "createdAt": 1760000000000,
                                  "descriptionPlain": "Prospect.", "categories": {"location": "Remote"}}])
    ashby = parse_jobs("ashby", {"jobs": [{"id": "u1", "title": "Head of Growth", "jobUrl": "https://z",
                                           "publishedAt": "2026-10-18T00:00:00Z", "descriptionPlain": "Grow."}]})
    assert (greenhouse[0].id, greenhouse[0].description, greenhouse[0].location) == ("7", "Hi", "NYC")
    assert lever[0].published_at is not None and lever[0].published_at.tzinfo is not None
    assert ashby[0].title == "Head of Growth"


def test_probe_stops_at_the_first_board_found() -> None:
    requested: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        requested.append(f"{request.url.host}{request.url.path}")
        if request.url.host == "api.ashbyhq.com" and request.url.path.endswith("/triggerdev"):
            return httpx.Response(200, json={"jobs": [{"id": "j1", "title": "Founding AE", "jobUrl": "https://j"}]})
        return httpx.Response(404)

    with PoliteClient("t", transport=httpx.MockTransport(handler), sleep=lambda _: None) as client:
        board = probe_company(client, "Trigger.dev", "trigger.dev")

    assert board is not None and (board.ats, board.token) == ("ashby", "triggerdev")
    assert requested == ["api.ashbyhq.com/posting-api/job-board/triggerdev"]  # first guess, first ATS


def test_hiring_signals_only_for_sales_roles_with_stable_fingerprints() -> None:
    jobs = parse_jobs("ashby", {"jobs": [
        {"id": "j1", "title": "Founding Account Executive", "jobUrl": "https://j/1", "descriptionPlain": "Own the sales cycle."},
        {"id": "j2", "title": "Backend Engineer", "jobUrl": "https://j/2", "descriptionPlain": "Build APIs."},
    ]})
    rows = hiring_signals("org", "co", "ashby", jobs, config.hiring_keywords(), NOW)
    assert len(rows) == 1
    assert rows[0]["title"] == "Hiring: Founding Account Executive"
    assert rows[0]["source_name"] == "Ashby"
    assert rows[0]["fingerprint"] == hiring_fingerprint("co", "ashby", "j1") == "hiring:co:ashby:j1"
    assert rows[0]["meta"]["founding"] is True
