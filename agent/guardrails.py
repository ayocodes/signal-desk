"""Checks every draft must pass before a person can approve it.

The same rules run in lib/guardrails.ts (live, while someone edits, and again on the server
when they approve). shared/fixtures/guardrails_cases.json is run by both test suites, so the
two implementations can't drift apart.

Text matching is case-insensitive, ignores runs of whitespace, and respects word boundaries
("sales" doesn't match inside "Salesforce").
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from agent.config import AgentConfig

Status = Literal["pass", "fail", "warn"]

# Names for characters the UI can't print (the banned em and en dashes).
CHAR_NAMES = {"—": "an em dash", "–": "an en dash"}
NUMBER = re.compile(r"(?<!\w)\d+(?:[.,]\d+)?%?")
PLACEHOLDER = re.compile(r"\{\{[^}]*\}\}|\{[A-Za-z_]+\}|\[[A-Z][A-Za-z ]*\]")


@dataclass(frozen=True)
class SignalText:
    title: str
    excerpt: str | None


@dataclass(frozen=True)
class DraftInput:
    angle: str
    subject: str
    body: str
    grounded_phrases: tuple[str, ...]
    signals: tuple[SignalText, ...]


@dataclass(frozen=True)
class GuardrailRules:
    max_body_words: int
    require_closing_question: bool
    banned_chars: tuple[str, ...]
    banned_phrases: tuple[str, ...]
    claim_phrases: tuple[str, ...]
    min_grounded_phrase_chars: int
    max_subject_chars: int
    proof_points: tuple[str, ...]


@dataclass(frozen=True)
class CheckResult:
    check: str
    status: Status
    message: str

    def as_row(self) -> dict[str, str]:
        return {"check": self.check, "status": self.status, "message": self.message}


def rules_from_config(cfg: AgentConfig) -> GuardrailRules:
    g = cfg.guardrails
    return GuardrailRules(
        max_body_words=g.max_body_words,
        require_closing_question=g.require_closing_question,
        banned_chars=g.banned_chars,
        banned_phrases=g.banned_phrases,
        claim_phrases=g.claim_phrases,
        min_grounded_phrase_chars=g.min_grounded_phrase_chars,
        max_subject_chars=g.max_subject_chars,
        proof_points=cfg.outreach.proof_points,
    )


def _norm(text: str) -> str:
    return " ".join(text.split())


def contains(text: str, phrase: str) -> bool:
    """Whole-phrase, case-insensitive match that ignores extra whitespace."""
    needle = _norm(phrase)
    if not needle:
        return False
    return re.search(rf"(?<!\w){re.escape(needle)}(?!\w)", _norm(text), re.IGNORECASE) is not None


def _quoted(items: list[str]) -> str:
    return ", ".join(f'"{item}"' for item in items)


def _numbers(text: str) -> list[str]:
    return [match.rstrip("%") for match in NUMBER.findall(text)]


def _unique(items: list[str]) -> list[str]:
    return list(dict.fromkeys(items))


def check_angle(d: DraftInput) -> CheckResult:
    if d.angle == "raw":
        return CheckResult("angle", "fail", "Unconstrained drafts can't be approved")
    return CheckResult("angle", "pass", "Approvable angle")


def check_grounding(d: DraftInput, rules: GuardrailRules) -> CheckResult:
    email = f"{d.subject}\n{d.body}"
    phrases = _unique([p for p in d.grounded_phrases if len(_norm(p)) >= rules.min_grounded_phrase_chars])
    verified = [
        p
        for p in phrases
        if contains(email, p) and any(contains(s.title, p) or contains(s.excerpt or "", p) for s in d.signals)
    ]
    unverified = [p for p in phrases if p not in verified]
    if not verified:
        missing = f" Not found in both the email and a signal: {_quoted(unverified)}." if unverified else ""
        return CheckResult("grounding", "fail", f"No phrase from the signals appears in the email.{missing}")
    if unverified:
        return CheckResult(
            "grounding", "warn",
            f"Grounded: {_quoted(verified)}. Not found in both the email and a signal: {_quoted(unverified)}",
        )
    return CheckResult("grounding", "pass", f"Grounded: {_quoted(verified)}")


def check_banned_chars(d: DraftInput, rules: GuardrailRules) -> CheckResult:
    email = f"{d.subject}\n{d.body}"
    found = [CHAR_NAMES.get(c, f'"{c}"') for c in rules.banned_chars if c in email]
    if found:
        return CheckResult("banned_chars", "fail", f"Contains {', '.join(found)}")
    return CheckResult("banned_chars", "pass", "No banned characters")


def check_banned_phrases(d: DraftInput, rules: GuardrailRules) -> CheckResult:
    email = f"{d.subject}\n{d.body}"
    found = [p for p in rules.banned_phrases if contains(email, p)]
    if found:
        return CheckResult("banned_phrases", "fail", f"Remove: {_quoted(found)}")
    return CheckResult("banned_phrases", "pass", "No banned phrases")


def check_word_count(d: DraftInput, rules: GuardrailRules) -> CheckResult:
    count = sum(1 for token in d.body.split() if any(ch.isalnum() for ch in token))
    if count > rules.max_body_words:
        return CheckResult("word_count", "fail", f"{count} words, limit {rules.max_body_words}")
    return CheckResult("word_count", "pass", f"{count} words")


def check_closing_question(d: DraftInput, rules: GuardrailRules) -> CheckResult:
    if not rules.require_closing_question:
        return CheckResult("closing_question", "pass", "Not required")
    if d.body.rstrip().endswith("?"):
        return CheckResult("closing_question", "pass", "Ends with a question")
    return CheckResult("closing_question", "fail", "End the body with a question")


def check_numbers(d: DraftInput, rules: GuardrailRules) -> CheckResult:
    sources = " ".join([*(f"{s.title} {s.excerpt or ''}" for s in d.signals), *rules.proof_points])
    allowed = set(_numbers(sources))
    used = _unique(_numbers(f"{d.subject}\n{d.body}"))
    invented = [n for n in used if n not in allowed]
    if invented:
        return CheckResult("numbers", "fail", f"Not in the signals or proof points: {', '.join(invented)}")
    return CheckResult("numbers", "pass", "Numbers come from the signals" if used else "No numbers")


def check_claims(d: DraftInput, rules: GuardrailRules) -> CheckResult:
    email = f"{d.subject}\n{d.body}"
    unsupported = [
        claim
        for claim in rules.claim_phrases
        if contains(email, claim)
        and not any(contains(point, claim) and contains(email, point) for point in rules.proof_points)
    ]
    if unsupported:
        return CheckResult("claims", "fail", f"Unsupported claim: {_quoted(unsupported)}")
    return CheckResult("claims", "pass", "No unsupported claims")


def check_placeholders(d: DraftInput) -> CheckResult:
    found = _unique(PLACEHOLDER.findall(f"{d.subject}\n{d.body}"))
    if found:
        return CheckResult("placeholders", "fail", f"Fill in: {', '.join(found)}")
    return CheckResult("placeholders", "pass", "No placeholders")


def check_subject(d: DraftInput, rules: GuardrailRules) -> CheckResult:
    subject = d.subject.strip()
    if not subject:
        return CheckResult("subject", "fail", "Add a subject")
    if len(subject) > rules.max_subject_chars:
        return CheckResult("subject", "warn", f"{len(subject)} characters; under {rules.max_subject_chars} reads better")
    return CheckResult("subject", "pass", f"{len(subject)} characters")


def run_guardrails(d: DraftInput, rules: GuardrailRules) -> list[CheckResult]:
    return [
        check_angle(d),
        check_grounding(d, rules),
        check_banned_chars(d, rules),
        check_banned_phrases(d, rules),
        check_word_count(d, rules),
        check_closing_question(d, rules),
        check_numbers(d, rules),
        check_claims(d, rules),
        check_placeholders(d),
        check_subject(d, rules),
    ]


def passed(results: list[CheckResult]) -> bool:
    return all(r.status != "fail" for r in results)
