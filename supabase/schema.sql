-- MLE Interview Coach: database setup.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.

-- Your answers from the setup page (one row per user).
create table if not exists public.profiles (
  user_id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  target_roles     text,
  level            text,
  target_companies text,
  ready_by         date,
  minutes_per_day  integer,
  resume_path      text,
  resume_name      text,
  updated_at       timestamptz not null default now()
);

-- Pasted job descriptions (one row each; the research step reads these).
create table if not exists public.job_descriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company    text,
  role       text,
  posting    text not null,
  created_at timestamptz not null default now()
);
create index if not exists job_descriptions_user_idx on public.job_descriptions (user_id);

-- Row-level security: each signed-in user can only see and change their own rows.
alter table public.profiles enable row level security;
alter table public.job_descriptions enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own job descriptions" on public.job_descriptions;
create policy "own job descriptions" on public.job_descriptions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Private bucket for resumes. Files live under <user id>/..., readable only by that user.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

drop policy if exists "own resume files" on storage.objects;
create policy "own resume files" on storage.objects
  for all to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
