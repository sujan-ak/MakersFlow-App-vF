-- ============================================================================
-- Edodwaja / MakersFlow — Admin Content Migration (Reviews moderation,
-- Quizzes, Lesson Resources, GST) — July 2026
-- Run in Supabase SQL Editor AFTER the earlier premium-features migration.
-- Idempotent — safe to re-run.
-- ============================================================================

-- ── Admin helper ─────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer            -- bypasses RLS on the read below (no recursion)
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;
grant execute on function public.is_admin() to authenticated, anon;

-- ── 1. REVIEWS MODERATION ────────────────────────────────────────────────────
alter table public.reviews
  add column if not exists status text not null default 'pending'
    check (status in ('pending','approved','rejected'));

-- Existing reviews stay visible (they were public before moderation existed)
update public.reviews set status = 'approved' where status = 'pending'
  and created_at < now() - interval '1 minute';

create index if not exists idx_reviews_course_status
  on public.reviews (course_id, status, created_at desc);

-- Any insert/update by a non-admin goes back to 'pending' (users can't
-- self-approve, and editing an approved review re-queues it for moderation)
create or replace function public.reviews_force_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.status := 'pending';
    new.user_id := auth.uid();  -- users can only ever write as themselves
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reviews_force_pending on public.reviews;
create trigger trg_reviews_force_pending
  before insert or update on public.reviews
  for each row execute function public.reviews_force_pending();

alter table public.reviews enable row level security;

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

-- ── 2. QUIZZES ───────────────────────────────────────────────────────────────
-- The mobile quiz screen already reads quiz_questions(lesson_id, question_text,
-- options, correct_option_index, position); web reads quiz_questions_public.
create table if not exists public.quiz_questions (
  id                   uuid primary key default gen_random_uuid(),
  lesson_id            bigint not null,   -- matches integer lessons.id
  question_text        text not null,
  options              jsonb not null default '[]'::jsonb,
  correct_option_index int not null default 0,
  position             int not null default 0,
  created_at           timestamptz not null default now()
);
create index if not exists idx_quiz_questions_lesson
  on public.quiz_questions (lesson_id, position);

alter table public.quiz_questions enable row level security;
drop policy if exists "quiz questions read" on public.quiz_questions;
create policy "quiz questions read" on public.quiz_questions
  for select using (auth.uid() is not null);
drop policy if exists "quiz questions admin write" on public.quiz_questions;
create policy "quiz questions admin write" on public.quiz_questions
  for all using (public.is_admin()) with check (public.is_admin());

-- Answer-free view for the web app (does not expose correct_option_index)
create or replace view public.quiz_questions_public as
  select id, lesson_id, question_text, options, position
    from public.quiz_questions;
grant select on public.quiz_questions_public to authenticated, anon;

-- Attempts (web writes these; harmless if it already exists with same shape)
create table if not exists public.quiz_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  lesson_id       bigint not null,   -- matches integer lessons.id
  score           int not null default 0,
  total_questions int not null default 0,
  completed_at    timestamptz not null default now()
);
alter table public.quiz_attempts enable row level security;
drop policy if exists "quiz attempts own" on public.quiz_attempts;
create policy "quiz attempts own" on public.quiz_attempts
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ── 3. LESSON RESOURCES ──────────────────────────────────────────────────────
-- Web already reads lesson_resources(id, title, url, type, size_bytes)
create table if not exists public.lesson_resources (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  bigint not null,   -- matches integer lessons.id
  title      text not null,
  url        text not null,
  type       text default 'link',          -- 'pdf' | 'link' | 'video' | 'zip'
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists idx_lesson_resources_lesson
  on public.lesson_resources (lesson_id);

alter table public.lesson_resources enable row level security;
drop policy if exists "lesson resources read" on public.lesson_resources;
create policy "lesson resources read" on public.lesson_resources
  for select using (auth.uid() is not null);
drop policy if exists "lesson resources admin write" on public.lesson_resources;
create policy "lesson resources admin write" on public.lesson_resources
  for all using (public.is_admin()) with check (public.is_admin());

-- ── 4. GST on orders (mobile now records the tax breakdown like web) ────────
alter table public.orders
  add column if not exists tax_amount numeric default 0;

-- ── 5. Admin read access for moderation joins ───────────────────────────────
-- The reviews page joins profiles + courses; admins read everyone, users read
-- their own row. is_admin() is SECURITY DEFINER so this does not recurse.
drop policy if exists "profiles admin read"         on public.profiles;
drop policy if exists "Users can view own profile"   on public.profiles;
drop policy if exists "profiles read own"            on public.profiles;
drop policy if exists "profiles select own or admin" on public.profiles;
create policy "profiles select own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

-- Verification queries (run manually if you like):
-- select status, count(*) from reviews group by status;
-- select * from quiz_questions_public limit 1;
-- select * from lesson_resources limit 1;
