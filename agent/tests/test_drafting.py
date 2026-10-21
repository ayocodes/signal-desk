"""The drafting step with an in-memory database and a scripted model (no network)."""

import json
from datetime import UTC, datetime
from typing import Any

import pytest

from agent import drafting
from agent.config import load_config
from agent.llm import LlmError, LlmQuotaExhausted, LlmResult
from agent.run import RunRecorder
from agent.settings import LlmSettings, Settings
from agent.steps import Context

ORG = "org-1"
GOOD = {
    "subject": "Your founding AE search",
    "body": "Hi Jane, saw you're hiring a Founding Account Executive to build your outbound motion from scratch. "
    "We help teams draft first emails that cite public signals. Worth a look?",
    "grounded_phrases": ["Founding Account Executive"],
}
BAD = {**GOOD, "body": GOOD["body"].replace("We help", "Our customers say we help")}  # unsupported claim


def answer(**angles: dict[str, Any]) -> str:
    return json.dumps({"drafts": [{"angle": angle, **draft} for angle, draft in angles.items()]})


ALL_GOOD = answer(signal=GOOD, peer=GOOD, short=GOOD)


class FakeDb:
    dry_run = False

    def __init__(self, budget: int = 100) -> None:
        self.budget = budget
        self.calls = 0
        self.updates: list[tuple[str, dict[str, Any], dict[str, Any]]] = []
        self.tables: dict[str, list[dict[str, Any]]] = {
            "leads": [
                {"id": "lead-low", "org_id": ORG, "status": "ready", "company_id": "co-1", "contact_id": "ct-1", "score": 60},
                {"id": "lead-high", "org_id": ORG, "status": "ready", "company_id": "co-1", "contact_id": "ct-1", "score": 95},
                {"id": "lead-done", "org_id": ORG, "status": "ready", "company_id": "co-1", "contact_id": None, "score": 99},
                {"id": "lead-raw-only", "org_id": ORG, "status": "ready", "company_id": "co-1", "contact_id": None, "score": 80},
                {"id": "lead-filtered", "org_id": ORG, "status": "filtered", "company_id": "co-1", "contact_id": None, "score": 99},
            ],
            "drafts": [
                {"id": "d-1", "org_id": ORG, "lead_id": "lead-done", "angle": "signal"},
                {"id": "d-2", "org_id": ORG, "lead_id": "lead-raw-only", "angle": "raw"},
            ],
            "companies": [{"id": "co-1", "name": "Acme", "domain": "acme.dev", "description": "Billing software."}],
            "contacts": [{"id": "ct-1", "name": "Jane Doe", "title": "CEO", "is_placeholder": False}],
            "signals": [
                {"company_id": "co-1", "type": "funding", "title": "YC W26", "excerpt": None, "source_name": "YC directory",
                 "occurred_at": "2026-10-01T00:00:00Z", "detected_at": "2026-10-01T00:00:00Z", "meta": {}},
                {"company_id": "co-1", "type": "hiring", "title": "Founding Account Executive",
                 "excerpt": "You will build our outbound motion from scratch.", "source_name": "Greenhouse",
                 "occurred_at": "2026-10-20T00:00:00Z", "detected_at": "2026-10-20T00:00:00Z", "meta": {"category": "sales"}},
            ],
        }

    def select_all(self, table: str, columns: str = "*", **equals: Any) -> list[dict[str, Any]]:
        return [r for r in self.tables.get(table, []) if all(r.get(k) == v for k, v in equals.items())]

    def insert(self, table: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        self.tables.setdefault(table, []).extend(rows)
        return rows

    def update(self, table: str, values: dict[str, Any], **equals: Any) -> None:
        self.updates.append((table, values, equals))

    def rpc(self, function: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        assert function == "reserve_llm_call" and params["p_source"] == "agent"
        if self.calls >= min(self.budget, params["p_daily_limit"]):
            return [{"call_id": None, "refusal": "budget"}]
        self.calls += 1
        return [{"call_id": f"call-{self.calls}", "refusal": None}]


class ScriptedLlm:
    name = "scripted"

    def __init__(self, *outcomes: str | Exception) -> None:
        self.outcomes = list(outcomes)
        self.prompts: list[str] = []

    def generate_json(self, prompt: str, schema: dict[str, Any]) -> LlmResult:
        self.prompts.append(prompt)
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return LlmResult(text=outcome, model="gemini-test", tokens_in=800, tokens_out=200, ms=1500)


def context(db: FakeDb, llm: ScriptedLlm, drafts_per_run: int = 1, budget: int = 20) -> tuple[Context, list[float]]:
    waits: list[float] = []
    settings = Settings(
        supabase_url="https://x.supabase.co", supabase_service_role_key="k",
        llm=LlmSettings(provider="gemini", api_key="k", model="gemini-test", daily_budget=budget),
        resend_api_key="k", resend_from="a@b.c", user_agent="ua", drafts_per_run=drafts_per_run,
        discovery_probes_per_run=0, job_boards=("greenhouse",), trigger="test",
    )
    ctx = Context(
        settings=settings, db=db, client=None, run=RunRecorder(db, ORG, "test"),  # type: ignore[arg-type]
        org_id=ORG, now=datetime(2026, 10, 21, tzinfo=UTC), config=load_config(ORG), llm=llm, sleep=waits.append,
    )
    return ctx, waits


def stored(db: FakeDb) -> list[dict[str, Any]]:
    return [d for d in db.tables["drafts"] if "id" not in d]


def test_picks_ready_leads_without_drafts_best_score_first() -> None:
    ctx, _ = context(FakeDb(), ScriptedLlm())
    ctx.settings = ctx.settings.model_copy(update={"drafts_per_run": 5})
    assert [lead["id"] for lead in drafting.leads_to_draft(ctx)] == ["lead-high", "lead-raw-only", "lead-low"]


def test_one_call_stores_three_drafts_with_prompt_tokens_and_trace() -> None:
    db = FakeDb()
    llm = ScriptedLlm(ALL_GOOD)
    ctx, _ = context(db, llm)
    drafting.draft_leads(ctx)

    rows = stored(db)
    assert [r["angle"] for r in rows] == ["signal", "peer", "short"]
    assert all(r["lead_id"] == "lead-high" and r["passed"] for r in rows)
    first = rows[0]
    assert first["prompt"] == llm.prompts[0] and len(first["prompt_hash"]) == 64
    assert (first["tokens_in"], first["tokens_out"], first["llm_call_id"]) == (800, 200, "call-1")
    assert first["trace"]["attempts"][0]["failedChecks"] == {"signal": [], "peer": [], "short": []}
    assert first["trace"]["signals"][0] == {"label": "Hiring", "title": "Founding Account Executive"}
    assert ("llm_calls", {"ok": True, "error": None, "model": "gemini-test", "tokens_in": 800, "tokens_out": 200}, {"id": "call-1"}) in db.updates
    assert ctx.run.stats == {"llm_calls": 1, "drafts_created": 3, "leads_drafted": 1}
    assert ctx.run._audit[-1]["action"] == "draft.created"


def test_prompt_lists_the_hiring_signal_before_the_funding_one() -> None:
    db = FakeDb()
    llm = ScriptedLlm(ALL_GOOD)
    ctx, _ = context(db, llm)
    drafting.draft_leads(ctx)
    assert llm.prompts[0].index("Founding Account Executive") < llm.prompts[0].index("YC W26")


def test_a_failing_angle_gets_one_retry_and_the_passing_version_is_kept() -> None:
    db = FakeDb()
    llm = ScriptedLlm(answer(signal=GOOD, peer=BAD, short=GOOD), answer(signal=BAD, peer=GOOD, short=GOOD))
    ctx, waits = context(db, llm)
    drafting.draft_leads(ctx)

    rows = {r["angle"]: r for r in stored(db)}
    assert all(r["passed"] for r in rows.values())
    assert (rows["signal"]["llm_call_id"], rows["peer"]["llm_call_id"]) == ("call-1", "call-2")
    assert rows["peer"]["trace"]["attempts"][0]["failedChecks"]["peer"] == ["claims"]
    assert len(waits) == 1 and 0 < waits[0] <= 13


def test_still_failing_after_the_retry_stores_the_first_version_marked_failed() -> None:
    db = FakeDb()
    bad = answer(signal=GOOD, peer=BAD, short=GOOD)
    ctx, _ = context(db, ScriptedLlm(bad, bad))
    drafting.draft_leads(ctx)
    rows = {r["angle"]: r for r in stored(db)}
    assert rows["peer"]["passed"] is False and rows["peer"]["llm_call_id"] == "call-1"
    assert ctx.run.stats["llm_calls"] == 2


def test_stops_at_the_agents_share_of_the_budget() -> None:
    db = FakeDb()
    llm = ScriptedLlm(ALL_GOOD, ALL_GOOD)
    ctx, _ = context(db, llm, drafts_per_run=5, budget=2)  # floor(2 * 0.8) = 1 call for the agent
    drafting.draft_leads(ctx)
    assert len(llm.prompts) == 1
    assert {r["lead_id"] for r in stored(db)} == {"lead-high"}
    assert ctx.run.stats["drafting_paused_budget"] == 1


def test_daily_quota_from_google_stops_the_step() -> None:
    db = FakeDb()
    llm = ScriptedLlm(LlmQuotaExhausted("Gemini's daily request quota is used up"), ALL_GOOD)
    ctx, _ = context(db, llm, drafts_per_run=5)
    drafting.draft_leads(ctx)
    assert len(llm.prompts) == 1 and stored(db) == []
    assert ctx.run.stats["drafting_paused_quota"] == 1
    assert db.updates[0][1]["ok"] is False


def test_bad_json_is_recorded_and_retried() -> None:
    db = FakeDb()
    ctx, _ = context(db, ScriptedLlm("not json", ALL_GOOD))
    drafting.draft_leads(ctx)
    assert len(stored(db)) == 3
    assert "expected JSON" in ctx.run.errors[0]["message"]


def test_a_failed_call_stores_nothing_when_the_retry_fails_too() -> None:
    db = FakeDb()
    ctx, _ = context(db, ScriptedLlm(LlmError("Gemini answered 500: oops"), LlmError("Gemini answered 500: oops")))
    drafting.draft_leads(ctx)
    assert stored(db) == [] and len(ctx.run.errors) == 2


def test_dry_runs_never_call_the_model() -> None:
    db = FakeDb()
    db.dry_run = True
    llm = ScriptedLlm()
    ctx, _ = context(db, llm)
    drafting.draft_leads(ctx)
    assert llm.prompts == [] and ctx.run.stats == {"drafting_skipped": 1}


@pytest.mark.parametrize("text", [answer(signal=GOOD, signal2=GOOD), '{"drafts": [{"angle": "signal"}]}'])
def test_parse_rejects_answers_that_break_the_schema(text: str) -> None:
    with pytest.raises(Exception):
        drafting.parse_drafts(text)
