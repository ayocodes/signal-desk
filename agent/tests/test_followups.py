"""Follow-up prompts and the fallback templates (agent/followups.py)."""

import pytest

from agent.config import load_config
from agent.followups import FollowupFacts, fill_template, first_name, job_title, render_followup_prompt
from agent.guardrails import DraftInput, SignalText, passed, rules_from_config, run_guardrails
from agent.prompts import PromptContact, PromptSignal

CFG = load_config("any-org")
SIGNALS = [
    PromptSignal("hiring", "sales", "Sales hire: Founding Account Executive", "Build our outbound motion from scratch.", "Ashby"),
    PromptSignal("launch", None, "Launch HN: Acme (YC W26) - billing for vertical SaaS", None, "Hacker News"),
    PromptSignal("hiring", "marketing", "Marketing hire: Head of Demand Generation 2026", None, "Lever"),
]


def facts(signal: PromptSignal, contact: PromptContact | None = PromptContact("Jane Doe", "CEO", False)) -> FollowupFacts:
    return FollowupFacts("Acme", contact, "Your founding AE search", "Hi Jane, saw the Founding Account Executive role. Worth a look?", signal)


@pytest.mark.parametrize("step", ["d4_followup_signal2", "d4_new_subject", "d7_case", "d11_close"])
@pytest.mark.parametrize("signal", SIGNALS, ids=["hiring", "launch", "numbers-in-title"])
def test_every_filled_template_passes_the_guardrails(step: str, signal: PromptSignal) -> None:
    subject, body, grounded = fill_template(step, facts(signal), CFG)
    results = run_guardrails(
        DraftInput("signal", subject, body, tuple(grounded), (SignalText(signal.title, signal.excerpt),)),
        rules_from_config(CFG),
    )
    assert passed(results), [r for r in results if r.status == "fail"]


def test_templates_greet_by_first_name_or_there() -> None:
    assert first_name(PromptContact("Jane Doe", "CEO", False)) == "Jane"
    assert first_name(PromptContact("Founder", None, True)) == "there"
    assert first_name(None) == "there"


def test_job_title_drops_our_label() -> None:
    assert job_title(SIGNALS[0]) == "Founding Account Executive"
    assert job_title(PromptSignal("funding", None, "YC W26", None, "YC directory")) == "YC W26"


def test_the_followup_prompt_carries_the_step_and_the_first_email() -> None:
    prompt = render_followup_prompt("d4_followup_signal2", facts(SIGNALS[1]), CFG)
    assert "A different public signal than the first email used" in prompt
    assert "Subject: Your founding AE search" in prompt
    assert "Launch: Launch HN: Acme (YC W26)" in prompt
    assert "{{" not in prompt
