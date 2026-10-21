// Checks every draft must pass before a person can approve it.
// The TypeScript twin of agent/guardrails.py: the editor runs it live on every keystroke, and
// the approve route runs it again on the server. Both suites run
// shared/fixtures/guardrails_cases.json, so the two can't drift apart.
//
// Text matching is case-insensitive, ignores runs of whitespace, and respects word boundaries
// ("sales" doesn't match inside "Salesforce"). Pure functions: safe in the browser.
import type { AgentConfig } from "@/lib/agent-config";

export type CheckStatus = "pass" | "fail" | "warn";
export type CheckName =
  | "angle"
  | "grounding"
  | "banned_chars"
  | "banned_phrases"
  | "word_count"
  | "closing_question"
  | "numbers"
  | "claims"
  | "placeholders"
  | "subject";
export type CheckResult = { check: CheckName; status: CheckStatus; message: string };

export type GuardrailInput = {
  angle: string;
  subject: string;
  body: string;
  groundedPhrases: string[];
  signals: { title: string; excerpt: string | null }[];
};

export type GuardrailRules = {
  maxBodyWords: number;
  requireClosingQuestion: boolean;
  bannedChars: string[];
  bannedPhrases: string[];
  claimPhrases: string[];
  minGroundedPhraseChars: number;
  maxSubjectChars: number;
  proofPoints: string[];
};

// Names for characters the UI can't print (the banned em and en dashes).
const CHAR_NAMES: Record<string, string> = { "—": "an em dash", "–": "an en dash" };
const WORD = "[\\p{L}\\p{N}_]";
const NUMBER = new RegExp(`(?<!${WORD})\\d+(?:[.,]\\d+)?%?`, "gu");
const PLACEHOLDER = /\{\{[^}]*\}\}|\{[A-Za-z_]+\}|\[[A-Z][A-Za-z ]*\]/g;

export function guardrailRules(config: AgentConfig): GuardrailRules {
  const g = config.guardrails;
  return {
    maxBodyWords: g.maxBodyWords,
    requireClosingQuestion: g.requireClosingQuestion,
    bannedChars: g.bannedChars,
    bannedPhrases: g.bannedPhrases,
    claimPhrases: g.claimPhrases,
    minGroundedPhraseChars: g.minGroundedPhraseChars,
    maxSubjectChars: g.maxSubjectChars,
    proofPoints: config.outreach.proofPoints,
  };
}

