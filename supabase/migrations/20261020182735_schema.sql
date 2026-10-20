-- 001: schema. Every table from docs/ARCHITECTURE.md.
-- Business tables carry org_id (multi-tenant from day one). Unique constraints make the
-- agent idempotent: re-running it can never duplicate companies, signals, leads or sends.
-- Row level security is enabled in the next migration (rls).

-- Enums ---------------------------------------------------------------------------------

create type public.app_role as enum ('admin', 'rep');
create type public.ats_type as enum ('greenhouse', 'lever', 'ashby');
create type public.buyer_status as enum ('verified', 'rerouted', 'unverified');
create type public.signal_type as enum ('hiring', 'launch', 'funding');
create type public.lead_status as enum ('ready', 'filtered', 'enrolled', 'bounced', 'replied', 'halted', 'completed');
create type public.draft_angle as enum ('signal', 'peer', 'short', 'raw');
create type public.sequence_status as enum ('active', 'paused', 'halted', 'completed');
create type public.step_status as enum ('pending', 'sent', 'skipped', 'cancelled');
create type public.mailbox_status as enum ('healthy', 'near_cap', 'paused', 'held');
create type public.event_source as enum ('resend', 'simulated');
create type public.actor_type as enum ('agent', 'user');

-- Helpers -------------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Organizations and people --------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icp_description text,
  created_at timestamptz not null default now()
);

-- One row per auth user. Created by the seed script (public sign-up is off).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'rep',
  -- Theme id from lib/themes.ts; validated by the server action that writes it.
  theme text not null default 'system',
  created_at timestamptz not null default now()
);
create index profiles_org_id_idx on public.profiles (org_id);

-- Companies, contacts, signals ----------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  domain text not null,
  yc_batch text,
  team_size integer,
  industries text[] not null default '{}',
  description text,
  ats_type public.ats_type,
  ats_token text,
  icp_match boolean not null default false,
  icp_reasons jsonb not null default '[]',
  jobs_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, domain)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  title text,
  is_placeholder boolean not null default false,
  -- Always a Resend test address (hard rule 3).
  send_address text not null,
  buyer_status public.buyer_status not null default 'unverified',
  buyer_reason text,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);
create index contacts_org_id_idx on public.contacts (org_id);

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  type public.signal_type not null,
  title text not null,
  excerpt text,
  source_name text not null,
  source_url text,
  occurred_at timestamptz,
  detected_at timestamptz not null default now(),
  -- type + company + source id; the unique constraint prevents duplicate signals.
  fingerprint text not null,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (org_id, fingerprint)
);
create index signals_company_id_idx on public.signals (company_id);

-- Leads and drafts ----------------------------------------------------------------------

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  score integer not null default 0,
  -- Ordered [label, points] pairs, e.g. [["ICP match", 40], ["Hiring", 30]].
  score_parts jsonb not null default '[]',
  status public.lead_status not null default 'ready',
  filtered_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, company_id)
);
create index leads_org_status_idx on public.leads (org_id, status);
create index leads_assigned_to_idx on public.leads (assigned_to);
create index leads_company_id_idx on public.leads (company_id);
create index leads_contact_id_idx on public.leads (contact_id);

create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  angle public.draft_angle not null,
  subject text not null,
  body text not null,
  grounded_phrases jsonb not null default '[]',
  -- One entry per check: {check, status: pass | fail | warn, message}.
  guardrail_results jsonb not null default '[]',
  passed boolean not null default false,
  model text,
  prompt_hash text,
  tokens_in integer,
  tokens_out integer,
  created_at timestamptz not null default now()
);
create index drafts_lead_id_idx on public.drafts (lead_id);
create index drafts_org_id_idx on public.drafts (org_id);

-- Mailboxes, sequences, events ----------------------------------------------------------

create table public.mailboxes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  label text not null,
  -- The actual sender address (the Resend sandbox sender for this project).
  send_via text not null,
  daily_cap integer not null,
  sent_today integer not null default 0,
  status public.mailbox_status not null default 'healthy',
  pause_reason text,
  -- SPF / DMARC / DKIM lookup results.
  auth jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (org_id, label)
);

create table public.sequences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  draft_id uuid references public.drafts (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  edited boolean not null default false,
  final_subject text not null,
  final_body text not null,
  status public.sequence_status not null default 'active',
  current_step text,
  created_at timestamptz not null default now(),
  -- One sequence per lead, so a double-clicked approve can't enroll twice.
  unique (lead_id)
);
create index sequences_org_id_idx on public.sequences (org_id);
create index sequences_draft_id_idx on public.sequences (draft_id);
create index sequences_approved_by_idx on public.sequences (approved_by);

create table public.sequence_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  sequence_id uuid not null references public.sequences (id) on delete cascade,
  step_key text not null,
  scheduled_for timestamptz not null,
  status public.step_status not null default 'pending',
  signal_id uuid references public.signals (id) on delete set null,
  mailbox_id uuid references public.mailboxes (id) on delete set null,
  message_id text,
  -- Sent to Resend with the request; the unique constraint stops a second send.
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index sequence_steps_org_id_idx on public.sequence_steps (org_id);
create index sequence_steps_sequence_id_idx on public.sequence_steps (sequence_id);
create index sequence_steps_due_idx on public.sequence_steps (status, scheduled_for);
create index sequence_steps_signal_id_idx on public.sequence_steps (signal_id);
create index sequence_steps_mailbox_id_idx on public.sequence_steps (mailbox_id);

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  step_id uuid references public.sequence_steps (id) on delete set null,
  -- Unique so webhook retries are harmless; null for simulated events.
  provider_event_id text unique,
  type text not null,
  source public.event_source not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index email_events_org_id_idx on public.email_events (org_id);
create index email_events_step_id_idx on public.email_events (step_id);

-- Agent runs and audit log --------------------------------------------------------------

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  trigger text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb not null default '{}',
  step_ms jsonb not null default '{}',
  errors jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index agent_runs_org_started_idx on public.agent_runs (org_id, started_at desc);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  actor_type public.actor_type not null,
  -- The user's profile id, or null for the agent.
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_org_created_idx on public.audit_log (org_id, created_at desc);
create index audit_log_actor_id_idx on public.audit_log (actor_id);
