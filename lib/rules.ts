// The editable rules document (one per org version) and its validator.
// The TypeScript twin of agent/rules.py: both return the same {path, code} errors for the
// same document, which shared/fixtures/config_cases.json proves. Hand-written walkers rather
// than zod/pydantic error lists, because those two libraries name errors differently.
//
// Paths are dotted, with list indexes: "hiring.categories.1.keywords.0".
// Structure is checked first; rules between fields only run once the structure is valid.
// Pure functions: the rules editor runs validateRules() in the browser on every change.

export type SignalKind = "hiring" | "launch" | "funding";

export type HiringCategoryRule = {
  /** Stable id stored on signals (lowercase letters, digits, underscores). */
  id: string;
  /** Shown on signals and in the score math, e.g. "Sales hire". */
  name: string;
  enabled: boolean;
  points: number;
  /** Extra points when the role is a founding one ("Founding AE"). */
  foundingBonus: number;
  keywords: string[];
  exclusions: string[];
};

export type RulesDoc = {
  icp: {
    status: "Active" | "Acquired" | "Inactive" | "Public";
    b2b: boolean;
    teamSizeMin: number;
    teamSizeMax: number;
    maxBatchAgeYears: number;
    points: { full: number; partial: number };
  };
  partial: { teamSizeMin: number; teamSizeMax: number; maxBatchAgeYears: number };
  /** Categories are checked in order; the first match wins. */
  hiring: { categories: HiringCategoryRule[]; founding: string[]; exclude: string[]; excludeExceptions: string[] };
  signals: { launch: { enabled: boolean; points: number }; ycRecent: { enabled: boolean; points: number } };
  threshold: number;
  weakSignalTypes: SignalKind[];
  scoreBands: { min: number; label: string }[];
  freshness: { maxHours: number; points: number }[];
  stackedPerExtraSignalType: number;
  signalWindows: { jobsRefreshHours: number; launchLookbackDays: number; fundingRecentMonths: number };
  outreach: { senderName: string; offer: string; proofPoints: string[] };
  guardrails: { maxBodyWords: number; extraBannedPhrases: string[] };
};

export type RuleError = { path: string; code: string };

const SIGNAL_TYPES = ["hiring", "launch", "funding"];
const YC_STATUSES = ["Active", "Acquired", "Inactive", "Public"];
const CATEGORY_ID = /^[a-z][a-z0-9_]{0,39}$/;

type Check = (w: Walker, value: unknown, path: string) => void;

const join = (path: string, key: string | number) => (path ? `${path}.${key}` : String(key));
const norm = (text: string) => text.toLowerCase().split(/\s+/).filter(Boolean).join(" ");
const length = (text: string) => [...text].length; // code points, like Python's len()
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

class Walker {
  errors: RuleError[] = [];

  add(path: string, code: string) {
    this.errors.push({ path, code });
  }

  checkObject(value: unknown, path: string, fields: Record<string, Check>) {
    if (!isObject(value)) return this.add(path, "wrong_type");
    for (const key of Object.keys(value)) if (!(key in fields)) this.add(join(path, key), "unknown_field");
    for (const [key, check] of Object.entries(fields)) {
      if (key in value) check(this, value[key], join(path, key));
      else this.add(join(path, key), "missing");
    }
  }

  checkInt(value: unknown, path: string, lo: number, hi: number) {
    if (typeof value !== "number" || !Number.isInteger(value)) this.add(path, "wrong_type");
    else if (value < lo || value > hi) this.add(path, "out_of_range");
  }

  checkBool(value: unknown, path: string) {
    if (typeof value !== "boolean") this.add(path, "wrong_type");
  }

  checkText(value: unknown, path: string, lo: number, hi: number) {
    if (typeof value !== "string") this.add(path, "wrong_type");
    else if (!value.trim()) this.add(path, "empty");
    else if (length(value.trim()) < lo || length(value.trim()) > hi) this.add(path, "out_of_range");
  }

  checkChoice(value: unknown, path: string, allowed: string[]) {
    if (typeof value !== "string") this.add(path, "wrong_type");
    else if (!allowed.includes(value)) this.add(path, "not_allowed");
  }

  checkList(value: unknown, path: string, lo: number, hi: number, item: Check, unique = false) {
    if (!Array.isArray(value)) return this.add(path, "wrong_type");
    if (value.length < lo) this.add(path, "too_few");
    else if (value.length > hi) this.add(path, "too_many");
    const seen = new Set<string>();
    value.forEach((entry, i) => {
      item(this, entry, join(path, i));
      if (unique && typeof entry === "string" && entry.trim()) {
        if (seen.has(norm(entry))) this.add(join(path, i), "duplicate");
        seen.add(norm(entry));
      }
    });
  }
}

// Field checks: small factories that return a Check.
const integer = (lo: number, hi: number): Check => (w, v, p) => w.checkInt(v, p, lo, hi);
const text = (lo: number, hi: number): Check => (w, v, p) => w.checkText(v, p, lo, hi);
const flag = (): Check => (w, v, p) => w.checkBool(v, p);
const choice = (allowed: string[]): Check => (w, v, p) => w.checkChoice(v, p, allowed);
const obj = (fields: Record<string, Check>): Check => (w, v, p) => w.checkObject(v, p, fields);
const items = (lo: number, hi: number, item: Check, unique = false): Check => (w, v, p) =>
  w.checkList(v, p, lo, hi, item, unique);
/** Unique (case-insensitive) phrases of 1 to 60 characters. */
const phrases = (lo: number, hi: number) => items(lo, hi, text(1, 60), true);

const categoryId: Check = (w, value, path) => {
  w.checkText(value, path, 1, 40);
  if (typeof value === "string" && value.trim() && !CATEGORY_ID.test(value)) w.add(path, "bad_id");
};

