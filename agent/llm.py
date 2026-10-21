"""The single LLM interface (AGENTS.md: all LLM calls go through one provider interface).

Gemini is called over its REST API with httpx (no SDK), the same request lib/llm.ts sends.
The model name comes from GEMINI_MODEL, never from code. The API key travels in a header, so
it never appears in a URL, a log line or an error message.

Rate limits: a 429 for the per-day quota stops drafting for the rest of the run
(LlmQuotaExhausted). A 429 for the per-minute quota waits for the delay Google asks for (at
most 60 s) and tries once more. A 500 or 503 (Google overloaded) waits 5 s and tries once
more. Retries happen inside one reserved call, so they don't spend more of the budget.
"""

from __future__ import annotations

import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from agent.settings import LlmSettings

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
TIMEOUT_SECONDS = 90
MAX_WAIT_SECONDS = 60
BUSY_STATUSES = (500, 503)
BUSY_WAIT_SECONDS = 5


class LlmError(Exception):
    """The call failed; the message is safe to store (no key, no prompt)."""


class LlmQuotaExhausted(LlmError):
    """The model's daily quota is used up; no further call can succeed today."""


class LlmRateLimited(LlmError):
    """Still over the per-minute limit after waiting once."""


@dataclass(frozen=True)
class LlmResult:
    text: str
    model: str
    tokens_in: int
    tokens_out: int
    ms: int


class LlmProvider(Protocol):
    name: str

    def generate_json(self, prompt: str, schema: dict[str, Any]) -> LlmResult:
        """Send one prompt; the answer is JSON following `schema`."""
        ...


def _retry_delay(details: list[dict[str, Any]]) -> float | None:
    for detail in details:
        delay = detail.get("retryDelay")
        if isinstance(delay, str):
            match = re.fullmatch(r"(\d+(?:\.\d+)?)s", delay)
            if match:
                return float(match.group(1))
    return None


def _is_daily_quota(details: list[dict[str, Any]]) -> bool:
    for detail in details:
        for violation in detail.get("violations", []):
            if "PerDay" in str(violation.get("quotaId", "")):
                return True
    return False


class GeminiProvider:
    name = "gemini"

    def __init__(
        self,
        settings: LlmSettings,
        *,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._model = settings.model
        self._sleep = sleep
        self._http = httpx.Client(
            timeout=TIMEOUT_SECONDS,
            transport=transport,
            headers={"x-goog-api-key": settings.api_key, "Content-Type": "application/json"},
        )

    def generate_json(self, prompt: str, schema: dict[str, Any]) -> LlmResult:
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "responseJsonSchema": schema},
        }
        for attempt in (1, 2):
            started = time.perf_counter()
            try:
                response = self._http.post(GEMINI_URL.format(model=self._model), json=body)
            except httpx.HTTPError as error:
                raise LlmError(f"Request to Gemini failed: {type(error).__name__}") from None
            ms = round((time.perf_counter() - started) * 1000)
            if response.status_code == 429:
                details = self._error(response).get("details", [])
                if _is_daily_quota(details):
                    raise LlmQuotaExhausted("Gemini's daily request quota is used up")
                if attempt == 1:
                    self._sleep(min(_retry_delay(details) or 30.0, MAX_WAIT_SECONDS))
                    continue
                raise LlmRateLimited("Gemini is still rate limiting after one wait")
            if response.status_code in BUSY_STATUSES and attempt == 1:
                self._sleep(BUSY_WAIT_SECONDS)
                continue
            if response.status_code != 200:
                message = self._error(response).get("message", "")
                raise LlmError(f"Gemini answered {response.status_code}: {str(message)[:200]}")
            return self._result(response.json(), ms)
        raise LlmRateLimited("Gemini is still rate limiting after one wait")  # unreachable, keeps mypy sure

    @staticmethod
    def _error(response: httpx.Response) -> dict[str, Any]:
        try:
            error = response.json().get("error", {})
        except ValueError:
            return {}
        return error if isinstance(error, dict) else {}

    def _result(self, data: dict[str, Any], ms: int) -> LlmResult:
        candidates = data.get("candidates") or []
        parts = (candidates[0].get("content") or {}).get("parts", []) if candidates else []
        text = "".join(part.get("text", "") for part in parts if not part.get("thought"))
        if not text:
            reason = candidates[0].get("finishReason", "no candidates") if candidates else "no candidates"
            raise LlmError(f"Gemini returned no text ({reason})")
        usage = data.get("usageMetadata", {})
        return LlmResult(
            text=text,
            model=str(data.get("modelVersion") or self._model),
            tokens_in=int(usage.get("promptTokenCount", 0)),
            # Thinking tokens are billed as output, so they count here too.
            tokens_out=int(usage.get("candidatesTokenCount", 0)) + int(usage.get("thoughtsTokenCount", 0)),
            ms=ms,
        )


def provider_from_settings(settings: LlmSettings) -> LlmProvider:
    if settings.provider == "gemini":
        return GeminiProvider(settings)
    raise NotImplementedError("The Groq provider isn't built yet: set LLM_PROVIDER=gemini.")
