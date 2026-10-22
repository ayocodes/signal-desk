// An admin resumes a paused mailbox from Ops. Server only.
//
// The rates restart from now (mailboxes.rates_since, migration 20261022150000): a mailbox
// paused for a 5% bounce rate over its whole history would otherwise be paused again by the
// next health check. The health check then runs at once, so the status is current. Audit logged.
import "server-only";
import { defaultConfig } from "@/lib/agent-config";
import { logUserAction } from "@/lib/audit";
import type { Profile } from "@/lib/auth";
import type { ServiceResult } from "@/lib/sequence-service";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MailboxStatus } from "@/lib/types";

export async function resumeMailbox(profile: Profile, mailboxId: string): Promise<ServiceResult<{ status: MailboxStatus }>> {
  // Read through the admin's own session first: RLS proves the mailbox is in their org.
  const supabase = await createSupabaseServerClient();
  const { data: box, error } = await supabase.from("mailboxes").select("id, label, status, pause_reason").eq("id", mailboxId).maybeSingle();
  if (error) throw new Error(`Loading the mailbox failed: ${error.message}`);
  if (!box) return { ok: false, status: 404, error: { code: "not_found", message: "Mailbox not found." } };
  if (box.status !== "paused" && box.status !== "held") {
    return { ok: false, status: 409, error: { code: "not_ready", message: "This mailbox isn't paused." } };
  }

  const db = createSupabaseAdminClient();
  const { error: updateError } = await db
    .from("mailboxes")
    .update({ status: "healthy", pause_reason: null, paused_at: null, rates_since: new Date().toISOString() })
    .eq("id", box.id);
  if (updateError) throw new Error(`Resuming the mailbox failed: ${updateError.message}`);
  const limits = defaultConfig().guardrails.mailbox; // locked: the same for every org
  const { error: healthError } = await db.rpc("refresh_mailbox_health", {
    p_mailbox: box.id,
    p_bounce_pct: limits.pauseBouncePct,
    p_complaint_pct: limits.pauseComplaintPct,
    p_min_sends: limits.minSendsForRates,
  });
  if (healthError) throw new Error(`Refreshing the mailbox's health failed: ${healthError.message}`);
  const { data: after, error: afterError } = await db.from("mailboxes").select("status").eq("id", box.id).single();
  if (afterError) throw new Error(`Reading the mailbox failed: ${afterError.message}`);

  await logUserAction(profile, {
    action: "mailbox.resumed",
    entityType: "mailbox",
    entityId: box.id,
    detail: { label: box.label, was: box.status, pause_reason: box.pause_reason, status: after.status },
  });
  return { ok: true, data: { status: after.status } };
}
