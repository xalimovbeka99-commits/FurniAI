-- ---------------------------------------------------------------------------
-- Creative (visual-concept) generation records — Scenario image → 3D
--
-- NOT APPLIED. Run only against an APPROVED NON-PRODUCTION database.
-- Creates exactly two tables and their policies. Idempotent.
--
-- These rows are NOT wardrobe designs and reference none: a generated mesh is
-- a visual concept, kept apart from wardrobe_designs / wardrobe_revisions.
-- No API key, token or asset URL is stored here. `sig` is an HMAC written by
-- the API server; rows without a valid signature are refused by the API, so a
-- row an owner writes straight through PostgREST is inert.
-- ---------------------------------------------------------------------------

create table if not exists public.creative_references (
  id uuid primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  content_type text not null,
  bytes integer not null check (bytes > 0),
  sha256 text not null,
  provider text not null,
  provider_asset_id text not null,
  sig text not null,
  created_at timestamptz not null default now(),
  unique (owner_user_id, sha256)
);

alter table public.creative_references enable row level security;
drop policy if exists "Owners can view their creative references" on public.creative_references;
create policy "Owners can view their creative references" on public.creative_references for select using (auth.uid() = owner_user_id);
drop policy if exists "Owners can insert their creative references" on public.creative_references;
create policy "Owners can insert their creative references" on public.creative_references for insert with check (auth.uid() = owner_user_id);

create table if not exists public.creative_jobs (
  id uuid primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  reference_id uuid not null references public.creative_references(id),
  provider text not null,
  model_id text not null,
  status text not null check (status in ('submitting','processing','succeeded','failed','submission_unknown')),
  provider_job_id text,
  provider_status text,
  provider_progress double precision,
  outputs jsonb not null default '[]'::jsonb,
  estimated_cost double precision,
  reported_cost double precision,
  error jsonb,
  sig text not null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  last_polled_at timestamptz
);

-- Duplicate-submission protection lives in the database, not only in code:
-- one job per idempotency key, and one ACTIVE job per reference and model.
create unique index if not exists creative_jobs_owner_key_uidx
  on public.creative_jobs (owner_user_id, idempotency_key);
create unique index if not exists creative_jobs_one_active_uidx
  on public.creative_jobs (owner_user_id, reference_id, model_id)
  where status in ('submitting','processing');
create index if not exists creative_jobs_owner_created_idx
  on public.creative_jobs (owner_user_id, created_at desc);

alter table public.creative_jobs enable row level security;
drop policy if exists "Owners can view their creative jobs" on public.creative_jobs;
create policy "Owners can view their creative jobs" on public.creative_jobs for select using (auth.uid() = owner_user_id);
drop policy if exists "Owners can insert their creative jobs" on public.creative_jobs;
create policy "Owners can insert their creative jobs" on public.creative_jobs for insert with check (auth.uid() = owner_user_id);
drop policy if exists "Owners can update their creative jobs" on public.creative_jobs;
create policy "Owners can update their creative jobs" on public.creative_jobs for update using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
-- No delete policy on either table.
