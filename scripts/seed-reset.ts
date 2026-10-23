// npm run seed:reset   (add -- --yes to skip the question)
// Puts the demo workspace back to a clean state for a walkthrough: deletes its sequences
// (their steps and recovery proposals go with them) and email events, returns those leads to
// "ready", and clears mailbox counters, rates and pauses. Companies, signals, scores, drafts,
// agent runs, rules and the audit log stay. Only the demo organization is touched.
import { createInterface } from "node:readline/promises";
import { DEMO_ORG_ID, serviceClient } from "./supabase-script-client";

async function confirmed(): Promise<boolean> {
  if (process.argv.includes("--yes")) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    "This deletes every sequence, email event and recovery proposal in the demo workspace. Type RESET to continue: ",
  );
  rl.close();
  return answer.trim() === "RESET";
}

async function main(): Promise<void> {
  if (!(await confirmed())) {
    console.log("Cancelled. Nothing changed.");
    return;
  }
  const db = serviceClient();

  const { data: sequences, error: readError } = await db.from("sequences").select("lead_id").eq("org_id", DEMO_ORG_ID);
  if (readError) throw new Error(`Reading sequences failed: ${readError.message}`);
  const leadIds = sequences.map((s) => s.lead_id as string);

  const { count: events, error: eventsError } = await db
    .from("email_events")
    .delete({ count: "exact" })
    .eq("org_id", DEMO_ORG_ID);
  if (eventsError) throw new Error(`Deleting email events failed: ${eventsError.message}`);

  const { error: sequencesError } = await db.from("sequences").delete().eq("org_id", DEMO_ORG_ID);
  if (sequencesError) throw new Error(`Deleting sequences failed: ${sequencesError.message}`);

  if (leadIds.length) {
    const { error: leadsError } = await db.from("leads").update({ status: "ready" }).eq("org_id", DEMO_ORG_ID).in("id", leadIds);
    if (leadsError) throw new Error(`Resetting leads failed: ${leadsError.message}`);
  }

  const { error: mailboxError } = await db
    .from("mailboxes")
    .update({
      status: "healthy",
      pause_reason: null,
      paused_at: null,
      sent_today: 0,
      bounce_rate: 0,
      complaint_rate: 0,
      rates_since: null,
    })
    .eq("org_id", DEMO_ORG_ID);
  if (mailboxError) throw new Error(`Resetting mailboxes failed: ${mailboxError.message}`);

  const detail = { sequences: leadIds.length, events: events ?? 0, by: "npm run seed:reset" };
  const { error: auditError } = await db
    .from("audit_log")
    .insert({ org_id: DEMO_ORG_ID, actor_type: "agent", action: "demo.reset", entity_type: "organization", entity_id: DEMO_ORG_ID, detail });
  if (auditError) throw new Error(`Writing the audit entry failed: ${auditError.message}`);

  console.log(`Demo reset: ${detail.sequences} sequence(s) and ${detail.events} email event(s) removed, leads back to ready, mailboxes cleared.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
