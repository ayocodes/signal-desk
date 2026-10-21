from datetime import UTC, date, datetime, timedelta

import pytest

from agent.config import load_config
from agent.icp import evaluate
from agent.scoring import SignalFacts, score_lead
from agent.sources.yc import YcCompany

NOW = datetime(2026, 10, 20, 12, tzinfo=UTC)
TODAY = date(2026, 10, 20)
CFG = load_config("test-org").scoring
HIRING = load_config("test-org").hiring


# Row 1: full | none | 40 | no | ICP match 40 | Score 40, under 50: no buying signals yet
def test_row1_full_none() -> None:
    result = score_lead("full", [], NOW, CFG, HIRING)
    assert result.score == 40
    assert result.ready is False
    assert result.parts == (("ICP match", 40),)
    assert result.filtered_reason == "Score 40, under 50: no buying signals yet"


# Row 2: partial | sales hire, 30 days | 50 | yes | Partial ICP match 20, Hiring 30 | (none)
def test_row2_partial_sales_hire_30_days() -> None:
    signals = [
        SignalFacts(
            type="hiring",
            occurred_at=NOW - timedelta(days=30),
            title="Hiring: Account Executive",
            category="sales",
        )
    ]
    result = score_lead("partial", signals, NOW, CFG, HIRING)
    assert result.score == 50
    assert result.ready is True
    assert result.parts == (("Partial ICP match", 20), ("Sales hire", 30))
    assert result.filtered_reason is None


# Row 3: partial | launch, 30h | 49 | no | Partial ICP match 20, Launch 18, Fresh (under 2 days) 11 | Score 49, under 50: partial ICP match needs a stronger signal
def test_row3_partial_launch_30h() -> None:
    signals = [
        SignalFacts(
            type="launch",
            occurred_at=NOW - timedelta(hours=30),
            title="Launch HN: Test",
        )
    ]
    result = score_lead("partial", signals, NOW, CFG, HIRING)
    assert result.score == 49
    assert result.ready is False
    assert result.parts == (
        ("Partial ICP match", 20),
        ("Launch", 18),
        ("Fresh (under 2 days)", 11),
    )
    assert (
        result.filtered_reason
        == "Score 49, under 50: partial ICP match needs a stronger signal"
    )


# Row 4: full | funding "YC Fall 2026", 40 days | 50 | no | ICP match 40, YC recent 10 | Score 50: only a weak signal (YC Fall 2026)
def test_row4_full_funding_weak_signal() -> None:
    signals = [
        SignalFacts(
            type="funding",
            occurred_at=NOW - timedelta(days=40),
            title="YC Fall 2026",
        )
    ]
    result = score_lead("full", signals, NOW, CFG, HIRING)
    assert result.score == 50
    assert result.ready is False
    assert result.parts == (("ICP match", 40), ("YC recent", 10))
    assert result.filtered_reason == "Score 50: only a weak signal (YC Fall 2026)"


# Row 5: full | sales hire 10h + funding 40 days | 102 | yes | ICP match 40, Hiring 30, YC recent 10, Fresh (under 24h) 15, 2 signal types 7 | (none)
def test_row5_full_sales_hire_10h_and_funding_40_days() -> None:
    signals = [
        SignalFacts(
            type="hiring",
            occurred_at=NOW - timedelta(hours=10),
            title="Hiring: Account Executive",
            category="sales",
        ),
        SignalFacts(
            type="funding",
            occurred_at=NOW - timedelta(days=40),
            title="YC Fall 2026",
        ),
    ]
    result = score_lead("full", signals, NOW, CFG, HIRING)
    assert result.score == 102
    assert result.ready is True
    assert result.parts == (
        ("ICP match", 40),
        ("Sales hire", 30),
        ("YC recent", 10),
        ("Fresh (under 24h)", 15),
        ("2 signal types", 7),
    )
    assert result.filtered_reason is None


