-- ============================================================================
-- LESSON NOTES ("Key Learning Points" in the app's Notes tab)
-- Run in Supabase SQL Editor. Idempotent.
-- Admin authors short bullet points per lesson; the app shows them in the
-- Notes tab of the learning screen.
-- ============================================================================

create table if not exists public.lesson_notes (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  bigint not null,          -- matches integer lessons.id
  content    text not null,            -- one key learning point (a bullet)
  position   int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_lesson_notes_lesson
  on public.lesson_notes (lesson_id, position);

-- Table-level GRANTs (Postgres checks these BEFORE RLS — the lesson we learned)
grant select, insert, update, delete on public.lesson_notes to authenticated;
grant select on public.lesson_notes to anon;
grant all on public.lesson_notes to service_role;

-- RLS: any logged-in user can read; only admins can write
alter table public.lesson_notes enable row level security;

drop policy if exists "lesson notes read" on public.lesson_notes;
create policy "lesson notes read" on public.lesson_notes
  for select using (auth.uid() is not null);

drop policy if exists "lesson notes admin write" on public.lesson_notes;
create policy "lesson notes admin write" on public.lesson_notes
  for all
  using (
    public.is_admin()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Verify:
-- select count(*) from public.lesson_notes;
