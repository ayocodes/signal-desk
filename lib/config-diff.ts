// Readable change lines between two rules versions, saved with each version and shown in the
// version history: "Threshold 50 → 55", "Sales hire points 30 → 35",
// 'Added keyword "revops lead" to Sales hire'. Pure, so it's unit-tested.
import type { HiringCategoryRule, RulesDoc } from "@/lib/rules";

const arrow = (before: unknown, after: unknown) => `${before} → ${after}`;
const onOff = (enabled: boolean) => (enabled ? "on" : "off");

function changed(lines: string[], label: string, before: unknown, after: unknown, unit = "") {
  if (before !== after) lines.push(`${label} ${arrow(before, after)}${unit}`);
}

/** "Added keyword "x" to Sales hire" / "Removed ..." lines for one phrase list. */
function phraseChanges(lines: string[], before: string[], after: string[], what: string, where = "") {
  const key = (p: string) => p.toLowerCase().trim();
  const old = new Set(before.map(key));
  const now = new Set(after.map(key));
  for (const p of after) if (!old.has(key(p))) lines.push(`Added ${what} "${p}"${where ? ` to ${where}` : ""}`);
  for (const p of before) if (!now.has(key(p))) lines.push(`Removed ${what} "${p}"${where ? ` from ${where}` : ""}`);
}

function categoryChanges(lines: string[], before: HiringCategoryRule[], after: HiringCategoryRule[]) {
  const old = new Map(before.map((c) => [c.id, c]));
  const now = new Map(after.map((c) => [c.id, c]));
  for (const c of after) {
    const prev = old.get(c.id);
    if (!prev) {
      lines.push(`Added category ${c.name} (${c.points} points, ${onOff(c.enabled)})`);
      continue;
    }
    if (prev.name !== c.name) lines.push(`Renamed category ${arrow(prev.name, c.name)}`);
    if (prev.enabled !== c.enabled) lines.push(`${c.name} turned ${onOff(c.enabled)}`);
    changed(lines, `${c.name} points`, prev.points, c.points);
    changed(lines, `${c.name} founding bonus`, prev.foundingBonus, c.foundingBonus);
    phraseChanges(lines, prev.keywords, c.keywords, "keyword", c.name);
    phraseChanges(lines, prev.exclusions, c.exclusions, "exclusion", c.name);
  }
  for (const c of before) if (!now.has(c.id)) lines.push(`Removed category ${c.name}`);
  const order = (list: HiringCategoryRule[]) => list.filter((c) => old.has(c.id) && now.has(c.id)).map((c) => c.id).join();
  if (order(before) !== order(after)) lines.push(`Category order: ${after.map((c) => c.name).join(", ")}`);
}

const teamSize = (rules: { teamSizeMin: number; teamSizeMax: number }) => `${rules.teamSizeMin} to ${rules.teamSizeMax}`;
const bands = (doc: RulesDoc) => doc.scoreBands.map((b) => `${b.label} ${b.min}`).join(", ");
const freshness = (doc: RulesDoc) => doc.freshness.map((s) => `${s.maxHours}h ${s.points}`).join(", ");

export function diffRules(before: RulesDoc, after: RulesDoc): string[] {
  const lines: string[] = [];

  changed(lines, "Threshold", before.threshold, after.threshold);

  changed(lines, "ICP status", before.icp.status, after.icp.status);
  if (before.icp.b2b !== after.icp.b2b) lines.push(`B2B only turned ${onOff(after.icp.b2b)}`);
  changed(lines, "ICP team size", teamSize(before.icp), teamSize(after.icp));
  changed(lines, "ICP batch age", before.icp.maxBatchAgeYears, after.icp.maxBatchAgeYears, " years");
  changed(lines, "Full ICP match points", before.icp.points.full, after.icp.points.full);
  changed(lines, "Partial ICP match points", before.icp.points.partial, after.icp.points.partial);
  changed(lines, "Partial match team size", teamSize(before.partial), teamSize(after.partial));
  changed(lines, "Partial match batch age", before.partial.maxBatchAgeYears, after.partial.maxBatchAgeYears, " years");

  categoryChanges(lines, before.hiring.categories, after.hiring.categories);
  phraseChanges(lines, before.hiring.founding, after.hiring.founding, "founding phrase");
  phraseChanges(lines, before.hiring.exclude, after.hiring.exclude, "excluded title word");
  phraseChanges(lines, before.hiring.excludeExceptions, after.hiring.excludeExceptions, "exclusion exception");

  for (const [key, name] of [["launch", "Launch"], ["ycRecent", "YC recent"]] as const) {
    const [prev, next] = [before.signals[key], after.signals[key]];
    if (prev.enabled !== next.enabled) lines.push(`${name} turned ${onOff(next.enabled)}`);
    changed(lines, `${name} points`, prev.points, next.points);
  }
  changed(lines, "Weak signal types", before.weakSignalTypes.join(", ") || "none", after.weakSignalTypes.join(", ") || "none");
  changed(lines, "Score bands", bands(before), bands(after));
  changed(lines, "Freshness", freshness(before), freshness(after));
  changed(lines, "Stacked signal bonus", before.stackedPerExtraSignalType, after.stackedPerExtraSignalType);
  changed(lines, "Job board refresh", before.signalWindows.jobsRefreshHours, after.signalWindows.jobsRefreshHours, " hours");
  changed(lines, "Launch lookback", before.signalWindows.launchLookbackDays, after.signalWindows.launchLookbackDays, " days");
  changed(lines, "YC recent window", before.signalWindows.fundingRecentMonths, after.signalWindows.fundingRecentMonths, " months");

  changed(lines, "Sender name", before.outreach.senderName, after.outreach.senderName);
  if (before.outreach.offer !== after.outreach.offer) lines.push("Offer changed");
  phraseChanges(lines, before.outreach.proofPoints, after.outreach.proofPoints, "proof point");
  changed(lines, "Max body words", before.guardrails.maxBodyWords, after.guardrails.maxBodyWords);
  phraseChanges(lines, before.guardrails.extraBannedPhrases, after.guardrails.extraBannedPhrases, "banned phrase");

  return lines;
}
