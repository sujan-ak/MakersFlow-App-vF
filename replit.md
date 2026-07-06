# EDODWAJA

A student-focused educational mobile platform offering LMS courses, a store (physical kits + digital resources), a news feed, a quiz system, and student profile management.

## Run & Operate

- `pnpm --filter @workspace/mobile run dev` — run the Expo app (Android + Web via Expo Go)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo SDK 53, Expo Router (file-based routing)
- State: AsyncStorage (local persistence), TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (not yet wired to mobile)
- Styling: React Native StyleSheet with `useColors()` hook
- Icons: @expo/vector-icons (Feather), expo-symbols (iOS SF Symbols)
- Fonts: @expo-google-fonts/inter

## Where things live

- `artifacts/mobile/` — Expo React Native app
  - `app/` — file-based routes (Expo Router)
    - `(auth)/` — login, register, forgot-password
    - `(tabs)/` — home, courses, store, news, profile (5-tab layout)
    - `course/` — detail and learn screens
    - `quiz/` — quiz and result screens
    - `store/` — product detail, checkout, orders
    - `news/` — article detail
    - `profile/` — edit profile
    - `settings/` — security, notifications, help
  - `components/` — CourseCard, ProductCard, NewsCard, SearchBar, SectionHeader, Badge, SkeletonLoader
  - `context/` — AuthContext (AsyncStorage-based), CartContext
  - `data/mockData.ts` — all mock courses, products, news, quizzes
  - `constants/colors.ts` — color tokens (primary #4F46E5, secondary #F97316)
  - `hooks/useColors.ts` — color hook (already in scaffold)
  - `assets/images/` — icon.png, splash.png, course thumbnails (AI-generated)
- `artifacts/api-server/` — Express API (not yet connected to mobile)

## Architecture decisions

- **No backend for MVP**: Auth and cart state stored in AsyncStorage locally. No real authentication — login accepts any email/password.
- **File-based routing**: Expo Router with stack-in-tabs. All detail screens live outside the `(tabs)` group to avoid nested tab bars.
- **Color system**: Single `colors` object in `constants/colors.ts`. The `useColors()` hook reads `light.xxx` keys. Dark mode not yet implemented.
- **YouTube videos**: Learning screen opens video links via `expo-web-browser` instead of embedding WebView (avoids react-native-webview dependency).
- **Mock data only**: All courses, products, news, and quiz questions are in `data/mockData.ts`. No API calls in the mobile app yet.

## Product

- **Home**: Dashboard with stats banner, continue learning row, featured courses, shop highlights, and latest news
- **Courses**: Full catalog with search and category filter, progress tracking for enrolled courses
- **Store**: Physical kits (Robotics, AI, Electronics) and digital products (Notes, Question Banks) with cart and checkout
- **News**: Educational news feed with featured cards and article detail view
- **Profile**: Avatar, stats, settings menu, sign out
- **Quiz**: Multiple-choice quiz with timer, haptic feedback, explanations, and score result screen

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/mobile run dev` (not root `pnpm dev`) — the workflow sets required env vars
- After adding new packages, always restart the expo workflow
- `useColors()` returns `colors.light.*` values — update `constants/colors.ts` to change the theme
- All screens use `Platform.OS === "web" ? 67 : insets.top` to handle the web preview's top bar height

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `expo` skill for Expo-specific guidelines
