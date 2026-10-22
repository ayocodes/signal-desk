// What an email event does, from Resend's webhook or from an admin's Simulate action: one
// handler, so simulated events take exactly the path real ones do. Server only. Uses the
// service-role client: webhooks have no user session (ARCHITECTURE.md "Roles and RLS"), and
// simulate routes check the admin role before calling this.
//
//   bounced     pause the sequence, lead -> bounced, propose a corrected address (a person approves)
//   complained  halt the sequence, lead -> halted, refresh the mailbox's health
//   replied     halt the sequence, lead -> replied
//   anything else (sent, delivered, opened, clicked, ...) is stored only
import "server-only";
import { defaultConfig } from "@/lib/agent-config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

export type EmailEventInput = {
  /** Resend's message id (data.email_id), or the step id for a simulated event. */
  messageId?: string;
  stepId?: string;
  type: string;
  source: "resend" | "simulated";
  /** Resend's svix-id; null for simulated events. A repeat is ignored. */
  providerEventId: string | null;
  payload: Json;
  /** The admin who simulated it; null for Resend. */
  actorId: string | null;
};

export type EmailEventResult = { stored: boolean; reason?: string };

type StepRow = {
  id: string;
  org_id: string;
  sequence_id: string;
  mailbox_id: string | null;
  sequence: { id: string; lead_id: string; status: string } | null;
};

const STEP_COLUMNS = "id, org_id, sequence_id, mailbox_id, sequence:sequences(id, lead_id, status)";

/** bounced+abc@resend.dev -> delivered+abc@resend.dev (the test inbox that delivers). */
export function proposedAddress(original: string): string {
  return original.replace(/^(bounced|complained)/i, "delivered");
}

function bounceDetails(payload: Json): { code: string | null; reason: string } {
  const data = payload && typeof payload === "object" && !Array.isArray(payload) ? payload.data : null;
  const bounce = data && typeof data === "object" && !Array.isArray(data) ? data.bounce : null;
  if (bounce && typeof bounce === "object" && !Array.isArray(bounce)) {
    const code = [bounce.type, bounce.subType].filter((v) => typeof v === "string").join(" / ") || null;
    const reason = typeof bounce.message === "string" && bounce.message ? bounce.message : "The address bounced";
    return { code, reason };
  }
  return { code: null, reason: "The address bounced" };
}

export async function applyEmailEvent(input: EmailEventInput): Promise<EmailEventResult> {
  const db = createSupabaseAdminClient();
  const query = db.from("sequence_steps").select(STEP_COLUMNS);
  const { data: found, error: findError } = input.stepId
    ? await query.eq("id", input.stepId).maybeSingle()
    : await query.eq("message_id", input.messageId ?? "").maybeSingle();
  if (findError) throw new Error(`Finding the email's step failed: ${findError.message}`);
  if (!found) return { stored: false, reason: "Not an email this app sent" };
  const step = found as unknown as StepRow;

  const { data: inserted, error: insertError } = await db
    .from("email_events")
    .upsert(
      {
        org_id: step.org_id,
        step_id: step.id,
        provider_event_id: input.providerEventId,
        type: input.type,
        source: input.source,
        payload: input.payload,
      },
      { onConflict: "provider_event_id", ignoreDuplicates: true },
    )
    .select("id");
  if (insertError) throw new Error(`Storing the email event failed: ${insertError.message}`);
  if (!inserted || inserted.length === 0) return { stored: false, reason: "Already received" };

  const sequence = step.sequence;
  if (!sequence) return { stored: true };
  const audit = async (action: string, detail: Record<string, Json>) => {
    const { error } = await db.from("audit_log").insert({
      org_id: step.org_id,
      actor_type: input.actorId ? "user" : "agent",
      actor_id: input.actorId,
      action,
      entity_type: "sequence",
      entity_id: sequence.id,
      detail: { ...detail, source: input.source },
    });
    if (error) throw new Error(`Writing the audit log failed: ${error.message}`);
  };

  if (input.type === "bounced") await handleBounce(db, step, sequence, input, audit);
  else if (input.type === "complained") await stopSequence(db, step, sequence, "halted", "email.complained", audit);
  else if (input.type === "replied") await stopSequence(db, step, sequence, "replied", "email.replied", audit);

  if ((input.type === "bounced" || input.type === "complained") && step.mailbox_id) {
    const limits = defaultConfig().guardrails.mailbox; // locked: the same for every org
    const { error } = await db.rpc("refresh_mailbox_health", {
      p_mailbox: step.mailbox_id,
      p_bounce_pct: limits.pauseBouncePct,
      p_complaint_pct: limits.pauseComplaintPct,
      p_min_sends: limits.minSendsForRates,
    });
    if (error) throw new Error(`Refreshing the mailbox's health failed: ${error.message}`);
  }
  return { stored: true };
}

type Db = ReturnType<typeof createSupabaseAdminClient>;
type Audit = (action: string, detail: Record<string, Json>) => Promise<void>;

async function check(result: PromiseLike<{ error: { message: string } | null }>, what: string) {
  const { error } = await result;
  if (error) throw new Error(`${what} failed: ${error.message}`);
}

/** A reply or a complaint: no more emails to this lead. Pending steps are cancelled. */
async function stopSequence(
  db: Db,
  step: StepRow,
  sequence: NonNullable<StepRow["sequence"]>,
  leadStatus: "halted" | "replied",
  action: string,
  audit: Audit,
) {
  await check(db.from("sequences").update({ status: "halted" }).eq("id", sequence.id), "Halting the sequence");
  await check(
    db.from("sequence_steps").update({ status: "cancelled" }).eq("sequence_id", sequence.id).eq("status", "pending"),
    "Cancelling the pending steps",
  );
  await check(db.from("leads").update({ status: leadStatus }).eq("id", sequence.lead_id), "Updating the lead");
  await audit(action, { step_id: step.id, lead_status: leadStatus });
}

/** A bounce: pause, and propose the corrected test inbox. Nothing resends until approved. */
async function handleBounce(
  db: Db,
  step: StepRow,
  sequence: NonNullable<StepRow["sequence"]>,
  input: EmailEventInput,
  audit: Audit,
) {
  const { data: lead, error } = await db
    .from("leads")
    .select("id, contact:contacts(send_address)")
    .eq("id", sequence.lead_id)
    .single();
  if (error) throw new Error(`Loading the bounced lead failed: ${error.message}`);
  const original = (lead.contact as unknown as { send_address: string } | null)?.send_address ?? "";
  const { code, reason } = bounceDetails(input.payload);

  await check(db.from("sequences").update({ status: "paused" }).eq("id", sequence.id), "Pausing the sequence");
  await check(db.from("leads").update({ status: "bounced" }).eq("id", sequence.lead_id), "Updating the lead");
  await check(
    db.from("recovery_proposals").upsert(
      {
        org_id: step.org_id,
        lead_id: sequence.lead_id,
        sequence_id: sequence.id,
        step_id: step.id,
        original_address: original,
        proposed_address: proposedAddress(original),
        bounce_code: code,
        reason,
      },
      { onConflict: "step_id", ignoreDuplicates: true },
    ),
    "Saving the recovery proposal",
  );
  await audit("email.bounced", { step_id: step.id, bounce_code: code, proposed: proposedAddress(original) });
}
