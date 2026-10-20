"""Typed access to the shared rule files in /shared (read by the web app too).

Scoring weights, ICP rules, keyword lists and guardrail numbers live there, never in code.
"""

from __future__ import annotations

import json
from functools import lru_cache

from pydantic import BaseModel, ConfigDict, Field

from agent.settings import REPO_ROOT

SHARED = REPO_ROOT / "shared"


class _Model(BaseModel):
    model_config = ConfigDict(populate_by_name=True, frozen=True, extra="forbid")


class IcpPoints(_Model):
    full: int
    partial: int


class SignalPoints(_Model):
    hiring_sales: int
    hiring_founding_sales_bonus: int
    launch: int
    funding_yc_recent: int


class FreshnessStep(_Model):
    max_hours: int = Field(alias="maxHours")
    points: int


class IcpRules(_Model):
    status: str
    b2b: bool
    team_size_min: int = Field(alias="teamSizeMin")
    team_size_max: int = Field(alias="teamSizeMax")
    max_batch_age_years: float = Field(alias="maxBatchAgeYears")


class PartialRules(_Model):
    team_size_min: int = Field(alias="teamSizeMin")
    team_size_max: int = Field(alias="teamSizeMax")
    max_batch_age_years: float = Field(alias="maxBatchAgeYears")


class SignalWindows(_Model):
    jobs_refresh_hours: int = Field(alias="jobsRefreshHours")
    launch_lookback_days: int = Field(alias="launchLookbackDays")
    funding_recent_months: int = Field(alias="fundingRecentMonths")


class ScoringConfig(_Model):
    threshold: int
    icp: IcpPoints
    signals: SignalPoints
    freshness: tuple[FreshnessStep, ...]
    stacked_per_extra_signal_type: int = Field(alias="stackedPerExtraSignalType")
    icp_rules: IcpRules = Field(alias="icpRules")
    partial_rules: PartialRules = Field(alias="partialRules")
    signal_windows: SignalWindows = Field(alias="signalWindows")


class HiringKeywords(_Model):
    categories: dict[str, tuple[str, ...]]
    founding: tuple[str, ...]
    exclude: tuple[str, ...]
    exclude_exceptions: tuple[str, ...] = Field(alias="excludeExceptions")


class MailboxRules(_Model):
    daily_cap: int = Field(alias="dailyCap")
    pause_bounce_pct: float = Field(alias="pauseBouncePct")
    pause_complaint_pct: float = Field(alias="pauseComplaintPct")
    min_sends_for_rates: int = Field(alias="minSendsForRates")


class TestInboxShare(_Model):
    bounced_per_100: int = Field(alias="bouncedPer100")
    complained_per_100: int = Field(alias="complainedPer100")


class GuardrailsConfig(_Model):
    max_body_words: int = Field(alias="maxBodyWords")
    require_closing_question: bool = Field(alias="requireClosingQuestion")
    banned_chars: tuple[str, ...] = Field(alias="bannedChars")
    banned_phrases: tuple[str, ...] = Field(alias="bannedPhrases")
    mailbox: MailboxRules
    test_inboxes: TestInboxShare = Field(alias="testInboxes")


def _read(name: str) -> object:
    return json.loads((SHARED / name).read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def scoring() -> ScoringConfig:
    return ScoringConfig.model_validate(_read("scoring.json"))


@lru_cache(maxsize=1)
def hiring_keywords() -> HiringKeywords:
    return HiringKeywords.model_validate(_read("hiring_keywords.json"))


@lru_cache(maxsize=1)
def guardrails() -> GuardrailsConfig:
    return GuardrailsConfig.model_validate(_read("guardrails.json"))
