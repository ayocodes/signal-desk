from collections import Counter
from datetime import UTC, datetime, timedelta

import pytest

from agent import config
from agent.contacts import buyer_check, inbox_for, placeholder_contact
from agent.scoring import SignalFacts, score_lead

NOW = datetime(2026, 10, 20, 12, tzinfo=UTC)
CFG = config.scoring()


def signal(kind: str, hours_ago: float, founding: bool = False, title: str = "Signal") -> SignalFacts:
    return SignalFacts(type=kind, occurred_at=NOW - timedelta(hours=hours_ago), title=title, founding=founding)  # type: ignore[arg-type]


def test_full_match_with_no_signals_is_filtered_with_a_reason() -> None:
    result = score_lead("full", [], NOW, CFG)
    assert (result.score, result.ready) == (40, False)
    assert result.parts == (("ICP match", 40),)
    assert result.filtered_reason == "Score 40, under 50: no buying signals yet"


def test_partial_plus_one_old_sales_hire_is_exactly_50_and_ready() -> None:
    result = score_lead("partial", [signal("hiring", hours_ago=24 * 30)], NOW, CFG)
    assert result.parts == (("Partial ICP match", 20), ("Hiring", 30))
    assert (result.score, result.ready, result.filtered_reason) == (50, True, None)


def test_49_is_filtered() -> None:
    # partial 20 + launch 18 + fresh (under 2 days) 11 = 49
    result = score_lead("partial", [signal("launch", hours_ago=30)], NOW, CFG)
    assert result.score == 49
    assert not result.ready
    assert result.filtered_reason == "Score 49, under 50: partial ICP match needs a stronger signal"


def test_full_stacked_example_from_the_architecture_doc() -> None:
    result = score_lead("full", [signal("hiring", 2, founding=True), signal("launch", 100)], NOW, CFG)
    assert result.parts == (
        ("ICP match", 40),
        ("Hiring", 30),
        ("Founding sales role", 5),
        ("Launch", 18),
        ("Fresh (under 24h)", 15),
        ("2 signal types", 7),
    )
    assert result.score == 115


@pytest.mark.parametrize(
    ("hours_ago", "label", "points"),
    [(1, "Fresh (under 24h)", 15), (30, "Fresh (under 2 days)", 11), (60, "Fresh (under 3 days)", 8), (150, "Fresh (under 7 days)", 4)],
)
def test_freshness_buckets_use_the_newest_signal(hours_ago: float, label: str, points: int) -> None:
    result = score_lead("full", [signal("hiring", 500), signal("hiring", hours_ago)], NOW, CFG)
    assert (label, points) in result.parts


def test_no_freshness_after_a_week_and_future_dates_count_as_now() -> None:
    assert not any(label.startswith("Fresh") for label, _ in score_lead("full", [signal("hiring", 200)], NOW, CFG).parts)
    assert ("Fresh (under 24h)", 15) in score_lead("full", [signal("hiring", -5)], NOW, CFG).parts


def test_a_weak_signal_alone_names_itself_when_filtered() -> None:
    result = score_lead("partial", [signal("funding", 24 * 40, title="YC Fall 2026")], NOW, CFG)
    assert result.filtered_reason == "Score 30, under 50: only a weak signal (YC Fall 2026)"


def test_a_weak_signal_cannot_make_a_lead_ready_even_at_50() -> None:
    result = score_lead("full", [signal("funding", 24 * 40, title="YC Fall 2026")], NOW, CFG)
    assert result.score == 50
    assert not result.ready
    assert result.filtered_reason == "Score 50: only a weak signal (YC Fall 2026)"


def test_a_weak_signal_still_adds_points_next_to_a_real_one() -> None:
    result = score_lead("partial", [signal("funding", 24 * 40), signal("hiring", 24 * 40)], NOW, CFG)
    assert ("YC recent", 10) in result.parts
    assert result.ready


@pytest.mark.parametrize(
    ("title", "team", "status"),
    [
        ("Founder", 12, "verified"),
        ("Co-founder & CEO", 25, "verified"),
        ("Founder", 45, "unverified"),
        ("Founder", None, "unverified"),
        ("Head of Growth", 45, "verified"),
        ("CTO", 10, "rerouted"),
        ("Office Manager", 10, "unverified"),
    ],
)
def test_buyer_check(title: str, team: int | None, status: str) -> None:
    assert buyer_check(title, team)[0] == status


def test_inbox_routing_is_deterministic_test_only_and_roughly_the_configured_share() -> None:
    share = config.guardrails().test_inboxes
    ids = [f"00000000-0000-4000-8000-{i:012d}" for i in range(2000)]
    addresses = [inbox_for(i, share) for i in ids]
    assert addresses == [inbox_for(i, share) for i in ids]  # same every run
    assert all(a.endswith("@resend.dev") for a in addresses)
    kinds = Counter(a.split("+")[0] for a in addresses)
    assert 60 <= kinds["bounced"] <= 140  # ~5 per 100
    assert 15 <= kinds["complained"] <= 65  # ~2 per 100


def test_placeholder_contact_is_marked_and_routed() -> None:
    contact = placeholder_contact("org", "11111111-2222-4333-8444-555555555555", 12, config.guardrails().test_inboxes)
    assert contact["is_placeholder"] is True
    assert contact["name"] == "Founder"
    assert contact["buyer_status"] == "verified"
    assert contact["send_address"].endswith("+11111111@resend.dev")
