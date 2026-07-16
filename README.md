# MakersFlow (Edodwaja) Workspace

Welcome to the MakersFlow (Edodwaja) monorepo. This repository contains the unified codebase for the Edodwaja universal mobile learning platform, its API server, shared database packages, and a component development sandbox.

## Repository Overview

This project is organized as a monorepo managed using `pnpm` workspaces. It includes the following components:

```
c:/dev/MF/
├── artifacts/
│   ├── mobile/             # Expo React Native mobile application
│   ├── api-server/         # Express REST API backend server
│   └── mockup-sandbox/     # Vite-based UI component sandbox
├── lib/
│   ├── db/                 # Drizzle ORM schema mappings & DB migrations
│   ├── api-zod/            # Shared Zod validation schemas
│   ├── api-spec/           # Shared API endpoint specifications
│   └── api-client-react/   # Shared React query hooks and client stubs
└── docs/
    └── migrations/         # SQL migration scripts for database tables
```

---

## Features

### 1. Universal Mobile Learning App (`artifacts/mobile`)
- **LMS Course Catalog**: Browse courses, track lesson progress, and play educational video content in-app using native player bindings.
- **Interactive Quizzes**: Multiple-choice testing per module with custom timers and haptic feedback.
- **Storefront**: Purchase physical kit components (Robotics, Electronics, IoT) and digital learning resources.
- **Notifications & Broadcasts**: Unread-count badges, broadcast announcements, and notification history.
- **User Dashboard**: Progress stats, certificates of completion, and user security/session logs.

### 2. Express API Backend (`artifacts/api-server`)
- Express-based REST API handling payments reconciliation, refunds, and rate limiting.
- Structured pino logs for production observability.
- Idempotent webhooks for payment processing.

### 3. Mockup Sandbox (`artifacts/mockup-sandbox`)
- A lightweight, Vite-powered workspace to preview, prototype, and refine design elements in isolation.

---

## Technical Stack

- **Package Manager**: `pnpm` workspaces
- **Frontend Framework**: Expo SDK 54 / React Native
- **Router**: Expo Router (file-based navigation)
- **Backend Framework**: Express.js
- **Database Mapping**: Drizzle ORM & PostgreSQL
- **State Management**: TanStack Query & React Context
- **Validation**: Zod schema validation
- **Styling**: Tailwind CSS (mockup environment) & React Native StyleSheet with custom color tokens (mobile environment)

---

## Getting Started

### Prerequisites
Ensure you have the following installed locally:
- Node.js (version 24 or newer recommended)
- `pnpm` package manager

### Installation

1. Install workspace dependencies:
   ```bash
   pnpm install
   ```

2. Build shared libraries (required before starting services):
   ```bash
   pnpm run build
   ```

### Running Services

- **Mobile App**:
  To start the Expo development server:
  ```bash
  pnpm --filter @workspace/mobile run start
  ```
  Or to open the mobile application directly in the web browser:
  ```bash
  pnpm --filter @workspace/mobile run web
  ```

- **API Server**:
  To start the backend in development mode:
  ```bash
  pnpm --filter @workspace/api-server run dev
  ```

- **Mockup Sandbox**:
  To start the Vite UI component preview environment:
  ```bash
  pnpm --filter @workspace/mockup-sandbox run dev
  ```

### Code Validation

To run TypeScript compiler checks across all workspaces:
```bash
pnpm run typecheck
```
