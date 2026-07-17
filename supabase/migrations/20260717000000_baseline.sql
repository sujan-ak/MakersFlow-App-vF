-- ============================================================================
-- MakersFlow — COMPLETE DATABASE SETUP (run this ONE file, top to bottom)
-- Paste the whole thing into Supabase SQL Editor → Run.
-- Fully idempotent — safe to run on a fresh OR already-partially-migrated DB.
--
-- Bundles, in correct dependency order:
--   1. Premium features (sessions, notifications, payments, expiry, indexes)
--   2. Coupons used_count patch
--   3. Admin content (is_admin, reviews moderation, quizzes, resources, GST)
--   4. Safety-net tables (feedback, refund_requests, shipping_addresses)
--   5. Profiles RLS hotfix (prevents login-breaking recursion)
--   6. HOTFIX2 (lesson_id type match + reviews unique constraint/policies)
--
-- After running, make yourself admin:
--   update profiles set role = 'admin' where email = 'YOUR-EMAIL';
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION: 2026-07_premium_features.sql
-- ═══════════════════════════════════════════════════════════════════════════
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
drop function if exists public.complete_paid_order(jsonb, text[], uuid);
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

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION: PATCH_coupons_used_count.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- ============================================================================
-- PATCH: coupons.used_count missing in the live database
-- Run in Supabase SQL Editor. Idempotent — safe to re-run.
--
-- The admin Coupon Usage page, the validate-coupon edge function, and the
-- webhook's increment_coupon_usage RPC all expect coupons.used_count, but the
-- live table was created without it.
-- ============================================================================

-- 1. Add the column
alter table public.coupons
  add column if not exists used_count int not null default 0;

-- 2. Backfill it from actual recorded usage
update public.coupons c
   set used_count = coalesce(u.cnt, 0)
  from (
    select coupon_id, count(*)::int as cnt
      from public.coupon_usage
     group by coupon_id
  ) u
 where u.coupon_id = c.id;

-- 3. Ensure the increment RPC exists (called by verify-razorpay-payment
--    and razorpay-webhook)
drop function if exists public.increment_coupon_usage(uuid);
create or replace function public.increment_coupon_usage(coupon_id_param uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.coupons
     set used_count = used_count + 1
   where id = coupon_id_param;
$$;

-- 4. Quick verification (should return rows without error):
-- select code, used_count from public.coupons order by created_at desc;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION: 2026-07_admin_content.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- ============================================================================
-- Edodwaja / MakersFlow — Admin Content Migration (Reviews moderation,
-- Quizzes, Lesson Resources, GST) — July 2026
-- Run in Supabase SQL Editor AFTER the earlier premium-features migration.
-- Idempotent — safe to re-run.
-- ============================================================================

-- ── Admin helper ─────────────────────────────────────────────────────────────
drop function if exists public.is_admin() cascade;
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer            -- bypasses RLS on the read below (no recursion)
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;
grant execute on function public.is_admin() to authenticated, anon;

-- ── 1. REVIEWS MODERATION ────────────────────────────────────────────────────
alter table public.reviews
  add column if not exists status text not null default 'pending'
    check (status in ('pending','approved','rejected'));

-- Existing reviews stay visible (they were public before moderation existed)
update public.reviews set status = 'approved' where status = 'pending'
  and created_at < now() - interval '1 minute';

create index if not exists idx_reviews_course_status
  on public.reviews (course_id, status, created_at desc);

-- Any insert/update by a non-admin goes back to 'pending' (users can't
-- self-approve, and editing an approved review re-queues it for moderation)
drop function if exists public.reviews_force_pending() cascade;
create or replace function public.reviews_force_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.status := 'pending';
    new.user_id := auth.uid();  -- users can only ever write as themselves
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reviews_force_pending on public.reviews;
create trigger trg_reviews_force_pending
  before insert or update on public.reviews
  for each row execute function public.reviews_force_pending();

alter table public.reviews enable row level security;

drop policy if exists "reviews read approved or own or admin" on public.reviews;
create policy "reviews read approved or own or admin" on public.reviews
  for select using (
    status = 'approved' or user_id = auth.uid() or public.is_admin()
  );

drop policy if exists "reviews insert own" on public.reviews;
create policy "reviews insert own" on public.reviews
  for insert with check (user_id = auth.uid());

drop policy if exists "reviews update own or admin" on public.reviews;
create policy "reviews update own or admin" on public.reviews
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "reviews delete own or admin" on public.reviews;
create policy "reviews delete own or admin" on public.reviews
  for delete using (user_id = auth.uid() or public.is_admin());

-- ── 2. QUIZZES ───────────────────────────────────────────────────────────────
-- The mobile quiz screen already reads quiz_questions(lesson_id, question_text,
-- options, correct_option_index, position); web reads quiz_questions_public.
create table if not exists public.quiz_questions (
  id                   uuid primary key default gen_random_uuid(),
  lesson_id            bigint not null,   -- matches integer lessons.id
  question_text        text not null,
  options              jsonb not null default '[]'::jsonb,
  correct_option_index int not null default 0,
  position             int not null default 0,
  created_at           timestamptz not null default now()
);
create index if not exists idx_quiz_questions_lesson
  on public.quiz_questions (lesson_id, position);

alter table public.quiz_questions enable row level security;
drop policy if exists "quiz questions read" on public.quiz_questions;
create policy "quiz questions read" on public.quiz_questions
  for select using (auth.uid() is not null);
drop policy if exists "quiz questions admin write" on public.quiz_questions;
create policy "quiz questions admin write" on public.quiz_questions
  for all using (public.is_admin()) with check (public.is_admin());

-- Answer-free view for the web app (does not expose correct_option_index)
create or replace view public.quiz_questions_public as
  select id, lesson_id, question_text, options, position
    from public.quiz_questions;
grant select on public.quiz_questions_public to authenticated, anon;

-- Attempts (web writes these; harmless if it already exists with same shape)
create table if not exists public.quiz_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  lesson_id       bigint not null,   -- matches integer lessons.id
  score           int not null default 0,
  total_questions int not null default 0,
  completed_at    timestamptz not null default now()
);
alter table public.quiz_attempts enable row level security;
drop policy if exists "quiz attempts own" on public.quiz_attempts;
create policy "quiz attempts own" on public.quiz_attempts
  for all using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ── 3. LESSON RESOURCES ──────────────────────────────────────────────────────
