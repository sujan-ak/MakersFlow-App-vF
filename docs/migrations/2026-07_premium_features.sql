-- ============================================================================
-- Edodwaja — Premium Features Migration (July 2026)
-- Run this in the Supabase SQL editor (or via supabase db push).
-- Covers every schema change required by the launch-readiness roadmap:
--   §1 single-device sessions, login events, WhatsApp OTP
--   §2 in-app notifications + push tokens
--   §3 1-year course access expiry
--   §5 payment webhook idempotency + atomic order completion
--   §10 indexes + RLS policies (schema now versioned in git)
-- Everything is idempotent (IF NOT EXISTS / OR REPLACE) — safe to re-run.
-- ============================================================================

-- ── §1 Single-device session enforcement ────────────────────────────────────
alter table public.profiles
  add column if not exists active_session_id text,
  add column if not exists phone text;

create index if not exists idx_profiles_phone on public.profiles (phone);

-- ── §1 Login events (suspicious login detection) ────────────────────────────
create table if not exists public.login_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  device_info text,
  ip          text,
  is_flagged  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_login_events_user_created
  on public.login_events (user_id, created_at desc);

alter table public.login_events enable row level security;
drop policy if exists "own login events read" on public.login_events;
create policy "own login events read" on public.login_events
  for select using (auth.uid() = user_id);
drop policy if exists "own login events insert" on public.login_events;
create policy "own login events insert" on public.login_events
  for insert with check (auth.uid() = user_id);

-- ── §1 WhatsApp OTP storage (service-role only — no user policies) ──────────
create table if not exists public.whatsapp_otps (
  id         bigint generated always as identity primary key,
  phone      text not null,
  code_hash  text not null,
  attempts   int not null default 0,
  used_at    timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_whatsapp_otps_phone_created
  on public.whatsapp_otps (phone, created_at desc);
alter table public.whatsapp_otps enable row level security;
-- No policies on purpose: only the service role (edge functions) may touch it.

-- ── §2 In-app notifications ──────────────────────────────────────────────────
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  body       text,
  type       text default 'system',       -- 'course' | 'order' | 'offer' | 'system'
  link       text,                        -- optional in-app route e.g. /course/12
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, is_read, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "own notifications read" on public.notifications;
create policy "own notifications read" on public.notifications
  for select using (auth.uid() = user_id);
drop policy if exists "own notifications update" on public.notifications;
create policy "own notifications update" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Inserts come from the backend/service role (admin dashboard, webhooks).

-- ── §2 Announcements (admin broadcast → web + mobile) ───────────────────────
-- The admin panel's "Notifications" section writes here (via its API route
-- with the service role). Web and mobile read published rows.
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  message    text,
  type       text default 'info',      -- 'info' | 'warning' | 'success' | ...
  link_url   text,
  status     text not null default 'published',  -- 'draft' | 'published'
  created_at timestamptz not null default now()
);
create index if not exists idx_announcements_status_created
  on public.announcements (status, created_at desc);
alter table public.announcements enable row level security;
drop policy if exists "announcements public read" on public.announcements;
create policy "announcements public read" on public.announcements
  for select using (status = 'published');

