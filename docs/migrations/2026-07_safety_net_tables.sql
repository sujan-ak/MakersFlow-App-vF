-- ============================================================================
-- SAFETY-NET: ensure pre-existing app tables exist (feedback, refund_requests,
-- shipping_addresses). Run in Supabase SQL Editor. Idempotent.
--
-- These tables are used by the mobile app's Feedback form, Refund flow, and
-- Shipping-address manager. They already exist in most deployments; this file
-- just guarantees they're present with correct columns + RLS so those screens
-- never error with "relation does not exist" or "permission denied".
-- ============================================================================

-- ── Feedback ─────────────────────────────────────────────────────────────────
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  rating     int,
  message    text,
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
drop policy if exists "feedback insert own" on public.feedback;
create policy "feedback insert own" on public.feedback
  for insert with check (user_id = auth.uid());
drop policy if exists "feedback read own or admin" on public.feedback;
create policy "feedback read own or admin" on public.feedback
  for select using (user_id = auth.uid() or public.is_admin());

-- ── Refund requests ──────────────────────────────────────────────────────────
create table if not exists public.refund_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  order_id   bigint,
  reason     text,
  status     text not null default 'pending',
  created_at timestamptz not null default now()
);
create index if not exists idx_refund_requests_user on public.refund_requests (user_id);
alter table public.refund_requests enable row level security;
drop policy if exists "refund requests insert own" on public.refund_requests;
create policy "refund requests insert own" on public.refund_requests
  for insert with check (user_id = auth.uid());
drop policy if exists "refund requests read own or admin" on public.refund_requests;
create policy "refund requests read own or admin" on public.refund_requests
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "refund requests admin update" on public.refund_requests;
create policy "refund requests admin update" on public.refund_requests
  for update using (public.is_admin()) with check (public.is_admin());

-- ── Shipping addresses ───────────────────────────────────────────────────────
create table if not exists public.shipping_addresses (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  full_name     text not null,
  address_line1 text not null,
  address_line2 text,
  city          text not null,
  state         text,
  postal_code   text,
  phone         text,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_shipping_addresses_user on public.shipping_addresses (user_id);
alter table public.shipping_addresses enable row level security;
drop policy if exists "shipping addresses own" on public.shipping_addresses;
create policy "shipping addresses own" on public.shipping_addresses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- NOTE: requires is_admin() from 2026-07_admin_content.sql (or the HOTFIX).
-- Run this AFTER those. If you haven't, this still works except the admin
-- read/update policies — run the admin migration first to be safe.
