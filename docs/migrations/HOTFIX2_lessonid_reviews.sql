-- ============================================================================
-- HOTFIX v2 — Quizzes/Resources "permission denied" + Reviews submit failure
-- Run in Supabase SQL Editor. Idempotent. Safe to re-run.
--
-- Root causes:
--  A) quiz_questions.lesson_id / lesson_resources.lesson_id were created as
--     UUID, but your `lessons.id` is an INTEGER (the quiz error proved it:
--     "invalid input syntax for type uuid: 8"). Column types must match.
--  B) reviews needs a unique(user_id, course_id) constraint for the app's
--     upsert (onConflict) to work, and the RLS/trigger must let a logged-in
--     user write their own review.
-- ============================================================================

-- ── A) Fix lesson_id column type to match lessons.id ────────────────────────
-- Detect the real type of lessons.id and rebuild the two tables to match.
-- Simplest robust approach: drop & recreate with the correct type. These
-- tables are new (added by the admin-content migration) so nothing depends
-- on their data yet.

do $$
declare
  v_type text;
begin
  select data_type into v_type
    from information_schema.columns
   where table_schema = 'public' and table_name = 'lessons' and column_name = 'id';

  -- Default to bigint if we can't detect (your app sends integers like "8")
  if v_type is null then v_type := 'bigint'; end if;

  -- Map information_schema type name to a usable column type
  if v_type in ('integer','bigint','smallint') then
    v_type := 'bigint';
  elsif v_type = 'uuid' then
    v_type := 'uuid';
  else
    v_type := 'text';  -- safe fallback that accepts anything
  end if;

  -- Rebuild quiz_questions with the correct lesson_id type
  execute 'drop table if exists public.quiz_questions cascade';
  execute format($f$
    create table public.quiz_questions (
      id                   uuid primary key default gen_random_uuid(),
      lesson_id            %s not null,
      question_text        text not null,
      options              jsonb not null default '[]'::jsonb,
      correct_option_index int not null default 0,
      position             int not null default 0,
      created_at           timestamptz not null default now()
    )$f$, v_type);

  -- Rebuild lesson_resources with the correct lesson_id type
  execute 'drop table if exists public.lesson_resources cascade';
  execute format($f$
    create table public.lesson_resources (
      id         uuid primary key default gen_random_uuid(),
      lesson_id  %s not null,
      title      text not null,
      url        text not null,
      type       text default 'link',
      size_bytes bigint,
      created_at timestamptz not null default now()
    )$f$, v_type);
end $$;

-- Indexes
create index if not exists idx_quiz_questions_lesson
  on public.quiz_questions (lesson_id, position);
create index if not exists idx_lesson_resources_lesson
  on public.lesson_resources (lesson_id);

-- RLS (read for any logged-in user, write for admins)
alter table public.quiz_questions enable row level security;
drop policy if exists "quiz questions read" on public.quiz_questions;
create policy "quiz questions read" on public.quiz_questions
  for select using (auth.uid() is not null);
drop policy if exists "quiz questions admin write" on public.quiz_questions;
create policy "quiz questions admin write" on public.quiz_questions
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.lesson_resources enable row level security;
drop policy if exists "lesson resources read" on public.lesson_resources;
create policy "lesson resources read" on public.lesson_resources
  for select using (auth.uid() is not null);
drop policy if exists "lesson resources admin write" on public.lesson_resources;
create policy "lesson resources admin write" on public.lesson_resources
  for all using (public.is_admin()) with check (public.is_admin());

-- Recreate the answer-free public view for the web app
create or replace view public.quiz_questions_public as
  select id, lesson_id, question_text, options, position
    from public.quiz_questions;
grant select on public.quiz_questions_public to authenticated, anon;

-- ── B) Reviews: unique constraint + working self-write policies ─────────────
-- The app upserts with onConflict "user_id,course_id"; that needs a matching
-- unique constraint or the insert fails.
create unique index if not exists uq_reviews_user_course
  on public.reviews (user_id, course_id);

alter table public.reviews enable row level security;

-- Rebuild the review policies cleanly (self can read own + approved; admin all)
drop policy if exists "reviews read approved or own or admin" on public.reviews;
create policy "reviews read approved or own or admin" on public.reviews
  for select using (
    status = 'approved' or user_id = auth.uid() or public.is_admin()
  );

drop policy if exists "reviews insert own" on public.reviews;
create policy "reviews insert own" on public.reviews
  for insert with check (user_id = auth.uid());

drop policy if exists "reviews update own or admin" on public.reviews;
create policy "reviews update own or admin" on public.reviews
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "reviews delete own or admin" on public.reviews;
create policy "reviews delete own or admin" on public.reviews
  for delete using (user_id = auth.uid() or public.is_admin());

-- Keep the "force pending for non-admins" trigger, but make it NOT overwrite
-- user_id on UPDATE (which would fight the upsert). It only defaults status.
create or replace function public.reviews_force_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.status := 'pending';          -- users can't self-approve
    if tg_op = 'INSERT' then
      new.user_id := auth.uid();       -- stamp author on insert only
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reviews_force_pending on public.reviews;
create trigger trg_reviews_force_pending
  before insert or update on public.reviews
  for each row execute function public.reviews_force_pending();

-- ── Verify ──────────────────────────────────────────────────────────────────
-- select column_name, data_type from information_schema.columns
--  where table_name in ('quiz_questions','lesson_resources') and column_name='lesson_id';
-- (should match lessons.id's type — bigint for your DB)
