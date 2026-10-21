-- 006: lead counts per status in one query (the Queue tabs), instead of one query per status.
-- security invoker: runs with the caller's permissions, so RLS applies exactly as for a
-- normal select. A rep counts only their own leads; the admin counts the whole org.
create function public.lead_status_counts()
returns table (status public.lead_status, total bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.status, count(*) from public.leads l group by l.status;
$$;

revoke all on function public.lead_status_counts() from public, anon;
grant execute on function public.lead_status_counts() to authenticated;
