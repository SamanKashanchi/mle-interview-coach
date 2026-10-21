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

-- One standard name per role, so research for "ML Engineer" also serves "Senior Machine Learning
-- Engineer, Growth": drops team/location suffixes (after , ( - |) and level words (Senior, Staff,
-- II, L5...), expands ML/MLE/SWE/SDE, and treats developer/eng/engineering as engineer.
-- The level lives in profiles.level and the team's details in targets.job_description.
create or replace function public.standard_role_name(p text) returns text
language plpgsql immutable set search_path = public as $$
declare s text := lower(coalesce(p, ''));
begin
  s := regexp_replace(s, '\msoftware (engineer|developer)\s*(,|\(|-|–|—|\|)\s*(machine learning|ml)\M.*$', 'machine learning engineer');
  s := regexp_replace(s, '\s*(,|\(|\s-\s|\s–\s|\s—\s|\|).*$', '');
  s := regexp_replace(s, '\m(ml|ai)\s*/\s*(ml|ai)\M', 'ml', 'g');
  s := regexp_replace(s, '[^a-z0-9+#& ]', ' ', 'g');
  s := ' ' || regexp_replace(s, '\s+', ' ', 'g') || ' ';
  s := regexp_replace(s, ' (senior|sr|staff|principal|lead|junior|jr|entry level|mid level|new grad|i|ii|iii|iv|1|2|3|4|5|l[3-7]|e[3-7]) ', ' ', 'g');
  s := regexp_replace(s, ' (senior|sr|staff|principal|lead|junior|jr|i|ii|iii|iv) ', ' ', 'g');
  s := replace(s, ' mle ', ' machine learning engineer ');
  s := replace(s, ' swe ', ' software engineer ');
  s := replace(s, ' sde ', ' software engineer ');
  s := replace(s, ' ml ', ' machine learning ');
  s := regexp_replace(s, ' (eng|engr|engineering) ', ' engineer ', 'g');
  s := regexp_replace(s, ' developer ', ' engineer ', 'g');
  s := btrim(regexp_replace(s, '\s+', ' ', 'g'));
  if s = '' then return btrim(p); end if;
  return regexp_replace(initcap(s), '\mAi\M', 'AI', 'g');
end $$;

create or replace function public.ensure_role(p_name text) returns uuid
language sql security invoker set search_path = public as $$
  insert into public.roles (name) values (public.standard_role_name(p_name)) on conflict ((lower(name))) do nothing;
  select id from public.roles where lower(name) = lower(public.standard_role_name(p_name));
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

-- Research: shared, one profile per company + role. Users can read; only the
-- research agent (service role, bypasses RLS) writes.

create table if not exists public.topics (
  id serial primary key,
  name text not null unique,
  category text not null check (category in ('coding','ml_coding','ml_fundamentals','deep_learning','ml_system_design','system_design','behavioral')),
  description text
);
-- Seed rows for topics live in supabase/seed_topics.sql.

create table if not exists public.research_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','running','done','failed')),
  summary text,
  style_notes text[] not null default '{}',
  level_notes text,
  confidence text check (confidence in ('low','medium','high')),
  gaps text[] not null default '{}',
  raw jsonb,
  error text,
  researched_at timestamptz,
  created_at timestamptz not null default now(),
  unique (company_id, role_id)
);

create table if not exists public.profile_sources (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.research_profiles(id) on delete cascade,
  url text not null,
  title text,
  kind text check (kind in ('official','candidate_report','guide','forum','job_posting','other'))
);
create index if not exists profile_sources_profile_idx on public.profile_sources(profile_id);

create table if not exists public.profile_rounds (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.research_profiles(id) on delete cascade,
  position int not null,
  name text not null,
  type text not null check (type in ('recruiter_screen','coding','ml_coding','ml_fundamentals','ml_system_design','system_design','behavioral','resume_deep_dive','take_home','other')),
  count int,
  minutes int,
  what_it_tests text,
  source_ids uuid[] not null default '{}'
);
create index if not exists profile_rounds_profile_idx on public.profile_rounds(profile_id);

create table if not exists public.round_topics (
  round_id uuid not null references public.profile_rounds(id) on delete cascade,
  topic_id int not null references public.topics(id),
  weight real not null check (weight >= 0 and weight <= 1),
  detail text,
  primary key (round_id, topic_id)
);
create index if not exists round_topics_topic_idx on public.round_topics(topic_id);

