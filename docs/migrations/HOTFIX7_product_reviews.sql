-- ============================================================================
-- HOTFIX v7 — Product Reviews moderated system
-- Run in Supabase SQL Editor. Idempotent. Safe to re-run.
-- ============================================================================

-- 1. Create table public.product_reviews
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id bigint not null references public.products(id) on delete cascade,
  rating int not null check (rating >= 1 and rating <= 5),
  comment text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  constraint uq_product_reviews_user_product unique (user_id, product_id)
);

create index if not exists idx_product_reviews_product_status
  on public.product_reviews (product_id, status, created_at desc);

-- 2. Trigger function to force pending for non-admins (prevents self-approval)
create or replace function public.product_reviews_force_pending()
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

drop trigger if exists trg_product_reviews_force_pending on public.product_reviews;
create trigger trg_product_reviews_force_pending
  before insert or update on public.product_reviews
  for each row execute function public.product_reviews_force_pending();

-- 3. RLS policies
alter table public.product_reviews enable row level security;

drop policy if exists "product reviews read approved or own or admin" on public.product_reviews;
create policy "product reviews read approved or own or admin" on public.product_reviews
  for select using (
    status = 'approved' or user_id = auth.uid() or public.is_admin()
  );

drop policy if exists "product reviews insert own" on public.product_reviews;
create policy "product reviews insert own" on public.product_reviews
  for insert with check (user_id = auth.uid());

drop policy if exists "product reviews update own or admin" on public.product_reviews;
create policy "product reviews update own or admin" on public.product_reviews
  for update using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "product reviews delete own or admin" on public.product_reviews;
create policy "product reviews delete own or admin" on public.product_reviews
  for delete using (user_id = auth.uid() or public.is_admin());

grant select, insert, update, delete on public.product_reviews to authenticated, anon;

-- 4. Reload PostgREST schema cache
notify pgrst, 'reload schema';