-- ── §2/§7 Push tokens ────────────────────────────────────────────────────────
create table if not exists public.push_tokens (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  token       text not null unique,
  device_info text,
  platform    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_push_tokens_user on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
drop policy if exists "own push tokens all" on public.push_tokens;
create policy "own push tokens all" on public.push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── §2 Promotions (home banner carousel) ─────────────────────────────────────
create table if not exists public.promotions (
  id         bigint generated always as identity primary key,
  title      text not null,
  subtitle   text,
  image_url  text,
  link       text,
  is_active  boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.promotions enable row level security;
drop policy if exists "promotions public read" on public.promotions;
create policy "promotions public read" on public.promotions
  for select using (is_active = true);

-- ── §3 1-year course access expiry ───────────────────────────────────────────
alter table public.enrollments
  add column if not exists expires_at timestamptz;

-- Backfill existing enrollments: 1 year from enrollment date
update public.enrollments
   set expires_at = enrolled_at + interval '1 year'
 where expires_at is null and enrolled_at is not null;

create index if not exists idx_enrollments_user_course
  on public.enrollments (user_id, course_id);
-- Required by the upsert/ON CONFLICT paths (app + RPC + webhook):
create unique index if not exists uq_enrollments_user_course
  on public.enrollments (user_id, course_id);
create index if not exists idx_enrollments_expiring
  on public.enrollments (expires_at) where expires_at is not null;

-- ── §5 Coupons — canonical discount system ──────────────────────────────────
-- The admin panel manages `coupons` (+ `coupon_usage`), the web app and the
-- mobile app both validate through the `validate-coupon` edge function, and
-- usage is recorded server-side by verify-razorpay-payment / the webhook.
-- (The earlier draft of this migration created a separate `promo_codes`
-- table; that is superseded. If you ran the earlier draft, you can drop it:)
--   drop table if exists public.promo_codes;

-- ── §5 Payment webhook idempotency ───────────────────────────────────────────
create table if not exists public.payment_events (
  id         bigint generated always as identity primary key,
  event_id   text not null unique,   -- x-razorpay-event-id (duplicate deliveries no-op)
  event_type text,
  payload    jsonb,
  created_at timestamptz not null default now()
);
alter table public.payment_events enable row level security;
-- Service-role only.

-- Orders: columns used by the mobile checkout + refund flow
alter table public.orders
  add column if not exists razorpay_order_id   text,
  add column if not exists razorpay_payment_id text,
  add column if not exists promo_code          text,
  add column if not exists discount_amount     numeric default 0,
  add column if not exists refund_id           text;
create index if not exists idx_orders_rzp_order on public.orders (razorpay_order_id);
create index if not exists idx_orders_user_created on public.orders (user_id, created_at desc);

-- ── §10 Atomic order completion (order + enrollments + promo in ONE tx) ─────
-- Called by the mobile checkout after server-side signature verification.
-- If anything fails, the whole transaction rolls back — no more
-- "charged but not enrolled" half-states.
create or replace function public.complete_paid_order(
  p_order        jsonb,
  p_product_ids  text[],
  p_promo_id     uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id  uuid;
  v_user_id   uuid;
  v_pid       text;
  v_product   record;
  v_course_id public.enrollments.course_id%type;
begin
  v_user_id := (p_order->>'user_id')::uuid;

  -- Only the authenticated owner may complete their own order
  if auth.uid() is null or auth.uid() <> v_user_id then
    raise exception 'not authorized';
  end if;

  insert into public.orders (
    user_id, total_amount, status,
    razorpay_order_id, razorpay_payment_id,
    promo_code, discount_amount, shipping_address, items
  ) values (
    v_user_id,
    (p_order->>'total_amount')::numeric,
    coalesce(p_order->>'status', 'paid'),
    p_order->>'razorpay_order_id',
    p_order->>'razorpay_payment_id',
    p_order->>'promo_code',
    coalesce((p_order->>'discount_amount')::numeric, 0),
    p_order->'shipping_address',
    p_order->'items'
  )
  returning id into v_order_id;

  foreach v_pid in array p_product_ids loop
    select is_course, course_id into v_product
      from public.products where id::text = v_pid;

    if found and (v_product.is_course or v_product.course_id is not null) then
      -- Works whether course_id is bigint, int, or uuid: PL/pgSQL assignment
      -- converts the text product id through the column's I/O functions.
      if v_product.course_id is not null then
        v_course_id := v_product.course_id;
      else
        v_course_id := v_pid;
      end if;

      insert into public.enrollments
        (user_id, course_id, payment_status, status, enrolled_at, expires_at)
      values
        (v_user_id, v_course_id, 'completed', 'active', now(), now() + interval '1 year')
      on conflict (user_id, course_id) do update
        set payment_status = 'completed',
            status         = 'active',
            expires_at     = now() + interval '1 year';  -- renewal extends access

      -- Mirror into course_purchases (what the admin LMS Purchases page and
      -- the web ecosystem use). Best-effort: if the table/constraint differs,
      -- don't fail the whole order — the webhook will fill it in.
      begin
        insert into public.course_purchases (user_id, course_id, order_id, status)
        values (v_user_id, v_course_id, v_order_id, 'active')
        on conflict (user_id, course_id) do nothing;
      exception when others then
        null;
      end;
    end if;
  end loop;

  -- Coupon usage is recorded server-side by verify-razorpay-payment /
  -- razorpay-webhook against `coupons` + `coupon_usage` (p_promo_id is
  -- accepted for backward compatibility but intentionally unused).

  return v_order_id;
end;
$$;

grant execute on function public.complete_paid_order(jsonb, text[], uuid) to authenticated;

-- ── §10 RLS audit reminders (verify these exist in your dashboard) ──────────
-- The app talks to Supabase directly, so these MUST be true:
--   • enrollments: users can SELECT only their own rows; no client UPDATE of
--     payment_status (fulfillment happens via complete_paid_order / webhook).
--   • orders: users can SELECT only their own rows.
--   • lesson_progress: SELECT/UPSERT restricted to auth.uid() = user_id.
--   • profiles: users can UPDATE only their own row, and NOT the role column.
