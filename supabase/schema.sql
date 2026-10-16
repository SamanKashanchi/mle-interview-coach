-- MLE Interview Coach: database schema (current state).
-- Applied to the live project through migrations; this file is the full picture for a fresh install.

-- Shared lists. Anyone signed in can read them and add new names; names are unique ignoring case.
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists companies_name_key on public.companies (lower(name));

create table if not exists public.roles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists roles_name_key on public.roles (lower(name));

-- One row per user.
create table if not exists public.profiles (
  user_id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  name            text,
  level           text,
  ready_by        date,
  minutes_per_day integer,
  resume_path     text,
  resume_name     text,
  updated_at      timestamptz not null default now()
);

-- What a user is aiming for: a company + role, optionally with the pasted job posting.
create table if not exists public.targets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id      uuid not null references public.companies (id),
  role_id         uuid not null references public.roles (id),
  job_description text,
  created_at      timestamptz not null default now(),
  unique (user_id, company_id, role_id)
);
create index if not exists targets_user_idx on public.targets (user_id);

-- Find a company/role by name (ignoring case), creating it if it's new. Runs with the caller's rights.
create or replace function public.ensure_company(p_name text) returns uuid
language sql security invoker set search_path = public as $$
  insert into public.companies (name) values (trim(p_name)) on conflict ((lower(name))) do nothing;
  select id from public.companies where lower(name) = lower(trim(p_name));
$$;

create or replace function public.ensure_role(p_name text) returns uuid
language sql security invoker set search_path = public as $$
  insert into public.roles (name) values (trim(p_name)) on conflict ((lower(name))) do nothing;
  select id from public.roles where lower(name) = lower(trim(p_name));
$$;

revoke execute on function public.ensure_company(text), public.ensure_role(text) from anon, public;
grant execute on function public.ensure_company(text), public.ensure_role(text) to authenticated;

-- Row-level security.
alter table public.companies enable row level security;
alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.targets enable row level security;

drop policy if exists "read companies" on public.companies;
create policy "read companies" on public.companies for select to authenticated using (true);
drop policy if exists "add companies" on public.companies;
create policy "add companies" on public.companies for insert to authenticated with check (created_by = auth.uid());

drop policy if exists "read roles" on public.roles;
create policy "read roles" on public.roles for select to authenticated using (true);
drop policy if exists "add roles" on public.roles;
create policy "add roles" on public.roles for insert to authenticated with check (created_by = auth.uid());

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own targets" on public.targets;
create policy "own targets" on public.targets for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Private bucket for resumes. Files live under <user id>/..., readable only by that user.
insert into storage.buckets (id, name, public) values ('resumes', 'resumes', false)
on conflict (id) do nothing;

drop policy if exists "own resume files" on storage.objects;
create policy "own resume files" on storage.objects for all to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
