"""Explainable lead scoring (weights come from load_config; defaults: shared/scoring.json).

score = ICP points + one entry per signal type present + freshness of the newest signal
        + a bonus for each extra signal type ("stacked" signals)

The parts are kept in order so the UI can print the math:
"ICP match 40 + Hiring 30 + Fresh 15 + 2 signal types 7 = 92".
A lead is ready when score >= threshold AND it has at least one signal that isn't "weak"
(weakSignalTypes: a recent YC batch adds points but can't qualify a lead alone).
So partial 20 + one sales hire 30 = 50 is ready; full 40 + YC recent 10 = 50 is not.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from agent.config import ScoringConfig

SignalType = Literal["hiring", "launch", "funding"]


@dataclass(frozen=True)
class SignalFacts:
    type: SignalType
    occurred_at: datetime
    title: str
    founding: bool = False


@dataclass(frozen=True)
class ScoreResult:
    score: int
    parts: tuple[tuple[str, int], ...]
    ready: bool
    filtered_reason: str | None


def _freshness(newest: datetime, now: datetime, cfg: ScoringConfig) -> tuple[str, int] | None:
    hours = max(0.0, (now - newest).total_seconds() / 3600)
    for step in cfg.freshness:
        if hours <= step.max_hours:
            label = f"Fresh (under {step.max_hours}h)" if step.max_hours < 48 else f"Fresh (under {step.max_hours // 24} days)"
            return label, step.points
    return None


def _filtered_reason(score: int, cfg: ScoringConfig, tier: str, signals: Sequence[SignalFacts]) -> str:
    threshold = cfg.threshold
    head = f"Score {score}, under {threshold}" if score < threshold else f"Score {score}"
    if not signals:
        return f"{head}: no buying signals yet"
    if all(s.type in cfg.weak_signal_types for s in signals):
        weak = next(s.title for s in signals)
        return f"{head}: only a weak signal ({weak})"
    if tier == "partial":
        return f"{head}: partial ICP match needs a stronger signal"
    return f"{head}: signals aren't strong or fresh enough yet"


def score_lead(tier: Literal["full", "partial"], signals: Sequence[SignalFacts], now: datetime, cfg: ScoringConfig) -> ScoreResult:
    parts: list[tuple[str, int]] = []
    parts.append(("ICP match", cfg.icp.full) if tier == "full" else ("Partial ICP match", cfg.icp.partial))

    types = {s.type for s in signals}
    if "hiring" in types:
        parts.append(("Hiring", cfg.signals.hiring_sales))
        if any(s.founding for s in signals if s.type == "hiring"):
            parts.append(("Founding sales role", cfg.signals.hiring_founding_sales_bonus))
    if "launch" in types:
        parts.append(("Launch", cfg.signals.launch))
    if "funding" in types:
        parts.append(("YC recent", cfg.signals.funding_yc_recent))

    if signals:
        fresh = _freshness(max(s.occurred_at for s in signals), now, cfg)
        if fresh:
            parts.append(fresh)
    if len(types) > 1:
        parts.append((f"{len(types)} signal types", cfg.stacked_per_extra_signal_type * (len(types) - 1)))

    score = sum(points for _, points in parts)
    has_strong_signal = any(s.type not in cfg.weak_signal_types for s in signals)
    ready = score >= cfg.threshold and has_strong_signal
    reason = None if ready else _filtered_reason(score, cfg, tier, signals)
    return ScoreResult(score, tuple(parts), ready, reason)
