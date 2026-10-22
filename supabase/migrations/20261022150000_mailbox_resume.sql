-- Phase 6: an admin resumes a paused mailbox from Ops.
--
-- Rates were counted over the mailbox's whole history, so a resumed mailbox would be paused
-- again by the next health check. A resume now starts a fresh measurement window:
-- rates_since is set to the resume time and refresh_mailbox_health counts only sends after it.

alter table public.mailboxes
  add column rates_since timestamptz;

create or replace function public.refresh_mailbox_health(
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
  v_since timestamptz;
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
  v_since := coalesce(v_box.rates_since, '-infinity'::timestamptz);

  select count(*) into v_sent
  from public.sequence_steps
  where mailbox_id = p_mailbox and sent_at is not null and sent_at >= v_since;
  select count(distinct e.step_id) filter (where e.type = 'bounced'),
         count(distinct e.step_id) filter (where e.type = 'complained')
    into v_bounced, v_complained
  from public.email_events e
  join public.sequence_steps st on st.id = e.step_id
  where st.mailbox_id = p_mailbox and st.sent_at >= v_since;

  v_bounce_rate := case when v_sent > 0 then round(100.0 * v_bounced / v_sent, 2) else 0 end;
  v_complaint_rate := case when v_sent > 0 then round(100.0 * v_complained / v_sent, 2) else 0 end;

  update public.mailboxes set bounce_rate = v_bounce_rate, complaint_rate = v_complaint_rate where id = p_mailbox;

  if v_box.status in ('paused', 'held') then
    return;  -- a person resumes a paused or held mailbox (Ops)
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
