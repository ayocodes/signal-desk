-- 010: sending, webhooks, deliverability.
-- Steps keep what was actually sent and how the step was decided; mailboxes keep their
-- rates and a daily-reset date; bounces get a recovery proposal a person must approve.

alter type public.step_status add value if not exists 'done';  -- check steps (no email)

alter table public.sequence_steps
  add column subject text,
  add column body text,
  add column sent_at timestamptz,
  -- How the step was decided or written: {"branch": "opened_twice", "reason": "...",
  -- "written_by": "ai" | "template" | "approved"}.
  add column meta jsonb not null default '{}';

alter table public.mailboxes
  -- The UTC day sent_today counts; the agent resets the counter when the day changes.
  add column sent_today_date date,
  add column bounce_rate numeric(5, 2) not null default 0,
  add column complaint_rate numeric(5, 2) not null default 0,
  add column paused_at timestamptz;

-- A bounced email's proposed fix. Nothing resends until a person approves it.
create table public.recovery_proposals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  sequence_id uuid not null references public.sequences (id) on delete cascade,
  step_id uuid not null references public.sequence_steps (id) on delete cascade,
  original_address text not null,
  proposed_address text not null,
  bounce_code text,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  -- One proposal per bounced step, so webhook retries can't create two.
  unique (step_id)
);
create index recovery_proposals_org_id_idx on public.recovery_proposals (org_id);
create index recovery_proposals_lead_id_idx on public.recovery_proposals (lead_id);
create index recovery_proposals_sequence_id_idx on public.recovery_proposals (sequence_id);
create index recovery_proposals_approved_by_idx on public.recovery_proposals (approved_by);
create index sequence_steps_message_id_idx on public.sequence_steps (message_id);

alter table public.recovery_proposals enable row level security;

create policy "visible through a readable lead"
on public.recovery_proposals for select to authenticated
using (
  org_id = (select private.current_org_id())
  and exists (select 1 from public.leads l where l.id = recovery_proposals.lead_id)
);

-- Recomputes one mailbox's bounce and complaint rates from its sent steps and their events,
-- then its status: paused (sticky until a person resumes it) when a rate crosses its limit
-- after enough sends, near_cap at 80% of the daily cap, otherwise healthy. Used by both the
-- webhook handler and the agent, so the rules live in one place; limits come from
-- shared/guardrails.json through the callers.
create function public.refresh_mailbox_health(
  p_mailbox uuid,
  p_bounce_pct numeric,
  p_complaint_pct numeric,
  p_min_sends integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_box public.mailboxes;
  v_sent integer;
  v_bounced integer;
  v_complained integer;
  v_bounce_rate numeric(5, 2);
  v_complaint_rate numeric(5, 2);
begin
  select * into v_box from public.mailboxes where id = p_mailbox for update;
  if not found then
    return;
  end if;

  select count(*) into v_sent from public.sequence_steps where mailbox_id = p_mailbox and sent_at is not null;
  select count(distinct e.step_id) filter (where e.type = 'bounced'),
         count(distinct e.step_id) filter (where e.type = 'complained')
    into v_bounced, v_complained
  from public.email_events e
  join public.sequence_steps st on st.id = e.step_id
  where st.mailbox_id = p_mailbox;

  v_bounce_rate := case when v_sent > 0 then round(100.0 * v_bounced / v_sent, 2) else 0 end;
  v_complaint_rate := case when v_sent > 0 then round(100.0 * v_complained / v_sent, 2) else 0 end;

  update public.mailboxes set bounce_rate = v_bounce_rate, complaint_rate = v_complaint_rate where id = p_mailbox;

  if v_box.status in ('paused', 'held') then
    return;  -- a person resumes a paused or held mailbox (Ops, Phase 6)
  end if;

  if v_sent >= p_min_sends and v_bounce_rate >= p_bounce_pct then
    update public.mailboxes
    set status = 'paused', paused_at = now(),
        pause_reason = format('Bounce rate %s%% (limit %s%%) after %s sends', v_bounce_rate, p_bounce_pct, v_sent)
    where id = p_mailbox;
  elsif v_sent >= p_min_sends and v_complaint_rate >= p_complaint_pct then
    update public.mailboxes
    set status = 'paused', paused_at = now(),
        pause_reason = format('Complaint rate %s%% (limit %s%%) after %s sends', v_complaint_rate, p_complaint_pct, v_sent)
    where id = p_mailbox;
  elsif v_box.sent_today >= ceil(v_box.daily_cap * 0.8) then
    update public.mailboxes set status = 'near_cap' where id = p_mailbox;
  else
    update public.mailboxes set status = 'healthy' where id = p_mailbox;
  end if;
end;
$$;

revoke all on function public.refresh_mailbox_health(uuid, numeric, numeric, integer) from public, anon, authenticated;
grant execute on function public.refresh_mailbox_health(uuid, numeric, numeric, integer) to service_role;
