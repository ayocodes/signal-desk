"""The single LLM interface (AGENTS.md: all LLM calls go through one provider interface).

Phase 2 only defines the shape. The Gemini and Groq providers arrive with drafting in C4.3,
selected by LLM_PROVIDER, with the model name from GEMINI_MODEL / GROQ_MODEL (never hardcoded).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from agent.settings import LlmSettings


@dataclass(frozen=True)
class LlmResult:
    text: str
    model: str
    tokens_in: int
    tokens_out: int


class LlmProvider(Protocol):
    name: str

    def generate_json(self, prompt: str) -> LlmResult:
        """Send one prompt and return the model's JSON text plus token counts."""
        ...


def provider_from_settings(settings: LlmSettings) -> LlmProvider:
    raise NotImplementedError(
        f"The {settings.provider} provider is added with drafting in Phase 4 (card C4.3)."
    )
