// What the Simulate and resend routes do. Server only.
//
// Simulate (admins only): a test inbox can't reply, and the sandbox sender can't track opens,
// so an admin creates those events. They're stored with source "simulated" and go through
// the same handler as real Resend events (lib/email-events.ts). Fast-forward makes the next
// step due now and starts a sequences run.
//
// Resend (the admin or the lead's rep): after a bounce, a person approves sending to the
// proposed address. Nothing resends without that click.
//
// Both read the lead through the user's own session first (RLS proves access), then write
// through the service-role client.
import "server-only";
import type { ApiError } from "@/lib/api";
import { logUserAction } from "@/lib/audit";
import type { Profile } from "@/lib/auth";
import { getLead } from "@/lib/data/leads";
import { applyEmailEvent } from "@/lib/email-events";
import { startSequencesRun } from "@/lib/rescore";
import { stepLabel } from "@/lib/sequence-labels";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ApplyStart } from "@/lib/types";

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: ApiError };
export type SimulateAction = "reply" | "open" | "fast-forward";

const fail = (status: number, code: ApiError["code"], message: string) => ({ ok: false, status, error: { code, message } }) as const;

async function sequenceOf(leadId: string) {
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from("sequences").select("id, status").eq("lead_id", leadId).maybeSingle();
  if (error) throw new Error(`Loading the sequence failed: ${error.message}`);
  return data;
}

