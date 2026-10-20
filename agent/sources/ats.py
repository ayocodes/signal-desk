"""Public job boards: Greenhouse, Lever, Ashby.

Each has a public, keyless JSON endpoint per company "board token" (slug). We don't know a
company's slug, so we guess a few from its name and domain and stop at the first board that
answers. Probing and fetching are the same request: a found board comes back with its jobs.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from html.parser import HTMLParser
from typing import Any, Literal

from agent.http_client import DisallowedByRobots, PoliteClient

Ats = Literal["greenhouse", "lever", "ashby"]
ATS_ORDER: tuple[Ats, ...] = ("ashby", "greenhouse", "lever")
ATS_LABEL: dict[Ats, str] = {"greenhouse": "Greenhouse", "lever": "Lever", "ashby": "Ashby"}

# Prefixes some companies put on their marketing domain (app.x.com, getx.com is a different case).
DOMAIN_PREFIXES = {"app", "www", "get", "try", "use", "go", "join", "my"}


@dataclass(frozen=True)
class Job:
    id: str
    title: str
    url: str | None
    published_at: datetime | None
    description: str  # plain text
    location: str | None


@dataclass(frozen=True)
class Board:
    ats: Ats
    token: str
    jobs: tuple[Job, ...]


def board_url(ats: Ats, token: str) -> str:
    if ats == "greenhouse":
        return f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true"
    if ats == "lever":
        return f"https://api.lever.co/v0/postings/{token}?mode=json"
    return f"https://api.ashbyhq.com/posting-api/job-board/{token}"


def slug_guesses(name: str, domain: str | None) -> list[str]:
    """Likely board tokens, most likely first, at most three.

    'Trigger.dev' / trigger.dev -> ['triggerdev', 'trigger', 'trigger-dev']
    """
    guesses: list[str] = []
    compact_name = re.sub(r"[^a-z0-9]", "", name.lower())
    if compact_name:
        guesses.append(compact_name)
    if domain:
        labels = domain.split(".")
        if labels and labels[0] in DOMAIN_PREFIXES and len(labels) > 2:
            labels = labels[1:]
        guesses.append(re.sub(r"[^a-z0-9]", "", "".join(labels)))  # domain without dots
        guesses.append(re.sub(r"[^a-z0-9-]", "", labels[0]))  # domain stem
    hyphenated = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if hyphenated:
        guesses.append(hyphenated)

    unique: list[str] = []
    for guess in guesses:
        if guess and guess not in unique:
            unique.append(guess)
    return unique[:3]


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"p", "br", "li", "div", "h1", "h2", "h3", "h4"}:
            self.parts.append(" ")


def html_to_text(markup: str | None) -> str:
    """Greenhouse sends HTML-escaped HTML; unescape, drop tags, collapse whitespace."""
    if not markup:
        return ""
    extractor = _TextExtractor()
    extractor.feed(html.unescape(markup))
    return re.sub(r"\s+", " ", html.unescape(" ".join(extractor.parts))).strip()


def _parse_time(value: Any) -> datetime | None:
    if isinstance(value, (int, float)):  # Lever: milliseconds since epoch
        return datetime.fromtimestamp(value / 1000, UTC)
    if isinstance(value, str) and value:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    return None


def parse_jobs(ats: Ats, payload: Any) -> tuple[Job, ...]:
    if ats == "greenhouse":
        items = payload.get("jobs", []) if isinstance(payload, dict) else []
        return tuple(
            Job(
                id=str(item["id"]),
                title=str(item.get("title", "")).strip(),
                url=item.get("absolute_url"),
                published_at=_parse_time(item.get("updated_at")),
                description=html_to_text(item.get("content")),
                location=(item.get("location") or {}).get("name"),
            )
            for item in items
            if "id" in item
        )
    if ats == "lever":
        items = payload if isinstance(payload, list) else []
        return tuple(
            Job(
                id=str(item["id"]),
                title=str(item.get("text", "")).strip(),
                url=item.get("hostedUrl"),
                published_at=_parse_time(item.get("createdAt")),
                description=str(item.get("descriptionPlain") or html_to_text(item.get("description"))),
                location=(item.get("categories") or {}).get("location"),
            )
            for item in items
            if "id" in item
        )
    items = payload.get("jobs", []) if isinstance(payload, dict) else []
    return tuple(
        Job(
            id=str(item["id"]),
            title=str(item.get("title", "")).strip(),
            url=item.get("jobUrl"),
            published_at=_parse_time(item.get("publishedAt")),
            description=str(item.get("descriptionPlain") or html_to_text(item.get("descriptionHtml"))),
            location=item.get("location"),
        )
        for item in items
        if "id" in item
    )


def fetch_board(client: PoliteClient, ats: Ats, token: str) -> Board | None:
    """The board with its jobs, or None if this token has no board on this ATS."""
    try:
        response = client.get(board_url(ats, token))
    except DisallowedByRobots:
        return None
    if response.status_code in (404, 410):
        return None
    response.raise_for_status()
    try:
        payload = response.json()
    except ValueError:
        return None
    # Lever answers some unknown tokens with {"ok": false}; treat anything unexpected as no board.
    if ats == "lever" and not isinstance(payload, list):
        return None
    if ats != "lever" and not (isinstance(payload, dict) and isinstance(payload.get("jobs"), list)):
        return None
    return Board(ats, token, parse_jobs(ats, payload))


def probe_company(client: PoliteClient, name: str, domain: str | None) -> Board | None:
    """Tries each slug guess on each ATS, stopping at the first board found.

    Network errors (httpx.HTTPError) propagate, so the caller can retry the company next run
    instead of recording "no board".
    """
    for token in slug_guesses(name, domain):
        for ats in ATS_ORDER:
            board = fetch_board(client, ats, token)
            if board is not None:
                return board
    return None

