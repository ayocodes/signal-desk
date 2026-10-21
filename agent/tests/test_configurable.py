"""Phase 4.5: the hiring categories and signal sources an admin can change."""

from datetime import UTC, datetime, timedelta
from typing import Any

from agent.config import build_config, default_rules
from agent.run import RunRecorder
from agent.scoring import SignalFacts, score_lead
from agent.signals import classify_title, job_title_of
from agent.steps import Context, reclassify_hiring

NOW = datetime(2026, 10, 21, 12, tzinfo=UTC)


def config(**changes: Any) -> Any:
    """The defaults with some fields changed, e.g. config(paid=True, launch=False)."""
    rules = default_rules()
    if changes.get("paid"):
        rules["hiring"]["categories"][2]["enabled"] = True
    if changes.get("marketing") is False:
        rules["hiring"]["categories"][0]["enabled"] = False
    if changes.get("launch") is False:
        rules["signals"]["launch"]["enabled"] = False
    if "sales_keyword" in changes:
        rules["hiring"]["categories"][1]["keywords"].append(changes["sales_keyword"])
    return build_config(rules, 2)


def test_paid_acquisition_roles_count_only_when_their_category_is_on() -> None:
    assert classify_title("Head of Paid Acquisition", config().hiring) is None
    match = classify_title("Head of Paid Acquisition", config(paid=True).hiring)
    assert match is not None and match.category == "paid_acquisition"


def test_a_disabled_category_matches_nothing() -> None:
    assert classify_title("Head of Marketing", config(marketing=False).hiring) is None


def test_the_first_matching_category_wins() -> None:
    # "Growth marketing" matches Marketing hire before the Sales hire keyword "head of growth".
    match = classify_title("Head of Growth Marketing", config().hiring)
    assert match is not None and match.category == "marketing"


def test_a_paid_acquisition_hire_scores_its_own_points() -> None:
    cfg = config(paid=True)
    hire = SignalFacts("hiring", NOW - timedelta(days=30), "Hire", category="paid_acquisition")
    result = score_lead("full", [hire], NOW, cfg.scoring, cfg.hiring)
    assert result.parts == (("ICP match", 40), ("Paid acquisition hire", 10))


def test_signals_from_a_switched_off_source_count_for_nothing() -> None:
    cfg = config(launch=False)
    launch = SignalFacts("launch", NOW - timedelta(hours=2), "Launch HN")
    result = score_lead("full", [launch], NOW, cfg.scoring, cfg.hiring)
    assert result.parts == (("ICP match", 40),)
    assert result.ready is False


def test_hiring_signals_in_a_disabled_category_count_for_nothing() -> None:
    cfg = config(marketing=False)
    hire = SignalFacts("hiring", NOW - timedelta(hours=2), "Hire", category="marketing")
    assert score_lead("full", [hire], NOW, cfg.scoring, cfg.hiring).score == 40


def test_old_signal_titles_give_back_the_job_title() -> None:
    assert job_title_of({"title": "Hiring: Founding AE", "meta": {}}) == "Founding AE"
    assert job_title_of({"title": "Sales hire: X", "meta": {"job_title": "Head of Sales: EMEA"}}) == "Head of Sales: EMEA"


class FakeDb:
    dry_run = False

    def __init__(self) -> None:
        self.updates: list[tuple[str, dict[str, Any], dict[str, Any]]] = []

    def update(self, table: str, values: dict[str, Any], **equals: Any) -> None:
        self.updates.append((table, values, equals))


