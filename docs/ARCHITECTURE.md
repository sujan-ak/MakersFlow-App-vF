# Architecture Documentation

This document describes the design, monorepo architecture, data flow, and components of the MakersFlow (Edodwaja) platform.

---

## Workspace Layout

The repository is structured as a monorepo containing multiple workspace packages under `artifacts/` and `lib/`:

### 1. Applications (`artifacts/`)
- **`mobile/`**: A universal cross-platform React Native app built with Expo SDK 54. It handles course listings, learning modules, store checkouts, and student profiles.
- **`api-server/`**: Express.js REST API server serving backend logic, processing payment confirmations, and managing rate limiting.
- **`mockup-sandbox/`**: A Vite-based web environment used by developers to build and test visual components in isolation.

### 2. Core Libraries (`lib/`)
- **`db/`**: Handles database connectivity, migrations, and schema mappings using Drizzle ORM.
- **`api-zod/`**: Contains Zod validation structures, which are auto-generated into typescript models and shared between frontend and backend.
- **`api-spec/`**: Houses OpenAPI-compliant specifications defining all REST endpoints.
- **`api-client-react/`**: React client libraries supplying fetch queries and mutation hooks.

---

## Authentication Flow

Authentication on the mobile application is managed by `AuthProvider` (`artifacts/mobile/context/AuthContextSupabase.tsx`):

1. **Supabase Client**: Initialized in `lib/supabase.ts` using public environment variables.
2. **Secure Persistence**: Implements an `ExpoSecureStoreAdapter` which persists user tokens securely via `expo-secure-store` on iOS/Android, falling back to `AsyncStorage` on web/older environments.
3. **Session Verification**: The root layout listens to auth state changes, directing unauthenticated traffic to the `(auth)/login` screen and checking for onboarding completion upon success.
4. **Single-Device Session Guard**: Writes a session identifier to the database on login. Other devices check this identifier periodically and prompt a sign-out if a newer session is active.

---

## Data Flow & Integration

```
┌─────────────────────────────────┐
│     mobile (Expo App Client)     │
└───────────────┬─────────────────┘
                │
                │ Webhook Confirm / RPC Checkout
                ▼
┌─────────────────────────────────┐       Database Writes       ┌────────────────────────┐
│    api-server (Express API)     ├────────────────────────────>│  Supabase (Postgres)   │
└─────────────────────────────────┘                             └────────────────────────┘
```

### 1. Client-Side State
- **Context Wrappers**: State is managed via local context providers (`CartContext`, `FavoritesContext`, `ProgressContext`, `NetworkContext`).
- **Progress Tracking**: Lesson progression is checked locally and saved periodically (every 5 seconds) to the database. If offline, the progress is cached in local storage and synced when the connection is restored.

### 2. Backend Orchestration
- **Payment Verification**: razorpay signatures are verified securely in the Express backend using raw request buffers.
- **Checkout Transactions**: Order creation, coupon verification, and student enrollment are combined inside single PostgreSQL atomic transactions (`complete_paid_order`) to ensure consistency.
- **Reconciliation**: A background cron-based reconciler checks for payment mismatches and automatically resolves stuck transactions.
