# MakersFlow

A mobile-first EdTech platform developed by **Edodwaja Pvt. Ltd.**

MakersFlow brings learning, assessments, engineering kits, learner progress, and student engagement into a single platform. The project is built as a monorepo containing the mobile application, backend services, shared libraries, and supporting documentation.

---

## Overview

MakersFlow is designed to provide a complete learning experience through a modern mobile application.

The platform enables users to:

- Discover and enroll in courses
- Learn through video-based content
- Track learning progress
- Complete quizzes and assessments
- Earn certificates and achievements
- Purchase engineering kits and learning resources
- Receive announcements and notifications
- Manage their profile and account settings

---

## Repository Structure

```text
.
├── artifacts/
│   ├── mobile/              # Expo React Native application
│   ├── api-server/          # Express backend services
│   └── mockup-sandbox/      # UI development sandbox
│
├── docs/                    # Project documentation
├── lib/                     # Shared packages and libraries
├── scripts/                 # Development utilities
├── supabase/                # Database resources
│
├── package.json
├── pnpm-workspace.yaml
└── PRODUCT.md
```

---

## Architecture

The project follows a layered architecture that separates presentation, business logic, and data access.

```text
Screens
    │
    ▼
Repositories
    │
    ▼
Services
    │
    ▼
Backend API / Supabase
```

This structure keeps the application modular, maintainable, and scalable as new features are introduced.

---

## Features

### Mobile Application (`artifacts/mobile`)

- Course discovery and enrollment
- Video-based learning experience
- Learning progress tracking
- Interactive quizzes
- Certificates and achievements
- User authentication
- Notifications and announcements
- Engineering kit storefront
- Shopping cart and checkout
- User profile management

### Backend API (`artifacts/api-server`)

- Express-based REST API
- Secure payment processing
- Rate limiting
- Request validation
- Payment reconciliation
- Webhook handling
- Production logging

### UI Sandbox (`artifacts/mockup-sandbox`)

- Component development
- UI prototyping
- Design experimentation
- Rapid interface validation

---

## Technology Stack

### Mobile

- React Native
- Expo SDK 54
- Expo Router
- TypeScript
- NativeWind

### Backend

- Node.js
- Express.js
- Supabase
- PostgreSQL

### State Management

- TanStack Query
- React Context

### Validation

- Zod

### Development

- pnpm Workspaces
- Drizzle ORM

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm

---

### Installation

Clone the repository.

```bash
git clone <repository-url>
```

Install dependencies.

```bash
pnpm install
```

---

## Running the Project

### Mobile Application

```bash
pnpm --filter @workspace/mobile run start
```

Run on the web.

```bash
pnpm --filter @workspace/mobile run web
```

---

### Backend API

```bash
pnpm --filter @workspace/api-server run dev
```

---

### UI Sandbox

```bash
pnpm --filter @workspace/mockup-sandbox run dev
```

---

## Development

Run TypeScript checks across the workspace.

```bash
pnpm run typecheck
```

Build all packages.

```bash
pnpm run build
```

---

## Documentation

Additional project documentation is available inside the `docs` directory.

| Document | Description |
|----------|-------------|
| `ARCHITECTURE.md` | System architecture and engineering handbook |
| `CONTRIBUTING.md` | Development workflow and contribution guidelines |
| `PRODUCT.md` | Product overview and vision |

---

## Engineering Principles

The project is built around a few core principles:

- Feature-oriented architecture
- Separation of concerns
- Repository pattern
- Service layer abstraction
- Centralized authentication
- Reusable components
- Predictable data flow
- Scalable project structure

---

## Contributing

Please read `docs/CONTRIBUTING.md` before contributing to the project.

---

## License

This project is developed for **Edodwaja Pvt. Ltd.**

Unless otherwise stated, all rights are reserved.
