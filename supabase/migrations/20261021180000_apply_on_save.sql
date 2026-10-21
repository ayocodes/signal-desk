-- 009: apply rules changes right away.
-- A saved change starts a re-score-only agent run (lib/rescore.ts); each run records the
-- rules version it scored with, so the editor can tell when a version has been applied.
-- A restore records which version it came from, so history can say so.

alter table public.agent_runs add column config_version integer;
alter table public.agent_configs add column restored_from integer;

drop function public.save_agent_config(jsonb, jsonb);

-- Same as in 008, plus p_restored_from (null for an ordinary save or a reset).
create function public.save_agent_config(p_rules jsonb, p_summary jsonb, p_restored_from integer default null)
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

  insert into public.agent_configs (org_id, version, rules, change_summary, created_by, restored_from)
  values (v_profile.org_id, v_version, p_rules, p_summary, v_profile.id, p_restored_from)
  returning id into v_id;

  insert into public.audit_log (org_id, actor_type, actor_id, action, entity_type, entity_id, detail)
  values (
    v_profile.org_id, 'user', v_profile.id, 'agent_config.saved', 'agent_config', v_id,
    jsonb_build_object('version', v_version, 'summary', p_summary, 'restored_from', p_restored_from)
  );
  return v_version;
end;
$$;

revoke all on function public.save_agent_config(jsonb, jsonb, integer) from public, anon;
grant execute on function public.save_agent_config(jsonb, jsonb, integer) to authenticated;
