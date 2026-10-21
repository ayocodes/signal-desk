-- 008: per-org agent rules, versioned.
-- Each save adds a version; the newest is current. A revert copies an old version in as a
-- new one, so history never changes. Members read their org's rules; only admins save,
-- through save_agent_config(), which checks the role in the database (layer 2 of the
-- server-side check in the route).

create table public.agent_configs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  version integer not null check (version >= 1),
  -- The rules document (agent/rules.py, lib/rules.ts), validated by the route before saving.
  rules jsonb not null,
  -- Readable change lines, e.g. ["Threshold 50 → 55"].
  change_summary jsonb not null default '[]',
  -- Null for the seeded version 1.
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, version)
);
create index agent_configs_created_by_idx on public.agent_configs (created_by);

alter table public.agent_configs enable row level security;

create policy "members read their org's rules"
on public.agent_configs for select to authenticated
using (org_id = (select private.current_org_id()));

-- No insert, update or delete policies: versions are only added by save_agent_config().
revoke insert, update, delete on public.agent_configs from authenticated;

-- The rules version that last scored each lead (null: scored before Phase 4.5).
alter table public.leads add column config_version integer;

-- Saves the next version for the caller's org. Admins only. The lock makes concurrent saves
-- take turns, so two can't get the same version number. Returns the new version.
create function public.save_agent_config(p_rules jsonb, p_summary jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_version integer;
  v_id uuid;
begin
  select * into v_profile from public.profiles where id = (select auth.uid());
  if not found or v_profile.role <> 'admin' then
    raise exception 'Only admins can change the agent rules' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rules) <> 'object' or jsonb_typeof(p_summary) <> 'array' then
    raise exception 'Rules must be an object and the summary a list' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.agent_configs ' || v_profile.org_id::text));
  select coalesce(max(version), 0) + 1 into v_version from public.agent_configs where org_id = v_profile.org_id;

  insert into public.agent_configs (org_id, version, rules, change_summary, created_by)
  values (v_profile.org_id, v_version, p_rules, p_summary, v_profile.id)
  returning id into v_id;

  insert into public.audit_log (org_id, actor_type, actor_id, action, entity_type, entity_id, detail)
  values (
    v_profile.org_id, 'user', v_profile.id, 'agent_config.saved', 'agent_config', v_id,
    jsonb_build_object('version', v_version, 'summary', p_summary)
  );
  return v_version;
end;
$$;

-- How many leads a threshold would put in the queue, from stored scores: score at or above
-- the threshold and at least one signal that isn't weak (the agent's ready rule), against
-- how many are ready now. Runs as the caller, so RLS applies.
create function public.threshold_preview(p_threshold integer, p_weak text[])
returns table (would_be_ready bigint, ready_now bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*) filter (
      where l.score >= p_threshold
        and exists (
          select 1 from public.signals s
          where s.company_id = l.company_id and not (s.type::text = any (p_weak))
        )
    ),
    count(*) filter (where l.status = 'ready')
  from public.leads l
  where l.status in ('ready', 'filtered');
$$;

revoke all on function public.save_agent_config(jsonb, jsonb) from public, anon;
revoke all on function public.threshold_preview(integer, text[]) from public, anon;
grant execute on function public.save_agent_config(jsonb, jsonb) to authenticated;
grant execute on function public.threshold_preview(integer, text[]) to authenticated;
