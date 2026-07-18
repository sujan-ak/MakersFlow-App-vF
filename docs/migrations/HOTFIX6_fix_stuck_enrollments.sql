-- ============================================================================
-- FIX_STUCK_ENROLLMENTS.sql — repairs the "enrolled 2 but only 1 visible" case
--
-- Cause: older app versions created enrollments with payment_status='pending'
-- when tapping Enroll on a paid course (before payment). The app correctly
-- hides unpaid enrollments — but if you actually paid (or it's a free course),
-- those rows are stuck invisible. This promotes the legitimate ones.
-- Run in Supabase Dashboard → SQL Editor. Idempotent.
-- ============================================================================

-- 1. Free courses can never be "pending" — mark them completed
update public.enrollments e
   set payment_status = 'completed', status = coalesce(e.status, 'active')
  from public.courses c
 where c.id = e.course_id
   and coalesce(c.is_free, false) = true
   and e.payment_status = 'pending';

-- 2. Pending enrollments that DO have a completed purchase → completed
update public.enrollments e
   set payment_status = 'completed', status = 'active'
 where e.payment_status = 'pending'
   and exists (
     select 1 from public.course_purchases cp
      where cp.user_id = e.user_id and cp.course_id = e.course_id
   );

-- 3. See what's still pending (genuinely unpaid — correct to stay hidden):
select e.user_id, e.course_id, c.title, e.payment_status, e.enrolled_at
  from public.enrollments e
  join public.courses c on c.id = e.course_id
 where e.payment_status in ('pending','failed')
 order by e.enrolled_at desc;
