"""Environment settings, validated once at the start of every run.

Same rules as lib/env-schema.ts on the web side:
- empty or whitespace-only values count as missing,
- every problem is reported at once, naming the variable,
- values are never printed.

Locally the values come from .env.local; in GitHub Actions from repository secrets.
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parent.parent

# The selected provider's key and model are required; the other provider's are optional.
PROVIDER_KEYS: dict[str, tuple[str, str]] = {
    "gemini": ("GEMINI_API_KEY", "GEMINI_MODEL"),
    "groq": ("GROQ_API_KEY", "GROQ_MODEL"),
}

ALWAYS_REQUIRED = (
    "SUPABASE_SERVICE_ROLE_KEY",
    "LLM_PROVIDER",
    "RESEND_API_KEY",
    "RESEND_FROM",
    "AGENT_USER_AGENT",
)


class SettingsError(Exception):
    def __init__(self, problems: list[str]) -> None:
        self.problems = problems
        super().__init__("Invalid environment configuration:\n" + "\n".join(f"  - {p}" for p in problems))


class _RawEnv(BaseSettings):
    """Every variable the agent reads, all optional here so problems can be collected together."""

    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env.local",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    SUPABASE_URL: str | None = None
    NEXT_PUBLIC_SUPABASE_URL: str | None = None
    SUPABASE_SERVICE_ROLE_KEY: str | None = None
    LLM_PROVIDER: str | None = None
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str | None = None
    GROQ_API_KEY: str | None = None
    GROQ_MODEL: str | None = None
    RESEND_API_KEY: str | None = None
    RESEND_FROM: str | None = None
    AGENT_USER_AGENT: str | None = None
    DRAFTS_PER_RUN: str | None = None
    DISCOVERY_PROBES_PER_RUN: str | None = None
    # Set by GitHub Actions ("schedule", "workflow_dispatch"); absent locally.
    GITHUB_EVENT_NAME: str | None = None

    @model_validator(mode="before")
    @classmethod
    def blank_means_missing(cls, values: dict[str, object]) -> dict[str, object]:
        return {
            key: value
            for key, value in values.items()
            if not (isinstance(value, str) and value.strip() == "")
        }


class LlmSettings(BaseModel):
    provider: Literal["gemini", "groq"]
    api_key: str
    model: str


class Settings(BaseModel):
    supabase_url: str
    supabase_service_role_key: str
    llm: LlmSettings
    resend_api_key: str
    resend_from: str
    user_agent: str
    drafts_per_run: int
    discovery_probes_per_run: int
    trigger: str


def _whole_number(raw: str | None, name: str, default: int, problems: list[str]) -> int:
    if raw is None:
        return default
    try:
        value = int(raw.strip())
    except ValueError:
        problems.append(f"Invalid environment variable {name}: must be a whole number")
        return default
    if value < 0:
        problems.append(f"Invalid environment variable {name}: must not be negative")
    return value


def settings_from_env(raw: _RawEnv) -> Settings:
    problems: list[str] = []
    values = raw.model_dump()

    # SUPABASE_URL is the GitHub secret's name; .env.local has NEXT_PUBLIC_SUPABASE_URL.
    supabase_url = (values["SUPABASE_URL"] or values["NEXT_PUBLIC_SUPABASE_URL"] or "").strip()
    if not supabase_url:
        problems.append("Missing environment variable SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)")

    for name in ALWAYS_REQUIRED:
        if not values[name]:
            problems.append(f"Missing environment variable {name}")

    provider = (values["LLM_PROVIDER"] or "").strip()
    if provider and provider not in PROVIDER_KEYS:
        problems.append('Invalid environment variable LLM_PROVIDER: must be "gemini" or "groq"')
    for name in PROVIDER_KEYS.get(provider, ()):
        if not values[name]:
            problems.append(f"Missing environment variable {name} (required when LLM_PROVIDER={provider})")

    drafts = _whole_number(values["DRAFTS_PER_RUN"], "DRAFTS_PER_RUN", 5, problems)
    probes = _whole_number(values["DISCOVERY_PROBES_PER_RUN"], "DISCOVERY_PROBES_PER_RUN", 40, problems)

    if problems:
        raise SettingsError(problems)

    key_name, model_name = PROVIDER_KEYS[provider]
    return Settings(
        supabase_url=supabase_url,
        supabase_service_role_key=values["SUPABASE_SERVICE_ROLE_KEY"].strip(),
        llm=LlmSettings(provider=provider, api_key=values[key_name].strip(), model=values[model_name].strip()),
        resend_api_key=values["RESEND_API_KEY"].strip(),
        resend_from=values["RESEND_FROM"].strip(),
        user_agent=values["AGENT_USER_AGENT"].strip(),
        drafts_per_run=drafts,
        discovery_probes_per_run=probes,
        trigger=(values["GITHUB_EVENT_NAME"] or "local").strip(),
    )


def load_settings(env_file: Path | None = REPO_ROOT / ".env.local") -> Settings:
    """Reads the process environment (and .env.local when present). Raises SettingsError."""
    try:
        raw = _RawEnv(_env_file=env_file)  # type: ignore[call-arg]
    except ValidationError as error:  # only reachable if a value isn't a string at all
        raise SettingsError([f"Could not read the environment: {error.error_count()} problem(s)"]) from None
    return settings_from_env(raw)
