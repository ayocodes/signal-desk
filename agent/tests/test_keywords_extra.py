import pytest

from agent.config import load_config
from agent.signals import classify_title

EXTRA_CLASSIFICATION_CASES: list[tuple[str, str | None]] = [
    # Sales roles (AE, account exec, inside/outside sales, reps, directors)
    ("Senior AE", "sales"),
    ("Enterprise AE", "sales"),
    ("Account Exec", "sales"),
    ("Senior Account Exec", "sales"),
    ("Mid-Market AE", "sales"),
    ("Enterprise Account Executive", "sales"),
    ("Commercial Account Executive", "sales"),
    ("Strategic Account Executive", "sales"),
    ("Inside Sales Representative", "sales"),
    ("Inside Sales Rep", "sales"),
    ("Outside Sales Representative", "sales"),
    ("Sales Development Rep", "sales"),
    ("Business Development Representative", "sales"),
    ("Director of Sales", "sales"),
    ("Sales Director, North America", "sales"),
    ("Head of Business Development", "sales"),
    ("VP of Business Development", "sales"),
    ("Field Sales Manager", "sales"),
    # GTM roles (Revenue, RevOps, Growth, CRO, GTM leads)
    ("Head of Revenue", "gtm"),
    ("VP of Revenue", "gtm"),
    ("Chief Revenue Officer", "gtm"),
    ("RevOps Lead", "gtm"),
    ("Head of RevOps", "gtm"),
    ("Revenue Operations Manager", "gtm"),
    ("Director of Growth", "gtm"),
    ("VP of Growth", "gtm"),
    ("Growth Director", "gtm"),
    ("Head of GTM", "gtm"),
    ("GTM Lead", "gtm"),
    ("Outbound Lead", "gtm"),
    ("Outbound Specialist", "gtm"),
    # Marketing roles (Senior, Demand Gen, Growth marketing, Performance marketing)
    ("Head of Marketing", "marketing"),
    ("VP of Marketing", "marketing"),
    ("Vice President of Marketing", "marketing"),
    ("Chief Marketing Officer", "marketing"),
    ("CMO", "marketing"),
    ("Marketing Director", "marketing"),
    ("Director of Marketing", "marketing"),
    ("Marketing Lead", "marketing"),
    ("Head of Demand Generation", "marketing"),
    ("Demand Generation Lead", "marketing"),
    ("Demand Gen Manager", "marketing"),
    ("Growth Marketer", "marketing"),
    ("Senior Growth Marketer", "marketing"),
    ("Head of Growth Marketing", "marketing"),
    ("Director of Growth Marketing", "marketing"),
    # Excluded marketing roles (junior, coordinator, associate, content, social media, product marketing, brand)
    ("Marketing Coordinator", None),
    ("Junior Marketing Associate", None),
    ("Social Media Manager", None),
    ("Content Writer", None),
    ("Marketing Content Writer", None),
    ("Head of Product Marketing", None),
    ("Product Marketing Director", None),
    ("Brand Director", None),
    ("VP of Brand Marketing", None),
    ("Brand Marketing Manager", None),
    # Excluded engineering / developer / IT / non-sales roles
    ("Senior Software Engineer", None),
    ("Full Stack Developer", None),
    ("Sales Engineer", None),
    ("DevOps Engineer", None),
    ("Salesforce Administrator", None),
    ("Salesforce Developer", None),
    ("Sales Intern", None),
    ("Marketing Intern", None),
    ("Customer Success Manager", None),
    ("Chief Financial Officer", None),
    ("Product Manager", None),
    ("HR Business Partner", None),
    ("Solutions Architect", None),
    ("Aerospace Flight Controller", None),
    ("Sundae Maker", None),
    # Ambiguous abbreviations and out-of-scope roles (Claude's review of F2.1)
    ("CRO Specialist", None),  # conversion rate optimization
    ("CRO Manager (Clinical Research)", None),  # clinical research organization
    ("AE Motion Designer", None),  # After Effects
    ("Head of Performance Marketing", None),  # outside the user's marketing scope
    ("Performance Marketing Specialist", None),
]


@pytest.mark.parametrize(("title", "expected"), EXTRA_CLASSIFICATION_CASES)
def test_keywords_extra_classification(title: str, expected: str | None) -> None:
    keywords = load_config("test-org").keywords
    match = classify_title(title, keywords)
    actual = match.category if match is not None else None
    assert actual == expected, f"Expected {title!r} to be classified as {expected!r}, got {actual!r}"


# Decided 2026-10-21: paid-ads roles point to paid, inbound acquisition, not outbound,
# so they never count as a hiring signal (candidate toggle for the Phase 4.5 rules editor).
@pytest.mark.parametrize(
    "title",
    [
        "Head of Performance Marketing",
        "Director of Performance Marketing",
        "Growth Lead, Paid Acquisition",
        "Head of Growth (Paid Acquisition)",
        "VP Marketing, Paid Media",
        "Head of Paid Media",
    ],
)
def test_paid_acquisition_roles_never_count(title: str) -> None:
    assert classify_title(title, load_config("any-org").keywords) is None