alter table public.topics enable row level security;
alter table public.research_profiles enable row level security;
alter table public.profile_sources enable row level security;
alter table public.profile_rounds enable row level security;
alter table public.round_topics enable row level security;

drop policy if exists "read topics" on public.topics;
create policy "read topics" on public.topics for select to authenticated using (true);
drop policy if exists "read research_profiles" on public.research_profiles;
create policy "read research_profiles" on public.research_profiles for select to authenticated using (true);
drop policy if exists "read profile_sources" on public.profile_sources;
create policy "read profile_sources" on public.profile_sources for select to authenticated using (true);
drop policy if exists "read profile_rounds" on public.profile_rounds;
create policy "read profile_rounds" on public.profile_rounds for select to authenticated using (true);
drop policy if exists "read round_topics" on public.round_topics;
create policy "read round_topics" on public.round_topics for select to authenticated using (true);

-- Blueprint: per-user topic weights. See agents/blueprint/README.md.
create table if not exists public.focus_topics (
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id int not null references public.topics(id),
  research_score real not null default 0,
  posting_factor real not null default 1 check (posting_factor between 0.5 and 1.5),
  resume_factor real not null default 1 check (resume_factor between 0.5 and 1.5),
  weight real not null default 0,
  reason text,
  updated_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
alter table public.focus_topics enable row level security;
drop policy if exists "read own focus_topics" on public.focus_topics;
create policy "read own focus_topics" on public.focus_topics for select to authenticated using (user_id = auth.uid());

-- Generated questions, per user. See agents/questions/README.md.
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id int not null references public.topics(id),
  company_id uuid references public.companies(id) on delete set null,
  format text not null check (format in ('coding','ml_coding','ml_concept','ml_system_design','system_design','behavioral')),
  difficulty int not null check (difficulty between 1 and 5),
  minutes int not null,
  prompt text not null,
  rubric text[] not null,
  created_at timestamptz not null default now()
);
create index if not exists questions_user_idx on public.questions(user_id, created_at desc);
alter table public.questions enable row level security;
drop policy if exists "read own questions" on public.questions;
create policy "read own questions" on public.questions for select to authenticated using (user_id = auth.uid());

-- Answers and grades. See agents/grading/README.md.
-- Users write their own answers; grades are written by the grader (bypasses RLS) and readable by the answer's owner.
create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  seconds_spent int check (seconds_spent >= 0),
  status text not null default 'pending' check (status in ('pending','graded')),
  created_at timestamptz not null default now()
);
create index if not exists answers_user_idx on public.answers(user_id, created_at desc);
create index if not exists answers_question_idx on public.answers(question_id);
alter table public.answers enable row level security;
drop policy if exists "read own answers" on public.answers;
create policy "read own answers" on public.answers for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "add own answers" on public.answers;
create policy "add own answers" on public.answers for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending'
    and exists (select 1 from public.questions q where q.id = question_id and q.user_id = (select auth.uid())));

create table if not exists public.grades (
  answer_id uuid primary key references public.answers(id) on delete cascade,
  score numeric(2,1) not null check (score between 0 and 5),
  rubric_scores jsonb not null, -- [{ "point": text, "verdict": "met" | "partial" | "missed", "note": text }]
  strengths text[] not null default '{}',
  improvements text[] not null default '{}',
  model_answer text,
  graded_at timestamptz not null default now()
);
alter table public.grades enable row level security;
drop policy if exists "read own grades" on public.grades;
create policy "read own grades" on public.grades for select to authenticated
  using (exists (select 1 from public.answers a where a.id = answer_id and a.user_id = (select auth.uid())));

-- History, habit loop and gap-aware questions --------------------------------------------

-- The day a question belongs to. Existing rows are all from 2026-10-16; new rows get
-- today's date unless the generator sets the owner's local date (it should).
alter table questions add column if not exists set_date date not null default date '2026-10-16';
alter table questions alter column set_date set default current_date;
-- Why the generator picked this question, shown on the question page.
alter table questions add column if not exists reason text;
create index if not exists questions_user_set_date on questions (user_id, set_date);

-- One row per question with its latest attempt and latest grade. security_invoker keeps RLS.
create or replace view question_history with (security_invoker = on) as
select q.id, q.user_id, q.topic_id, q.company_id, c.name as company, q.format, q.difficulty,
       q.minutes, q.prompt, q.set_date, q.reason, q.created_at,
       la.id as answer_id, la.status as answer_status, la.created_at as answered_at, la.seconds_spent,
       lg.score, lg.graded_at,
       coalesce(ac.attempts, 0)::int as attempts,
       coalesce(ac.answered_ats, '{}') as answered_ats
