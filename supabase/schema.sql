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
