"""Launch signals from Hacker News (Algolia search API, public and keyless).

We fetch every "Show HN" story and every "Launch HN" story from the lookback window in a
few requests, then match them to companies locally. A story counts only if:
  - its URL is on the company's domain (or a subdomain), or
  - it is a Launch HN post whose title starts with the company name AND carries the
    company's own YC batch marker, e.g. "Launch HN: Respan (YC W24)" for a Winter 2024 company.
A Show HN title alone is not enough: on real data, names that are ordinary words ("Native",
"Open", "Agency") matched unrelated projects. False launches are worse than missed ones.
"""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from agent.domains import normalize_domain, url_matches_domain
from agent.http_client import PoliteClient

SEARCH_URL = "https://hn.algolia.com/api/v1/search_by_date"
HITS_PER_PAGE = 1000  # Algolia's cap: one query never returns more than this
INITIAL_WINDOW = timedelta(days=5)
MIN_WINDOW = timedelta(hours=6)
TITLE_PREFIX = re.compile(r"^(show|launch) hn\s*:\s*", re.IGNORECASE)
# "(YC W24)" -> Winter 2024. YC writes Spring batches with an X.
BATCH_MARKER = re.compile(r"\(YC ([WSFX])(\d{2})\)")
BATCH_SEASON = {"W": "Winter", "S": "Summer", "F": "Fall", "X": "Spring"}


@dataclass(frozen=True)
class Story:
    id: str
    title: str
    url: str | None
    points: int
    comments: int
    created_at: datetime
    kind: str  # "show_hn" | "launch_hn"


# (company id, name, domain, YC batch)
CompanyRef = tuple[str, str, str, str | None]


def _story(hit: dict[str, Any], kind: str) -> Story | None:
    title = hit.get("title")
    if not title or "objectID" not in hit or "created_at_i" not in hit:
        return None
    return Story(
        id=str(hit["objectID"]),
        title=str(title),
        url=hit.get("url"),
        points=int(hit.get("points") or 0),
        comments=int(hit.get("num_comments") or 0),
        created_at=datetime.fromtimestamp(int(hit["created_at_i"]), UTC),
        kind=kind,
    )


def _search(client: PoliteClient, params: dict[str, str | int]) -> list[dict[str, Any]]:
    response = client.get(SEARCH_URL, params={**params, "hitsPerPage": HITS_PER_PAGE})
    response.raise_for_status()
    return list(response.json().get("hits", []))


def _show_hn_window(client: PoliteClient, start: datetime, end: datetime) -> list[Story]:
    """All Show HN stories in [start, end). Splits the window if it hits Algolia's 1,000 cap."""
    hits = _search(
        client,
        {
            "tags": "show_hn",
            "numericFilters": f"created_at_i>={int(start.timestamp())},created_at_i<{int(end.timestamp())}",
        },
    )
    if len(hits) >= HITS_PER_PAGE and end - start > MIN_WINDOW:
        middle = start + (end - start) / 2
        return _show_hn_window(client, start, middle) + _show_hn_window(client, middle, end)
    return [s for s in (_story(hit, "show_hn") for hit in hits) if s]


def fetch_launch_stories(client: PoliteClient, now: datetime, lookback_days: int) -> list[Story]:
    since = now - timedelta(days=lookback_days)
    stories: dict[str, Story] = {}

    window_start = since
    while window_start < now:
        window_end = min(window_start + INITIAL_WINDOW, now)
        for story in _show_hn_window(client, window_start, window_end):
            stories[story.id] = story
        window_start = window_end

    launch_hits = _search(
        client,
        {"query": '"Launch HN"', "tags": "story", "numericFilters": f"created_at_i>={int(since.timestamp())}"},
    )
    for hit in launch_hits:
        story = _story(hit, "launch_hn")
        if story and story.title.lower().startswith("launch hn"):
            stories[story.id] = story
    return list(stories.values())


def title_names_company(title: str, company_name: str) -> bool:
    """'Show HN: Acme - ...' names 'Acme'; 'Show HN: Acmeville' and 'Show HN: I built Acme' don't."""
    rest = TITLE_PREFIX.sub("", title, count=1)
    if rest == title:
        return False
    pattern = re.compile(rf"^{re.escape(company_name)}(?![a-z0-9])", re.IGNORECASE)
    return pattern.match(rest.strip()) is not None


def title_batch(title: str) -> str | None:
    """'Launch HN: Respan (YC W24) - ...' -> 'Winter 2024'."""
    match = BATCH_MARKER.search(title)
    if match is None:
        return None
    return f"{BATCH_SEASON[match.group(1)]} 20{match.group(2)}"


def story_matches(story: Story, company_name: str, company_domain: str, company_batch: str | None) -> bool:
    if url_matches_domain(story.url, company_domain):
        return True
    return (
        story.kind == "launch_hn"
        and company_batch is not None
        and title_batch(story.title) == company_batch
        and title_names_company(story.title, company_name)
    )


def _first_word(text: str) -> str:
    match = re.match(r"[a-z0-9]+", text.lower())
    return match.group(0) if match else ""


def match_stories(
    stories: list[Story], companies: list[CompanyRef]
) -> dict[str, list[Story]]:
    """Maps company id -> matching stories. companies: (id, name, domain, yc_batch).

    Indexes by domain and by the first word of the name, so 4,000 stories x 1,000 companies
    stays fast.
    """
    by_first_word: dict[str, list[CompanyRef]] = defaultdict(list)
    by_domain: dict[str, list[CompanyRef]] = defaultdict(list)
    for company in companies:
        by_first_word[_first_word(company[1])].append(company)
        by_domain[company[2]].append(company)

    matches: dict[str, list[Story]] = defaultdict(list)
    for story in stories:
        candidates = list(by_first_word.get(_first_word(TITLE_PREFIX.sub("", story.title, count=1)), []))
        host = normalize_domain(story.url)
        if host:
            labels = host.split(".")
            # cloud.trigger.dev -> try cloud.trigger.dev, trigger.dev (subdomains match their parent)
            for i in range(len(labels) - 1):
                candidates += by_domain.get(".".join(labels[i:]), [])
        seen: set[str] = set()
        for company_id, name, domain, batch in candidates:
            if company_id not in seen and story_matches(story, name, domain, batch):
                matches[company_id].append(story)
                seen.add(company_id)
    return matches
