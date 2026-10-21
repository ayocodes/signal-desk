"""Runs every shared guardrail case; lib/guardrails.test.ts runs the same file and must agree."""

import json
from dataclasses import replace
from pathlib import Path

import pytest

from agent.config import load_config
from agent.guardrails import DraftInput, SignalText, contains, passed, rules_from_config, run_guardrails

CASES = json.loads(
    (Path(__file__).resolve().parents[2] / "shared" / "fixtures" / "guardrails_cases.json").read_text(encoding="utf-8")
)["cases"]
RULES = rules_from_config(load_config("any-org"))


def _input(raw: dict) -> DraftInput:  # type: ignore[type-arg]
    return DraftInput(
        angle=raw["angle"],
        subject=raw["subject"],
        body=raw["body"],
        grounded_phrases=tuple(raw["groundedPhrases"]),
        signals=tuple(SignalText(s["title"], s.get("excerpt")) for s in raw["signals"]),
    )


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_shared_case(case: dict) -> None:  # type: ignore[type-arg]
    rules = replace(RULES, proof_points=tuple(case["proofPoints"])) if "proofPoints" in case else RULES
    results = run_guardrails(_input(case["input"]), rules)
    statuses = {r.check: r.status for r in results}
    for check, expected in case["expect"].items():
        assert statuses[check] == expected, f"{check}: {next(r.message for r in results if r.check == check)}"
    assert passed(results) is case["passed"]


def test_every_check_runs_in_a_fixed_order() -> None:
    results = run_guardrails(_input(CASES[0]["input"]), RULES)
    assert [r.check for r in results] == [
        "angle", "grounding", "banned_chars", "banned_phrases", "word_count",
        "closing_question", "numbers", "claims", "placeholders", "subject",
    ]


def test_messages_name_what_was_found() -> None:
    results = {r.check: r for r in run_guardrails(_input(CASES[0]["input"]), RULES)}
    assert results["grounding"].message == 'Grounded: "Founding Account Executive", "outbound motion from scratch"'


def test_messages_never_print_a_dash_character() -> None:
    body = "Saw the Founding Account Executive role — worth a chat?"
    d = DraftInput("signal", "Hi", body, ("Founding Account Executive",), (SignalText("Founding Account Executive", None),))
    message = next(r.message for r in run_guardrails(d, RULES) if r.check == "banned_chars")
    assert message == "Contains an em dash"


def test_contains_matches_whole_phrases_only() -> None:
    assert contains("Our Sales team", "sales")
    assert not contains("Salesforce admin", "sales")
    assert contains("build the outbound\n motion", "outbound motion")
    assert not contains("anything", "   ")
