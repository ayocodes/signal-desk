"""The agent's rules, through one function: load_config(org_id, db).

ICP rules, scoring weights, the threshold, hiring categories, the offer and guardrail numbers
are never read anywhere else (agent/tests/test_config.py enforces it).

Each org's editable rules are one document per version in the database (agent_configs);
agent/rules.py validates it. load_config merges the org's newest version with the locked
parts that always come from /shared (built-in banned phrases, prompts, mailbox rules, LLM
pacing). Without a database, or when an org has no valid version, it uses
shared/defaults/rules.json (version 0) and says why in `problem`.
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field

from agent.rules import validate_rules
from agent.settings import REPO_ROOT

SHARED = REPO_ROOT / "shared"


class _Model(BaseModel):
    model_config = ConfigDict(populate_by_name=True, frozen=True, extra="forbid")


class IcpPoints(_Model):
    full: int
    partial: int


class SignalSource(_Model):
    enabled: bool
    points: int


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
    launch: SignalSource
    yc_recent: SignalSource = Field(alias="ycRecent")
    freshness: tuple[FreshnessStep, ...]
    stacked_per_extra_signal_type: int = Field(alias="stackedPerExtraSignalType")
    icp_rules: IcpRules = Field(alias="icpRules")
    partial_rules: PartialRules = Field(alias="partialRules")
    signal_windows: SignalWindows = Field(alias="signalWindows")


class HiringCategory(_Model):
    id: str
    # Shown on signals and in the score math, e.g. "Sales hire".
    name: str
    enabled: bool
    points: int
    founding_bonus: int = Field(alias="foundingBonus")
    keywords: tuple[str, ...]
    exclusions: tuple[str, ...]


class HiringRules(_Model):
    # Checked in order; the first enabled category that matches a job title wins.
    categories: tuple[HiringCategory, ...]
    founding: tuple[str, ...]
    exclude: tuple[str, ...]
    exclude_exceptions: tuple[str, ...] = Field(alias="excludeExceptions")

    def category(self, category_id: str | None) -> HiringCategory | None:
        return next((c for c in self.categories if c.id == category_id), None)

    def label(self, category_id: str | None) -> str:
        """How a hiring signal is named: its category, or plain "Hiring" if it no longer has one."""
        category = self.category(category_id)
        return category.name if category else "Hiring"


class MailboxRules(_Model):
    daily_cap: int = Field(alias="dailyCap")
    pause_bounce_pct: float = Field(alias="pauseBouncePct")
    pause_complaint_pct: float = Field(alias="pauseComplaintPct")
    min_sends_for_rates: int = Field(alias="minSendsForRates")


class InboxShare(_Model):
    bounced_per_100: int = Field(alias="bouncedPer100")
    complained_per_100: int = Field(alias="complainedPer100")


class GuardrailsConfig(_Model):
    # From the org's rules (40 to 150).
    max_body_words: int = Field(alias="maxBodyWords")
    require_closing_question: bool = Field(alias="requireClosingQuestion")
    banned_chars: tuple[str, ...] = Field(alias="bannedChars")
    # The built-in list plus the org's extra phrases.
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
    followup: str
    # JSON schemas the model's answers must follow (Gemini's structured output).
    draft_schema: dict[str, object]
    followup_schema: dict[str, object]


class SequenceStep(_Model):
    key: str
    day_offset: int = Field(alias="dayOffset")


class SequenceBranch(_Model):
    # At the day-3 check: this many opens means a follow-up on another signal.
    opens_for_signal_followup: int = Field(alias="opensForSignalFollowup")
    opened_enough: SequenceStep = Field(alias="openedEnough")
    otherwise: SequenceStep


class SequenceRules(_Model):
    """The default sequence (shared/sequence.json): steps, the day-3 branch, threading."""

    steps: tuple[SequenceStep, ...]
    check_steps: tuple[str, ...] = Field(alias="checkSteps")
    branch: SequenceBranch
    same_thread_steps: tuple[str, ...] = Field(alias="sameThreadSteps")
    new_subject_steps: tuple[str, ...] = Field(alias="newSubjectSteps")


class FollowupTemplate(_Model):
    subject: str
    body: str


class FollowupStep(_Model):
    # What the AI is asked to write for this step, and the pre-checked fallback.
    instructions: str
    template: FollowupTemplate


class AgentConfig(_Model):
    """Every rule one agent run uses, for one organization."""

    # The org's rules version that produced a score (stored on each lead); 0 means the defaults.
    version: int
    # Why the defaults were used instead of the org's stored rules, if they were.
    problem: str | None = None
    scoring: ScoringConfig
    hiring: HiringRules
    guardrails: GuardrailsConfig
    outreach: OutreachConfig
    prompts: Prompts
    sequence: SequenceRules
    followups: dict[str, FollowupStep]


DEFAULTS_VERSION = 0


class RulesSource(Protocol):
    """The part of agent/db.py's Database that load_config needs."""

    def select_all(self, table: str, columns: str = "*", **equals: Any) -> list[dict[str, Any]]: ...


