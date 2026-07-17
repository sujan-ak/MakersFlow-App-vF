-- ============================================================================
-- MakersFlow Security & Payment Integrity Fixes Migration
-- ============================================================================

-- 1. Database Columns Setup
alter table public.products
  add column if not exists weight numeric not null default 0.5,
  add column if not exists stock int not null default 100;

alter table public.orders
  add column if not exists shipment_status text check (shipment_status in ('pending', 'created', 'failed'));

-- 2. Rate Limiting Schema & Helper Function
create table if not exists public.rate_limits (
  id bigint generated always as identity primary key,
  key text not null unique,
  attempts int not null default 1,
  last_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_rate_limits_key on public.rate_limits (key);

create or replace function public.check_rate_limit(
  p_key text,
  p_limit int,
  p_window_interval interval
)
returns table (
  allowed boolean,
  attempts int,
  backoff_seconds int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts int;
  v_last_attempt_at timestamptz;
  v_backoff_seconds int;
  v_seconds_since numeric;
  v_backoffs int[] := array[5, 30, 300, 1800, 7200];
  v_excess int;
begin
  -- Perform an atomic UPSERT that checks cooldown and resets/increments attempts
  insert into public.rate_limits (key, attempts, last_attempt_at)
  values (p_key, 1, now())
  on conflict (key) do update
    set attempts = case
                     -- If cooldown has not elapsed (lockout active), keep attempts unchanged
                     when now() - rate_limits.last_attempt_at < (
                       case
                         when rate_limits.attempts - p_limit >= 0 then coalesce(v_backoffs[rate_limits.attempts - p_limit + 1], 7200)
                         else 0
                       end
                     ) * interval '1 second' then rate_limits.attempts
                     -- If window elapsed, reset attempts to 1
                     when now() - rate_limits.last_attempt_at > p_window_interval then 1
                     -- Otherwise increment
                     else rate_limits.attempts + 1
                   end,
        last_attempt_at = case
                            when now() - rate_limits.last_attempt_at < (
                              case
                                when rate_limits.attempts - p_limit >= 0 then coalesce(v_backoffs[rate_limits.attempts - p_limit + 1], 7200)
                                else 0
                              end
                            ) * interval '1 second' then rate_limits.last_attempt_at
                            else now()
                          end
  returning public.rate_limits.attempts, public.rate_limits.last_attempt_at into v_attempts, v_last_attempt_at;

  v_excess := v_attempts - p_limit;
  if v_excess >= 0 then
    v_backoff_seconds := coalesce(v_backoffs[v_excess + 1], 7200);
    v_seconds_since := extract(epoch from (now() - v_last_attempt_at));
    
    if v_seconds_since < v_backoff_seconds then
      return query select false, v_attempts, (v_backoff_seconds - v_seconds_since)::int;
    else
      return query select true, v_attempts, 0;
    end if;
  else
    return query select true, v_attempts, 0;
  end if;
end;
$$;

-- Enable pg_cron for routine pruning (no inline delete)
create extension if not exists pg_cron;
select cron.schedule('prune-rate-limits', '0 * * * *', $$
  delete from public.rate_limits where last_attempt_at < now() - interval '1 day';
$$);

-- 3. Restricted orders RLS policies (client can insert pending only)
alter table public.orders enable row level security;

drop policy if exists "orders select own" on public.orders;
drop policy if exists "users select own orders" on public.orders;
drop policy if exists "orders select own or admin" on public.orders;
drop policy if exists "orders insert own" on public.orders;
drop policy if exists "orders insert own or admin" on public.orders;
drop policy if exists "orders update own or admin" on public.orders;
drop policy if exists "orders delete own or admin" on public.orders;

-- Users can select their own orders
create policy "orders_select_own" on public.orders
  for select using (user_id = auth.uid());

-- Users can insert pending orders (cannot set paid/refunded status or attach payment ids)
create policy "orders_insert_own_pending" on public.orders
  for insert with check (
    user_id = auth.uid()
    and status = 'pending'
    and razorpay_payment_id is null
    and refund_id is null
  );

-- Users can update status ONLY to 'cancelled' and only if currently pending
create policy "orders_update_own_cancel" on public.orders
  for update using (user_id = auth.uid() and status = 'pending')
  with check (
    user_id = auth.uid()
    and status = 'cancelled'
  );

-- Admin override policy
create policy "orders_admin_all" on public.orders
  for all using (public.is_admin()) with check (public.is_admin());

-- 4. Restricted enrollments RLS policies (client cannot insert or update directly)
alter table public.enrollments enable row level security;

drop policy if exists "enrollments_select_own" on public.enrollments;
create policy "enrollments_select_own" on public.enrollments
  for select using (user_id = auth.uid() or public.is_admin());

-- Disallow insertions and updates for regular users (only admin or service role can write)
drop policy if exists "enrollments_admin_all" on public.enrollments;
create policy "enrollments_admin_all" on public.enrollments
  for all using (public.is_admin()) with check (public.is_admin());

-- 5. Product Stock decrement RPC
create or replace function public.decrement_product_stock(
  p_product_id bigint,
  p_qty int
)
returns table (
  success boolean,
  new_stock int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_stock int;
begin
  update public.products
     set stock = stock - p_qty
   where id = p_product_id
     and is_course = false
     and stock >= p_qty
  returning stock into v_new_stock;

  if found then
    return query select true, v_new_stock;
  else
    return query select false, null::int;
  end if;
end;
$$;

-- 6. Storage Bucket Security Configurations
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values 
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('courses', 'courses', true, 5242880, array['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('products', 'products', true, 5242880, array['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
