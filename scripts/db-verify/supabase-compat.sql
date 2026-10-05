-- ---------------------------------------------------------------------------
-- LOCAL STAND-IN for the parts of Supabase that the persistence migration
-- depends on. Used ONLY by scripts/verify-persistence-db.mjs --local, against
-- a throwaway PostgreSQL cluster it creates and deletes itself.
--
-- NEVER run this against a Supabase project: Supabase already defines every
-- object below, and its definitions are the real ones.
--
-- What is modelled, and why each matters to the tests:
--   * roles anon / authenticated / authenticator — PostgREST switches to the
--     role named in the JWT, so RLS is evaluated as `authenticated`, exactly
--     as on Supabase.
--   * auth.users — the migration's foreign key target.
--   * auth.uid() — Supabase's definition: the JWT `sub` claim. Every RLS
--     policy in the migration is written in terms of it.
--   * GRANT ALL on public tables to anon/authenticated — Supabase's DEFAULT
--     privileges. This matters: it means row-level security is the ONLY thing
--     standing between one customer and another's rows. Testing with narrower
--     grants would make isolation look stronger than it is on Supabase.
-- ---------------------------------------------------------------------------

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if;
end $$;
grant anon, authenticated to authenticator;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated;

create table if not exists auth.users (
  id uuid primary key,
  email text
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;

-- service_role — Supabase's server-side role: BYPASSRLS and full privileges on
-- public tables. Modelled for scripts/verify-creative-db.mjs, where the API
-- server (and only it) writes generation records. The persistence harnesses
-- never mint a token for this role.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
end $$;
grant service_role to authenticator;
grant usage on schema public to service_role;
grant usage on schema auth to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on functions to service_role;
