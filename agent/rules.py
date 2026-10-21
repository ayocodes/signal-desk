"""The editable rules document (one per org version) and its validator.

lib/rules.ts is the TypeScript twin. Both return the same {path, code} errors for the same
document, which shared/fixtures/config_cases.json proves. They are hand-written walkers
rather than pydantic/zod error lists, because those two libraries name errors differently.

Paths are dotted, with list indexes: "hiring.categories.1.keywords.0".
Structure is checked first (types, ranges, unknown or missing fields); rules between fields
(team size min <= max, bands high to low, ...) only run once the structure is valid.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

SIGNAL_TYPES = ("hiring", "launch", "funding")
YC_STATUSES = ("Active", "Acquired", "Inactive", "Public")
CATEGORY_ID = re.compile(r"[a-z][a-z0-9_]{0,39}")


@dataclass(frozen=True, order=True)
class RuleError:
    path: str
    code: str

    def as_dict(self) -> dict[str, str]:
        return {"path": self.path, "code": self.code}


def _join(path: str, key: str | int) -> str:
    return f"{path}.{key}" if path else str(key)


def _norm(text: str) -> str:
    return " ".join(text.lower().split())


Check = Callable[["_Walker", Any, str], None]


class _Walker:
    def __init__(self) -> None:
        self.errors: list[RuleError] = []

    def add(self, path: str, code: str) -> None:
        self.errors.append(RuleError(path, code))

    def check_object(self, value: Any, path: str, fields: dict[str, Check]) -> None:
        if not isinstance(value, dict):
            self.add(path, "wrong_type")
            return
        for key in value:
            if key not in fields:
                self.add(_join(path, key), "unknown_field")
        for key, check in fields.items():
            if key in value:
                check(self, value[key], _join(path, key))
            else:
                self.add(_join(path, key), "missing")

    def check_int(self, value: Any, path: str, lo: int, hi: int) -> None:
        # Whole numbers only. 50.0 counts (JavaScript can't tell it from 50); 50.5 doesn't.
        whole = isinstance(value, int) or (isinstance(value, float) and value.is_integer())
        if isinstance(value, bool) or not whole:
            self.add(path, "wrong_type")
        elif not lo <= value <= hi:
            self.add(path, "out_of_range")

    def check_bool(self, value: Any, path: str) -> None:
        if not isinstance(value, bool):
            self.add(path, "wrong_type")

    def check_text(self, value: Any, path: str, lo: int, hi: int) -> None:
        if not isinstance(value, str):
            self.add(path, "wrong_type")
        elif not value.strip():
            self.add(path, "empty")
        elif not lo <= len(value.strip()) <= hi:
            self.add(path, "out_of_range")

    def check_choice(self, value: Any, path: str, allowed: tuple[str, ...]) -> None:
        if not isinstance(value, str):
            self.add(path, "wrong_type")
        elif value not in allowed:
            self.add(path, "not_allowed")

    def check_list(self, value: Any, path: str, lo: int, hi: int, item: Check, *, unique: bool = False) -> None:
        if not isinstance(value, list):
            self.add(path, "wrong_type")
            return
        if len(value) < lo:
            self.add(path, "too_few")
        elif len(value) > hi:
            self.add(path, "too_many")
        seen: set[str] = set()
        for i, entry in enumerate(value):
            item(self, entry, _join(path, i))
            if unique and isinstance(entry, str) and entry.strip():
                if _norm(entry) in seen:
                    self.add(_join(path, i), "duplicate")
                seen.add(_norm(entry))


# Field checks: small factories that return a Check.
def integer(lo: int, hi: int) -> Check:
    return lambda w, v, p: w.check_int(v, p, lo, hi)


def text(lo: int, hi: int) -> Check:
    return lambda w, v, p: w.check_text(v, p, lo, hi)


def flag() -> Check:
    return lambda w, v, p: w.check_bool(v, p)


def choice(*allowed: str) -> Check:
    return lambda w, v, p: w.check_choice(v, p, allowed)


def obj(fields: dict[str, Check]) -> Check:
    return lambda w, v, p: w.check_object(v, p, fields)


def items(lo: int, hi: int, item: Check, *, unique: bool = False) -> Check:
    return lambda w, v, p: w.check_list(v, p, lo, hi, item, unique=unique)


def phrases(lo: int, hi: int) -> Check:
    """Unique (case-insensitive) phrases of 1 to 60 characters."""
    return items(lo, hi, text(1, 60), unique=True)


def category_id(w: _Walker, value: Any, path: str) -> None:
    w.check_text(value, path, 1, 40)
    if isinstance(value, str) and value.strip() and not CATEGORY_ID.fullmatch(value):
        w.add(path, "bad_id")


def proof_point(w: _Walker, value: Any, path: str) -> None:
    w.check_text(value, path, 3, 120)
    if isinstance(value, str) and any(ch.isdigit() for ch in value):
        w.add(path, "has_digit")  # the numbers guardrail allows numbers found in proof points


CATEGORY = obj({
    "id": category_id,
    "name": text(1, 40),
    "enabled": flag(),
    "points": integer(0, 100),
    "foundingBonus": integer(0, 50),
    "keywords": phrases(1, 200),
    "exclusions": phrases(0, 200),
})

SHAPE: dict[str, Check] = {
    "icp": obj({
        "status": choice(*YC_STATUSES),
        "b2b": flag(),
        "teamSizeMin": integer(1, 10000),
        "teamSizeMax": integer(1, 10000),
        "maxBatchAgeYears": integer(1, 20),
        "points": obj({"full": integer(0, 100), "partial": integer(0, 100)}),
    }),
    "partial": obj({"teamSizeMin": integer(1, 10000), "teamSizeMax": integer(1, 10000), "maxBatchAgeYears": integer(1, 20)}),
    "hiring": obj({
        "categories": items(1, 8, CATEGORY),
        "founding": phrases(0, 200),
        "exclude": phrases(0, 200),
        "excludeExceptions": phrases(0, 200),
    }),
    "signals": obj({
        "launch": obj({"enabled": flag(), "points": integer(0, 100)}),
        "ycRecent": obj({"enabled": flag(), "points": integer(0, 100)}),
    }),
    "threshold": integer(1, 500),
    "weakSignalTypes": items(0, 3, choice(*SIGNAL_TYPES), unique=True),
    "scoreBands": items(1, 6, obj({"min": integer(1, 500), "label": text(1, 20)})),
    "freshness": items(1, 8, obj({"maxHours": integer(1, 8760), "points": integer(0, 50)})),
    "stackedPerExtraSignalType": integer(0, 50),
    "signalWindows": obj({
        "jobsRefreshHours": integer(1, 168),
        "launchLookbackDays": integer(1, 365),
        "fundingRecentMonths": integer(1, 36),
    }),
    "outreach": obj({
        "senderName": text(1, 40),
        "offer": text(10, 300),
        "proofPoints": items(1, 6, proof_point, unique=True),
    }),
    "guardrails": obj({"maxBodyWords": integer(40, 150), "extraBannedPhrases": phrases(0, 50)}),
}


def max_possible_score(doc: dict[str, Any]) -> int:
    """The most points any lead could get under these rules."""
    categories = [c for c in doc["hiring"]["categories"] if c["enabled"]]
    launch, yc = doc["signals"]["launch"], doc["signals"]["ycRecent"]
    types = (1 if categories else 0) + int(launch["enabled"]) + int(yc["enabled"])
    return (
        max(doc["icp"]["points"]["full"], doc["icp"]["points"]["partial"])
        + sum(c["points"] + c["foundingBonus"] for c in categories)
        + (launch["points"] if launch["enabled"] else 0)
        + (yc["points"] if yc["enabled"] else 0)
        + max(step["points"] for step in doc["freshness"])
        + doc["stackedPerExtraSignalType"] * max(0, types - 1)
    )


def _between_fields(w: _Walker, doc: dict[str, Any]) -> None:
    for section in ("icp", "partial"):
        if doc[section]["teamSizeMin"] > doc[section]["teamSizeMax"]:
            w.add(f"{section}.teamSizeMin", "min_above_max")

    categories = doc["hiring"]["categories"]
    ids: set[str] = set()
    names: set[str] = set()
    for i, category in enumerate(categories):
        if category["id"] in ids:
            w.add(f"hiring.categories.{i}.id", "duplicate")
        if _norm(category["name"]) in names:
            w.add(f"hiring.categories.{i}.name", "duplicate")
        ids.add(category["id"])
        names.add(_norm(category["name"]))

    # A lead needs a non-weak signal to be ready, so at least one must be possible.
    weak = set(doc["weakSignalTypes"])
    sources = {
        "hiring": any(c["enabled"] for c in categories),
        "launch": doc["signals"]["launch"]["enabled"],
        "funding": doc["signals"]["ycRecent"]["enabled"],
    }
    if not any(enabled and kind not in weak for kind, enabled in sources.items()):
        w.add("signals", "no_strong_signal_source")

    if doc["threshold"] > max_possible_score(doc):
        w.add("threshold", "above_max_score")

    bands = doc["scoreBands"]
    if any(a["min"] <= b["min"] for a, b in zip(bands, bands[1:])):
        w.add("scoreBands", "not_descending")
    if bands[-1]["min"] != doc["threshold"]:
        w.add("scoreBands", "lowest_band_not_threshold")
    labels = [_norm(band["label"]) for band in bands]
    if len(set(labels)) != len(labels):
        w.add("scoreBands", "duplicate")

    steps = doc["freshness"]
    if any(a["maxHours"] >= b["maxHours"] for a, b in zip(steps, steps[1:])):
        w.add("freshness", "not_ascending")


def validate_rules(doc: Any) -> list[RuleError]:
    """Every problem with a rules document, sorted by path then code. Empty means valid."""
    w = _Walker()
    w.check_object(doc, "", SHAPE)
    if not w.errors:
        _between_fields(w, doc)
    return sorted(set(w.errors))
