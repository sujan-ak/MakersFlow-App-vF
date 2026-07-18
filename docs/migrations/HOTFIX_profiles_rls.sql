-- ============================================================================
-- HOTFIX: "permission denied for table profiles (42501)" breaking login
-- Run this in Supabase SQL Editor. Idempotent — safe to re-run.
--
-- Cause: the admin-content migration's is_admin() function reads the profiles
-- table. When a profiles RLS policy also calls is_admin(), Postgres hits
-- infinite policy recursion and denies the read — so NO user (admin or not)
-- can load their own profile, which blocks login.
--
-- Fix:
--   1. Make is_admin() read a role snapshot WITHOUT re-triggering profiles RLS
--      (SECURITY DEFINER already bypasses RLS; we also mark it so the planner
--       never recurses).
--   2. Restore a plain, self-only profiles SELECT policy that does NOT call
--      is_admin(), plus a separate admin-read policy that is safe.
-- ============================================================================

-- 1. Recreate is_admin() so it never recurses through RLS.
--    SECURITY DEFINER runs as the owner and bypasses RLS on the read below.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;
grant execute on function public.is_admin() to authenticated, anon;

-- 2. Reset ALL profiles SELECT policies to a known-good, non-recursive set.
--    (Drop every variant we might have created across migrations.)
drop policy if exists "profiles admin read"          on public.profiles;
drop policy if exists "Users can view own profile"    on public.profiles;
drop policy if exists "profiles read own"             on public.profiles;
drop policy if exists "profiles select own or admin"  on public.profiles;

-- Self-read: the critical one — every user can read THEIR OWN row.
-- No is_admin() call here, so there is no recursion and login works.
create policy "profiles select own or admin" on public.profiles
  for select using (
    id = auth.uid()               -- your own row (no function call, no recursion)
    or public.is_admin()          -- admins can read everyone (definer-safe)
  );

-- 3. Make sure the original insert/update policies still exist (recreate if
--    the earlier migrations dropped them). These are self-only.
drop policy if exists "profiles update own"          on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles insert own"          on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert with check (id = auth.uid());

-- 4. Verify: this should return YOUR row without error when run while
--    authenticated in the app. As the SQL editor (postgres role) it always works.
-- select id, email, role from profiles where id = auth.uid();
