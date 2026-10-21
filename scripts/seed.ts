// npm run seed
// Creates the demo organization, the admin and two rep users, their profiles, and 4 mailboxes,
// then splits the agent's ready/filtered leads evenly between the reps.
// Safe to run again: everything is an upsert, passwords are re-synced, and the split is
// deterministic, so a second run changes nothing.
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import guardrails from "../shared/guardrails.json" with { type: "json" };
import { env, serviceClient } from "./supabase-script-client";

// Fixed id so re-runs update the same organization instead of creating another.
const DEMO_ORG_ID = "00000000-0000-4000-8000-000000000001";

const MAILBOX_LABELS = ["outbound-1", "outbound-2", "outbound-3", "outbound-4"];

// A second rep so the demo can show RLS: each rep sees only their own leads. Nobody logs in
// as this user; the password is random on every seed run.
const SECOND_REP_EMAIL = "rep2@example.com";

// Only these statuses are (re)assigned; enrolled and later leads keep their rep.
const REASSIGNABLE = ["ready", "filtered"];

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

type LeadRow = { company_id: string; assigned_to: string | null; company: { name: string } | null };

async function reassignableLeads(db: SupabaseClient): Promise<LeadRow[]> {
  const rows: LeadRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("leads")
      .select("company_id, assigned_to, company:companies(name)")
      .eq("org_id", DEMO_ORG_ID)
      .in("status", REASSIGNABLE)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`Reading leads failed: ${error.message}`);
    rows.push(...(data as unknown as LeadRow[]));
    if (data.length < 1000) return rows;
  }
}

// Alternates leads between reps in company-name order: the same input always gives the same
// split, and only leads whose rep changes are written.
async function splitLeads(db: SupabaseClient, reps: string[]): Promise<number> {
  const leads = (await reassignableLeads(db)).sort((a, b) =>
    (a.company?.name ?? "").localeCompare(b.company?.name ?? "") || a.company_id.localeCompare(b.company_id),
  );
  const changes = leads
    .map((lead, index) => ({ lead, rep: reps[index % reps.length] }))
    .filter(({ lead, rep }) => lead.assigned_to !== rep)
    .map(({ lead, rep }) => ({ org_id: DEMO_ORG_ID, company_id: lead.company_id, assigned_to: rep }));

  for (let start = 0; start < changes.length; start += 500) {
    const { error } = await db
      .from("leads")
      .upsert(changes.slice(start, start + 500), { onConflict: "org_id,company_id" });
    if (error) throw new Error(`Splitting leads failed: ${error.message}`);
  }
  return changes.length;
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
  const rep2Id = await ensureUser(db, SECOND_REP_EMAIL, randomBytes(24).toString("base64url"));

  // theme is left out so a re-seed keeps each user's chosen theme.
  const { error: profileError } = await db.from("profiles").upsert([
    { id: adminId, org_id: DEMO_ORG_ID, full_name: "Demo Admin", role: "admin" },
    { id: repId, org_id: DEMO_ORG_ID, full_name: "Demo Rep", role: "rep" },
    { id: rep2Id, org_id: DEMO_ORG_ID, full_name: "Demo Rep 2", role: "rep" },
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

  const moved = await splitLeads(db, [repId, rep2Id]);
  console.log(`Lead split: ${moved} lead(s) reassigned.`);

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
