"""The drafting step: three grounded first emails per ready lead, in one LLM call.

For each ready lead without drafts (best score first, at most DRAFTS_PER_RUN):
1. reserve a call against the daily budget (the agent may use its share; the rest is kept
   for Regenerate and Unconstrained in the web app),
2. send the prompt (shared/prompts/draft.md), read back {drafts: [...]} as JSON,
3. run the guardrails on each angle, and if any angle fails, try once more,
4. store each angle's best version with the exact prompt, its hash, tokens and a trace.

The raw baseline is never made here: the web app generates it on demand.
"""

from __future__ import annotations

import math
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel, ValidationError

from agent.db import Row
from agent.guardrails import CheckResult, DraftInput, GuardrailRules, SignalText, passed, rules_from_config, run_guardrails
from agent.llm import LlmError, LlmQuotaExhausted, LlmResult
from agent.prompts import PromptContact, PromptFacts, PromptSignal, prompt_hash, render_draft_prompt, signal_label
from agent.steps import Context

ANGLES = ("signal", "peer", "short")
TYPE_PRIORITY = {"hiring": 0, "launch": 1, "funding": 2}


class DraftOut(BaseModel):
    angle: Literal["signal", "peer", "short", "raw"]
    subject: str
    body: str
    grounded_phrases: list[str]


class DraftsOut(BaseModel):
    drafts: list[DraftOut]


@dataclass
class Attempt:
    number: int
    call_id: str
    result: LlmResult | None = None
    drafts: dict[str, DraftOut] = field(default_factory=dict)
    checks: dict[str, list[CheckResult]] = field(default_factory=dict)
    error: str | None = None

    def all_passed(self) -> bool:
        return all(angle in self.checks and passed(self.checks[angle]) for angle in ANGLES)


def parse_drafts(text: str) -> dict[str, DraftOut]:
    """The model's answer, one draft per angle (the first one wins if an angle repeats)."""
    out: dict[str, DraftOut] = {}
    for draft in DraftsOut.model_validate_json(text).drafts:
        if draft.angle in ANGLES:
            out.setdefault(draft.angle, draft)
    return out


def choose(attempts: list[Attempt], angle: str) -> Attempt | None:
    """The first attempt whose draft for this angle passed, else the first that has one."""
    having = [a for a in attempts if angle in a.drafts]
    return next((a for a in having if passed(a.checks[angle])), having[0] if having else None)


def strongest_first(signals: list[Row]) -> list[Row]:
    newest_first = sorted(signals, key=lambda s: s.get("occurred_at") or s["detected_at"], reverse=True)
    return sorted(newest_first, key=lambda s: TYPE_PRIORITY.get(s["type"], 9))


def _category(signal: Row) -> str | None:
    meta = signal.get("meta")
    return meta.get("category") if isinstance(meta, dict) else None


def leads_to_draft(ctx: Context) -> list[Row]:
    drafted = {r["lead_id"] for r in ctx.db.select_all("drafts", "lead_id, angle", org_id=ctx.org_id) if r["angle"] != "raw"}
    ready = ctx.db.select_all("leads", "id, company_id, contact_id, score", org_id=ctx.org_id, status="ready")
    todo = sorted((lead for lead in ready if lead["id"] not in drafted), key=lambda lead: (-lead["score"], lead["id"]))
    return todo[: ctx.settings.drafts_per_run]


def lead_facts(ctx: Context, lead: Row) -> tuple[PromptFacts, tuple[SignalText, ...]]:
    company = ctx.db.select_all("companies", "name, domain, description", id=lead["company_id"])[0]
    contacts = ctx.db.select_all("contacts", "name, title, is_placeholder", id=lead["contact_id"]) if lead["contact_id"] else []
    signals = strongest_first(
        ctx.db.select_all(
            "signals", "type, title, excerpt, source_name, occurred_at, detected_at, meta", company_id=lead["company_id"]
        )
    )
    contact = contacts[0] if contacts else None
    facts = PromptFacts(
        company_name=company["name"],
        domain=company["domain"] or "",
        description=company["description"],
        contact=PromptContact(contact["name"], contact["title"], contact["is_placeholder"]) if contact else None,
        signals=tuple(
            PromptSignal(s["type"], _category(s), s["title"], s["excerpt"], s["source_name"]) for s in signals
        ),
    )
    # Grounding accepts a phrase from any of the company's signals, as the editor does.
    return facts, tuple(SignalText(s["title"], s["excerpt"]) for s in signals)


class _Pacer:
    """Keeps calls at least `seconds` apart (the free tier also limits requests per minute)."""

    def __init__(self, seconds: float, sleep: Callable[[float], None]) -> None:
        self._seconds = seconds
        self._sleep = sleep
        self._last: float | None = None

    def wait(self) -> None:
        if self._last is not None:
            remaining = self._seconds - (time.monotonic() - self._last)
            if remaining > 0:
                self._sleep(remaining)
        self._last = time.monotonic()


def _reserve(ctx: Context, lead: Row, limit: int) -> str | None:
    rows = ctx.db.rpc(
        "reserve_llm_call",
        {"p_org": ctx.org_id, "p_source": "agent", "p_actor": None, "p_lead": lead["id"], "p_daily_limit": limit},
    )
    return rows[0]["call_id"] if rows else None


