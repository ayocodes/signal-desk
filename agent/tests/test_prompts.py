"""Runs every shared prompt case; lib/prompts.test.ts runs the same file and must agree."""

import json
from pathlib import Path

import pytest

from agent.config import load_config
from agent.prompts import (
    PromptContact,
    PromptFacts,
    PromptSignal,
    prompt_hash,
    render_draft_prompt,
    render_raw_prompt,
)

CASES = json.loads(
    (Path(__file__).resolve().parents[2] / "shared" / "fixtures" / "prompt_cases.json").read_text(encoding="utf-8")
)["cases"]
CFG = load_config("any-org")


def _facts(raw: dict) -> PromptFacts:  # type: ignore[type-arg]
    c = raw["contact"]
    return PromptFacts(
        company_name=raw["companyName"],
        domain=raw["domain"],
        description=raw["description"],
        contact=PromptContact(c["name"], c["title"], c["isPlaceholder"]) if c else None,
        signals=tuple(
            PromptSignal(s["type"], s["category"], s["title"], s["excerpt"], s["sourceName"]) for s in raw["signals"]
        ),
    )


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_shared_case(case: dict) -> None:  # type: ignore[type-arg]
    render = render_draft_prompt if case["kind"] == "draft" else render_raw_prompt
    assert render(_facts(case["facts"]), CFG) == case["expected"]


def test_raw_prompt_carries_no_signals_and_no_rules() -> None:
    raw = next(c for c in CASES if c["kind"] == "raw")
    prompt = render_raw_prompt(_facts(raw["facts"]), CFG)
    assert "Founding Account Executive" not in prompt
    assert "proof points" not in prompt.lower() and "em dash" not in prompt


def test_hash_is_stable_sha256() -> None:
    assert prompt_hash("abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"


def test_unknown_placeholder_in_a_template_is_an_error() -> None:
    from agent.prompts import _fill

    with pytest.raises(ValueError, match="unknown placeholders"):
        _fill("Hello {{nobody}}", {})
