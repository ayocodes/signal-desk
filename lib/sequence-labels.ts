// Readable names for sequence steps (shared/sequence.json keys). Pure, for server and browser.
const STEP_LABELS: Record<string, string> = {
  d1_open: "Opening email",
  d3_check: "Day 3 check",
  d4_followup_signal2: "Follow-up on another signal",
  d4_new_subject: "Follow-up, new subject",
  d7_case: "Case note",
  d11_close: "Close the loop",
};

export function stepLabel(key: string): string {
  return STEP_LABELS[key] ?? key;
}
