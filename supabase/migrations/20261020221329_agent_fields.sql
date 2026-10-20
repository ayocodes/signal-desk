-- 003: fields the agent needs on companies (Phase 2).
-- New columns inherit the table's RLS policies; nothing else changes.

-- Full match: every ICP rule passes. Partial: a near miss on team size or batch age
-- (see shared/scoring.json, icpRules and partialRules).
create type public.icp_tier as enum ('full', 'partial');

alter table public.companies
  add column icp_tier public.icp_tier,
  add column yc_slug text,
  -- From the YC directory; used to probe hiring companies' job boards first.
  add column yc_is_hiring boolean not null default false,
  -- When the job-board probe ran. Null means "not probed yet"; ats_type null with a
  -- timestamp means "probed, no public board found".
  add column ats_probed_at timestamptz;

-- The probe queue: unprobed companies per org.
create index companies_unprobed_idx on public.companies (org_id) where ats_probed_at is null;