from questions q
left join companies c on c.id = q.company_id
left join lateral (
  select a.id, a.status, a.created_at, a.seconds_spent from answers a
  where a.question_id = q.id order by a.created_at desc limit 1
) la on true
left join lateral (
  select g.score, g.graded_at from answers a join grades g on g.answer_id = a.id
  where a.question_id = q.id order by a.created_at desc limit 1
) lg on true
left join lateral (
  select count(*) as attempts, array_agg(a.created_at order by a.created_at) as answered_ats
  from answers a where a.question_id = q.id
) ac on true;

-- Per user and topic: how often it was asked, answered and graded, and a Bayesian mastery
-- (prior 2.5/5 worth two answers). The question generator reads this.
create or replace view topic_progress with (security_invoker = on) as
select f.user_id, f.topic_id, t.name as topic, f.weight as focus_weight,
       count(h.id)::int as times_asked,
       count(h.answer_id)::int as times_answered,
       count(h.score)::int as times_graded,
       round(avg(h.score), 2) as avg_score,
       (array_agg(h.score order by h.graded_at desc) filter (where h.score is not null))[1] as last_score,
       max(h.set_date) as last_asked,
       round((coalesce(sum(h.score), 0) + 2.5 * 2) / (count(h.score) + 2) / 5, 3) as mastery
from focus_topics f
join topics t on t.id = f.topic_id
left join question_history h on h.user_id = f.user_id and h.topic_id = f.topic_id
group by f.user_id, f.topic_id, t.name, f.weight;

-- Code editor ---------------------------------------------------------------------------

-- Runnable spec for coding questions: {language, starter, entry, params, schema, tests[]}.
-- See agents/questions/README.md.
alter table public.questions add column if not exists code jsonb;
-- Code answers: the language and the test results from the in-browser runner at submit time.
alter table public.answers add column if not exists language text check (language in ('python','sql'));
alter table public.answers add column if not exists run_result jsonb;

-- Voice answers (non-coding questions). The app uploads the recording to the private
-- answer-audio bucket under <user id>/<answer id>.<ext> and saves a 30-day signed URL, so the Mac
-- mini worker can download it without a secret. Until the worker transcribes it, body holds a
-- placeholder; the worker then replaces body with the transcript and sets transcribed_at.
alter table public.answers add column if not exists audio_path text;
alter table public.answers add column if not exists audio_url text;
alter table public.answers add column if not exists transcribed_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('answer-audio', 'answer-audio', false, 52428800, array['audio/*'])
on conflict (id) do nothing;

