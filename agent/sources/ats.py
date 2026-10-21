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

# Subdomain labels in front of the brand (app.acme.ai -> acme.ai).
DOMAIN_PREFIXES = {"app", "www", "get", "try", "use", "go", "join", "my"}
# Legal suffixes are never part of a board token ("DeepReach Inc." -> deepreach).
LEGAL_SUFFIX = re.compile(r"\b(inc|llc|ltd|limited|corp|corporation|co|gmbh|pbc)\b\.?", re.IGNORECASE)
# Trailing words a board token often drops ("Gojiberry AI" -> gojiberry).
GENERIC_TRAILING = {"ai", "labs", "hq", "technologies", "tech", "app", "io", "data", "software"}
MAX_GUESSES = 4


class BoardHostUnavailable(Exception):
    """A job-board site refused us (401/403, or 429/5xx after retries): skip it for this run."""

    def __init__(self, ats: Ats, status: int) -> None:
        self.ats = ats
        self.status = status
        super().__init__(f"{ATS_LABEL[ats]} answered {status}")


# 404/410 mean "no board for this token"; these mean "the site won't answer us right now".
UNAVAILABLE_STATUSES = {401, 403, 429}


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
    """Likely board tokens, most likely first, at most four.

    Measured on real YC companies (every hit was on Ashby, usually the plain brand name):
      'Trigger.dev' / trigger.dev        -> ['triggerdev', 'trigger', 'trigger-dev']
      'DeepReach Inc.' / deepreach.ai    -> ['deepreach', 'deepreachai']
      'Gojiberry AI' / gojiberry.ai      -> ['gojiberryai', 'gojiberry', ...]
      'TryNearby' / trynearby.com        -> ['trynearby', 'trynearbycom']
    """
    words = re.findall(r"[a-z0-9]+", LEGAL_SUFFIX.sub("", name.lower()))
    guesses: list[str] = []
    if words:
        guesses.append("".join(words))
        if len(words) > 1 and words[-1] in GENERIC_TRAILING:
            guesses.append("".join(words[:-1]))
    if domain:
        labels = domain.split(".")
        if labels[0] in DOMAIN_PREFIXES and len(labels) > 2:
            labels = labels[1:]
        # A glued prefix (getacme.com) needs no stripping: the name guess already covers "acme",
        # and stripping breaks brands that start with one ("Gojiberry" isn't "go" + "jiberry").
        guesses.append(re.sub(r"[^a-z0-9-]", "", labels[0]))
        guesses.append(re.sub(r"[^a-z0-9]", "", "".join(labels)))  # brand includes the TLD (triggerdev)
    if len(words) > 1:
        guesses.append("-".join(words))

    unique: list[str] = []
    for guess in guesses:
        if guess and guess not in unique:
            unique.append(guess)
    return unique[:MAX_GUESSES]


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
    """The board with its jobs, or None if this token has no board on this ATS.

    Raises BoardHostUnavailable when the site refuses or fails, so the caller can skip that
    site instead of recording "no board".
    """
    try:
        response = client.get(board_url(ats, token))
    except DisallowedByRobots:
        return None
    if response.status_code in (404, 410):
        return None
    if response.status_code in UNAVAILABLE_STATUSES or response.status_code >= 500:
        raise BoardHostUnavailable(ats, response.status_code)
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


@dataclass
class ProbeResult:
    board: Board | None
    # Sites where every guess got a clear answer (no refusal). Without a board, these are
    # proven "no board here"; others must be checked again later.
    checked: frozenset[Ats]


def probe_company(
    client: PoliteClient, name: str, domain: str | None, sites: tuple[Ats, ...], unavailable: dict[Ats, int]
) -> ProbeResult:
    """Tries each slug guess on each of `sites`, stopping at the first board found.

    Sites in `unavailable` (site -> status it answered) are skipped. A site that refuses us
    during the probe is added to it (shared across the run, so one blocked site doesn't burn
    the request budget). Network errors (httpx.HTTPError) propagate, so the caller can retry.
    """
    for token in slug_guesses(name, domain):
        for ats in sites:
            if ats in unavailable:
                continue
            try:
                board = fetch_board(client, ats, token)
            except BoardHostUnavailable as refused:
                unavailable[refused.ats] = refused.status
                print(f"{refused}; skipping {ATS_LABEL[refused.ats]} for the rest of this run.", flush=True)
                continue
            if board is not None:
                return ProbeResult(board, checked=frozenset({ats}))
    return ProbeResult(None, checked=frozenset(site for site in sites if site not in unavailable))