-- Web already reads lesson_resources(id, title, url, type, size_bytes)
create table if not exists public.lesson_resources (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  bigint not null,   -- matches integer lessons.id
  title      text not null,
  url        text not null,
  type       text default 'link',          -- 'pdf' | 'link' | 'video' | 'zip'
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists idx_lesson_resources_lesson
  on public.lesson_resources (lesson_id);

alter table public.lesson_resources enable row level security;
drop policy if exists "lesson resources read" on public.lesson_resources;
create policy "lesson resources read" on public.lesson_resources
  for select using (auth.uid() is not null);
drop policy if exists "lesson resources admin write" on public.lesson_resources;
create policy "lesson resources admin write" on public.lesson_resources
  for all using (public.is_admin()) with check (public.is_admin());

-- ── 4. GST on orders (mobile now records the tax breakdown like web) ────────
alter table public.orders
  add column if not exists tax_amount numeric default 0;

-- ── 5. Admin read access for moderation joins ───────────────────────────────
-- The reviews page joins profiles + courses; admins read everyone, users read
-- their own row. is_admin() is SECURITY DEFINER so this does not recurse.
drop policy if exists "profiles admin read"         on public.profiles;
drop policy if exists "Users can view own profile"   on public.profiles;
drop policy if exists "profiles read own"            on public.profiles;
drop policy if exists "profiles select own or admin" on public.profiles;
create policy "profiles select own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());

-- Verification queries (run manually if you like):
-- select status, count(*) from reviews group by status;
-- select * from quiz_questions_public limit 1;
-- select * from lesson_resources limit 1;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION: 2026-07_safety_net_tables.sql
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION: HOTFIX_profiles_rls.sql
-- ═══════════════════════════════════════════════════════════════════════════
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
drop function if exists public.is_admin() cascade;
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

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION: HOTFIX2_lessonid_reviews.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- ============================================================================
-- HOTFIX v2 — Quizzes/Resources "permission denied" + Reviews submit failure
-- Run in Supabase SQL Editor. Idempotent. Safe to re-run.
--
-- Root causes:
--  A) quiz_questions.lesson_id / lesson_resources.lesson_id were created as
--     UUID, but your `lessons.id` is an INTEGER (the quiz error proved it:
--     "invalid input syntax for type uuid: 8"). Column types must match.
--  B) reviews needs a unique(user_id, course_id) constraint for the app's
--     upsert (onConflict) to work, and the RLS/trigger must let a logged-in
--     user write their own review.
-- ============================================================================

-- ── A) Fix lesson_id column type to match lessons.id ────────────────────────
-- Detect the real type of lessons.id and rebuild the two tables to match.
-- Simplest robust approach: drop & recreate with the correct type. These
-- tables are new (added by the admin-content migration) so nothing depends
-- on their data yet.

do $$
declare
  v_type text;