def test_scoring_reclassifies_hiring_signals_with_the_current_rules() -> None:
    db = FakeDb()
    ctx = Context(
        settings=None, db=db, client=None, run=RunRecorder(db, "org", "test"),  # type: ignore[arg-type]
        org_id="org", now=NOW, config=config(sales_keyword="customer success lead"),
    )
    rows = [
        # Stored before Phase 4.5 with the old label and the old "gtm" category.
        {"id": "s1", "type": "hiring", "title": "Hiring: Head of Growth", "meta": {"category": "gtm", "founding": False}},
        # Didn't count before; the new keyword makes it a Sales hire.
        {"id": "s2", "type": "hiring", "title": "Hiring: Customer Success Lead", "meta": {"category": None}},
        # Already up to date: nothing is written.
        {"id": "s3", "type": "hiring", "title": "Marketing hire: Head of Marketing",
         "meta": {"category": "marketing", "founding": False, "job_title": "Head of Marketing"}},
        {"id": "s4", "type": "launch", "title": "Launch HN: Acme", "meta": {}},
    ]
    reclassify_hiring(ctx, rows)
    assert [(u[2]["id"], u[1]["title"], u[1]["meta"]["category"]) for u in db.updates] == [
        ("s1", "Sales hire: Head of Growth", "sales"),
        ("s2", "Sales hire: Customer Success Lead", "sales"),
    ]
    assert rows[0]["meta"]["category"] == "sales"  # the rows scoring uses are updated too
    assert ctx.run.stats["signals_reclassified"] == 2


class TableDb:
    """An in-memory stand-in for the tables score_leads reads and writes."""

    dry_run = False

    def __init__(self, tables: dict[str, list[dict[str, Any]]]) -> None:
        self.tables = tables
        self.upserts: list[tuple[str, list[dict[str, Any]]]] = []

    def select_all(self, table: str, columns: str = "*", **equals: Any) -> list[dict[str, Any]]:
        return [dict(r) for r in self.tables.get(table, []) if all(r.get(k) == v for k, v in equals.items())]

    def upsert(self, table: str, rows: list[dict[str, Any]], **_: Any) -> list[dict[str, Any]]:
        if rows:
            self.upserts.append((table, rows))
        return rows

    def update(self, table: str, values: dict[str, Any], **equals: Any) -> None:
        return None


def test_scoring_records_the_rules_version_and_leaves_enrolled_leads_alone() -> None:
    from agent.steps import score_leads

    hire = {"id": "s", "type": "hiring", "title": "Sales hire: Founding AE", "occurred_at": NOW.isoformat(),
            "detected_at": NOW.isoformat(), "meta": {"category": "sales", "founding": True, "job_title": "Founding AE"}}
    db = TableDb({
        "companies": [
            {"id": "c1", "org_id": "org", "icp_match": True, "name": "Ready Co", "icp_tier": "full", "team_size": 10},
            {"id": "c2", "org_id": "org", "icp_match": True, "name": "Enrolled Co", "icp_tier": "full", "team_size": 10},
        ],
        "signals": [{**hire, "id": "s1", "company_id": "c1", "org_id": "org"}, {**hire, "id": "s2", "company_id": "c2", "org_id": "org"}],
        "leads": [
            {"id": "l1", "org_id": "org", "company_id": "c1", "status": "ready", "score": 90, "score_parts": [],
             "filtered_reason": None, "assigned_to": "rep", "config_version": 1},
            {"id": "l2", "org_id": "org", "company_id": "c2", "status": "enrolled", "score": 77, "score_parts": [],
             "filtered_reason": None, "assigned_to": "rep", "config_version": 1},
        ],
        "contacts": [{"id": "ct1", "org_id": "org", "company_id": "c1"}, {"id": "ct2", "org_id": "org", "company_id": "c2"}],
        "profiles": [{"id": "rep", "org_id": "org", "role": "rep", "created_at": NOW.isoformat()}],
    })
    ctx = Context(
        settings=None, db=db, client=None, run=RunRecorder(db, "org", "test"),  # type: ignore[arg-type]
        org_id="org", now=NOW, config=config(),  # rules version 2
    )
    score_leads(ctx)
    written = [row for table, rows in db.upserts if table == "leads" for row in rows]
    assert [(r["company_id"], r["config_version"]) for r in written] == [("c1", 2)]