def _read(name: str) -> Any:
    return json.loads((SHARED / name).read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _locked() -> dict[str, Any]:
    """The parts no org can change, read once."""
    return {
        "guardrails": _read("guardrails.json"),
        "outreach": _read("outreach.json"),
        "prompts": Prompts(
            draft=(SHARED / "prompts" / "draft.md").read_text(encoding="utf-8"),
            raw=(SHARED / "prompts" / "raw.md").read_text(encoding="utf-8"),
            followup=(SHARED / "prompts" / "followup.md").read_text(encoding="utf-8"),
            draft_schema=_read("prompts/draft_schema.json"),
            followup_schema=_read("prompts/followup_schema.json"),
        ),
        "sequence": SequenceRules.model_validate(_read("sequence.json")),
        "followups": {k: FollowupStep.model_validate(v) for k, v in _read("followups.json")["steps"].items()},
    }


def default_rules() -> dict[str, Any]:
    """Version 1 of every org's rules (also what `npm run seed` stores)."""
    return _read("defaults/rules.json")


def build_config(rules: dict[str, Any], version: int, problem: str | None = None) -> AgentConfig:
    """Merges a valid rules document with the locked /shared parts."""
    locked = _locked()
    guardrails = locked["guardrails"]
    outreach = locked["outreach"]
    return AgentConfig(
        version=version,
        problem=problem,
        scoring=ScoringConfig(
            threshold=rules["threshold"],
            weakSignalTypes=rules["weakSignalTypes"],
            scoreBands=rules["scoreBands"],
            icp=rules["icp"]["points"],
            launch=rules["signals"]["launch"],
            ycRecent=rules["signals"]["ycRecent"],
            freshness=rules["freshness"],
            stackedPerExtraSignalType=rules["stackedPerExtraSignalType"],
            icpRules={k: v for k, v in rules["icp"].items() if k != "points"},
            partialRules=rules["partial"],
            signalWindows=rules["signalWindows"],
        ),
        hiring=HiringRules.model_validate(rules["hiring"]),
        guardrails=GuardrailsConfig.model_validate({
            **guardrails,
            "maxBodyWords": rules["guardrails"]["maxBodyWords"],
            # The built-in phrases are always banned; admins can only add to them.
            "bannedPhrases": [*guardrails["bannedPhrases"], *rules["guardrails"]["extraBannedPhrases"]],
        }),
        outreach=OutreachConfig.model_validate({
            **outreach,
            "sender": {"name": rules["outreach"]["senderName"], "company": outreach["sender"]["company"]},
            "offer": rules["outreach"]["offer"],
            "proofPoints": rules["outreach"]["proofPoints"],
        }),
        prompts=locked["prompts"],
        sequence=locked["sequence"],
        followups=locked["followups"],
    )


@lru_cache(maxsize=1)
def _defaults() -> AgentConfig:
    return build_config(default_rules(), DEFAULTS_VERSION)


def load_config(org_id: str, db: RulesSource | None = None) -> AgentConfig:
    """The rules for one organization's run: its newest saved version, merged with the locked
    parts. Without a database (tests), or when the org has no valid version, the defaults."""
    if db is None:
        return _defaults()
    versions = db.select_all("agent_configs", "version, rules", org_id=org_id)
    if not versions:
        return _defaults().model_copy(update={"problem": "No saved rules for this org yet; using the defaults."})
    newest = max(versions, key=lambda row: row["version"])
    errors = validate_rules(newest["rules"])
    if errors:
        first = errors[0]
        problem = f"Rules version {newest['version']} is invalid ({first.path}: {first.code}); using the defaults."
        return _defaults().model_copy(update={"problem": problem})
    return build_config(newest["rules"], newest["version"])
