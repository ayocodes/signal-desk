from datetime import date

import pytest

from agent import config
from agent.icp import evaluate
from agent.sources.yc import YcCompany

TODAY = date(2026, 10, 20)


def company(**overrides: object) -> YcCompany:
    base: dict[str, object] = {
        "id": 1,
        "name": "Drillbit",
        "slug": "drillbit",
        "website": "https://www.drillbit.com",
        "batch": "Summer 2024",
        "status": "Active",
        "industry": "B2B",
        "subindustry": "B2B -> Operations",
        "tags": ["AI"],
        "team_size": 12,
    }
    return YcCompany.model_validate({**base, **overrides})


def test_full_match_with_readable_reasons() -> None:
    result = evaluate(company(), TODAY, config.scoring())
    assert result.tier == "full"
    assert result.reasons == (
        "Active",
        "B2B industry (Operations)",
        "Team of 12 (5 to 60)",
        "YC Summer 2024 (within 3 years)",
    )


def test_b2b_by_tag_says_where_it_was_filed() -> None:
    result = evaluate(company(industry="Fintech", subindustry="Fintech -> Payments", tags=["B2B"]), TODAY, config.scoring())
    assert result.tier == "full"
    assert "B2B tag, filed under Fintech" in result.reasons


def test_plain_b2b_subindustry_has_no_redundant_detail() -> None:
    result = evaluate(company(subindustry="B2B"), TODAY, config.scoring())
    assert "B2B industry" in result.reasons


@pytest.mark.parametrize(
    ("overrides", "reason_part"),
    [
        ({"team_size": 80}, "Team of 80, outside 5 to 60"),
        ({"team_size": 4}, "Team of 4, outside 5 to 60"),
        ({"batch": "Summer 2022"}, "YC Summer 2022, 4.4 years ago (over 3 years)"),
    ],
)
def test_one_near_miss_is_a_partial_match(overrides: dict[str, object], reason_part: str) -> None:
    result = evaluate(company(**overrides), TODAY, config.scoring())
    assert result.tier == "partial"
    assert reason_part in result.reasons


@pytest.mark.parametrize(
    "overrides",
    [
        {"status": "Inactive"},
        {"status": "Acquired"},
        {"industry": "Consumer", "subindustry": "Consumer", "tags": []},
        {"nonprofit": True},
        {"team_size": 200},
        {"team_size": None},
        {"batch": "Winter 2019"},
        {"team_size": 80, "batch": "Summer 2022"},  # two near misses is not a partial match
        {"batch": "IK12"},
    ],
)
def test_not_tracked(overrides: dict[str, object]) -> None:
    assert evaluate(company(**overrides), TODAY, config.scoring()).tier is None


def test_an_upcoming_batch_counts_as_recent() -> None:
    assert evaluate(company(batch="Winter 2027"), TODAY, config.scoring()).tier == "full"
