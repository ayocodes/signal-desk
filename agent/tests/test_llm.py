"""The Gemini provider against canned HTTP answers (no network)."""

import json

import httpx
import pytest

from agent.llm import GeminiProvider, LlmError, LlmQuotaExhausted, LlmRateLimited
from agent.settings import LlmSettings

SETTINGS = LlmSettings(provider="gemini", api_key="secret-key", model="gemini-test", daily_budget=20)
OK = {
    "candidates": [{"content": {"parts": [{"text": "thinking...", "thought": True}, {"text": '{"drafts": []}'}]}}],
    "usageMetadata": {"promptTokenCount": 900, "candidatesTokenCount": 150, "thoughtsTokenCount": 50},
    "modelVersion": "gemini-test-001",
}


def quota_error(quota_id: str, delay: str | None = None) -> dict:  # type: ignore[type-arg]
    details: list[dict] = [{"@type": "type.googleapis.com/google.rpc.QuotaFailure", "violations": [{"quotaId": quota_id}]}]  # type: ignore[type-arg]
    if delay:
        details.append({"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": delay})
    return {"error": {"code": 429, "message": "quota", "details": details}}


def provider(*answers: tuple[int, dict]) -> tuple[GeminiProvider, list[httpx.Request], list[float]]:  # type: ignore[type-arg]
    seen: list[httpx.Request] = []
    waits: list[float] = []
    queue = list(answers)

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        status, body = queue.pop(0)
        return httpx.Response(status, json=body)

    return GeminiProvider(SETTINGS, transport=httpx.MockTransport(handle), sleep=waits.append), seen, waits


def test_returns_text_and_tokens_and_sends_the_key_in_a_header() -> None:
    p, seen, _ = provider((200, OK))
    result = p.generate_json("prompt", {"type": "object"})
    assert result.text == '{"drafts": []}'
    assert (result.model, result.tokens_in, result.tokens_out) == ("gemini-test-001", 900, 200)
    request = seen[0]
    assert request.headers["x-goog-api-key"] == "secret-key"
    assert "secret-key" not in str(request.url)
    assert "models/gemini-test:generateContent" in str(request.url)
    body = json.loads(request.content)
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    assert body["generationConfig"]["responseJsonSchema"] == {"type": "object"}


def test_daily_quota_stops_without_waiting() -> None:
    p, seen, waits = provider((429, quota_error("GenerateRequestsPerDayPerProjectPerModel-FreeTier", "40s")))
    with pytest.raises(LlmQuotaExhausted):
        p.generate_json("prompt", {})
    assert len(seen) == 1 and waits == []


def test_per_minute_limit_waits_the_asked_delay_then_retries_once() -> None:
    p, seen, waits = provider((429, quota_error("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", "12.5s")), (200, OK))
    assert p.generate_json("prompt", {}).tokens_in == 900
    assert waits == [12.5] and len(seen) == 2


def test_waits_are_capped_and_a_second_429_gives_up() -> None:
    minute = quota_error("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", "300s")
    p, _, waits = provider((429, minute), (429, minute))
    with pytest.raises(LlmRateLimited):
        p.generate_json("prompt", {})
    assert waits == [60]


def test_other_errors_say_the_status_but_never_the_key() -> None:
    p, _, _ = provider((400, {"error": {"code": 400, "message": "Invalid JSON schema"}}))
    with pytest.raises(LlmError) as caught:
        p.generate_json("prompt", {})
    assert "400" in str(caught.value) and "Invalid JSON schema" in str(caught.value)
    assert "secret-key" not in str(caught.value)


def test_an_answer_without_text_is_an_error() -> None:
    p, _, _ = provider((200, {"candidates": [{"finishReason": "SAFETY", "content": {"parts": []}}]}))
    with pytest.raises(LlmError, match="SAFETY"):
        p.generate_json("prompt", {})
