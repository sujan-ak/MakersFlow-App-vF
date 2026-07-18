-- Security Fix: Restrict client-side enrollment inserts strictly to free courses verified in public.courses table
alter table public.enrollments enable row level security;

drop policy if exists "enrollments_insert_free" on public.enrollments;

create policy "enrollments_insert_free" on public.enrollments
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.courses c
      where c.id = course_id
        and c.is_free = true
    )
  );
