-- ---------------------------------------------------------------------------
-- Pilot wardrobe design persistence — save / reopen by design ID
--
-- NOT APPLIED. Run only against an APPROVED NON-PRODUCTION database, and only
-- after the inspection queries in docs/m3/PERSISTENCE_DB_TEST_PROCEDURE.md §1
-- have been run and their output read.
--
-- SCOPE: this file creates exactly two tables and their policies. It is
-- deliberately NOT supabase/schema.sql, which also defines profiles, projects,
-- ai_conversations and ai_corrections and installs a trigger on auth.users.
-- Running the whole of that file to get these two tables would touch four
-- unrelated tables and an auth trigger on a database that may already have
-- them — a far larger blast radius than this work needs.
--
-- Idempotent: every statement is IF NOT EXISTS, or DROP ... IF EXISTS before
-- CREATE. A partial or repeated run does not error.
--
-- Nothing here stores an API key, a token, or any provider authorization
-- value. Design rows hold furniture geometry and provenance only.
-- ---------------------------------------------------------------------------

-- A saved design. One row per design the customer can reopen.
create table if not exists public.wardrobe_designs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled wardrobe',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wardrobe_designs enable row level security;

drop policy if exists "Owners can view their wardrobe designs" on public.wardrobe_designs;
create policy "Owners can view their wardrobe designs"
  on public.wardrobe_designs for select
  using (auth.uid() = owner_user_id);

drop policy if exists "Owners can insert their wardrobe designs" on public.wardrobe_designs;
create policy "Owners can insert their wardrobe designs"
  on public.wardrobe_designs for insert
  with check (auth.uid() = owner_user_id);

drop policy if exists "Owners can update their wardrobe designs" on public.wardrobe_designs;
create policy "Owners can update their wardrobe designs"
  on public.wardrobe_designs for update
  using (auth.uid() = owner_user_id);

drop policy if exists "Owners can delete their wardrobe designs" on public.wardrobe_designs;
create policy "Owners can delete their wardrobe designs"
  on public.wardrobe_designs for delete
  using (auth.uid() = owner_user_id);

create index if not exists wardrobe_designs_owner_user_id_idx
  on public.wardrobe_designs(owner_user_id);

-- An immutable revision of a design.
--
-- `unique (design_id, revision)` is not a tidiness constraint. It is the ONLY
-- mutual exclusion in the save path: the application's checks all read before
-- they act, so two concurrent writers can pass every one of them, and this is
-- what decides which of them takes a revision number. If it is missing, the
-- concurrency behaviour documented in docs/m3/DESIGN_PERSISTENCE_API.md does
-- not hold, whatever the application code says.
create table if not exists public.wardrobe_revisions (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.wardrobe_designs(id) on delete cascade,
  revision integer not null check (revision >= 1),
  fingerprint text not null,
  furnispec jsonb not null,
  part_graph jsonb not null,
  origins jsonb,
  validation_status text,
  created_at timestamptz not null default now(),
  unique (design_id, revision)
);

alter table public.wardrobe_revisions enable row level security;

drop policy if exists "Owners can view their wardrobe revisions" on public.wardrobe_revisions;
create policy "Owners can view their wardrobe revisions"
  on public.wardrobe_revisions for select
  using (
    exists (
      select 1 from public.wardrobe_designs d
      where d.id = design_id and d.owner_user_id = auth.uid()
    )
  );

drop policy if exists "Owners can insert their wardrobe revisions" on public.wardrobe_revisions;
create policy "Owners can insert their wardrobe revisions"
  on public.wardrobe_revisions for insert
  with check (
    exists (
      select 1 from public.wardrobe_designs d
      where d.id = design_id and d.owner_user_id = auth.uid()
    )
  );

-- Intentionally NO update or delete policy on wardrobe_revisions.
--
-- With RLS enabled and no policy for a command, that command is denied for
-- every non-superuser role. This is what makes a saved revision immutable —
-- not application convention, and not the absence of code that would modify
-- it. Adding an UPDATE or DELETE policy here silently withdraws that
-- guarantee.

create index if not exists wardrobe_revisions_design_id_idx
  on public.wardrobe_revisions(design_id);