begin
  select data_type into v_type
    from information_schema.columns
   where table_schema = 'public' and table_name = 'lessons' and column_name = 'id';

  -- Default to bigint if we can't detect (your app sends integers like "8")
  if v_type is null then v_type := 'bigint'; end if;

  -- Map information_schema type name to a usable column type
  if v_type in ('integer','bigint','smallint') then
    v_type := 'bigint';
  elsif v_type = 'uuid' then
    v_type := 'uuid';
  else
    v_type := 'text';  -- safe fallback that accepts anything
  end if;

  -- Rebuild quiz_questions with the correct lesson_id type
  execute 'drop table if exists public.quiz_questions cascade';
  execute format($f$
    create table public.quiz_questions (
      id                   uuid primary key default gen_random_uuid(),
      lesson_id            %s not null,
      question_text        text not null,
      options              jsonb not null default '[]'::jsonb,
      correct_option_index int not null default 0,
      position             int not null default 0,
      created_at           timestamptz not null default now()
    )$f$, v_type);

  -- Rebuild lesson_resources with the correct lesson_id type
  execute 'drop table if exists public.lesson_resources cascade';
  execute format($f$
    create table public.lesson_resources (
      id         uuid primary key default gen_random_uuid(),
      lesson_id  %s not null,
      title      text not null,
      url        text not null,
      type       text default 'link',
      size_bytes bigint,
      created_at timestamptz not null default now()
    )$f$, v_type);
end $$;

-- Indexes
create index if not exists idx_quiz_questions_lesson
  on public.quiz_questions (lesson_id, position);
create index if not exists idx_lesson_resources_lesson
  on public.lesson_resources (lesson_id);

-- RLS (read for any logged-in user, write for admins)
alter table public.quiz_questions enable row level security;
drop policy if exists "quiz questions read" on public.quiz_questions;
create policy "quiz questions read" on public.quiz_questions
  for select using (auth.uid() is not null);
drop policy if exists "quiz questions admin write" on public.quiz_questions;
create policy "quiz questions admin write" on public.quiz_questions
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.lesson_resources enable row level security;
drop policy if exists "lesson resources read" on public.lesson_resources;
create policy "lesson resources read" on public.lesson_resources
  for select using (auth.uid() is not null);
drop policy if exists "lesson resources admin write" on public.lesson_resources;
create policy "lesson resources admin write" on public.lesson_resources
  for all using (public.is_admin()) with check (public.is_admin());

-- Recreate the answer-free public view for the web app
create or replace view public.quiz_questions_public as
  select id, lesson_id, question_text, options, position
    from public.quiz_questions;
grant select on public.quiz_questions_public to authenticated, anon;

-- ── B) Reviews: unique constraint + working self-write policies ─────────────
-- The app upserts with onConflict "user_id,course_id"; that needs a matching
-- unique constraint or the insert fails.
create unique index if not exists uq_reviews_user_course
  on public.reviews (user_id, course_id);

alter table public.reviews enable row level security;

-- Rebuild the review policies cleanly (self can read own + approved; admin all)
drop policy if exists "reviews read approved or own or admin" on public.reviews;
create policy "reviews read approved or own or admin" on public.reviews
  for select using (
    status = 'approved' or user_id = auth.uid() or public.is_admin()
  );

drop policy if exists "reviews insert own" on public.reviews;
create policy "reviews insert own" on public.reviews
  for insert with check (user_id = auth.uid());

drop policy if exists "reviews update own or admin" on public.reviews;
create policy "reviews update own or admin" on public.reviews
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "reviews delete own or admin" on public.reviews;
create policy "reviews delete own or admin" on public.reviews
  for delete using (user_id = auth.uid() or public.is_admin());

-- Keep the "force pending for non-admins" trigger, but make it NOT overwrite
-- user_id on UPDATE (which would fight the upsert). It only defaults status.
drop function if exists public.reviews_force_pending() cascade;
create or replace function public.reviews_force_pending()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.status := 'pending';          -- users can't self-approve
    if tg_op = 'INSERT' then
      new.user_id := auth.uid();       -- stamp author on insert only
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reviews_force_pending on public.reviews;
create trigger trg_reviews_force_pending
  before insert or update on public.reviews
  for each row execute function public.reviews_force_pending();

-- ── Verify ──────────────────────────────────────────────────────────────────
-- select column_name, data_type from information_schema.columns
--  where table_name in ('quiz_questions','lesson_resources') and column_name='lesson_id';
-- (should match lessons.id's type — bigint for your DB)

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION: HOTFIX4_grants.sql (table-level GRANTs — must be LAST)
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION: SQL_lesson_notes.sql
-- ═══════════════════════════════════════════════════════════════════════════
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
