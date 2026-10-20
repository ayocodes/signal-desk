"""Contacts: who an email would go to, and whether they're the right buyer.

The YC dataset has no founder names, so every company starts with a placeholder "Founder"
contact (is_placeholder = true, shown as such in the UI).

Hard rule 3: we never email real people. Every contact's send address is a Resend test
inbox. A small, fixed share (load_config guardrails; defaults: shared/guardrails.json) is routed to the bounce
and complaint test inboxes, chosen deterministically from the company id, so the
deliverability paths get exercised by real webhook events.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any, Literal

from agent.config import InboxShare

BuyerStatus = Literal["verified", "rerouted", "unverified"]

SMALL_TEAM = 30  # under this, the founder usually still runs outbound
FOUNDER_TITLES = re.compile(r"\b(founder|co-?founder|ceo|chief executive)\b", re.IGNORECASE)
SALES_LEADER_TITLES = re.compile(r"\b(sales|growth|revenue|gtm|go-to-market|business development)\b", re.IGNORECASE)
NON_BUYER_TITLES = re.compile(r"\b(engineer|engineering|cto|developer|product|design)\b", re.IGNORECASE)


def buyer_check(title: str | None, team_size: int | None) -> tuple[BuyerStatus, str]:
    text = title or ""
    if SALES_LEADER_TITLES.search(text):
        return "verified", f"{text} usually owns outbound"
    if FOUNDER_TITLES.search(text):
        if team_size is not None and team_size < SMALL_TEAM:
            return "verified", f"Founder at a {team_size}-person team usually runs outbound"
        size = f"{team_size} people" if team_size is not None else "an unknown team size"
        return "unverified", f"At {size}, a sales leader may own outbound instead of the founder"
    if NON_BUYER_TITLES.search(text):
        return "rerouted", f"{text} rarely buys outbound tooling; look for a founder or sales leader"
    return "unverified", "Title doesn't say who owns outbound"


def inbox_for(company_id: str, share: InboxShare) -> str:
    """delivered+/bounced+/complained+{short id}@resend.dev, the same answer every run."""
    short = company_id.replace("-", "")[:8]
    bucket = int(hashlib.sha256(company_id.encode()).hexdigest(), 16) % 100
    if bucket < share.bounced_per_100:
        kind = "bounced"
    elif bucket < share.bounced_per_100 + share.complained_per_100:
        kind = "complained"
    else:
        kind = "delivered"
    return f"{kind}+{short}@resend.dev"


def placeholder_contact(org_id: str, company_id: str, team_size: int | None, share: InboxShare) -> dict[str, Any]:
    status, reason = buyer_check("Founder", team_size)
    return {
        "org_id": org_id,
        "company_id": company_id,
        "name": "Founder",
        "title": "Founder",
        "is_placeholder": True,
        "send_address": inbox_for(company_id, share),
        "buyer_status": status,
        "buyer_reason": reason,
    }
