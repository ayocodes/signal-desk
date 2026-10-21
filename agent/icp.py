"""Does a YC company fit the ICP? (Rules come from load_config: the org's icp and partial rules; defaults in shared/defaults/rules.json.)

Hard rules decide whether we track a company at all: active, B2B (by industry or tag), not a
nonprofit. Two soft rules then decide the tier:
  - full:    team size and batch age both inside icpRules
  - partial: exactly one of them misses, but only by a little (inside partialRules)
Everything else isn't tracked. Each result carries the reasons shown in the lead detail.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Literal

from agent.config import ScoringConfig
from agent.sources.yc import YcCompany, batch_age_years

Tier = Literal["full", "partial"]


@dataclass(frozen=True)
class IcpResult:
    tier: Tier | None
    reasons: tuple[str, ...]


def _b2b_reason(company: YcCompany) -> str | None:
    if company.industry == "B2B":
        detail = company.subindustry.removeprefix("B2B -> ") if company.subindustry else ""
        return f"B2B industry ({detail})" if detail and detail != "B2B" else "B2B industry"
    if "B2B" in company.tags:
        return f"B2B tag, filed under {company.industry}"
    return None


def _team(company: YcCompany, rules: ScoringConfig) -> tuple[str, str]:
    """('ok' | 'near' | 'miss', reason)."""
    full, near = rules.icp_rules, rules.partial_rules
    size = company.team_size
    if size is None:
        return "miss", "Team size unknown"
    if full.team_size_min <= size <= full.team_size_max:
        return "ok", f"Team of {size} ({full.team_size_min} to {full.team_size_max})"
    if near.team_size_min <= size <= near.team_size_max:
        return "near", f"Team of {size}, outside {full.team_size_min} to {full.team_size_max}"
    return "miss", f"Team of {size}, far outside {full.team_size_min} to {full.team_size_max}"


def _batch(company: YcCompany, today: date, rules: ScoringConfig) -> tuple[str, str]:
    full_years = rules.icp_rules.max_batch_age_years
    age = batch_age_years(company.batch, today)
    if age is None:
        return "miss", f"YC batch '{company.batch}' not recognized"
    limit = f"{full_years:g} years"
    if age <= full_years:
        return "ok", f"YC {company.batch} (within {limit})"
    if age <= rules.partial_rules.max_batch_age_years:
        return "near", f"YC {company.batch}, {age:.1f} years ago (over {limit})"
    return "miss", f"YC {company.batch}, {age:.1f} years ago"


def evaluate(company: YcCompany, today: date, rules: ScoringConfig) -> IcpResult:
    if company.status != rules.icp_rules.status:
        return IcpResult(None, (f"Status is {company.status}",))
    if company.nonprofit:
        return IcpResult(None, ("Nonprofit",))
    b2b = _b2b_reason(company)
    if rules.icp_rules.b2b and b2b is None:
        return IcpResult(None, (f"Not B2B ({company.industry})",))

    team_state, team_reason = _team(company, rules)
    batch_state, batch_reason = _batch(company, today, rules)
    reasons = (company.status, b2b or "", team_reason, batch_reason)
    reasons = tuple(r for r in reasons if r)

    if team_state == "ok" and batch_state == "ok":
        return IcpResult("full", reasons)
    if {team_state, batch_state} == {"ok", "near"}:
        return IcpResult("partial", reasons)
    return IcpResult(None, reasons)