export async function simulate(
  profile: Profile,
  action: SimulateAction,
  leadId: string,
): Promise<ServiceResult<{ step: string; apply?: ApplyStart }>> {
  const lead = await getLead(leadId);
  if (!lead) return fail(404, "not_found", "Lead not found.");
  const sequence = await sequenceOf(lead.id);
  if (!sequence) return fail(409, "not_ready", "This lead has no sequence yet. Approve a draft first.");
  const db = createSupabaseAdminClient();

  if (action === "fast-forward") {
    if (sequence.status !== "active") return fail(409, "not_ready", `This sequence is ${sequence.status}.`);
    const { data: next, error } = await db
      .from("sequence_steps")
      .select("id, step_key")
      .eq("sequence_id", sequence.id)
      .eq("status", "pending")
      .order("scheduled_for", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Finding the next step failed: ${error.message}`);
    if (!next) return fail(409, "not_ready", "There are no steps left in this sequence.");
    const { error: updateError } = await db
      .from("sequence_steps")
      .update({ scheduled_for: new Date().toISOString() })
      .eq("id", next.id);
    if (updateError) throw new Error(`Fast-forwarding failed: ${updateError.message}`);
    await logUserAction(profile, {
      action: "sequence.fast_forwarded",
      entityType: "sequence",
      entityId: sequence.id,
      detail: { step: next.step_key, simulated: true },
    });
    return { ok: true, data: { step: stepLabel(next.step_key), apply: await startSequencesRun(profile, lead.id) } };
  }

  const { data: sent, error } = await db
    .from("sequence_steps")
    .select("id, step_key")
    .eq("sequence_id", sequence.id)
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Finding the last email failed: ${error.message}`);
  if (!sent) return fail(409, "not_ready", "Nothing has been sent to this lead yet.");
  await applyEmailEvent({
    stepId: sent.id,
    type: action === "reply" ? "replied" : "opened",
    source: "simulated",
    providerEventId: null,
    payload: { simulated: true, by: profile.id },
    actorId: profile.id,
  });
  return { ok: true, data: { step: stepLabel(sent.step_key) } };
}

export async function resendToCorrected(
  profile: Profile,
  leadId: string,
  proposalId: string,
): Promise<ServiceResult<{ apply: ApplyStart }>> {
  const lead = await getLead(leadId);
  if (!lead) return fail(404, "not_found", "Lead not found.");
  const supabase = await createSupabaseServerClient();
  const { data: proposal, error } = await supabase
    .from("recovery_proposals")
    .select("id, sequence_id, step_id, proposed_address, status")
    .eq("id", proposalId)
    .eq("lead_id", lead.id)
    .maybeSingle();
  if (error) throw new Error(`Loading the recovery proposal failed: ${error.message}`);
  if (!proposal) return fail(404, "not_found", "Recovery proposal not found.");
  if (proposal.status === "approved") return fail(409, "already_enrolled", "This was already resent.");

  const db = createSupabaseAdminClient();
  const { data: leadRow, error: leadError } = await db.from("leads").select("contact_id").eq("id", lead.id).single();
  if (leadError) throw new Error(`Loading the lead failed: ${leadError.message}`);
  const { data: bounced, error: stepError } = await db.from("sequence_steps").select("step_key").eq("id", proposal.step_id).single();
  if (stepError) throw new Error(`Loading the bounced step failed: ${stepError.message}`);

  const writes = [
    db.from("contacts").update({ send_address: proposal.proposed_address }).eq("id", leadRow.contact_id ?? ""),
    db.from("recovery_proposals").update({ status: "approved", approved_by: profile.id, approved_at: new Date().toISOString() }).eq("id", proposal.id),
    // The bounced email again, now to the corrected address, with its own idempotency key.
    db.from("sequence_steps").insert({
      org_id: profile.orgId,
      sequence_id: proposal.sequence_id,
      step_key: bounced.step_key,
      scheduled_for: new Date().toISOString(),
      idempotency_key: `${proposal.sequence_id}:${bounced.step_key}:retry:${proposal.id}`,
    }),
    db.from("sequences").update({ status: "active" }).eq("id", proposal.sequence_id),
    db.from("leads").update({ status: "enrolled" }).eq("id", lead.id),
  ];
  for (const write of writes) {
    const { error: writeError } = await write;
    if (writeError) throw new Error(`Approving the resend failed: ${writeError.message}`);
  }
  await logUserAction(profile, {
    action: "lead.resend_approved",
    entityType: "lead",
    entityId: lead.id,
    detail: { proposal_id: proposal.id, to: proposal.proposed_address },
  });
  return { ok: true, data: { apply: await startSequencesRun(profile, lead.id) } };
}

export type TestInbox = "delivered" | "bounced" | "complained";

/** delivered+2b56@resend.dev -> complained+2b56@resend.dev (the +label is kept). */
export function withTestInbox(address: string, inbox: TestInbox): string {
  const label = /^(?:delivered|bounced|complained)(\+[A-Za-z0-9._-]+)?@resend\.dev$/i.exec(address.trim())?.[1] ?? "";
  return `${inbox}${label}@resend.dev`;
}

/** Admin demo control: which Resend test inbox this lead's contact uses, so a demo can show a
 *  real delivery, bounce or complaint on purpose. The events that follow are real Resend events. */
export async function setTestInbox(
  profile: Profile,
  leadId: string,
  inbox: TestInbox,
): Promise<ServiceResult<{ sendAddress: string }>> {
  const lead = await getLead(leadId);
  if (!lead) return fail(404, "not_found", "Lead not found.");
  if (!lead.contact) return fail(409, "not_ready", "This lead has no contact.");
  const db = createSupabaseAdminClient();
  const { data: row, error } = await db.from("leads").select("contact_id").eq("id", lead.id).single();
  if (error) throw new Error(`Loading the lead failed: ${error.message}`);
  const sendAddress = withTestInbox(lead.contact.sendAddress, inbox);
  const { error: updateError } = await db.from("contacts").update({ send_address: sendAddress }).eq("id", row.contact_id ?? "");
  if (updateError) throw new Error(`Changing the test inbox failed: ${updateError.message}`);
  await logUserAction(profile, {
    action: "lead.test_inbox_changed",
    entityType: "lead",
    entityId: lead.id,
    detail: { from: lead.contact.sendAddress, to: sendAddress },
  });
  return { ok: true, data: { sendAddress } };
}
