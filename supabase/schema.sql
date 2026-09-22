-- FurniAI accounts + saved projects schema
-- Run this in Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / DROP...IF EXISTS
-- before CREATE), so a partial or repeated run never errors on "already exists".

-- Profiles: one row per signed-up user, auto-created on signup
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Projects: saved furniture designs (one row per saved design)
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  config jsonb not null,   -- the cfg object: type/sections/drawers/shelves/doorType/mat/handle/led/w/h/d
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

drop policy if exists "Users can view their own projects" on public.projects;
create policy "Users can view their own projects"
  on public.projects for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own projects" on public.projects;
create policy "Users can insert their own projects"
  on public.projects for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own projects" on public.projects;
create policy "Users can update their own projects"
  on public.projects for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own projects" on public.projects;
create policy "Users can delete their own projects"
  on public.projects for delete
  using (auth.uid() = user_id);

create index if not exists projects_user_id_idx on public.projects(user_id);

-- AI conversations: chat history, so the AI can reference past designs
-- ("create another wardrobe like the one from last month")
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  messages jsonb not null default '[]'::jsonb,  -- [{role, content}, ...]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_conversations enable row level security;

drop policy if exists "Users can view their own conversations" on public.ai_conversations;
create policy "Users can view their own conversations"
  on public.ai_conversations for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own conversations" on public.ai_conversations;
create policy "Users can insert their own conversations"
  on public.ai_conversations for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own conversations" on public.ai_conversations;
create policy "Users can update their own conversations"
  on public.ai_conversations for update
  using (auth.uid() = user_id);

create index if not exists ai_conversations_user_id_idx on public.ai_conversations(user_id);

-- AI corrections: an append-only log of times the AI got something wrong
-- (usually a photo misread) and the customer corrected it — e.g. "that's
-- walnut, not oak". Never updated or deleted; over time this becomes a
-- real, proprietary dataset of exactly what this app's customers correct,
-- which no generic model provides.
create table if not exists public.ai_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  furniture_type text,
  field text not null,
  wrong_value text not null,
  correct_value text not null,
  created_at timestamptz not null default now()
);

alter table public.ai_corrections enable row level security;

drop policy if exists "Users can view their own corrections" on public.ai_corrections;
create policy "Users can view their own corrections"
  on public.ai_corrections for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own corrections" on public.ai_corrections;
create policy "Users can insert their own corrections"
  on public.ai_corrections for insert
  with check (auth.uid() = user_id);

create index if not exists ai_corrections_user_id_idx on public.ai_corrections(user_id);


-- ---------------------------------------------------------------------------
-- Pilot wardrobe designs (FurniSpec + PartGraph revisions) — Save / Reopen
-- Appended for feat/pilot-design-persistence. Idempotent.
-- Does NOT store API keys or provider authorization data.
-- Revisions are immutable: no UPDATE/DELETE policies on wardrobe_revisions.
-- ---------------------------------------------------------------------------

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

-- Intentionally no UPDATE or DELETE policies: revisions are immutable.

create index if not exists wardrobe_revisions_design_id_idx
  on public.wardrobe_revisions(design_id);
