-- ============================================================================
-- HOTFIX v8 — Rebuild orders table RLS and grants
-- Run in Supabase SQL Editor. Idempotent. Safe to re-run.
-- ============================================================================

-- 1. Enable RLS on public.orders
alter table public.orders enable row level security;

-- 2. Drop existing policies to prevent overlaps
drop policy if exists "orders select own" on public.orders;
drop policy if exists "users select own orders" on public.orders;
drop policy if exists "orders select own or admin" on public.orders;
drop policy if exists "orders insert own" on public.orders;
drop policy if exists "orders insert own or admin" on public.orders;
drop policy if exists "orders update own or admin" on public.orders;
drop policy if exists "orders delete own or admin" on public.orders;

-- 3. Create the select policy allowing authenticated users to see their own orders, and admins to see all
create policy "orders select own or admin" on public.orders
  for select using (user_id = auth.uid() or public.is_admin());

-- 4. Create standard write policies for safety
create policy "orders insert own or admin" on public.orders
  for insert with check (user_id = auth.uid() or public.is_admin());

create policy "orders update own or admin" on public.orders
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "orders delete own or admin" on public.orders
  for delete using (user_id = auth.uid() or public.is_admin());

-- 5. Grant permissions to authenticated role
grant select, insert, update, delete on public.orders to authenticated;

-- 6. Reload PostgREST schema cache
notify pgrst, 'reload schema';
