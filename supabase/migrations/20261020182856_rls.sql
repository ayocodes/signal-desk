-- 002: row level security, per the roles table in docs/ARCHITECTURE.md.
--
-- Layer 2 of "security in two layers" (layer 1 is the server-side role checks).
-- Every table has RLS on. A user only ever sees their own organization.
--   admin: everything in the org.
--   rep:   only leads assigned to them, and the rows hanging off those leads.
-- The agent and the seed script use the service-role key, which bypasses RLS.
-- Write policies for approve, regenerate, etc. arrive with those features.

-- Helper functions ----------------------------------------------------------------------
-- They live in a schema the API doesn't expose, so they can't be called over HTTP.
-- security definer lets them read profiles without re-entering the profiles policy.

create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select org_id from public.profiles where id = (select auth.uid());
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = (select auth.uid())),
    false
  );
$$;

revoke all on all functions in schema private from public;
grant execute on function private.current_org_id() to authenticated;
grant execute on function private.is_admin() to authenticated;

-- Logged-out visitors get nothing, even before policies are considered.
revoke all on all tables in schema public from anon;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- Enable RLS everywhere -----------------------------------------------------------------

alter table public.organizations  enable row level security;
alter table public.profiles       enable row level security;
alter table public.companies      enable row level security;
alter table public.contacts       enable row level security;
alter table public.signals        enable row level security;
alter table public.leads          enable row level security;
alter table public.drafts         enable row level security;
alter table public.mailboxes      enable row level security;
alter table public.sequences      enable row level security;
alter table public.sequence_steps enable row level security;
alter table public.email_events   enable row level security;
alter table public.agent_runs     enable row level security;
alter table public.audit_log      enable row level security;

-- Policies wrap function calls in (select ...) so Postgres runs them once per query,
-- not once per row.

-- Organization and profiles -------------------------------------------------------------

create policy "members read their organization"
on public.organizations for select to authenticated
using (id = (select private.current_org_id()));

create policy "members read profiles in their org"
on public.profiles for select to authenticated
using (org_id = (select private.current_org_id()));

-- Users may edit only their own theme and display name. Column privileges stop anyone
-- from changing their own role or org, whatever the policy allows.
revoke update on public.profiles from authenticated;
grant update (theme, full_name) on public.profiles to authenticated;

create policy "users update their own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Leads: the root of what a rep can see ------------------------------------------------

create policy "admins read all leads, reps read their own"
on public.leads for select to authenticated
using (
  org_id = (select private.current_org_id())
  and ((select private.is_admin()) or assigned_to = (select auth.uid()))
);

-- Rows that hang off a lead. The exists() subqueries run under the leads policy above,
-- so a rep automatically sees only rows belonging to their own leads.

create policy "visible through a readable lead"
on public.companies for select to authenticated
using (
  org_id = (select private.current_org_id())
  and ((select private.is_admin()) or exists (
    select 1 from public.leads l where l.company_id = companies.id
  ))
);

create policy "visible through a readable lead"
on public.contacts for select to authenticated
using (
  org_id = (select private.current_org_id())
  and ((select private.is_admin()) or exists (
    select 1 from public.leads l where l.company_id = contacts.company_id
  ))
);

create policy "visible through a readable lead"
on public.signals for select to authenticated
using (
  org_id = (select private.current_org_id())
  and ((select private.is_admin()) or exists (
    select 1 from public.leads l where l.company_id = signals.company_id
  ))
);

create policy "visible through a readable lead"
on public.drafts for select to authenticated
using (
  org_id = (select private.current_org_id())
  and exists (select 1 from public.leads l where l.id = drafts.lead_id)
);

create policy "visible through a readable lead"
on public.sequences for select to authenticated
using (
  org_id = (select private.current_org_id())
  and exists (select 1 from public.leads l where l.id = sequences.lead_id)
);

create policy "visible through a readable sequence"
on public.sequence_steps for select to authenticated
using (
  org_id = (select private.current_org_id())
  and exists (select 1 from public.sequences s where s.id = sequence_steps.sequence_id)
);

create policy "visible through a readable step"
on public.email_events for select to authenticated
using (
  org_id = (select private.current_org_id())
  and ((select private.is_admin()) or exists (
    select 1 from public.sequence_steps st where st.id = email_events.step_id
  ))
);

-- Admin-only tables (Ops) ----------------------------------------------------------------

create policy "admins read mailboxes"
on public.mailboxes for select to authenticated
using (org_id = (select private.current_org_id()) and (select private.is_admin()));

create policy "admins read agent runs"
on public.agent_runs for select to authenticated
using (org_id = (select private.current_org_id()) and (select private.is_admin()));

create policy "admins read the audit log"
on public.audit_log for select to authenticated
using (org_id = (select private.current_org_id()) and (select private.is_admin()));

-- Any member may record their own actions, and only as themselves.
create policy "users write their own audit entries"
on public.audit_log for insert to authenticated
with check (
  org_id = (select private.current_org_id())
  and actor_type = 'user'
  and actor_id = (select auth.uid())
);
