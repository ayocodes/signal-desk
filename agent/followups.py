"""Follow-up emails (day 4, 7, 11): the prompt the AI gets, and the fallback template.

The agent asks the AI first (inside its budget share). When the budget is used up, the call
fails, or the draft fails the guardrails, it sends the step's template from
shared/followups.json instead. Every filled template passes the guardrails (tested), so the
fallback is always sendable.
"""

from __future__ import annotations

from dataclasses import dataclass

from agent.config import AgentConfig
from agent.prompts import PromptContact, PromptSignal, _contact, _fill, signal_label


@dataclass(frozen=True)
class FollowupFacts:
    company_name: str
    contact: PromptContact | None
    previous_subject: str
    previous_body: str
    # The signal this follow-up is built on (another signal for d4_followup_signal2).
    signal: PromptSignal


def first_name(contact: PromptContact | None) -> str:
    if contact is None or contact.is_placeholder or not contact.name.strip():
        return "there"
    return contact.name.split()[0]


def job_title(signal: PromptSignal) -> str:
    """The grounded phrase a template quotes. Hiring titles start with our own label
    ("Sales hire: Founding AE"), which is dropped; other titles ("Launch HN: Acme ...") are
    the source's own words and stay whole."""
    if signal.type == "hiring" and ": " in signal.title:
        return signal.title.split(": ", 1)[1]
    return signal.title


def fill_template(step_key: str, facts: FollowupFacts, cfg: AgentConfig) -> tuple[str, str, list[str]]:
    """The fallback (subject, body, grounded phrases) for a step."""
    template = cfg.followups[step_key].template
    values = {
        "first_name": first_name(facts.contact),
        "company": facts.company_name,
        "signal_title": job_title(facts.signal),
        "proof_point": cfg.outreach.proof_points[0],
        "subject": facts.previous_subject,
    }
    return _fill(template.subject, values), _fill(template.body, values), [values["signal_title"]]


def render_followup_prompt(step_key: str, facts: FollowupFacts, cfg: AgentConfig) -> str:
    out = cfg.outreach
    s = facts.signal
    signal_lines = [f"{signal_label(s, cfg.hiring)}: {s.title.strip()}"]
    if s.excerpt and s.excerpt.strip():
        signal_lines.append(f"Excerpt: {s.excerpt.strip()}")
    signal_lines.append(f"Source: {s.source_name}")
    return _fill(
        cfg.prompts.followup,
        {
            "sender_name": out.sender.name,
            "sender_company": out.sender.company,
            "offer": out.offer,
            "proof_points": "\n".join(f"- {point}" for point in out.proof_points),
            "contact": _contact(facts.contact),
            "company": facts.company_name,
            "previous_subject": facts.previous_subject,
            "previous_body": facts.previous_body,
            "signal": "\n".join(signal_lines),
            "step_instructions": cfg.followups[step_key].instructions,
            "max_words": str(cfg.guardrails.max_body_words),
            "banned_phrases": ", ".join(f'"{p}"' for p in cfg.guardrails.banned_phrases),
        },
    )
