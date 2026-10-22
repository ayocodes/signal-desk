"""The sequence engine: sends due steps of active sequences (one agent step, run_sequences).

For each due step of an active sequence:
- the day-3 check sends nothing: it counts opens and adds the day-4 step it chooses
  (opened enough: a follow-up on another signal; otherwise: a new subject line),
- an email step picks a mailbox (healthy or near its cap, under its daily cap, fewest sent
  today), gets its text (the approved email on day 1; an AI follow-up later, or the step's
  pre-checked template when the budget is used up or the draft fails the checks), and sends
  it through Resend with the step's idempotency key, only ever to a Resend test inbox.

Replies, bounces and complaints change sequences as they arrive (the webhook), so this step
only sees sequences that are still active. It also resets daily send counters at UTC
midnight, looks up the sending domain's SPF and DMARC records once a day, and recomputes
every mailbox's health.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any

from pydantic import BaseModel, ValidationError

from agent.db import Row
from agent.drafting import _finish_call, _Pacer, _reserve, lead_facts
from agent.followups import FollowupFacts, fill_template, render_followup_prompt
from agent.guardrails import DraftInput, SignalText, passed, rules_from_config, run_guardrails
from agent.http_client import DisallowedByRobots
from agent.llm import LlmError, LlmQuotaExhausted
from agent.prompts import PromptFacts, PromptSignal
from agent.resend_client import OutgoingEmail, RefusedRecipient, SendFailed
from agent.steps import Context

DOH_URL = "https://dns.google/resolve"


class FollowupOut(BaseModel):
    subject: str
    body: str
    grounded_phrases: list[str]


def due_steps(ctx: Context) -> list[tuple[Row, Row]]:
    """(step, sequence) pairs that are pending and due, for active sequences, oldest first."""
    sequences = {s["id"]: s for s in ctx.db.select_all(
        "sequences", "id, lead_id, status, final_subject, final_body, approved_at", org_id=ctx.org_id, status="active")}
    steps = ctx.db.select_all(
        "sequence_steps", "id, sequence_id, step_key, scheduled_for, status, signal_id, idempotency_key", org_id=ctx.org_id, status="pending")
    due = [
        (step, sequences[step["sequence_id"]])
        for step in steps
        if step["sequence_id"] in sequences and datetime.fromisoformat(step["scheduled_for"]) <= ctx.now
    ]
    return sorted(due, key=lambda pair: pair[0]["scheduled_for"])


def reset_daily_counters(ctx: Context, mailboxes: list[Row]) -> None:
    today = ctx.now.date().isoformat()
    for box in mailboxes:
        if box.get("sent_today_date") != today:
            ctx.db.update("mailboxes", {"sent_today": 0, "sent_today_date": today}, id=box["id"])
            box["sent_today"], box["sent_today_date"] = 0, today


def pick_mailbox(mailboxes: list[Row]) -> Row | None:
    """Rotation: usable mailboxes under their daily cap, the one with the fewest sends today."""
    usable = [b for b in mailboxes if b["status"] in ("healthy", "near_cap") and b["sent_today"] < b["daily_cap"]]
    return min(usable, key=lambda b: (b["sent_today"], b["label"])) if usable else None


def opens_for(ctx: Context, sequence_id: str) -> int:
    step_ids = [s["id"] for s in ctx.db.select_all("sequence_steps", "id", sequence_id=sequence_id)]
    events = [e for sid in step_ids for e in ctx.db.select_all("email_events", "type", step_id=sid)]
    return sum(1 for e in events if e["type"] == "opened")


def run_check(ctx: Context, step: Row, sequence: Row) -> None:
    """The day-3 check: choose the day-4 step from opens, add it, mark the check done."""
    branch = ctx.config.sequence.branch
    opens = opens_for(ctx, sequence["id"])
    chosen, reason = (
        (branch.opened_enough, f"Opened {opens} times, so the follow-up uses another signal")
        if opens >= branch.opens_for_signal_followup
        else (branch.otherwise, f"Opened {opens} times, so the follow-up tries a new subject line")
    )
    scheduled = max(datetime.fromisoformat(sequence["approved_at"]) + timedelta(days=chosen.day_offset), ctx.now)
    ctx.db.upsert(
        "sequence_steps",
        [{
            "org_id": ctx.org_id, "sequence_id": sequence["id"], "step_key": chosen.key,
            "scheduled_for": scheduled.isoformat(), "idempotency_key": f"{sequence['id']}:{chosen.key}",
        }],
        on_conflict="idempotency_key",
        ignore_duplicates=True,
    )
    ctx.db.update(
        "sequence_steps",
        {"status": "done", "meta": {"branch": chosen.key, "opens": opens, "reason": reason}},
        id=step["id"],
    )
    ctx.run.audit("sequence.branched", "sequence", sequence["id"], step=chosen.key, opens=opens)
    ctx.run.count("sequence_checks")


def _first_step(ctx: Context, sequence_id: str) -> Row | None:
    rows = ctx.db.select_all("sequence_steps", "step_key, subject, body, message_id", sequence_id=sequence_id, step_key="d1_open")
    return rows[0] if rows else None


def followup_signal(step_key: str, facts: PromptFacts) -> PromptSignal:
    """The signal a follow-up is built on: the second strongest for the signal follow-up."""
    if step_key == "d4_followup_signal2" and len(facts.signals) > 1:
        return facts.signals[1]
    return facts.signals[0]


def write_followup(
    ctx: Context, step: Row, lead: Row, first: Row, facts: PromptFacts, signals: tuple[SignalText, ...], pacer: _Pacer,
) -> tuple[str, str, dict[str, Any]]:
    """The follow-up's (subject, body, meta): the AI's draft when it passes, else the template."""
    key = step["step_key"]
    followup = FollowupFacts(facts.company_name, facts.contact, first["subject"] or "", first["body"] or "", followup_signal(key, facts))
    same_thread = key in ctx.config.sequence.same_thread_steps and key not in ctx.config.sequence.new_subject_steps
    template_subject, template_body, _ = fill_template(key, followup, ctx.config)

    def fallback(reason: str) -> tuple[str, str, dict[str, Any]]:
        return template_subject, template_body, {"written_by": "template", "reason": reason}

    if ctx.llm is None:
        return fallback("No AI provider in this run")
    limit = math.floor(ctx.settings.llm.daily_budget * ctx.config.outreach.llm.agent_share)
    call_id = _reserve(ctx, lead, limit)
    if call_id is None:
        return fallback("Today's AI budget is used up")
    pacer.wait()
    ctx.run.count("llm_calls")
    try:
        result = ctx.llm.generate_json(render_followup_prompt(key, followup, ctx.config), ctx.config.prompts.followup_schema)
        draft = FollowupOut.model_validate_json(result.text)
    except (LlmError, ValidationError) as error:
        message = str(error) if isinstance(error, LlmError) else "The answer wasn't the expected JSON"
        _finish_call(ctx, call_id, None, message)
        if isinstance(error, LlmQuotaExhausted):
            return fallback("Google's daily quota is used up")
        return fallback(f"The AI draft failed: {message[:120]}")
    _finish_call(ctx, call_id, result, None)

    subject = f"Re: {first['subject']}" if same_thread else draft.subject
    checks = run_guardrails(
        DraftInput("signal", subject, draft.body, tuple(draft.grounded_phrases), signals), rules_from_config(ctx.config)
    )
    if not passed(checks):
        failed = [c.check for c in checks if c.status == "fail"]
        return fallback(f"The AI draft failed the checks: {', '.join(failed)}")
    return subject, draft.body, {"written_by": "ai", "model": result.model, "grounded_phrases": draft.grounded_phrases}


def signature(ctx: Context) -> str:
    sender = ctx.config.outreach.sender
    return f"\n\n{sender.name}\n{sender.company}"


def send_step(ctx: Context, step: Row, sequence: Row, mailboxes: list[Row], pacer: _Pacer) -> None:
    box = pick_mailbox(mailboxes)
    if box is None:
        ctx.run.count("steps_waiting_no_mailbox")  # every mailbox is paused or at its daily cap
        return
    lead = ctx.db.select_all("leads", "id, company_id, contact_id", id=sequence["lead_id"])[0]
    contact = ctx.db.select_all("contacts", "send_address", id=lead["contact_id"])[0] if lead["contact_id"] else None
    if contact is None:
        ctx.run.errors.append({"step": "run_sequences", "message": f"lead {lead['id']}: no contact to send to"})
        return

    if step["step_key"] == "d1_open":
        subject, body, meta = sequence["final_subject"], sequence["final_body"], {"written_by": "approved"}
    else:
        first = _first_step(ctx, sequence["id"])
        if first is None or first.get("message_id") is None:
            return  # the opening email hasn't gone out yet (e.g. waiting for a mailbox)
        facts, signals = lead_facts(ctx, lead)
        subject, body, meta = write_followup(ctx, step, lead, first, facts, signals, pacer)

    text = body + signature(ctx)
    try:
        message_id = ctx.email.send(OutgoingEmail(  # type: ignore[union-attr]
            sender=f"{ctx.config.outreach.sender.name} <{ctx.settings.resend_from}>",
            to=contact["send_address"], subject=subject, text=text, idempotency_key=step["idempotency_key"],
        ))
    except (RefusedRecipient, SendFailed) as error:
        ctx.run.errors.append({"step": "run_sequences", "message": f"step {step['id']}: {error}"})
        return

    ctx.db.update("sequence_steps", {
        "status": "sent", "sent_at": ctx.now.isoformat(), "message_id": message_id, "mailbox_id": box["id"],
        "subject": subject, "body": text, "meta": meta,
    }, id=step["id"])
    box["sent_today"] += 1
    ctx.db.update("mailboxes", {"sent_today": box["sent_today"], "sent_today_date": ctx.now.date().isoformat()}, id=box["id"])
    ctx.db.update("sequences", {"current_step": step["step_key"]}, id=sequence["id"])
    if step["step_key"] == ctx.config.sequence.steps[-1].key:
        ctx.db.update("sequences", {"status": "completed"}, id=sequence["id"])
        ctx.db.update("leads", {"status": "completed"}, id=lead["id"])
    ctx.run.audit("step.sent", "sequence", sequence["id"], step=step["step_key"], mailbox=box["label"], written_by=meta["written_by"])
    ctx.run.count("emails_sent")


def check_dns(ctx: Context, mailboxes: list[Row]) -> None:
    """SPF and DMARC for each sending domain, once a UTC day (public DNS-over-HTTPS, no key)."""
    today = ctx.now.date().isoformat()
    for box in mailboxes:
        auth = box.get("auth") or {}
        if auth.get("checked_on") == today:
            continue
        domain = box["send_via"].rsplit("@", 1)[-1].strip(">").lower()
        try:
            spf = _txt(ctx, domain, "v=spf1")
            dmarc = _txt(ctx, f"_dmarc.{domain}", "v=DMARC1")
        except (DisallowedByRobots, OSError, ValueError) as error:
            ctx.run.errors.append({"step": "run_sequences", "message": f"DNS lookup for {domain} failed: {type(error).__name__}"})
            continue
        result = {"domain": domain, "spf": spf, "dmarc": dmarc, "dkim": "managed by provider", "checked_on": today}
        ctx.db.update("mailboxes", {"auth": result}, id=box["id"])


def _txt(ctx: Context, name: str, prefix: str) -> str | None:
    answer = ctx.client.get(DOH_URL, params={"name": name, "type": "TXT"}).json().get("Answer", [])
    records = [str(a.get("data", "")).strip('"') for a in answer]
    return next((r for r in records if r.lower().startswith(prefix.lower())), None)


def refresh_health(ctx: Context, mailboxes: list[Row]) -> None:
    rules = ctx.config.guardrails.mailbox
    for box in mailboxes:
        ctx.db.rpc("refresh_mailbox_health", {
            "p_mailbox": box["id"], "p_bounce_pct": rules.pause_bounce_pct,
            "p_complaint_pct": rules.pause_complaint_pct, "p_min_sends": rules.min_sends_for_rates,
        })


def run_sequences(ctx: Context) -> None:
    if ctx.db.dry_run or ctx.email is None:
        ctx.run.count("sequences_skipped")  # dry runs never send
        return
    mailboxes = ctx.db.select_all("mailboxes", "id, label, send_via, daily_cap, sent_today, sent_today_date, status, auth", org_id=ctx.org_id)
    reset_daily_counters(ctx, mailboxes)
    pacer = _Pacer(ctx.config.outreach.llm.min_seconds_between_calls, ctx.sleep)
    for step, sequence in due_steps(ctx):
        if step["step_key"] in ctx.config.sequence.check_steps:
            run_check(ctx, step, sequence)
        else:
            send_step(ctx, step, sequence, mailboxes, pacer)
    if ctx.client is not None:
        check_dns(ctx, mailboxes)
    refresh_health(ctx, mailboxes)
