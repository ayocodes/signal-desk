// npm run test:rls
// Signs in as the demo users through the public (anon) key, exactly like the browser does,
// and checks that row level security returns only what each role may see.
// Run after `npm run seed`. Exits with code 1 if any check fails.
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, env, serviceClient, signedInClient } from "./supabase-script-client";

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];

function check(name: string, ok: boolean, detail: string): void {
  results.push({ name, ok, detail });
}

async function rowCount(client: SupabaseClient, table: string): Promise<number | string> {
  const { data, error } = await client.from(table).select("id");
  if (error) return `error ${error.code}`;
  return data.length;
}

async function count(client: SupabaseClient, table: string, column?: string, value?: string): Promise<number> {
  let query = client.from(table).select("id", { count: "exact", head: true });
  if (column && value) query = query.eq(column, value);
  const { count: n, error } = await query;
  if (error) throw new Error(`Counting ${table} failed: ${error.message}`);
  return n ?? 0;
}

// Waits for Realtime events on leads as the given user, while `touch` changes some leads.
// Stops early once `expected` has been heard; otherwise gives events up to 20s to arrive.
async function heardLeadIds(client: SupabaseClient, expected: string, touch: () => Promise<void>): Promise<Set<string>> {
  const heard = new Set<string>();
  await client.realtime.setAuth();
  const channel = client
    .channel(`rls-check-${Date.now()}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads" }, (payload) => {
      heard.add(String((payload.new as { id?: string }).id));
    });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Realtime didn't connect within 20s")), 20_000);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  // Realtime needs a moment after SUBSCRIBED before it matches changes for a new subscriber.
  await new Promise((resolve) => setTimeout(resolve, 3_000));
  await touch();
  for (let waited = 0; waited < 20_000 && !heard.has(expected); waited += 500) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  await new Promise((resolve) => setTimeout(resolve, 3_000)); // room for an event that shouldn't come
  await client.removeChannel(channel);
  return heard;
}

// With two reps, "a rep sees only their leads" is no longer trivially true.
async function checkLeadsPerRep(rep: SupabaseClient, admin: SupabaseClient, repId: string | undefined): Promise<void> {
  const service = serviceClient();
  const allLeads = await count(service, "leads");
  const repLeads = await count(service, "leads", "assigned_to", repId);
  const repSees = await count(rep, "leads");
  check("rep reads exactly the leads assigned to them", repSees === repLeads && repSees > 0 && repSees < allLeads, `${repSees} of ${allLeads}`);
  const adminSees = await count(admin, "leads");
  check("admin reads every lead in the org", adminSees === allLeads, `${adminSees} of ${allLeads}`);

  // A company whose lead belongs to the other rep and has signals.
  const { data: otherLeads, error } = await service
    .from("leads")
    .select("id, company_id")
    .neq("assigned_to", repId ?? "")
    .not("assigned_to", "is", null)
    .limit(200);
  if (error) throw new Error(`Finding the other rep's leads failed: ${error.message}`);
  let otherCompany: string | undefined;
  for (const lead of otherLeads) {
    if ((await count(service, "signals", "company_id", lead.company_id)) > 0) {
      otherCompany = lead.company_id;
      break;
    }
  }
  if (otherCompany) {
    const repSignals = await count(rep, "signals", "company_id", otherCompany);
    const adminSignals = await count(admin, "signals", "company_id", otherCompany);
    check("rep can't read signals of the other rep's leads", repSignals === 0 && adminSignals > 0, `rep ${repSignals}, admin ${adminSignals}`);
    const repContacts = await count(rep, "contacts", "company_id", otherCompany);
    check("rep can't read contacts of the other rep's leads", repContacts === 0, `rep ${repContacts}`);
  } else {
    check("rep can't read signals of the other rep's leads", false, "no other-rep lead with signals to test");
  }

  // Realtime applies RLS too: touch one lead of each rep and see what the rep hears.
  const { data: own } = await service.from("leads").select("id").eq("assigned_to", repId ?? "").limit(1).single();
  const other = otherLeads[0];
  const heard = await heardLeadIds(rep, own?.id ?? "", async () => {
    for (const id of [own?.id, other?.id]) {
      // A no-op write (score = score) still emits an UPDATE; the agent rewrites scores anyway.
      const { data } = await service.from("leads").select("score").eq("id", id ?? "").single();
      await service.from("leads").update({ score: data?.score ?? 0 }).eq("id", id ?? "");
    }
  });
  check(
    "Realtime tells a rep about their own leads only",
    heard.has(own?.id ?? "") && !heard.has(other?.id ?? ""),
    `heard own: ${heard.has(own?.id ?? "")}, heard other rep's: ${heard.has(other?.id ?? "")}`,
  );
}

// Approving and reserving LLM calls must go through the server routes, which re-run the
// guardrails and the budget rules; a member calling the database functions directly is refused.
async function checkServerOnlyFunctions(rep: SupabaseClient, repId: string | undefined): Promise<void> {
  const zero = "00000000-0000-0000-0000-000000000000";
  const { error: approveError } = await rep.rpc("approve_lead", {
    p_actor: repId ?? zero, p_lead: zero, p_draft: zero, p_subject: "x", p_body: "x", p_steps: [],
  });
  check("rep can't call approve_lead directly", approveError?.code === "42501", approveError ? `blocked (${approveError.code})` : "call succeeded");
  const { error: reserveError } = await rep.rpc("reserve_llm_call", {
    p_org: zero, p_source: "regenerate", p_actor: repId ?? zero, p_lead: zero, p_daily_limit: 1000,
  });
  check("rep can't reserve LLM calls directly", reserveError?.code === "42501", reserveError ? `blocked (${reserveError.code})` : "call succeeded");
  const { data: used, error: usedError } = await rep.rpc("llm_calls_today");
  check("rep can read today's LLM call count", !usedError && typeof used === "number", usedError ? `error ${usedError.code}` : `${used} today`);
}

// Every member reads the org's agent rules; only admins can save a version.
async function checkAgentRules(rep: SupabaseClient, admin: SupabaseClient): Promise<void> {
  const repReads = await rowCount(rep, "agent_configs");
  check("rep reads the org's agent rules", typeof repReads === "number" && repReads >= 1, `got ${repReads}`);
  const { error: repSave } = await rep.rpc("save_agent_config", { p_rules: {}, p_summary: [] });
  check("rep can't save agent rules", repSave?.code === "42501", repSave ? `blocked (${repSave.code})` : "save succeeded");
  const { error: repInsert } = await rep.from("agent_configs").insert({ org_id: "00000000-0000-4000-8000-000000000001", version: 999, rules: {} });
  check("nobody inserts agent rules directly", repInsert !== null, repInsert ? `blocked (${repInsert.code})` : "insert succeeded");
  // A malformed summary is rejected after the role check, so this proves the admin passes it
  // without writing a real version.
  const { error: adminSave } = await admin.rpc("save_agent_config", { p_rules: {}, p_summary: {} });
  check("admin passes the role check for saving rules", adminSave?.code === "22023", adminSave ? `stopped at validation (${adminSave.code})` : "saved");
}

async function main(): Promise<void> {
  // Logged out: the anon role has no table privileges at all.
  const anon = anonClient();
  const anonOrgs = await rowCount(anon, "organizations");
  check("anon cannot read organizations", anonOrgs === 0 || typeof anonOrgs === "string", `got ${anonOrgs}`);

  const rep = await signedInClient(env.demo.rep.email, env.demo.rep.password);
  const { data: repUser } = await rep.auth.getUser();
  const repId = repUser.user?.id;

  for (const table of ["mailboxes", "agent_runs", "audit_log", "llm_calls"]) {
    const n = await rowCount(rep, table);
    check(`rep reads 0 rows from ${table}`, n === 0, `got ${n}`);
  }
  check("rep reads their organization", (await rowCount(rep, "organizations")) === 1, "expected 1");

  const { data: repLeads, error: repLeadsError } = await rep.from("leads").select("assigned_to");
  check(
    "rep reads only leads assigned to them",
    !repLeadsError && repLeads.every((lead) => lead.assigned_to === repId),
    repLeadsError ? `error ${repLeadsError.code}` : `${repLeads.length} leads`,
  );

  const { error: promoteError } = await rep.from("profiles").update({ role: "admin" }).eq("id", repId);
  check("rep cannot change their own role", promoteError !== null, promoteError ? `blocked (${promoteError.code})` : "update succeeded");

  // Writes back the current theme, so the check doesn't change the rep's choice.
  const { data: repProfile } = await rep.from("profiles").select("theme").eq("id", repId).single();
  const { data: themed, error: themeError } = await rep
    .from("profiles")
    .update({ theme: repProfile?.theme ?? "system" })
    .eq("id", repId)
    .select("id");
  check("rep can change their own theme", !themeError && themed?.length === 1, themeError ? `error ${themeError.code}` : "ok");

  const { error: forgeError } = await rep.from("audit_log").insert({
    org_id: (await rep.from("profiles").select("org_id").eq("id", repId).single()).data?.org_id,
    actor_type: "agent",
    action: "forged",
  });
  check("rep cannot write audit entries as the agent", forgeError !== null, forgeError ? `blocked (${forgeError.code})` : "insert succeeded");

  const admin = await signedInClient(env.demo.admin.email, env.demo.admin.password);
  const adminMailboxes = await rowCount(admin, "mailboxes");
  check("admin reads 4 mailboxes", adminMailboxes === 4, `got ${adminMailboxes}`);
  const adminProfiles = await rowCount(admin, "profiles");
  check("admin reads all 3 profiles in the org", adminProfiles === 3, `got ${adminProfiles}`);

  await checkLeadsPerRep(rep, admin, repId);
  await checkServerOnlyFunctions(rep, repId);
  await checkAgentRules(rep, admin);

  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  (${r.detail})`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed === 0 ? `\nAll ${results.length} RLS checks passed.` : `\n${failed} of ${results.length} RLS checks failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
