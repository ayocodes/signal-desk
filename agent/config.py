"""The agent's rules, through one function: load_config(org_id).

ICP rules, scoring weights, the threshold, keyword lists and guardrail numbers are never
read anywhere else (agent/tests/test_config.py enforces it). Today load_config returns the
/shared JSON defaults for every organization; Phase 4.5 moves rules into the database per
org (versioned), and only this module changes.
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
    hiring_marketing: int
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


class ScoreBand(_Model):
    min: int
    label: str


class ScoringConfig(_Model):
    threshold: int
    weak_signal_types: tuple[str, ...] = Field(alias="weakSignalTypes")
    # Display labels for ready leads (the web app shows them next to the score).
    score_bands: tuple[ScoreBand, ...] = Field(alias="scoreBands")
    icp: IcpPoints
    signals: SignalPoints
    freshness: tuple[FreshnessStep, ...]
    stacked_per_extra_signal_type: int = Field(alias="stackedPerExtraSignalType")
    icp_rules: IcpRules = Field(alias="icpRules")
    partial_rules: PartialRules = Field(alias="partialRules")
    signal_windows: SignalWindows = Field(alias="signalWindows")


class HiringKeywords(_Model):
    # Checked in order; the first category that matches wins (sales before gtm before marketing).
    categories: dict[str, tuple[str, ...]]
    # Phrases that disqualify a title from one category only (e.g. gtm skips "marketing" titles).
    category_exclude: dict[str, tuple[str, ...]] = Field(default_factory=dict, alias="categoryExclude")
    founding: tuple[str, ...]
    exclude: tuple[str, ...]
    exclude_exceptions: tuple[str, ...] = Field(alias="excludeExceptions")


class MailboxRules(_Model):
    daily_cap: int = Field(alias="dailyCap")
    pause_bounce_pct: float = Field(alias="pauseBouncePct")
    pause_complaint_pct: float = Field(alias="pauseComplaintPct")
    min_sends_for_rates: int = Field(alias="minSendsForRates")


class InboxShare(_Model):
    bounced_per_100: int = Field(alias="bouncedPer100")
    complained_per_100: int = Field(alias="complainedPer100")


class GuardrailsConfig(_Model):
    max_body_words: int = Field(alias="maxBodyWords")
    require_closing_question: bool = Field(alias="requireClosingQuestion")
    banned_chars: tuple[str, ...] = Field(alias="bannedChars")
    banned_phrases: tuple[str, ...] = Field(alias="bannedPhrases")
    # Claims about customers; allowed only as part of a listed proof point (outreach.json).
    claim_phrases: tuple[str, ...] = Field(alias="claimPhrases")
    min_grounded_phrase_chars: int = Field(alias="minGroundedPhraseChars")
    max_subject_chars: int = Field(alias="maxSubjectChars")
    mailbox: MailboxRules
    test_inboxes: InboxShare = Field(alias="testInboxes")


class Sender(_Model):
    name: str
    company: str


class Angles(_Model):
    signal: str
    peer: str
    short: str


class LlmRules(_Model):
    # Share of LLM_DAILY_BUDGET the agent may use; the rest is kept for the web app.
    agent_share: float = Field(alias="agentShare")
    min_seconds_between_calls: float = Field(alias="minSecondsBetweenCalls")
    regenerate_per_user_per_hour: int = Field(alias="regeneratePerUserPerHour")
    max_retries_per_lead: int = Field(alias="maxRetriesPerLead")


class OutreachConfig(_Model):
    """Who sends, what they offer, and the only claims a draft may make about them."""

    sender: Sender
    offer: str
    proof_points: tuple[str, ...] = Field(alias="proofPoints")
    angles: Angles
    max_signals_in_prompt: int = Field(alias="maxSignalsInPrompt")
    llm: LlmRules


class Prompts(_Model):
    draft: str
    raw: str
    # JSON schema the model's answer must follow (Gemini's structured output).
    draft_schema: dict[str, object]


class AgentConfig(_Model):
    """Every rule one agent run uses, for one organization."""

    # Which rules produced a score: "defaults" for the /shared files; a database version id
    # once rules are stored per org (Phase 4.5).
    version: str
    scoring: ScoringConfig
    keywords: HiringKeywords
    guardrails: GuardrailsConfig
    outreach: OutreachConfig
    prompts: Prompts


DEFAULTS_VERSION = "defaults"


def _read(name: str) -> object:
    return json.loads((SHARED / name).read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _load_defaults() -> AgentConfig:
    return AgentConfig(
        version=DEFAULTS_VERSION,
        scoring=ScoringConfig.model_validate(_read("scoring.json")),
        keywords=HiringKeywords.model_validate(_read("hiring_keywords.json")),
        guardrails=GuardrailsConfig.model_validate(_read("guardrails.json")),
        outreach=OutreachConfig.model_validate(_read("outreach.json")),
        prompts=Prompts(
            draft=(SHARED / "prompts" / "draft.md").read_text(encoding="utf-8"),
            raw=(SHARED / "prompts" / "raw.md").read_text(encoding="utf-8"),
            draft_schema=_read("prompts/draft_schema.json"),  # type: ignore[arg-type]
        ),
    )


def load_config(org_id: str) -> AgentConfig:
    """The rules for one organization's run.

    Currently the /shared defaults for every org (org_id is unused until rules move into the
    database in Phase 4.5, where this returns the org's current version, seeded from these).
    """
    del org_id  # part of the contract already, so callers don't change later
    return _load_defaults()
