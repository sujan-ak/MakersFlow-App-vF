# Edodwaja App — Premium Upgrade (July 2026)

Every gap in the "Current State, Gaps & Roadmap" document has been closed or
scaffolded. This file maps each PDF section to what changed, plus the setup
steps needed to activate the backend pieces.

Legend: ✅ shipped in this update · 🟢 was already implemented in the codebase · 🔧 needs config/deploy step

---

## 1. Authentication & Onboarding

| PDF item | Status | Where |
|---|---|---|
| WhatsApp OTP | ✅🔧 | `login.tsx` / `verify-otp.tsx` now route through new `sendWhatsappOtp` / `verifyWhatsappOtp` (AuthContext) → Supabase Edge Functions in `supabase/functions/send-whatsapp-otp` and `verify-whatsapp-otp`. Deploy them and set Twilio (or MSG91/Gupshup) secrets. Falls back gracefully ("use SMS instead") if not deployed. |
| Post-signup onboarding (age/school/grade) | ✅ | `register.tsx` collected grade/school but **discarded them** — fixed: they now flow into signup metadata and the auto-created profile. `app/index.tsx` also gates: any logged-in user with no grade/school (e.g. Google sign-ins) is routed to `(auth)/onboarding.tsx`. |
| Single-device login enforcement | ✅ | `AuthContextSupabase.tsx`: every sign-in writes a fresh `profiles.active_session_id`; every device validates it on app-foreground + every 60s. Older devices get "signed in on another device" and are logged out. Column added in the migration. |
| Suspicious login detection | 🟢 | `login_events` logging + same-hour different-device flagging already existed (`security-log.tsx`). Migration now versions the table + RLS. |
| Token expiry mid-lesson | ✅ | `lib/sessionEvents.ts` + `progressStorage.ts` detect auth failures during the 5-second progress saves; `learn.tsx` shows a "Session expired — Log In" prompt instead of failing silently. |

## 2. Landing Page (Home)

- 🟢 Promo banner carousel already existed (`promotions` table — now versioned in the migration with RLS).
- ✅ **Notification bell** with unread-count badge added to the home header.
- ✅ **`app/notifications.tsx`** — full notifications screen (unread styling, mark-one/mark-all read, pull-to-refresh, deep-links via the `link` column). The route was registered in `_layout.tsx` but the screen never existed — now it does. Backed by the new `notifications` table.

## 3. My Courses

- 🟢 `expires_at` (+1 year) was already set by `enrollmentService.enrollInCourse` and gated in `learn.tsx`.
- ✅ Migration adds the `enrollments.expires_at` column + **backfills existing enrollments** (enrolled_at + 1 year) + expiry index.
- ✅ **"Renew Access" CTA** on `course/[id].tsx` — replaces "Continue Learning" when access has lapsed, showing the expiry date and renewal price.
- 🟢 Certificates on completion already existed (`certificate.tsx`, triggered from the course page).

## 4. Progress Tab — 🟢 no gaps (confirmed).

## 5. Kits / Payments (the big one)

- 🟢 Razorpay client flow (create order → WebView checkout → server-side signature verify via edge functions) already existed.
- ✅ **Idempotent webhook handler** — `api-server/src/routes/razorpay.ts` `POST /api/razorpay/webhook`: verifies the HMAC against the **raw body**, dedupes on `x-razorpay-event-id` via the new `payment_events` unique table, marks orders paid and fulfills enrollments server-side. Duplicate deliveries are no-ops; failures return 500 so Razorpay retries.
- ✅ **Reconciliation** — `POST /api/razorpay/reconcile` (admin-secret protected): finds orders stuck pending >10 min, checks Razorpay's Orders API, settles them. Point a cron at it.
- ✅ **Refunds** — `POST /api/razorpay/refund` (admin-secret protected): calls Razorpay's refund API, marks the order refunded, never double-refunds.
- ✅ **Atomic checkout** — new `complete_paid_order()` Postgres function runs order-insert + enrollments + promo-counter in **one transaction** (no more "charged but not enrolled"). `checkout.tsx` calls it first and falls back to the legacy path until the migration is run.
- 🟢 Promo codes, invoices (PDF via expo-print, downloadable from orders) already existed; the `promo_codes` table shape is now versioned.

## 6. News — ✅ tab re-enabled in the bottom nav (`href: null` removed).

## 7. Profile & Settings

- 🟢 Feedback screen, share buttons already existed.
- ✅ **Real push notifications**: new `lib/pushNotifications.ts` registers the Expo push token into the new `push_tokens` table on every sign-in and when the settings toggle is enabled; token is removed on logout. (Requires a dev build — Expo Go can't do remote push, and the code detects that.)

## 8. Playback

- 🟢 Retry-with-backoff on video error + user-facing Try Again already existed.
- ✅ **Buffering watchdog**: if the player sits in "loading" >15s, a "Slow or unstable connection" prompt with **Reconnect** replaces the infinite spinner (`VideoPlayerEnhanced.tsx`).
- 🟢 Offline downloads already existed (`learn.tsx` + `downloadStorage`) — note the in-code TODO: add DRM/anti-piracy review before shipping this publicly.
- ✅ Session-expiry re-login prompt during playback (see §1).

## 9. Admin Dashboard

Still a separate web app (out of scope for this repo, as the PDF recommends) — but the api-server now exposes the admin primitives it needs: refund, reconcile, and the service-role Supabase client (`src/lib/supabaseAdmin.ts`).

## 10. Security / DB / Infra

- ✅ **Schema is now versioned in git**: `docs/migrations/2026-07_premium_features.sql` — every new table, column, **index**, and **RLS policy**, all idempotent.
- ✅ **Transactions**: `complete_paid_order()` (see §5).
- ✅ **Rate limiting**: `api-server/src/middlewares/rateLimit.ts` (per-IP sliding window) applied to all API routes.
- ⚠️ **Manual RLS audit still required** in the Supabase dashboard (the migration ends with the exact checklist: enrollments, orders, lesson_progress, profiles.role).
- ⚠️ Backups: check your Supabase plan settings (not a code concern).

---

## Setup steps to activate everything

1. **Run the migration**: paste `docs/migrations/2026-07_premium_features.sql` into the Supabase SQL editor. Idempotent — safe to re-run.
2. **api-server env vars**:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `ADMIN_API_SECRET`
   Then `pnpm install` (adds `@supabase/supabase-js`) and deploy. Point the Razorpay dashboard webhook at `https://<your-api>/api/razorpay/webhook` (events: `payment.captured`, `order.paid`, `payment.failed`).
3. **WhatsApp OTP** (optional): `supabase functions deploy send-whatsapp-otp verify-whatsapp-otp` and set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` secrets. Users must have a phone saved on their profile.
4. **Push notifications**: requires an EAS dev/production build (Expo Go can't receive remote pushes). Send pushes to the tokens in `push_tokens` via Expo's push API; write in-app copies to `notifications` so the bell/badge shows them.
5. **Cron the reconciler**: hit `POST /api/razorpay/reconcile` with header `x-admin-secret` every 5–10 minutes.
