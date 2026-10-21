-- 005: live updates for leads.
-- Adding the table to Supabase's realtime publication lets the web app subscribe to changes.
-- Realtime applies the same RLS policies to each subscriber, so a rep only hears about leads
-- assigned to them; the app then re-reads through the normal (RLS-checked) queries.
alter publication supabase_realtime add table public.leads;
