"""Sending email through Resend's API (httpx, no SDK).

Hard rule 3: we never email real people. send() refuses any recipient that isn't a Resend
test inbox (delivered@, bounced@, complained@resend.dev, with +label suffixes), whatever the
caller passes. Each send carries the sequence step's idempotency key, so a re-run of the agent
can't send the same step twice.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import httpx

RESEND_URL = "https://api.resend.com/emails"
TEST_INBOX = re.compile(r"(delivered|bounced|complained)(\+[A-Za-z0-9._-]+)?@resend\.dev", re.IGNORECASE)
TIMEOUT_SECONDS = 30


class RefusedRecipient(Exception):
    """The address isn't a Resend test inbox; nothing was sent."""


class SendFailed(Exception):
    """Resend didn't accept the email; the message is safe to store (no key)."""


@dataclass(frozen=True)
class OutgoingEmail:
    sender: str  # "Sam <onboarding@resend.dev>"
    to: str
    subject: str
    text: str
    idempotency_key: str


def is_test_inbox(address: str) -> bool:
    return TEST_INBOX.fullmatch(address.strip()) is not None


class ResendClient:
    def __init__(self, api_key: str, *, transport: httpx.BaseTransport | None = None) -> None:
        self._http = httpx.Client(
            timeout=TIMEOUT_SECONDS,
            transport=transport,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        )

    def send(self, email: OutgoingEmail) -> str:
        """Sends one email and returns Resend's message id."""
        if not is_test_inbox(email.to):
            raise RefusedRecipient(f"Refusing to send to {email.to}: only Resend test inboxes are allowed")
        try:
            response = self._http.post(
                RESEND_URL,
                headers={"Idempotency-Key": email.idempotency_key},
                json={"from": email.sender, "to": [email.to], "subject": email.subject, "text": email.text},
            )
        except httpx.HTTPError as error:
            raise SendFailed(f"Request to Resend failed: {type(error).__name__}") from None
        if response.status_code != 200:
            try:
                message = str(response.json().get("message", ""))[:200]
            except ValueError:
                message = ""
            raise SendFailed(f"Resend answered {response.status_code}: {message}")
        return str(response.json()["id"])
