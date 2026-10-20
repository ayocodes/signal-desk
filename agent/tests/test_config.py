import ast
from pathlib import Path

from agent.config import DEFAULTS_VERSION, load_config

AGENT = Path(__file__).resolve().parent.parent
SHARED_FILES = ("scoring.json", "hiring_keywords.json", "guardrails.json")


def test_defaults_load_with_the_documented_weights() -> None:
    cfg = load_config("any-org")
    assert cfg.version == DEFAULTS_VERSION
    s = cfg.scoring
    assert s.threshold == 50
    assert (s.icp.full, s.icp.partial) == (40, 20)
    assert s.signals.hiring_sales == 30
    assert [step.max_hours for step in s.freshness] == sorted(step.max_hours for step in s.freshness)
    assert s.partial_rules.team_size_max > s.icp_rules.team_size_max


def test_keyword_and_guardrail_rules_load() -> None:
    cfg = load_config("any-org")
    assert "sales" in cfg.keywords.categories
    assert cfg.guardrails.mailbox.daily_cap > 0
    share = cfg.guardrails.test_inboxes
    assert 0 <= share.bounced_per_100 + share.complained_per_100 < 100


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
