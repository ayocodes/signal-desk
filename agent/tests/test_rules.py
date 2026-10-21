"""Runs every shared rules case; lib/rules.test.ts runs the same file and must agree."""

import copy
import json
from pathlib import Path
from typing import Any

import pytest

from agent.rules import max_possible_score, validate_rules

SHARED = Path(__file__).resolve().parents[2] / "shared"
DEFAULTS = json.loads((SHARED / "defaults" / "rules.json").read_text(encoding="utf-8"))
CASES = json.loads((SHARED / "fixtures" / "config_cases.json").read_text(encoding="utf-8"))["cases"]


def apply(ops: list[dict[str, Any]]) -> Any:
    doc: Any = copy.deepcopy(DEFAULTS)
    for op in ops:
        if op["op"] == "replace":
            doc = op["value"]
            continue
        *parents, last = op["path"].split(".")
        target = doc
        for key in parents:
            target = target[int(key)] if isinstance(target, list) else target[key]
        key: Any = int(last) if isinstance(target, list) else last
        if op["op"] == "set":
            target[key] = op["value"]
        else:
            del target[key]
    return doc


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_shared_case(case: dict[str, Any]) -> None:
    assert [e.as_dict() for e in validate_rules(apply(case["ops"]))] == case["errors"]


def test_the_highest_possible_score_with_the_defaults_is_152() -> None:
    assert max_possible_score(DEFAULTS) == 152
