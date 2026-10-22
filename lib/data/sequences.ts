// Sequences for the Sequences page, the lead timeline and bounce recovery. Server only.
// Reads run as the signed-in user, so RLS applies: a rep sees only their own leads' sequences.
import "server-only";
import type { Json } from "@/lib/database.types";
import { stepLabel } from "@/lib/sequence-labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  RecoveryProposal,
  SequenceEvent,
  SequenceRow,
  SequenceTimeline,
  StepStatus,
  TimelineStep,
} from "@/lib/types";

type EventRow = { type: string; source: "resend" | "simulated"; created_at: string };
type StepRow = {
  id: string;
  step_key: string;
  status: StepStatus;
  scheduled_for: string;
  sent_at: string | null;
  subject: string | null;
  body: string | null;
  message_id: string | null;
  meta: Json;
  mailbox: { label: string } | null;
  events: EventRow[];
};

const toEvent = (e: EventRow): SequenceEvent => ({ type: e.type, source: e.source, at: e.created_at });
const byTime = (a: SequenceEvent, b: SequenceEvent) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0);

function metaOf(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toStep(row: StepRow): TimelineStep {
  const meta = metaOf(row.meta);
  const written = meta.written_by;
  return {
    id: row.id,
    key: row.step_key,
    label: stepLabel(row.step_key),
    status: row.status,
    scheduledFor: row.scheduled_for,
    sentAt: row.sent_at,
    subject: row.subject,
    body: row.body,
    mailbox: row.mailbox?.label ?? null,
    messageId: row.message_id,
    writtenBy: written === "approved" || written === "ai" || written === "template" ? written : null,
    writtenReason: typeof meta.reason === "string" && written === "template" ? meta.reason : null,
    branch:
      typeof meta.branch === "string"
        ? { chosen: meta.branch, reason: typeof meta.reason === "string" ? meta.reason : "", opens: Number(meta.opens ?? 0) }
        : null,
    events: (row.events ?? []).map(toEvent).sort(byTime),
  };
}

const STEP_COLUMNS =
  "id, step_key, status, scheduled_for, sent_at, subject, body, message_id, meta, mailbox:mailboxes(label), events:email_events(type, source, created_at)";

/** The lead's sequence with every step in send order, or null if it has none (or isn't visible). */
export async function getSequenceTimeline(leadId: string): Promise<SequenceTimeline | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sequences")
    .select(`id, status, approved_at, edited, approver:profiles(id, full_name), steps:sequence_steps(${STEP_COLUMNS})`)
    .eq("lead_id", leadId)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw new Error(`Loading the sequence failed: ${error.message}`);
  }
  if (!data) return null;
  const row = data as unknown as {
    id: string;
    status: SequenceTimeline["status"];
    approved_at: string | null;
    edited: boolean;
    approver: { id: string; full_name: string } | null;
    steps: StepRow[];
  };
  const steps = row.steps.map(toStep).sort((a, b) => (a.scheduledFor < b.scheduledFor ? -1 : a.scheduledFor > b.scheduledFor ? 1 : 0));
  return {
    sequenceId: row.id,
    status: row.status,
    approvedAt: row.approved_at,
    approvedBy: row.approver ? { id: row.approver.id, name: row.approver.full_name } : null,
    edited: row.edited,
    steps,
  };
}

/** Every sequence this user may see, most recently approved first. */
export async function listSequences(): Promise<SequenceRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sequences")
    .select(
      `id, lead_id, status, current_step, approved_at,
       lead:leads(id, company:companies(name, domain), assignee:profiles(id, full_name)),
       steps:sequence_steps(step_key, status, scheduled_for, events:email_events(type, source, created_at))`,
    )
    .order("approved_at", { ascending: false });
  if (error) throw new Error(`Loading sequences failed: ${error.message}`);
  type Row = {
    id: string;
    lead_id: string;
    status: SequenceRow["status"];
    current_step: string | null;
    approved_at: string | null;
    lead: { id: string; company: { name: string; domain: string } | null; assignee: { id: string; full_name: string } | null } | null;
    steps: { step_key: string; status: StepStatus; scheduled_for: string; events: EventRow[] }[];
  };
  return (data as unknown as Row[]).map((row) => {
    const pending = row.steps.filter((s) => s.status === "pending").sort((a, b) => (a.scheduled_for < b.scheduled_for ? -1 : 1));
    const events = row.steps.flatMap((s) => s.events ?? []).map(toEvent).sort(byTime);
    return {
      sequenceId: row.id,
      leadId: row.lead_id,
      company: { name: row.lead?.company?.name ?? "Unknown company", domain: row.lead?.company?.domain ?? "" },
      assignee: row.lead?.assignee ? { id: row.lead.assignee.id, name: row.lead.assignee.full_name } : null,
      status: row.status,
      currentStep: row.current_step ? stepLabel(row.current_step) : null,
      nextStep: row.status === "active" && pending[0] ? { label: stepLabel(pending[0].step_key), scheduledFor: pending[0].scheduled_for } : null,
      lastEvent: events.at(-1) ?? null,
      approvedAt: row.approved_at,
    };
  });
}

/** The lead's newest recovery proposal (pending or approved), or null. */
export async function getRecoveryProposal(leadId: string): Promise<RecoveryProposal | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("recovery_proposals")
    .select("id, original_address, proposed_address, bounce_code, reason, status, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw new Error(`Loading the recovery proposal failed: ${error.message}`);
  }
  if (!data) return null;
  return {
    id: data.id,
    originalAddress: data.original_address,
    proposedAddress: data.proposed_address,
    bounceCode: data.bounce_code,
    reason: data.reason,
    status: data.status === "approved" ? "approved" : "pending",
    createdAt: data.created_at,
  };
}
