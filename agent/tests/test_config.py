import ast
from pathlib import Path

from agent.config import DEFAULTS_VERSION, default_rules, load_config

AGENT = Path(__file__).resolve().parent.parent
SHARED_FILES = (
    "scoring.json", "hiring_keywords.json", "guardrails.json", "outreach.json",
    "draft.md", "raw.md", "draft_schema.json", "rules.json", "sequence.json", "followups.json",
    "followup.md", "followup_schema.json",
)


def test_defaults_load_with_the_documented_weights() -> None:
    cfg = load_config("any-org")
    assert cfg.version == DEFAULTS_VERSION
    s = cfg.scoring
    assert s.threshold == 50
    assert (s.icp.full, s.icp.partial) == (40, 20)
    assert [c.name for c in cfg.hiring.categories] == ["Marketing hire", "Sales hire", "Paid acquisition hire"]
    assert cfg.hiring.category("sales").points == 30  # type: ignore[union-attr]
    assert [step.max_hours for step in s.freshness] == sorted(step.max_hours for step in s.freshness)
    assert s.partial_rules.team_size_max > s.icp_rules.team_size_max


def test_score_bands_run_high_to_low_and_start_at_the_threshold() -> None:
    s = load_config("any-org").scoring
    mins = [band.min for band in s.score_bands]
    assert mins == sorted(mins, reverse=True)
    assert mins[-1] == s.threshold  # every ready lead gets a label


def test_keyword_and_guardrail_rules_load() -> None:
    cfg = load_config("any-org")
    assert cfg.hiring.category("paid_acquisition").enabled is False  # type: ignore[union-attr]
    assert cfg.guardrails.mailbox.daily_cap > 0
    share = cfg.guardrails.test_inboxes
    assert 0 <= share.bounced_per_100 + share.complained_per_100 < 100


def test_outreach_and_prompts_load() -> None:
    cfg = load_config("any-org")
    out = cfg.outreach
    assert out.proof_points and all(not any(ch.isdigit() for ch in p) for p in out.proof_points)
    assert 0 < out.llm.agent_share < 1
    # Every placeholder in the prompts is one the renderers fill in.
    assert "{{signals}}" in cfg.prompts.draft and "{{offer}}" in cfg.prompts.raw
    assert cfg.prompts.draft_schema["required"] == ["drafts"]


def _code_strings(source: str) -> list[str]:
    """Every string constant in the code, skipping docstrings (they may say where defaults live)."""
    tree = ast.parse(source)
    docstrings = {
        id(node.body[0].value)
        for node in ast.walk(tree)
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef))
        and node.body
        and isinstance(node.body[0], ast.Expr)
        and isinstance(node.body[0].value, ast.Constant)
    }
    return [
        node.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str) and id(node) not in docstrings
    ]


def _names_used(source: str) -> set[str]:
    """Names referenced or imported: x, module.x, from module import x."""
    names: set[str] = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Name):
            names.add(node.id)
        elif isinstance(node, ast.Attribute):
            names.add(node.attr)
        elif isinstance(node, ast.ImportFrom):
            names.update(alias.name for alias in node.names)
    return names


def test_only_config_py_reads_the_rule_files() -> None:
    """Rules move into the database in Phase 4.5; nothing but load_config may know where they live."""
    offenders = []
    for path in AGENT.rglob("*.py"):
        if path.name == "config.py" or "tests" in path.parts:
            continue
        source = path.read_text(encoding="utf-8")
        for text in _code_strings(source):
            offenders += [f"{path.relative_to(AGENT)}: {text!r}" for name in SHARED_FILES if name in text]
        for name in ("_load_defaults", "SHARED"):
            if name in _names_used(source):
                offenders.append(f"{path.relative_to(AGENT)}: {name}")
    assert offenders == [], "Read rules through load_config(org_id):\n" + "\n".join(offenders)


class FakeRules:
    """Stands in for agent/db.py's Database: returns the given agent_configs rows."""

    def __init__(self, rows: list[dict]) -> None:  # type: ignore[type-arg]
        self.rows = rows

    def select_all(self, table: str, columns: str = "*", **equals: object) -> list[dict]:  # type: ignore[type-arg]
        assert table == "agent_configs"
        return self.rows


def test_load_config_uses_the_orgs_newest_version_merged_with_the_locked_parts() -> None:
    v2 = default_rules()
    v2["threshold"] = 55
    v2["scoreBands"][-1]["min"] = 55
    v2["guardrails"] = {"maxBodyWords": 60, "extraBannedPhrases": ["quick win"]}
    v2["outreach"]["senderName"] = "Alex"
    cfg = load_config("org", FakeRules([{"version": 1, "rules": default_rules()}, {"version": 2, "rules": v2}]))
    assert (cfg.version, cfg.problem, cfg.scoring.threshold) == (2, None, 55)
    assert cfg.guardrails.max_body_words == 60
    assert "touch base" in cfg.guardrails.banned_phrases and "quick win" in cfg.guardrails.banned_phrases
    assert (cfg.outreach.sender.name, cfg.outreach.sender.company) == ("Alex", "Signal Desk")


def test_an_invalid_stored_version_falls_back_to_the_defaults_and_says_why() -> None:
    bad = default_rules()
    bad["threshold"] = 0
    cfg = load_config("org", FakeRules([{"version": 3, "rules": bad}]))
    assert (cfg.version, cfg.scoring.threshold) == (DEFAULTS_VERSION, 50)
    assert cfg.problem == "Rules version 3 is invalid (threshold: out_of_range); using the defaults."


def test_an_org_without_saved_rules_uses_the_defaults() -> None:
    cfg = load_config("org", FakeRules([]))
    assert cfg.version == DEFAULTS_VERSION and cfg.problem is not None