def _finish_call(ctx: Context, call_id: str, result: LlmResult | None, error: str | None) -> None:
    values: Row = {"ok": error is None, "error": error}
    if result is not None:
        values |= {"model": result.model, "tokens_in": result.tokens_in, "tokens_out": result.tokens_out}
    ctx.db.update("llm_calls", values, id=call_id)


def _trace(ctx: Context, facts: PromptFacts, digest: str, attempts: list[Attempt], chosen: Attempt) -> Row:
    shown = facts.signals[: ctx.config.outreach.max_signals_in_prompt]
    return {
        "source": "agent",
        "runId": ctx.run.run_id,
        "promptHash": digest,
        "signals": [{"label": signal_label(s), "title": s.title} for s in shown],
        "attempts": [
            {
                "attempt": a.number,
                "model": a.result.model if a.result else None,
                "tokensIn": a.result.tokens_in if a.result else None,
                "tokensOut": a.result.tokens_out if a.result else None,
                "ms": a.result.ms if a.result else None,
                "error": a.error,
                "failedChecks": {
                    angle: [c.check for c in checks if c.status == "fail"] for angle, checks in a.checks.items()
                },
            }
            for a in attempts
        ],
        "chosenAttempt": chosen.number,
        # One call writes all three angles, so its tokens are shared by them.
        "tokensSharedByAngles": True,
    }


def save_drafts(ctx: Context, lead: Row, facts: PromptFacts, prompt: str, attempts: list[Attempt]) -> int:
    digest = prompt_hash(prompt)
    rows: list[Row] = []
    for angle in ANGLES:
        chosen = choose(attempts, angle)
        if chosen is None or chosen.result is None:
            continue
        draft, checks = chosen.drafts[angle], chosen.checks[angle]
        rows.append(
            {
                "org_id": ctx.org_id,
                "lead_id": lead["id"],
                "angle": angle,
                "subject": draft.subject,
                "body": draft.body,
                "grounded_phrases": draft.grounded_phrases,
                "guardrail_results": [c.as_row() for c in checks],
                "passed": passed(checks),
                "model": chosen.result.model,
                "prompt_hash": digest,
                "prompt": prompt,
                "tokens_in": chosen.result.tokens_in,
                "tokens_out": chosen.result.tokens_out,
                "trace": _trace(ctx, facts, digest, attempts, chosen),
                "llm_call_id": chosen.call_id,
            }
        )
    ctx.db.insert("drafts", rows)
    if rows:
        ctx.run.audit(
            "draft.created", "lead", lead["id"],
            angles=[r["angle"] for r in rows], passed={r["angle"]: r["passed"] for r in rows}, attempts=len(attempts),
        )
    return len(rows)


def _attempt(ctx: Context, number: int, call_id: str, prompt: str, signals: tuple[SignalText, ...], rules: GuardrailRules) -> Attempt:
    """One call. LlmQuotaExhausted propagates (nothing else can succeed today)."""
    attempt = Attempt(number=number, call_id=call_id)
    try:
        attempt.result = ctx.llm.generate_json(prompt, ctx.config.prompts.draft_schema)  # type: ignore[union-attr]
        attempt.drafts = parse_drafts(attempt.result.text)
    except LlmQuotaExhausted as error:
        _finish_call(ctx, call_id, None, str(error))
        raise
    except LlmError as error:
        attempt.error = str(error)
    except ValidationError as error:
        attempt.error = f"The answer wasn't the expected JSON ({error.error_count()} problems)"
    _finish_call(ctx, call_id, attempt.result, attempt.error)
    for angle, draft in attempt.drafts.items():
        attempt.checks[angle] = run_guardrails(
            DraftInput(angle, draft.subject, draft.body, tuple(draft.grounded_phrases), signals), rules
        )
    return attempt


def draft_leads(ctx: Context) -> None:
    if ctx.db.dry_run or ctx.llm is None:
        ctx.run.count("drafting_skipped")  # dry runs never call the model
        return
    out = ctx.config.outreach
    limit = math.floor(ctx.settings.llm.daily_budget * out.llm.agent_share)
    rules = rules_from_config(ctx.config)
    pacer = _Pacer(out.llm.min_seconds_between_calls, ctx.sleep)

    for lead in leads_to_draft(ctx):
        facts, signals = lead_facts(ctx, lead)
        prompt = render_draft_prompt(facts, ctx.config)
        attempts: list[Attempt] = []
        stop: str | None = None
        for number in range(1, out.llm.max_retries_per_lead + 2):
            if attempts and attempts[-1].all_passed():
                break
            call_id = _reserve(ctx, lead, limit)
            if call_id is None:
                stop = "budget"
                break
            pacer.wait()
            ctx.run.count("llm_calls")
            try:
                attempts.append(_attempt(ctx, number, call_id, prompt, signals, rules))
            except LlmQuotaExhausted:
                stop = "quota"
                break
            if attempts[-1].error:
                ctx.run.errors.append({"step": "draft_leads", "message": f"lead {lead['id']}: {attempts[-1].error}"})
        saved = save_drafts(ctx, lead, facts, prompt, attempts)
        ctx.run.count("drafts_created", saved)
        if saved:
            ctx.run.count("leads_drafted")
        if stop:
            # Budget or quota: no later lead can be drafted in this run.
            ctx.run.stats[f"drafting_paused_{stop}"] = 1
            return
