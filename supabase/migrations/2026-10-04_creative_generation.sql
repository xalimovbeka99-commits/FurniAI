-- ---------------------------------------------------------------------------
-- Creative (visual-concept) generation records — Scenario image → 3D
--
-- NOT APPLIED. Run only against an APPROVED NON-PRODUCTION database.
-- Creates exactly two tables, their policies and one guard trigger. Idempotent.
--
-- These rows are NOT wardrobe designs and reference none: a generated mesh is
-- a visual concept, kept apart from wardrobe_designs / wardrobe_revisions.
-- No API key, token or asset URL is stored here.
--
-- WRITE AUTHORITY — the point of this file.
-- A job row decides whether a paid generation may be submitted. So the owner
-- may READ their rows and nothing else: there is NO insert, update or delete
-- policy, and the table privileges of `anon` and `authenticated` are reduced
-- to SELECT. Only the API server, using the service-role key, writes.
-- (The first draft of this migration let owners UPDATE their job rows; an
-- owner could then mark a running job `failed` and buy a second generation.
-- Reproduced and closed — scripts/verify-creative-db.mjs.)
--
-- `sig` is an HMAC over every other column, written by the API server; the
-- trigger below additionally stops ANY writer rolling a job back.
-- ---------------------------------------------------------------------------

create table if not exists public.creative_references (
  id uuid primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  content_type text not null,
  bytes integer not null check (bytes > 0),
  sha256 text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  validation text not null check (validation in ('decoded','structure')),
  provider text not null,
  provider_asset_id text not null,
  sig text not null,
  created_at timestamptz not null default now(),
  unique (owner_user_id, sha256)
);

create table if not exists public.creative_jobs (
  id uuid primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  reference_id uuid not null references public.creative_references(id),
  provider text not null,
  model_id text not null,
  version integer not null default 1 check (version >= 1),
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
-- one job per idempotency key, and one ACTIVE job per reference. These are
-- trustworthy because customers cannot write `status`.
create unique index if not exists creative_jobs_owner_key_uidx
  on public.creative_jobs (owner_user_id, idempotency_key);
create unique index if not exists creative_jobs_one_active_uidx
  on public.creative_jobs (owner_user_id, reference_id)
  where status in ('submitting','processing');
create index if not exists creative_jobs_owner_created_idx
  on public.creative_jobs (owner_user_id, created_at desc);

-- Owners read their own rows. Nothing else.
alter table public.creative_references enable row level security;
alter table public.creative_jobs enable row level security;

drop policy if exists "Owners can view their creative references" on public.creative_references;
create policy "Owners can view their creative references" on public.creative_references for select using (auth.uid() = owner_user_id);
drop policy if exists "Owners can insert their creative references" on public.creative_references;

drop policy if exists "Owners can view their creative jobs" on public.creative_jobs;
create policy "Owners can view their creative jobs" on public.creative_jobs for select using (auth.uid() = owner_user_id);
drop policy if exists "Owners can insert their creative jobs" on public.creative_jobs;
drop policy if exists "Owners can update their creative jobs" on public.creative_jobs;

-- Supabase grants ALL on new public tables to anon and authenticated by
-- default; RLS would then be the only barrier. Remove the privileges too, so
-- a policy added by mistake later cannot reopen writes on its own.
revoke all on public.creative_references from anon, authenticated;
revoke all on public.creative_jobs from anon, authenticated;
grant select on public.creative_references to authenticated;
grant select on public.creative_jobs to authenticated;

-- No writer — not even the server — may roll a job back or rewrite its
-- identity. Each update must move the version forward by exactly one, keep
-- the identifying columns, and follow the lifecycle:
--   submitting -> processing | failed | submission_unknown
--   processing -> processing | succeeded | failed
--   succeeded, failed, submission_unknown: final.
create or replace function public.creative_jobs_guard() returns trigger
language plpgsql as $$
begin
  if new.id is distinct from old.id
     or new.owner_user_id is distinct from old.owner_user_id
     or new.idempotency_key is distinct from old.idempotency_key
     or new.reference_id is distinct from old.reference_id
     or new.provider is distinct from old.provider
     or new.model_id is distinct from old.model_id
     or new.created_at is distinct from old.created_at
     or new.estimated_cost is distinct from old.estimated_cost then
    raise exception 'creative_jobs: identifying columns are immutable' using errcode = '23514';
  end if;
  if new.version <> old.version + 1 then
    raise exception 'creative_jobs: version must advance by exactly one' using errcode = '23514';
  end if;
  if old.provider_job_id is not null and new.provider_job_id is distinct from old.provider_job_id then
    raise exception 'creative_jobs: provider job id cannot change once set' using errcode = '23514';
  end if;
  if not (
       (old.status = 'submitting' and new.status in ('processing','failed','submission_unknown'))
    or (old.status = 'processing' and new.status in ('processing','succeeded','failed'))
  ) then
    raise exception 'creative_jobs: transition % -> % is not allowed', old.status, new.status using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists creative_jobs_guard on public.creative_jobs;
create trigger creative_jobs_guard before update on public.creative_jobs
  for each row execute function public.creative_jobs_guard();
