-- 007: drafting and approval.
-- Drafts keep the exact prompt and an agent trace. Every LLM call is counted per UTC day
-- against LLM_DAILY_BUDGET (one Gemini key, so one budget for every org). Approval goes
-- through one function that re-checks access in the database and writes everything in a
-- single transaction.

-- Drafts ----------------------------------------------------------------------------------

create type public.llm_call_source as enum ('agent', 'regenerate', 'unconstrained');

create table public.llm_calls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  source public.llm_call_source not null,
  -- The user who asked (Regenerate, Unconstrained), or null for the agent.
  actor_id uuid references public.profiles (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  model text,
  tokens_in integer,
  tokens_out integer,
  -- Null while the call is in flight; true or false once it returns.
  ok boolean,
  error text
);
create index llm_calls_created_at_idx on public.llm_calls (created_at);
create index llm_calls_org_id_idx on public.llm_calls (org_id);
create index llm_calls_actor_created_idx on public.llm_calls (actor_id, created_at);
create index llm_calls_lead_id_idx on public.llm_calls (lead_id);

alter table public.drafts
  add column prompt text,
  add column trace jsonb not null default '{}',
  -- Null for agent drafts; the user for Regenerate and Unconstrained.
  add column created_by uuid references public.profiles (id) on delete set null,
  add column llm_call_id uuid references public.llm_calls (id) on delete set null;
create index drafts_created_by_idx on public.drafts (created_by);
create index drafts_llm_call_id_idx on public.drafts (llm_call_id);
create index drafts_lead_angle_created_idx on public.drafts (lead_id, angle, created_at desc);

alter table public.llm_calls enable row level security;

create policy "admins read llm calls"
on public.llm_calls for select to authenticated
using (org_id = (select private.current_org_id()) and (select private.is_admin()));

-- LLM budget -----------------------------------------------------------------------------

create function private.utc_day_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select date_trunc('day', now() at time zone 'utc') at time zone 'utc';
$$;

-- Reserves one LLM call, or says why not: 'budget' (today's calls reached p_daily_limit) or
-- 'rate_limited' (this user made p_actor_hourly_limit calls in the last hour). The lock makes
-- callers take turns, so two of them can't both take the last call of the day.
-- The agent passes its share of the budget as p_daily_limit; the web app passes the whole budget.
create function public.reserve_llm_call(
  p_org uuid,
  p_source public.llm_call_source,
  p_actor uuid,
  p_lead uuid,
  p_daily_limit integer,
  p_actor_hourly_limit integer default null
)
returns table (call_id uuid, refusal text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('public.llm_calls budget'));

  if (select count(*) from public.llm_calls where created_at >= private.utc_day_start()) >= p_daily_limit then
    return query select null::uuid, 'budget'::text;
    return;
  end if;

  if p_actor is not null and p_actor_hourly_limit is not null and (
    select count(*) from public.llm_calls
    where actor_id = p_actor and created_at > now() - interval '1 hour'
  ) >= p_actor_hourly_limit then
    return query select null::uuid, 'rate_limited'::text;
    return;
  end if;

  insert into public.llm_calls (org_id, source, actor_id, lead_id)
  values (p_org, p_source, p_actor, p_lead)
  returning id into v_id;
  return query select v_id, null::text;
end;
$$;

-- Calls used today, for any member's UI ("Today's AI budget is used up"). Counts every org,
-- because the budget belongs to the one API key.
create function public.llm_calls_today()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.llm_calls where created_at >= private.utc_day_start();
$$;

-- Approval -------------------------------------------------------------------------------

-- Called by the approve route (service role) after it has read the lead through the user's
-- own session and re-run the guardrails. Checks access again here, then enrolls the lead in
-- one transaction. Errors use distinct codes the route maps to HTTP statuses:
--   42501 not allowed, P0002 not found, 23505 already enrolled, P0001 not ready, 22023 bad draft.
create function public.approve_lead(
  p_actor uuid,
  p_lead uuid,
  p_draft uuid,
  p_subject text,
  p_body text,
  p_steps jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_lead public.leads;
  v_draft public.drafts;
  v_signal uuid;
  v_sequence uuid;
  v_edited boolean;
begin
  select * into v_profile from public.profiles where id = p_actor;
  if not found then
    raise exception 'Unknown user' using errcode = '42501';
  end if;

  select * into v_lead from public.leads where id = p_lead for update;
  if not found or v_lead.org_id <> v_profile.org_id then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;
  if v_profile.role <> 'admin' and v_lead.assigned_to is distinct from p_actor then
    raise exception 'This lead is assigned to someone else' using errcode = '42501';
  end if;
  if exists (select 1 from public.sequences where lead_id = p_lead) then
    raise exception 'Lead is already enrolled' using errcode = '23505';
  end if;
  if v_lead.status <> 'ready' then
    raise exception 'Lead is %, not ready', v_lead.status using errcode = 'P0001';
  end if;

  select * into v_draft from public.drafts where id = p_draft and lead_id = p_lead;
  if not found then
    raise exception 'Draft does not belong to this lead' using errcode = '22023';
  end if;
  if v_draft.angle = 'raw' then
    raise exception 'Unconstrained drafts cannot be approved' using errcode = '22023';
  end if;
  if jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) = 0 then
    raise exception 'No sequence steps given' using errcode = '22023';
  end if;

  -- The opening email is built on the lead's strongest signal (hiring, launch, funding; newest first).
  select s.id into v_signal
  from public.signals s
  where s.company_id = v_lead.company_id
  order by case s.type when 'hiring' then 0 when 'launch' then 1 else 2 end,
           coalesce(s.occurred_at, s.detected_at) desc
  limit 1;

  v_edited := p_subject <> v_draft.subject or p_body <> v_draft.body;

  insert into public.sequences (
    org_id, lead_id, draft_id, approved_by, approved_at, edited, final_subject, final_body, status, current_step
  )
  values (
    v_lead.org_id, p_lead, p_draft, p_actor, now(), v_edited, p_subject, p_body, 'active', p_steps -> 0 ->> 'key'
  )
  returning id into v_sequence;

  insert into public.sequence_steps (org_id, sequence_id, step_key, scheduled_for, signal_id, idempotency_key)
  select v_lead.org_id,
         v_sequence,
         step ->> 'key',
         now() + make_interval(days => (step ->> 'dayOffset')::integer),
         case when position = 1 then v_signal end,
         v_sequence::text || ':' || (step ->> 'key')
  from jsonb_array_elements(p_steps) with ordinality as t (step, position);

  update public.leads set status = 'enrolled' where id = p_lead;

  insert into public.audit_log (org_id, actor_type, actor_id, action, entity_type, entity_id, detail)
  values (
    v_lead.org_id, 'user', p_actor, 'lead.approved', 'lead', p_lead,
    jsonb_build_object('sequence_id', v_sequence, 'draft_id', p_draft, 'angle', v_draft.angle, 'edited', v_edited)
  );

  return v_sequence;
end;
$$;

-- Only the server (service role) may reserve calls or approve; members may read today's count.
revoke all on function private.utc_day_start() from public;
revoke all on function public.reserve_llm_call(uuid, public.llm_call_source, uuid, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.approve_lead(uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.llm_calls_today() from public, anon;
grant execute on function public.reserve_llm_call(uuid, public.llm_call_source, uuid, uuid, integer, integer) to service_role;
grant execute on function public.approve_lead(uuid, uuid, uuid, text, text, jsonb) to service_role;
grant execute on function public.llm_calls_today() to authenticated;
