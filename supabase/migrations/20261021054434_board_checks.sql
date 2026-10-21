-- 004: which job-board sites each company has been checked on, and when.
--
-- Ashby refuses requests from GitHub's runners (403), so scheduled runs check Greenhouse and
-- Lever only and Ashby is checked during local runs. A company is fully probed once every
-- site is checked (ats_probed_at) or a board is found (ats_type).
-- Shape: {"greenhouse": "<timestamp>", "lever": "<timestamp>", "ashby": "<timestamp>"}

alter table public.companies
  add column ats_checked jsonb not null default '{}';

-- Backfill from probes done before this column existed (all of them checked every site).
update public.companies
set ats_checked = jsonb_build_object(
  'greenhouse', ats_probed_at,
  'lever', ats_probed_at,
  'ashby', ats_probed_at
)
where ats_probed_at is not null and ats_type is null;

update public.companies
set ats_checked = jsonb_build_object(ats_type::text, ats_probed_at)
where ats_probed_at is not null and ats_type is not null;
