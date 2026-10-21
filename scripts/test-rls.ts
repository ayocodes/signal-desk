// npm run test:rls
// Signs in as the demo users through the public (anon) key, exactly like the browser does,
// and checks that row level security returns only what each role may see.
// Run after `npm run seed`. Exits with code 1 if any check fails.
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, env, signedInClient } from "./supabase-script-client";

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

async function main(): Promise<void> {
  // Logged out: the anon role has no table privileges at all.
  const anon = anonClient();
  const anonOrgs = await rowCount(anon, "organizations");
  check("anon cannot read organizations", anonOrgs === 0 || typeof anonOrgs === "string", `got ${anonOrgs}`);

  const rep = await signedInClient(env.demo.rep.email, env.demo.rep.password);
  const { data: repUser } = await rep.auth.getUser();
  const repId = repUser.user?.id;

  for (const table of ["mailboxes", "agent_runs", "audit_log"]) {
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

  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}  (${r.detail})`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed === 0 ? `\nAll ${results.length} RLS checks passed.` : `\n${failed} of ${results.length} RLS checks failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