# Row 6: partial | sales hire 60h + launch 200h | 83 | yes | Partial ICP match 20, Hiring 30, Launch 18, Fresh (under 3 days) 8, 2 signal types 7 | (none)
def test_row6_partial_sales_hire_60h_and_launch_200h() -> None:
    signals = [
        SignalFacts(
            type="hiring",
            occurred_at=NOW - timedelta(hours=60),
            title="Hiring: Account Executive",
            category="sales",
        ),
        SignalFacts(
            type="launch",
            occurred_at=NOW - timedelta(hours=200),
            title="Launch HN: Test",
        ),
    ]
    result = score_lead("partial", signals, NOW, CFG, HIRING)
    assert result.score == 83
    assert result.ready is True
    assert result.parts == (
        ("Partial ICP match", 20),
        ("Sales hire", 30),
        ("Launch", 18),
        ("Fresh (under 3 days)", 8),
        ("2 signal types", 7),
    )
    assert result.filtered_reason is None


# Row 7: full | founding sales hire 80h + launch 300h + funding 40 days | 121 | yes | ICP match 40, Hiring 30, Founding sales role 5, Launch 18, YC recent 10, Fresh (under 7 days) 4, 3 signal types 14 | (none)
def test_row7_full_founding_sales_hire_launch_and_funding() -> None:
    signals = [
        SignalFacts(
            type="hiring",
            occurred_at=NOW - timedelta(hours=80),
            title="Hiring: Founding AE",
            founding=True,
            category="sales",
        ),
        SignalFacts(
            type="launch",
            occurred_at=NOW - timedelta(hours=300),
            title="Launch HN: Test",
        ),
        SignalFacts(
            type="funding",
            occurred_at=NOW - timedelta(days=40),
            title="YC Fall 2026",
        ),
    ]
    result = score_lead("full", signals, NOW, CFG, HIRING)
    assert result.score == 121
    assert result.ready is True
    assert result.parts == (
        ("ICP match", 40),
        ("Sales hire", 30),
        ("Founding sales hire", 5),
        ("Launch", 18),
        ("YC recent", 10),
        ("Fresh (under 7 days)", 4),
        ("3 signal types", 14),
    )
    assert result.filtered_reason is None


# Row 8: full | marketing hire, 30 days | 60 | yes | ICP match 40, Marketing hire 20 | (none)
def test_row8_full_marketing_hire_30_days() -> None:
    signals = [
        SignalFacts(
            type="hiring",
            occurred_at=NOW - timedelta(days=30),
            title="Marketing hire: Marketing Lead",
            category="marketing",
        )
    ]
    result = score_lead("full", signals, NOW, CFG, HIRING)
    assert result.score == 60
    assert result.ready is True
    assert result.parts == (("ICP match", 40), ("Marketing hire", 20))
    assert result.filtered_reason is None


# ICP evaluation test cases from card F2.2
def _yc_company(**kwargs: object) -> YcCompany:
    base: dict[str, object] = {
        "id": 100,
        "name": "CardTest",
        "slug": "cardtest",
        "website": "https://cardtest.com",
        "batch": "Summer 2025",
        "status": "Active",
        "industry": "Fintech",
        "subindustry": "Fintech -> Payments",
        "tags": ["B2B"],
        "team_size": 70,
    }
    return YcCompany.model_validate({**base, **kwargs})


def test_icp_fintech_b2b_tag_team_70() -> None:
    company = _yc_company(
        industry="Fintech",
        tags=["B2B"],
        team_size=70,
        batch="Summer 2025",
    )
    result = evaluate(company, TODAY, CFG)
    assert result.tier == "partial"
    assert result.reasons == (
        "Active",
        "B2B tag, filed under Fintech",
        "Team of 70, outside 5 to 60",
        "YC Summer 2025 (within 3 years)",
    )


def test_icp_fintech_b2b_tag_team_2_untracked() -> None:
    company = _yc_company(
        industry="Fintech",
        tags=["B2B"],
        team_size=2,
        batch="Summer 2025",
    )
    result = evaluate(company, TODAY, CFG)
    assert result.tier is None
    assert result.reasons == (
        "Active",
        "B2B tag, filed under Fintech",
        "Team of 2, far outside 5 to 60",
        "YC Summer 2025 (within 3 years)",
    )


def test_icp_b2b_industry_sales_subindustry_team_22() -> None:
    company = _yc_company(
        industry="B2B",
        subindustry="B2B -> Sales",
        team_size=22,
        batch="Winter 2025",
        tags=[],
    )
    result = evaluate(company, TODAY, CFG)
    assert result.tier == "full"
    assert result.reasons == (
        "Active",
        "B2B industry (Sales)",
        "Team of 22 (5 to 60)",
        "YC Winter 2025 (within 3 years)",
    )