drop policy if exists "own answer audio" on storage.objects;
create policy "own answer audio" on storage.objects for all to authenticated
  using (bucket_id = 'answer-audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'answer-audio' and (storage.foldername(name))[1] = auth.uid()::text);

-- Mac mini worker ------------------------------------------------------------------------

-- How many answers are waiting for a grade. Superseded by worker_todo() below; kept because
-- it's live. The work itself goes through the Supabase MCP.
create or replace function public.pending_grades() returns int
language sql stable security definer set search_path = public
as $$ select count(*)::int from public.answers where status = 'pending' $$;
revoke all on function public.pending_grades() from public;
grant execute on function public.pending_grades() to anon, authenticated;

-- Extra questions the owner asks for with "Generate questions" on Today: how many, and optionally
-- which formats and topics (empty = the coach picks). The worker (worker/prompts/requests.md) marks
-- it working, writes the questions with questions.request_id set, then marks it done or failed with
-- a note. One open request per user at a time.
create table if not exists public.question_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  set_date date not null,
  count smallint not null check (count between 1 and 10),
  formats text[] not null default '{}',
  topic_ids int[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','working','done','failed')),
  note text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create unique index if not exists question_requests_one_open on public.question_requests(user_id) where status in ('pending','working');
alter table public.question_requests enable row level security;
drop policy if exists "read own question requests" on public.question_requests;
create policy "read own question requests" on public.question_requests for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "ask for questions" on public.question_requests;
create policy "ask for questions" on public.question_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and started_at is null and finished_at is null and note is null);

-- Set for questions written for a request; the daily set ignores these when checking "today has a set".
alter table public.questions add column if not exists request_id uuid references public.question_requests(id) on delete set null;

-- What the Mac mini worker has to do, as counts only (no content), so worker/worker.mjs can
-- check it with the public key: answers to grade, target company+roles with no finished research,
-- users with targets but no daily set for p_today (the owner's local date), and open question requests
-- (a 'working' one over an hour old counts again, in case the worker died).
create or replace function public.worker_todo(p_today date) returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'grade', (select count(*) from answers where status = 'pending'),
    'research', (select count(*) from (
        select distinct t.company_id, t.role_id from targets t
        where not exists (select 1 from research_profiles rp
                          where rp.company_id = t.company_id and rp.role_id = t.role_id and rp.status = 'done')) x),
    'questions', (select count(*) from profiles p
        where exists (select 1 from targets t where t.user_id = p.user_id)
          and not exists (select 1 from questions q where q.user_id = p.user_id and q.set_date = p_today and q.request_id is null)),
    'requests', (select count(*) from question_requests
        where status = 'pending' or (status = 'working' and started_at < now() - interval '1 hour'))
  )
$$;
revoke all on function public.worker_todo(date) from public;
grant execute on function public.worker_todo(date) to anon, authenticated;

-- Push reminders --------------------------------------------------------------------------
-- reminders: when to nudge (local time + timezone, weekdays, what kind of question).
-- push_subscriptions: one row per device that turned notifications on.
-- Every 5 minutes pg_cron calls the send-reminders edge function (supabase/functions/), which
-- calls claim_due_reminders() and sends Web Push. Secrets are in Vault, created once with
--   select vault.create_secret('<VAPID private key>', 'vapid_private_key');
--   select vault.create_secret('<random string>', 'reminders_cron_secret');
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  at time not null,
  timezone text not null,
  kind text not null default 'any' check (kind in ('coding','talk','any')),
  days smallint[] not null default '{0,1,2,3,4,5,6}',
  enabled boolean not null default true,
  last_sent_on date,
  created_at timestamptz not null default now()
);
create index if not exists reminders_user_idx on public.reminders(user_id);
alter table public.reminders enable row level security;
drop policy if exists "own reminders" on public.reminders;
create policy "own reminders" on public.reminders for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Reminders that are due now, marked as sent for today, with the message to send. A reminder is
-- due within the hour after its time, in its own timezone, on its days, once a day. It sends
-- nothing when every question of its kind for today is already answered. Service role only.
create or replace function public.claim_due_reminders()
returns table (user_id uuid, title text, body text, url text)
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  local_ts timestamp;
  n int;
  mins int;
  first_id uuid;
  names text;
begin
  for r in select * from reminders where enabled for update skip locked loop
    local_ts := now() at time zone r.timezone;
    continue when not (extract(dow from local_ts)::smallint = any (r.days));
    continue when local_ts::time < r.at or local_ts::time >= r.at + interval '60 minutes';
    continue when r.last_sent_on = local_ts::date;
    update reminders set last_sent_on = local_ts::date where id = r.id;

    select count(*), coalesce(sum(q.minutes), 0), (array_agg(q.id order by q.created_at))[1],
           string_agg(distinct t.name, ', ')
      into n, mins, first_id, names
    from questions q join topics t on t.id = q.topic_id
    where q.user_id = r.user_id and q.set_date = local_ts::date
      and not exists (select 1 from answers a where a.question_id = q.id)
      and (r.kind = 'any' or (r.kind = 'coding') = (q.format in ('coding', 'ml_coding')));
    continue when n = 0;

    user_id := r.user_id;
    title := case r.kind
      when 'coding' then 'Time for your coding questions'
      when 'talk' then 'Time to talk through today''s questions'
      else 'Today''s questions are waiting' end;
    body := n || ' waiting: ' || names || ' (~' || mins || ' min).'
      || case when r.kind = 'talk' then ' Tap to answer out loud.' else '' end;
    url := '/questions/' || first_id;
    return next;
  end loop;
end
$$;
revoke all on function public.claim_due_reminders() from public, anon, authenticated;
grant execute on function public.claim_due_reminders() to service_role;

create or replace function public.reminder_secrets()
returns table (vapid_private_key text, cron_secret text)
language sql stable security definer set search_path = public
as $$
  select (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key'),
         (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret')
$$;
revoke all on function public.reminder_secrets() from public, anon, authenticated;
grant execute on function public.reminder_secrets() to service_role;

create extension if not exists pg_net;
create extension if not exists pg_cron;
select cron.schedule('send-reminders', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://uwmenprzfrtlqujmvlyq.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000)
$cron$);