const proofPoint: Check = (w, value, path) => {
  w.checkText(value, path, 3, 120);
  // The numbers guardrail allows numbers found in proof points, so they may not contain any.
  if (typeof value === "string" && /\p{Nd}/u.test(value)) w.add(path, "has_digit");
};

const CATEGORY = obj({
  id: categoryId,
  name: text(1, 40),
  enabled: flag(),
  points: integer(0, 100),
  foundingBonus: integer(0, 50),
  keywords: phrases(1, 200),
  exclusions: phrases(0, 200),
});

const SHAPE: Record<string, Check> = {
  icp: obj({
    status: choice(YC_STATUSES),
    b2b: flag(),
    teamSizeMin: integer(1, 10000),
    teamSizeMax: integer(1, 10000),
    maxBatchAgeYears: integer(1, 20),
    points: obj({ full: integer(0, 100), partial: integer(0, 100) }),
  }),
  partial: obj({ teamSizeMin: integer(1, 10000), teamSizeMax: integer(1, 10000), maxBatchAgeYears: integer(1, 20) }),
  hiring: obj({
    categories: items(1, 8, CATEGORY),
    founding: phrases(0, 200),
    exclude: phrases(0, 200),
    excludeExceptions: phrases(0, 200),
  }),
  signals: obj({
    launch: obj({ enabled: flag(), points: integer(0, 100) }),
    ycRecent: obj({ enabled: flag(), points: integer(0, 100) }),
  }),
  threshold: integer(1, 500),
  weakSignalTypes: items(0, 3, choice(SIGNAL_TYPES), true),
  scoreBands: items(1, 6, obj({ min: integer(1, 500), label: text(1, 20) })),
  freshness: items(1, 8, obj({ maxHours: integer(1, 8760), points: integer(0, 50) })),
  stackedPerExtraSignalType: integer(0, 50),
  signalWindows: obj({
    jobsRefreshHours: integer(1, 168),
    launchLookbackDays: integer(1, 365),
    fundingRecentMonths: integer(1, 36),
  }),
  outreach: obj({
    senderName: text(1, 40),
    offer: text(10, 300),
    proofPoints: items(1, 6, proofPoint, true),
  }),
  guardrails: obj({ maxBodyWords: integer(40, 150), extraBannedPhrases: phrases(0, 50) }),
};

/** The most points any lead could get under these rules. */
export function maxPossibleScore(doc: RulesDoc): number {
  const categories = doc.hiring.categories.filter((c) => c.enabled);
  const { launch, ycRecent } = doc.signals;
  const types = (categories.length ? 1 : 0) + Number(launch.enabled) + Number(ycRecent.enabled);
  return (
    Math.max(doc.icp.points.full, doc.icp.points.partial) +
    categories.reduce((sum, c) => sum + c.points + c.foundingBonus, 0) +
    (launch.enabled ? launch.points : 0) +
    (ycRecent.enabled ? ycRecent.points : 0) +
    Math.max(...doc.freshness.map((step) => step.points)) +
    doc.stackedPerExtraSignalType * Math.max(0, types - 1)
  );
}

function betweenFields(w: Walker, doc: RulesDoc) {
  for (const section of ["icp", "partial"] as const) {
    if (doc[section].teamSizeMin > doc[section].teamSizeMax) w.add(`${section}.teamSizeMin`, "min_above_max");
  }

  const categories = doc.hiring.categories;
  const ids = new Set<string>();
  const names = new Set<string>();
  categories.forEach((category, i) => {
    if (ids.has(category.id)) w.add(`hiring.categories.${i}.id`, "duplicate");
    if (names.has(norm(category.name))) w.add(`hiring.categories.${i}.name`, "duplicate");
    ids.add(category.id);
    names.add(norm(category.name));
  });

  // A lead needs a non-weak signal to be ready, so at least one must be possible.
  const weak = new Set<string>(doc.weakSignalTypes);
  const sources: [SignalKind, boolean][] = [
    ["hiring", categories.some((c) => c.enabled)],
    ["launch", doc.signals.launch.enabled],
    ["funding", doc.signals.ycRecent.enabled],
  ];
  if (!sources.some(([kind, enabled]) => enabled && !weak.has(kind))) w.add("signals", "no_strong_signal_source");

  if (doc.threshold > maxPossibleScore(doc)) w.add("threshold", "above_max_score");

  const bands = doc.scoreBands;
  if (bands.some((band, i) => i > 0 && bands[i - 1].min <= band.min)) w.add("scoreBands", "not_descending");
  if (bands[bands.length - 1].min !== doc.threshold) w.add("scoreBands", "lowest_band_not_threshold");
  const labels = bands.map((band) => norm(band.label));
  if (new Set(labels).size !== labels.length) w.add("scoreBands", "duplicate");

  const steps = doc.freshness;
  if (steps.some((step, i) => i > 0 && steps[i - 1].maxHours >= step.maxHours)) w.add("freshness", "not_ascending");
}

const byPathThenCode = (a: RuleError, b: RuleError) =>
  a.path < b.path ? -1 : a.path > b.path ? 1 : a.code < b.code ? -1 : a.code > b.code ? 1 : 0;

/** Every problem with a rules document, sorted by path then code. Empty means valid. */
export function validateRules(doc: unknown): RuleError[] {
  const w = new Walker();
  w.checkObject(doc, "", SHAPE);
  if (w.errors.length === 0) betweenFields(w, doc as RulesDoc);
  const unique = new Map(w.errors.map((e) => [`${e.path}\u0000${e.code}`, e]));
  return [...unique.values()].sort(byPathThenCode);
}
