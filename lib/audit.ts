// Every user action writes an audit_log row (AGENTS.md). RLS only lets a user write
// entries as themselves, in their own org.
import "server-only";
import type { Json } from "@/lib/database.types";
import type { Profile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuditEntry = {
  action: string;
  entityType?: string;
  entityId?: string;
  detail?: Json;
};

export async function logUserAction(profile: Profile, entry: AuditEntry): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("audit_log").insert({
    org_id: profile.orgId,
    actor_type: "user",
    actor_id: profile.id,
    action: entry.action,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    detail: entry.detail ?? {},
  });
  if (error) throw new Error(`Writing the audit log failed: ${error.message}`);
}
