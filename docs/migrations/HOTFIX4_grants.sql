-- ============================================================================
-- HOTFIX 4 — THE ACTUAL FIX for all "permission denied" errors
-- Run in Supabase SQL Editor. Idempotent.
--
-- The error hints told us precisely: "GRANT SELECT ON public.quiz_questions
-- TO authenticated". Postgres requires BOTH a table-level GRANT and an RLS
-- policy. Tables recreated by our hotfixes (quiz_questions, lesson_resources)
-- and some others were missing the base GRANTs that Supabase normally applies.
-- RLS policies were fine all along — the request was denied one layer earlier.
--
-- This restores the standard Supabase grant model: roles get table access,
-- and RLS (already in place) remains the security gatekeeper.
-- ============================================================================

-- 1. Schema usage (usually present; harmless to re-grant)
grant usage on schema public to anon, authenticated, service_role;

-- 2. Standard Supabase table grants on EVERYTHING in public.
--    RLS still controls what rows anyone can actually touch.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant all on all tables in schema public to service_role;

-- 3. Sequences (needed for identity/bigserial inserts, e.g. shipping_addresses)
grant usage, select on all sequences in schema public to authenticated;
grant usage, select on all sequences in schema public to service_role;

-- 4. Make this automatic for any table created in the future by the postgres
--    role (so a dropped/recreated table never loses grants again)
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;

-- 5. The answer-free quiz view for web (re-grant to be safe)
grant select on public.quiz_questions_public to anon, authenticated;

-- ============================================================================
-- SECURITY NOTE: this is the standard Supabase model. Granting table access
-- to `authenticated` does NOT open your data — every sensitive table has RLS
-- enabled, and RLS decides row access:
--   • quiz_questions / lesson_resources: read = any logged-in user,
--     write = admins only (is_admin policies)
--   • reviews: read approved/own, write own (pending), moderate = admin
--   • orders/enrollments/profiles/etc.: own-row policies as before
--   • whatsapp_otps / payment_events: RLS on with NO user policies
--     → still service-role only, grants alone don't open them.
-- ============================================================================

-- 6. VERIFY (each should return without error):
-- select count(*) from public.quiz_questions;
-- select count(*) from public.lesson_resources;
-- select count(*) from public.reviews;
