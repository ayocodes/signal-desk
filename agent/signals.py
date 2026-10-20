"""Turning raw source data into signal rows.

Every signal gets a fingerprint (type + company + source id). The database has a unique
constraint on (org_id, fingerprint), so re-running the agent can never duplicate a signal.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from typing import Any

from agent.config import HiringKeywords
from agent.sources.ats import ATS_LABEL, Ats, Job

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
        if any(_contains(text, phrase) for phrase in phrases):
            founding = any(_contains(text, phrase) for phrase in keywords.founding)
            return RoleMatch(category, founding)
    return None


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
                "title": f"Hiring: {job.title}",
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
