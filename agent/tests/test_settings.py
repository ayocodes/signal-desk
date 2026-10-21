import pytest

from agent.settings import SettingsError, _RawEnv, settings_from_env

VALID = {
    "SUPABASE_URL": "https://abc.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "service-key",
    "LLM_PROVIDER": "gemini",
    "GEMINI_API_KEY": "gemini-key",
    "GEMINI_MODEL": "gemini-model",
    "RESEND_API_KEY": "resend-key",
    "RESEND_FROM": "onboarding@resend.dev",
    "AGENT_USER_AGENT": "SignalDesk-test/0.1",
    "LLM_DAILY_BUDGET": "20",
}


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """Tests must not see the developer's or CI's real variables."""
    for name in _RawEnv.model_fields:
        monkeypatch.delenv(name, raising=False)


def build(**overrides: str | None) -> object:
    values = {**VALID, **overrides}
    raw = _RawEnv(_env_file=None, **{k: v for k, v in values.items() if v is not None})  # type: ignore[call-arg]
    return settings_from_env(raw)


def problems(**overrides: str | None) -> list[str]:
    with pytest.raises(SettingsError) as caught:
        build(**overrides)
    return caught.value.problems


def test_accepts_a_complete_config_with_defaults() -> None:
    settings = build()
    assert settings.llm.provider == "gemini"
    assert settings.llm.model == "gemini-model"
    assert settings.drafts_per_run == 5
    assert settings.discovery_probes_per_run == 40
    assert settings.trigger == "local"


def test_empty_and_whitespace_values_count_as_missing() -> None:
    assert problems(RESEND_FROM="") == ["Missing environment variable RESEND_FROM"]
    assert problems(AGENT_USER_AGENT="   ") == ["Missing environment variable AGENT_USER_AGENT"]


def test_supabase_url_falls_back_to_the_next_public_name() -> None:
    settings = build(SUPABASE_URL=None, NEXT_PUBLIC_SUPABASE_URL="https://xyz.supabase.co")
    assert settings.supabase_url == "https://xyz.supabase.co"
    assert problems(SUPABASE_URL="") == ["Missing environment variable SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)"]


def test_requires_the_selected_providers_key_and_model_only() -> None:
    assert problems(GEMINI_MODEL="") == [
        "Missing environment variable GEMINI_MODEL (required when LLM_PROVIDER=gemini)"
    ]
    groq = build(LLM_PROVIDER="groq", GROQ_API_KEY="k", GROQ_MODEL="m", GEMINI_API_KEY="")
    assert groq.llm.provider == "groq"


def test_lists_every_problem_at_once_without_values() -> None:
    found = problems(RESEND_API_KEY="", GEMINI_API_KEY="", DISCOVERY_PROBES_PER_RUN="lots-hunter2")
    assert len(found) == 3
    assert "Invalid environment variable DISCOVERY_PROBES_PER_RUN: must be a whole number" in found
    assert not any("hunter2" in p for p in found)


def test_rejects_an_unknown_provider() -> None:
    assert problems(LLM_PROVIDER="openai") == ['Invalid environment variable LLM_PROVIDER: must be "gemini" or "groq"']


def test_reads_the_github_trigger_and_custom_caps() -> None:
    settings = build(GITHUB_EVENT_NAME="schedule", DISCOVERY_PROBES_PER_RUN="120")
    assert settings.trigger == "schedule"
    assert settings.discovery_probes_per_run == 120


def test_job_boards_default_to_all_sites_and_accept_a_subset() -> None:
    assert build().job_boards == ("ashby", "greenhouse", "lever")
    assert build(AGENT_JOB_BOARDS="lever, Greenhouse").job_boards == ("greenhouse", "lever")


def test_job_boards_reject_unknown_sites() -> None:
    assert problems(AGENT_JOB_BOARDS="greenhouse,workday") == [
        "Invalid environment variable AGENT_JOB_BOARDS: use ashby, greenhouse, lever, comma-separated"
    ]


def test_llm_daily_budget_is_required_and_a_whole_number() -> None:
    assert build().llm.daily_budget == 20  # type: ignore[attr-defined]
    assert problems(LLM_DAILY_BUDGET=None) == ["Missing environment variable LLM_DAILY_BUDGET"]
    assert problems(LLM_DAILY_BUDGET="lots") == ["Invalid environment variable LLM_DAILY_BUDGET: must be a whole number"]
