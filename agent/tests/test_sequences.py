"""The sequence engine (agent/sequences.py) with an in-memory database, a fake sender and a scripted model."""

import json
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest

from agent import sequences
from agent.config import load_config
from agent.llm import LlmResult
from agent.resend_client import OutgoingEmail, RefusedRecipient, ResendClient, is_test_inbox
from agent.run import RunRecorder
from agent.settings import LlmSettings, Settings
from agent.steps import Context

NOW = datetime(2026, 10, 22, 12, tzinfo=UTC)
ORG = "org-1"
APPROVED = (NOW - timedelta(days=4)).isoformat()


class FakeDb:
    dry_run = False

    def __init__(self, budget: int = 100) -> None:
        self.budget = budget
        self.calls = 0
        self.rpcs: list[tuple[str, dict[str, Any]]] = []
        self.tables: dict[str, list[dict[str, Any]]] = {
            "sequences": [{"id": "seq-1", "org_id": ORG, "lead_id": "lead-1", "status": "active", "final_subject": "Your founding AE search",
                           "final_body": "Hi Jane, saw the Founding Account Executive role. Worth a look?", "approved_at": APPROVED}],
            "sequence_steps": [],
            "leads": [{"id": "lead-1", "org_id": ORG, "company_id": "co-1", "contact_id": "ct-1", "status": "enrolled"}],
            "contacts": [{"id": "ct-1", "name": "Jane Doe", "title": "CEO", "is_placeholder": False, "send_address": "delivered+abc@resend.dev"}],
            "companies": [{"id": "co-1", "name": "Acme", "domain": "acme.dev", "description": "Billing."}],
            "signals": [
                {"company_id": "co-1", "type": "hiring", "title": "Sales hire: Founding Account Executive", "excerpt": "Build our outbound motion from scratch.",
                 "source_name": "Ashby", "occurred_at": "2026-10-20T00:00:00Z", "detected_at": "2026-10-20T00:00:00Z", "meta": {"category": "sales"}},
                {"company_id": "co-1", "type": "launch", "title": "Launch HN: Acme (YC W26) - billing for vertical SaaS", "excerpt": None,
                 "source_name": "Hacker News", "occurred_at": "2026-10-10T00:00:00Z", "detected_at": "2026-10-10T00:00:00Z", "meta": {}},
            ],
            "mailboxes": [
                {"id": f"mb-{i}", "org_id": ORG, "label": f"outbound-{i}", "send_via": "onboarding@resend.dev", "daily_cap": 50,
                 "sent_today": sent, "sent_today_date": NOW.date().isoformat(), "status": "healthy", "auth": {"checked_on": NOW.date().isoformat()}}
                for i, sent in ((1, 3), (2, 1), (3, 2))
            ],
            "email_events": [],
            "llm_calls": [],
        }

    def step(self, key: str, *, status: str = "pending", due: datetime = NOW - timedelta(hours=1), **extra: Any) -> dict[str, Any]:
        row = {"id": f"st-{key}", "org_id": ORG, "sequence_id": "seq-1", "step_key": key, "scheduled_for": due.isoformat(),
               "status": status, "signal_id": None, "idempotency_key": f"seq-1:{key}", "message_id": None, "subject": None, "body": None, **extra}
        self.tables["sequence_steps"].append(row)
        return row

    def select_all(self, table: str, columns: str = "*", **equals: Any) -> list[dict[str, Any]]:
        return [dict(r) for r in self.tables.get(table, []) if all(r.get(k) == v for k, v in equals.items())]

    def update(self, table: str, values: dict[str, Any], **equals: Any) -> None:
        for row in self.tables[table]:
            if all(row.get(k) == v for k, v in equals.items()):
                row.update(values)

    def upsert(self, table: str, rows: list[dict[str, Any]], **_: Any) -> list[dict[str, Any]]:
        keys = {r["idempotency_key"] for r in self.tables[table]}
        new = [{"id": f"st-{r['step_key']}", "status": "pending", "signal_id": None, "message_id": None, **r} for r in rows if r["idempotency_key"] not in keys]
        self.tables[table].extend(new)
        return new

    def insert(self, table: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return rows

    def rpc(self, function: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        self.rpcs.append((function, params))
        if function == "reserve_llm_call":
            if self.calls >= self.budget:
                return [{"call_id": None, "refusal": "budget"}]
            self.calls += 1
            return [{"call_id": f"call-{self.calls}", "refusal": None}]
        return []


class FakeSender:
    def __init__(self) -> None:
        self.sent: list[OutgoingEmail] = []

    def send(self, email: OutgoingEmail) -> str:
        if not is_test_inbox(email.to):
            raise RefusedRecipient("not a test inbox")
        self.sent.append(email)
        return f"msg-{len(self.sent)}"


class ScriptedLlm:
    name = "scripted"

    def __init__(self, *answers: dict[str, Any]) -> None:
        self.answers = list(answers)

    def generate_json(self, prompt: str, schema: dict[str, Any]) -> LlmResult:
        return LlmResult(text=json.dumps(self.answers.pop(0)), model="gemini-test", tokens_in=1, tokens_out=1, ms=1)


def context(db: FakeDb, llm: ScriptedLlm | None = None) -> tuple[Context, FakeSender]:
    settings = Settings(
        supabase_url="https://x.supabase.co", supabase_service_role_key="k",
        llm=LlmSettings(provider="gemini", api_key="k", model="m", daily_budget=20), resend_api_key="k",
        resend_from="onboarding@resend.dev", user_agent="ua", drafts_per_run=5, discovery_probes_per_run=0,
        job_boards=("greenhouse",), trigger="test",
    )
    sender = FakeSender()
    ctx = Context(settings=settings, db=db, client=None, run=RunRecorder(db, ORG, "test"),  # type: ignore[arg-type]
                  org_id=ORG, now=NOW, config=load_config(ORG), llm=llm, email=sender, sleep=lambda s: None)  # type: ignore[arg-type]
    return ctx, sender


def test_day_one_sends_the_approved_email_from_the_least_used_mailbox() -> None:
    db = FakeDb()
    step = db.step("d1_open")
    ctx, sender = context(db)
    sequences.run_sequences(ctx)
    [email] = sender.sent
    assert (email.to, email.subject, email.idempotency_key) == ("delivered+abc@resend.dev", "Your founding AE search", "seq-1:d1_open")
    assert email.sender == "Sam <onboarding@resend.dev>"
    assert email.text.endswith("\n\nSam\nSignal Desk")
    assert (step["status"], step["message_id"], step["mailbox_id"], step["meta"]) == ("sent", "msg-1", "mb-2", {"written_by": "approved"})
    assert db.tables["mailboxes"][1]["sent_today"] == 2
    assert ("refresh_mailbox_health", {"p_mailbox": "mb-1", "p_bounce_pct": 4.0, "p_complaint_pct": 0.3, "p_min_sends": 20}) in db.rpcs


def test_steps_not_yet_due_or_of_paused_sequences_wait() -> None:
    db = FakeDb()
    db.step("d1_open", due=NOW + timedelta(hours=1))
    ctx, sender = context(db)
    sequences.run_sequences(ctx)
    db.tables["sequences"][0]["status"] = "paused"
    db.tables["sequence_steps"][0]["scheduled_for"] = (NOW - timedelta(hours=1)).isoformat()
    sequences.run_sequences(ctx)
    assert sender.sent == []


def test_every_mailbox_paused_or_capped_means_the_step_waits() -> None:
    db = FakeDb()
    db.step("d1_open")
    db.tables["mailboxes"][0]["status"] = "paused"
    for box in db.tables["mailboxes"][1:]:
        box["sent_today"] = 50
    ctx, sender = context(db)
    sequences.run_sequences(ctx)
    assert sender.sent == [] and ctx.run.stats["steps_waiting_no_mailbox"] == 1


def test_counters_reset_when_the_utc_day_changes() -> None:
    db = FakeDb()
    db.tables["mailboxes"][0].update(sent_today=40, sent_today_date="2026-10-21")
    ctx, _ = context(db)
    sequences.run_sequences(ctx)
    assert (db.tables["mailboxes"][0]["sent_today"], db.tables["mailboxes"][0]["sent_today_date"]) == (0, "2026-10-22")


@pytest.mark.parametrize(("opens", "chosen"), [(2, "d4_followup_signal2"), (1, "d4_new_subject"), (0, "d4_new_subject")])
def test_day_three_check_chooses_the_day_four_step_from_opens(opens: int, chosen: str) -> None:
    db = FakeDb()
    db.step("d1_open", status="sent", message_id="msg-0", subject="Your founding AE search", body="Hi")
    check = db.step("d3_check")
    db.tables["email_events"] = [{"step_id": "st-d1_open", "type": "opened"} for _ in range(opens)]
    ctx, _ = context(db, ScriptedLlm({"subject": "x", "body": "x", "grounded_phrases": []}))
    sequences.run_check(ctx, check, db.tables["sequences"][0])
    assert check["status"] == "done" and check["meta"]["branch"] == chosen and check["meta"]["opens"] == opens
    added = [s for s in db.tables["sequence_steps"] if s["step_key"] == chosen]
    assert len(added) == 1 and added[0]["idempotency_key"] == f"seq-1:{chosen}"
    sequences.run_check(ctx, check, db.tables["sequences"][0])  # a re-run adds nothing
    assert len([s for s in db.tables["sequence_steps"] if s["step_key"] == chosen]) == 1


GOOD_FOLLOWUP = {
    "subject": "One more thing",
    "body": "Hi Jane, I also saw Launch HN: Acme (YC W26) - billing for vertical SaaS. Would a first email built on that help?",
    "grounded_phrases": ["Launch HN: Acme (YC W26) - billing for vertical SaaS"],
}


def test_a_followup_uses_the_ai_draft_when_it_passes_and_stays_in_the_thread() -> None:
    db = FakeDb()
    db.step("d1_open", status="sent", message_id="msg-0", subject="Your founding AE search", body="Hi")
    step = db.step("d4_followup_signal2")
    ctx, sender = context(db, ScriptedLlm(GOOD_FOLLOWUP))
    sequences.run_sequences(ctx)
    [email] = sender.sent
    assert email.subject == "Re: Your founding AE search"
    assert email.text.startswith(GOOD_FOLLOWUP["body"])
    assert step["meta"]["written_by"] == "ai"


def test_a_followup_falls_back_to_the_template_when_the_draft_fails_the_checks() -> None:
    db = FakeDb()
    db.step("d1_open", status="sent", message_id="msg-0", subject="Your founding AE search", body="Hi")
    step = db.step("d4_followup_signal2")
    bad = {**GOOD_FOLLOWUP, "body": GOOD_FOLLOWUP["body"].replace("Would", "Our customers say it doubles replies. Would")}
    ctx, sender = context(db, ScriptedLlm(bad))
    sequences.run_sequences(ctx)
    assert step["meta"]["written_by"] == "template"
    assert "claims" in step["meta"]["reason"]
    assert "Launch HN: Acme (YC W26)" in sender.sent[0].text  # the template uses the second signal


def test_a_followup_falls_back_to_the_template_when_the_budget_is_used_up() -> None:
    db = FakeDb(budget=0)
    db.step("d1_open", status="sent", message_id="msg-0", subject="Your founding AE search", body="Hi")
    step = db.step("d7_case")
    ctx, sender = context(db, ScriptedLlm())
    sequences.run_sequences(ctx)
    assert step["meta"] == {"written_by": "template", "reason": "Today's AI budget is used up"}
    assert sender.sent[0].subject == "Re: Your founding AE search"


def test_the_last_step_completes_the_sequence_and_the_lead() -> None:
    db = FakeDb(budget=0)
    db.step("d1_open", status="sent", message_id="msg-0", subject="Your founding AE search", body="Hi")
    db.step("d11_close")
    ctx, _ = context(db, ScriptedLlm())
    sequences.run_sequences(ctx)
    assert db.tables["sequences"][0]["status"] == "completed"
    assert db.tables["leads"][0]["status"] == "completed"


def test_dry_runs_never_send() -> None:
    db = FakeDb()
    db.dry_run = True
    db.step("d1_open")
    ctx, sender = context(db)
    sequences.run_sequences(ctx)
    assert sender.sent == [] and ctx.run.stats == {"sequences_skipped": 1}


@pytest.mark.parametrize("address", ["delivered@resend.dev", "bounced+lead1@resend.dev", "COMPLAINED+x@Resend.dev"])
def test_test_inboxes_are_allowed(address: str) -> None:
    assert is_test_inbox(address)


@pytest.mark.parametrize("address", ["jane@acme.dev", "delivered@resend.dev.evil.com", "someone@resend.dev", "delivered@resend.dev, jane@acme.dev"])
def test_anything_else_is_refused_before_any_request(address: str) -> None:
    requests: list[httpx.Request] = []
    client = ResendClient("k", transport=httpx.MockTransport(lambda r: requests.append(r) or httpx.Response(200, json={"id": "x"})))
    with pytest.raises(RefusedRecipient):
        client.send(OutgoingEmail("Sam <onboarding@resend.dev>", address, "s", "t", "key"))
    assert requests == []


def test_resend_gets_the_idempotency_key() -> None:
    seen: list[httpx.Request] = []
    client = ResendClient("k", transport=httpx.MockTransport(lambda r: seen.append(r) or httpx.Response(200, json={"id": "msg-9"})))
    assert client.send(OutgoingEmail("Sam <onboarding@resend.dev>", "delivered+a@resend.dev", "s", "t", "seq-1:d1_open")) == "msg-9"
    assert seen[0].headers["Idempotency-Key"] == "seq-1:d1_open"
    assert json.loads(seen[0].content)["to"] == ["delivered+a@resend.dev"]
