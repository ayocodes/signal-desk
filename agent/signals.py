"""Turning raw source data into signal rows.

Every signal gets a fingerprint (type + company + source id). The database has a unique
constraint on (org_id, fingerprint), so re-running the agent can never duplicate a signal.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, date, datetime
from functools import lru_cache
from typing import Any

from agent.config import HiringKeywords
from agent.sources.ats import ATS_LABEL, Ats, Job
from agent.sources.hn import Story
from agent.sources.yc import batch_start

EXCERPT_MAX = 220
SENTENCE_END = re.compile(r"(?<=[.!?])\s+")
# Words that make a sentence "relevant" for the excerpt, beyond the title keywords.
EXCERPT_HINTS = ("customer", "pipeline", "revenue", "sales", "outbound", "deal", "quota", "prospect", "market")


@dataclass(frozen=True)
class RoleMatch:
    category: str
    founding: bool


@lru_cache(maxsize=256)
def _phrase_pattern(phrase: str) -> re.Pattern[str]:
    words = (re.escape(word) for word in phrase.lower().split())
    return re.compile(r"\b" + r"[\s\-]+".join(words) + r"\b")


def _contains(text: str, phrase: str) -> bool:
    return _phrase_pattern(phrase).search(text) is not None


def classify_title(title: str, keywords: HiringKeywords) -> RoleMatch | None:
    """The sales/GTM category a job title belongs to, or None if it isn't a sales/GTM role."""
    text = title.lower()
    excepted = any(_contains(text, phrase) for phrase in keywords.exclude_exceptions)
    if not excepted and any(_contains(text, phrase) for phrase in keywords.exclude):
        return None
    for category, phrases in keywords.categories.items():
        if not any(_contains(text, phrase) for phrase in phrases):
            continue
        if any(_contains(text, phrase) for phrase in keywords.category_exclude.get(category, ())):
            continue
        founding = any(_contains(text, phrase) for phrase in keywords.founding)
        return RoleMatch(category, founding)
    return None


MARKETING = "marketing"


def hiring_label(category: str) -> str:
    """How a hiring signal is named in titles and score parts."""
    return "Marketing hire" if category == MARKETING else "Hiring"


def excerpt_for(description: str, keywords: HiringKeywords) -> str | None:
    """The first relevant sentence of a job description, at most 220 characters."""
    sentences = [s.strip() for s in SENTENCE_END.split(description) if s.strip()]
    if not sentences:
        return None
    hints = [p for phrases in keywords.categories.values() for p in phrases] + list(EXCERPT_HINTS)
    chosen = next((s for s in sentences if any(_contains(s.lower(), h) for h in hints)), sentences[0])
    if len(chosen) <= EXCERPT_MAX:
        return chosen
    cut = chosen[: EXCERPT_MAX - 1].rsplit(" ", 1)[0]
    return f"{cut}…"


def hiring_fingerprint(company_id: str, ats: Ats, job_id: str) -> str:
    return f"hiring:{company_id}:{ats}:{job_id}"


def launch_fingerprint(company_id: str, story_id: str) -> str:
    return f"launch:{company_id}:hn:{story_id}"


def funding_fingerprint(company_id: str, batch: str) -> str:
    return f"funding:{company_id}:yc:{batch.lower().replace(' ', '-')}"


def hiring_signals(
    org_id: str, company_id: str, ats: Ats, jobs: tuple[Job, ...], keywords: HiringKeywords, now: datetime
) -> list[dict[str, Any]]:
    """One hiring signal per sales/GTM role on the board."""
    rows: list[dict[str, Any]] = []
    for job in jobs:
        match = classify_title(job.title, keywords)
        if match is None:
            continue
        rows.append(
            {
                "org_id": org_id,
                "company_id": company_id,
                "type": "hiring",
                "title": f"{hiring_label(match.category)}: {job.title}",
                "excerpt": excerpt_for(job.description, keywords),
                "source_name": ATS_LABEL[ats],
                "source_url": job.url,
                "occurred_at": (job.published_at or now).isoformat(),
                "fingerprint": hiring_fingerprint(company_id, ats, job.id),
                "meta": {
                    "category": match.category,
                    "founding": match.founding,
                    "location": job.location,
                    "ats": ats,
                    "job_id": job.id,
                },
            }
        )
    return rows


def launch_signal(org_id: str, company_id: str, story: Story) -> dict[str, Any]:
    label = "Launch HN" if story.kind == "launch_hn" else "Show HN"
    return {
        "org_id": org_id,
        "company_id": company_id,
        "type": "launch",
        "title": story.title,
        "excerpt": f"{label} post with {story.points} points and {story.comments} comments.",
        "source_name": "Hacker News",
        "source_url": f"https://news.ycombinator.com/item?id={story.id}",
        "occurred_at": story.created_at.isoformat(),
        "fingerprint": launch_fingerprint(company_id, story.id),
        "meta": {"kind": story.kind, "points": story.points, "comments": story.comments, "url": story.url},
    }


def yc_recency_signal(
    org_id: str, company_id: str, batch: str, slug: str | None, today: date, recent_months: int
) -> dict[str, Any] | None:
    """A weak funding signal for a batch that started within the window (or hasn't started yet)."""
    start = batch_start(batch)
    if start is None:
        return None
    months_ago = (today.year - start.year) * 12 + (today.month - start.month)
    if months_ago > recent_months:
        return None
    occurred = min(start, today)
    return {
        "org_id": org_id,
        "company_id": company_id,
        "type": "funding",
        "title": f"YC {batch}",
        "excerpt": f"Joined Y Combinator in the {batch} batch.",
        "source_name": "YC directory",
        "source_url": f"https://www.ycombinator.com/companies/{slug}" if slug else None,
        "occurred_at": datetime(occurred.year, occurred.month, occurred.day, tzinfo=UTC).isoformat(),
        "fingerprint": funding_fingerprint(company_id, batch),
        "meta": {"batch": batch},
    }