function norm(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(" ");
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-phrase, case-insensitive match that ignores extra whitespace. */
export function contains(text: string, phrase: string): boolean {
  const needle = norm(phrase);
  if (!needle) return false;
  return new RegExp(`(?<!${WORD})${escapeRegExp(needle)}(?!${WORD})`, "iu").test(norm(text));
}

const quoted = (items: string[]) => items.map((item) => `"${item}"`).join(", ");
const unique = (items: string[]) => [...new Set(items)];
const numbers = (text: string) => [...text.matchAll(NUMBER)].map((m) => m[0].replace(/%$/, ""));
const result = (check: CheckName, status: CheckStatus, message: string): CheckResult => ({ check, status, message });

function checkAngle(d: GuardrailInput): CheckResult {
  if (d.angle === "raw") return result("angle", "fail", "Unconstrained drafts can't be approved");
  return result("angle", "pass", "Approvable angle");
}

function checkGrounding(d: GuardrailInput, rules: GuardrailRules): CheckResult {
  const email = `${d.subject}\n${d.body}`;
  const phrases = unique(d.groundedPhrases.filter((p) => norm(p).length >= rules.minGroundedPhraseChars));
  const verified = phrases.filter(
    (p) => contains(email, p) && d.signals.some((s) => contains(s.title, p) || contains(s.excerpt ?? "", p)),
  );
  const unverified = phrases.filter((p) => !verified.includes(p));
  if (verified.length === 0) {
    const missing = unverified.length ? ` Not found in both the email and a signal: ${quoted(unverified)}.` : "";
    return result("grounding", "fail", `No phrase from the signals appears in the email.${missing}`);
  }
  if (unverified.length) {
    return result(
      "grounding",
      "warn",
      `Grounded: ${quoted(verified)}. Not found in both the email and a signal: ${quoted(unverified)}`,
    );
  }
  return result("grounding", "pass", `Grounded: ${quoted(verified)}`);
}

function checkBannedChars(d: GuardrailInput, rules: GuardrailRules): CheckResult {
  const email = `${d.subject}\n${d.body}`;
  const found = rules.bannedChars.filter((c) => email.includes(c)).map((c) => CHAR_NAMES[c] ?? `"${c}"`);
  if (found.length) return result("banned_chars", "fail", `Contains ${found.join(", ")}`);
  return result("banned_chars", "pass", "No banned characters");
}

function checkBannedPhrases(d: GuardrailInput, rules: GuardrailRules): CheckResult {
  const email = `${d.subject}\n${d.body}`;
  const found = rules.bannedPhrases.filter((p) => contains(email, p));
  if (found.length) return result("banned_phrases", "fail", `Remove: ${quoted(found)}`);
  return result("banned_phrases", "pass", "No banned phrases");
}

function checkWordCount(d: GuardrailInput, rules: GuardrailRules): CheckResult {
  const count = d.body.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
  if (count > rules.maxBodyWords) return result("word_count", "fail", `${count} words, limit ${rules.maxBodyWords}`);
  return result("word_count", "pass", `${count} words`);
}

function checkClosingQuestion(d: GuardrailInput, rules: GuardrailRules): CheckResult {
  if (!rules.requireClosingQuestion) return result("closing_question", "pass", "Not required");
  if (d.body.trimEnd().endsWith("?")) return result("closing_question", "pass", "Ends with a question");
  return result("closing_question", "fail", "End the body with a question");
}

function checkNumbers(d: GuardrailInput, rules: GuardrailRules): CheckResult {
  const sources = [...d.signals.map((s) => `${s.title} ${s.excerpt ?? ""}`), ...rules.proofPoints].join(" ");
  const allowed = new Set(numbers(sources));
  const used = unique(numbers(`${d.subject}\n${d.body}`));
  const invented = used.filter((n) => !allowed.has(n));
  if (invented.length) return result("numbers", "fail", `Not in the signals or proof points: ${invented.join(", ")}`);
  return result("numbers", "pass", used.length ? "Numbers come from the signals" : "No numbers");
}

function checkClaims(d: GuardrailInput, rules: GuardrailRules): CheckResult {
  const email = `${d.subject}\n${d.body}`;
  const unsupported = rules.claimPhrases.filter(
    (claim) =>
      contains(email, claim) && !rules.proofPoints.some((point) => contains(point, claim) && contains(email, point)),
  );
  if (unsupported.length) return result("claims", "fail", `Unsupported claim: ${quoted(unsupported)}`);
  return result("claims", "pass", "No unsupported claims");
}

function checkPlaceholders(d: GuardrailInput): CheckResult {
  const found = unique(`${d.subject}\n${d.body}`.match(PLACEHOLDER) ?? []);
  if (found.length) return result("placeholders", "fail", `Fill in: ${found.join(", ")}`);
  return result("placeholders", "pass", "No placeholders");
}

function checkSubject(d: GuardrailInput, rules: GuardrailRules): CheckResult {
  const subject = d.subject.trim();
  const length = [...subject].length; // code points, like Python's len()
  if (!subject) return result("subject", "fail", "Add a subject");
  if (length > rules.maxSubjectChars) {
    return result("subject", "warn", `${length} characters; under ${rules.maxSubjectChars} reads better`);
  }
  return result("subject", "pass", `${length} characters`);
}

export function runGuardrails(d: GuardrailInput, rules: GuardrailRules): CheckResult[] {
  return [
    checkAngle(d),
    checkGrounding(d, rules),
    checkBannedChars(d, rules),
    checkBannedPhrases(d, rules),
    checkWordCount(d, rules),
    checkClosingQuestion(d, rules),
    checkNumbers(d, rules),
    checkClaims(d, rules),
    checkPlaceholders(d),
    checkSubject(d, rules),
  ];
}

export function passed(results: CheckResult[]): boolean {
  return results.every((r) => r.status !== "fail");
}
