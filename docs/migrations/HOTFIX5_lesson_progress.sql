-- ============================================================================
-- HOTFIX v5 — Fix lesson_progress constraints and RLS
-- Run in Supabase SQL Editor. Idempotent. Safe to re-run.
-- ============================================================================

-- 1. Ensure course_id column is bigint (to match courses.id and prevent UUID cast errors)
do $$
declare
  v_type text;
begin
  select data_type into v_type
    from information_schema.columns
   where table_schema = 'public' and table_name = 'lesson_progress' and column_name = 'course_id';

  if v_type = 'uuid' then
    -- Convert course_id to bigint. Since it is empty/has dummy data, we cast via text to bigint
    alter table public.lesson_progress alter column course_id type bigint using course_id::text::bigint;
  end if;
end $$;

-- 2. Create the missing composite unique constraint required by the app's onConflict: 'user_id,course_id,lesson_id'
-- Drop legacy unique constraints on (user_id, lesson_id) if they exist
alter table public.lesson_progress drop constraint if exists uq_lesson_progress_user_lesson;
alter table public.lesson_progress drop constraint if exists lesson_progress_user_id_lesson_id_key;
drop index if exists public.idx_lesson_progress_user_lesson;

-- Create the new unique index on (user_id, course_id, lesson_id)
create unique index if not exists uq_lesson_progress_user_course_lesson
  on public.lesson_progress (user_id, course_id, lesson_id);

-- 3. RLS policy — make sure users can insert/update/read their own progress
alter table public.lesson_progress enable row level security;

drop policy if exists "lesson_progress own read" on public.lesson_progress;
create policy "lesson_progress own read" on public.lesson_progress
  for select using (user_id = auth.uid());

drop policy if exists "lesson_progress own write" on public.lesson_progress;
create policy "lesson_progress own write" on public.lesson_progress
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.lesson_progress to authenticated;

-- 4. Force PostgREST to reload schema
notify pgrst, 'reload schema';
