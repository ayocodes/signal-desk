"""Fills in the prompt templates (shared/prompts/*.md) for one lead.

lib/prompts.ts does the same for the web app (Regenerate, Unconstrained). Both must produce
the exact same text for the same facts, so the stored prompt hash means the same thing
everywhere; shared/fixtures/prompt_cases.json is run by both test suites.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

from agent.config import AgentConfig

UNFILLED = re.compile(r"\{\{\w+\}\}")


@dataclass(frozen=True)
class PromptContact:
    name: str
    title: str | None
    is_placeholder: bool


@dataclass(frozen=True)
class PromptSignal:
    type: str
    category: str | None
    title: str
    excerpt: str | None
    source_name: str


@dataclass(frozen=True)
class PromptFacts:
    """What the model is told about one lead. Signals are strongest first."""

    company_name: str
    domain: str
    description: str | None
    contact: PromptContact | None
    signals: tuple[PromptSignal, ...]


def signal_label(signal: PromptSignal) -> str:
    """The same words the UI uses (components/leads/SignalCard.tsx signalLabel)."""
    if signal.type == "hiring":
        return "Marketing hire" if signal.category == "marketing" else "Hiring"
    if signal.type == "launch":
        return "Launch"
    return "YC recent"


def _contact(contact: PromptContact | None) -> str:
    if contact is None or contact.is_placeholder:
        return 'the founder (name unknown; open with "Hi there,")'
    return f"{contact.name}, {contact.title}" if contact.title else contact.name


def _signals(signals: tuple[PromptSignal, ...]) -> str:
    if not signals:
        return "None found."
    blocks = []
    for number, s in enumerate(signals, start=1):
        lines = [f"{number}. {signal_label(s)}: {s.title.strip()}"]
        if s.excerpt and s.excerpt.strip():
            lines.append(f"   Excerpt: {s.excerpt.strip()}")
        lines.append(f"   Source: {s.source_name}")
        blocks.append("\n".join(lines))
    return "\n".join(blocks)


def _fill(template: str, values: dict[str, str]) -> str:
    text = template
    for key, value in values.items():
        text = text.replace("{{" + key + "}}", value)
    left = UNFILLED.findall(text)
    if left:
        raise ValueError(f"Prompt template has unknown placeholders: {', '.join(sorted(set(left)))}")
    return text


def _common(facts: PromptFacts, cfg: AgentConfig) -> dict[str, str]:
    out = cfg.outreach
    return {
        "sender_name": out.sender.name,
        "sender_company": out.sender.company,
        "offer": out.offer,
        "contact": _contact(facts.contact),
        "company": facts.company_name,
    }


def render_draft_prompt(facts: PromptFacts, cfg: AgentConfig) -> str:
    out = cfg.outreach
    angles = out.angles
    return _fill(
        cfg.prompts.draft,
        {
            **_common(facts, cfg),
            "proof_points": "\n".join(f"- {point}" for point in out.proof_points),
            "company_line": f"{facts.company_name} ({facts.domain})" if facts.domain else facts.company_name,
            "company_description": (facts.description or "").strip() or "Not known.",
            "signals": _signals(facts.signals[: out.max_signals_in_prompt]),
            "angles": f"- signal: {angles.signal}\n- peer: {angles.peer}\n- short: {angles.short}",
            "max_words": str(cfg.guardrails.max_body_words),
            "banned_phrases": ", ".join(f'"{p}"' for p in cfg.guardrails.banned_phrases),
        },
    )


def render_raw_prompt(facts: PromptFacts, cfg: AgentConfig) -> str:
    """The unconstrained baseline: offer and company only, no signals and no rules."""
    return _fill(cfg.prompts.raw, _common(facts, cfg))


def prompt_hash(prompt: str) -> str:
    return hashlib.sha256(prompt.encode("utf-8")).hexdigest()
