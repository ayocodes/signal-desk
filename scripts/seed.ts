// npm run seed
// Creates the demo organization, the admin and rep users, their profiles, and 4 mailboxes.
// Safe to run again: everything is an upsert, and user passwords are re-synced from env.
import type { SupabaseClient } from "@supabase/supabase-js";
import guardrails from "../shared/guardrails.json" with { type: "json" };
import { env, serviceClient } from "./supabase-script-client";

// Fixed id so re-runs update the same organization instead of creating another.
const DEMO_ORG_ID = "00000000-0000-4000-8000-000000000001";

const MAILBOX_LABELS = ["outbound-1", "outbound-2", "outbound-3", "outbound-4"];

async function ensureUser(db: SupabaseClient, email: string, password: string): Promise<string> {
  const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`Listing users failed: ${error.message}`);

  const existing = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    const { error: updateError } = await db.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
    if (updateError) throw new Error(`Updating ${email} failed: ${updateError.message}`);
    return existing.id;
  }

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) throw new Error(`Creating ${email} failed: ${createError?.message}`);
  return created.user.id;
}

async function main(): Promise<void> {
  const db = serviceClient();

  const { error: orgError } = await db.from("organizations").upsert({
    id: DEMO_ORG_ID,
    name: "Demo workspace",
    icp_description:
      "Seed to Series A B2B software startups, roughly 5 to 60 people, founder-led or early sales team, likely to start or scale outbound.",
  });
  if (orgError) throw new Error(`Organization upsert failed: ${orgError.message}`);

  const adminId = await ensureUser(db, env.demo.admin.email, env.demo.admin.password);
  const repId = await ensureUser(db, env.demo.rep.email, env.demo.rep.password);

  // theme is left out so a re-seed keeps each user's chosen theme.
  const { error: profileError } = await db.from("profiles").upsert([
    { id: adminId, org_id: DEMO_ORG_ID, full_name: "Demo Admin", role: "admin" },
    { id: repId, org_id: DEMO_ORG_ID, full_name: "Demo Rep", role: "rep" },
  ]);
  if (profileError) throw new Error(`Profile upsert failed: ${profileError.message}`);

  const { error: mailboxError } = await db.from("mailboxes").upsert(
    MAILBOX_LABELS.map((label) => ({
      org_id: DEMO_ORG_ID,
      label,
      send_via: env.resend.from,
      daily_cap: guardrails.mailbox.dailyCap,
    })),
    { onConflict: "org_id,label" },
  );
  if (mailboxError) throw new Error(`Mailbox upsert failed: ${mailboxError.message}`);

  const counts = await Promise.all(
    ["organizations", "profiles", "mailboxes"].map(async (table) => {
      const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
      if (error) throw new Error(`Counting ${table} failed: ${error.message}`);
      return `${table}: ${count}`;
    }),
  );
  console.log(`Seeded the demo workspace (${counts.join(", ")}).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
