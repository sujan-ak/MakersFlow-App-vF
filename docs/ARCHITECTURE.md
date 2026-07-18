# MakersFlow Architecture

This document provides a high-level overview of the MakersFlow architecture, workspace organization, authentication flow, and application data flow.

The goal is to help developers quickly understand how the platform is built and how new features integrate into the existing architecture.

---

# System Overview

```
                           MakersFlow

                  React Native Mobile App
                            │
                            ▼
                      Expo Router
                            │
                            ▼
                    Screens & Components
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
      React Context                  TanStack Query
 (Application State)                (Server State)
            │                               │
            └───────────────┬───────────────┘
                            ▼
                    Repository Layer
                            ▼
                     Service Layer
                            ▼
          ┌─────────────────┴─────────────────┐
          │                                   │
          ▼                                   ▼
    Express Backend                     Supabase
          │                                   │
          └─────────────────┬─────────────────┘
                            ▼
                       PostgreSQL
```

Every layer owns a single responsibility, making the application predictable, maintainable, and scalable.

---

# Workspace Layout

The repository is organized as a pnpm monorepo.

```
MakersFlow
│
├── artifacts
│   ├── mobile
│   │     Expo React Native application
│   │
│   ├── api-server
│   │     Express backend services
│   │
│   └── mockup-sandbox
│         UI development sandbox
│
├── lib
│   ├── db
│   ├── api-zod
│   ├── api-spec
│   └── api-client-react
│
├── docs
│
└── supabase
```

---

# Workspace Responsibilities

| Workspace | Responsibility |
|------------|----------------|
| `artifacts/mobile` | Mobile application |
| `artifacts/api-server` | Backend APIs and payment processing |
| `artifacts/mockup-sandbox` | UI prototyping |
| `lib/db` | Database schemas and migrations |
| `lib/api-zod` | Shared validation schemas |
| `lib/api-spec` | Shared API specifications |
| `lib/api-client-react` | Shared API client and query hooks |
| `docs` | Project documentation |
| `supabase` | Database resources |

---

# Mobile Application

The mobile application is built using:

- React Native
- Expo SDK 54
- Expo Router
- TypeScript

Primary responsibilities:

- Course browsing
- Video learning
- Student progress
- Store
- Orders
- Notifications
- User profile
- Authentication
- Certificates
- Quizzes

The mobile application never communicates directly with database tables.

All feature requests pass through repositories and services.

---

# Authentication Architecture

Authentication is managed by `AuthProvider`.

```
                 Application Launch
                         │
                         ▼
              Initialize Supabase Client
                         │
                         ▼
               Restore Previous Session
                         │
                         ▼
      SecureStore / AsyncStorage (Web Fallback)
                         │
                         ▼
                 Session Validation
                         │
            ┌────────────┴────────────┐
            │                         │
            ▼                         ▼
     Authenticated             Unauthenticated
            │                         │
            ▼                         ▼
     Load Application          Login / Onboarding
```

---

# Authentication Components

| Component | Responsibility |
|-----------|----------------|
| AuthProvider | Global authentication state |
| Supabase Client | Login, logout, registration |
| SecureStore | Secure token persistence |
| AsyncStorage | Web fallback storage |
| Root Layout | Route protection |
| Session Guard | Single-device session validation |

---

# Session Lifecycle

```
Login

↓

Generate Session

↓

Store Secure Token

↓

Update Database Session ID

↓

Restore Session On Next Launch

↓

Validate Session

↓

Continue
```

If another device creates a newer session, the current device is automatically signed out.

---

# Request Lifecycle

Every feature follows the same architecture.

```
User Action

↓

Screen

↓

Repository

↓

Service

↓

Backend API / Supabase

↓

Repository Result

↓

UI Update
```

This predictable request flow simplifies development.

---

# Repository Pattern

Repositories coordinate feature data.

```
Home Screen

↓

homeRepository

↓

CacheManager

↓

HomeService

↓

Supabase

↓

HomeData

↓

Home Screen
```

Repositories are responsible for:

- Cache coordination
- Combining multiple data sources
- Mapping backend models
- Returning feature-ready objects

Repositories never render UI.

---

# Client State

Application state is managed using React Context.

```
Application

↓

React Context

├── AuthContext
├── CartContext
├── FavoritesContext
├── ProgressContext
└── NetworkContext
```

Context manages only application state.

---

# Server State

Server state is managed with TanStack Query.

Examples include:

- Courses
- Products
- Orders
- Reviews
- News

React Query provides:

- Request caching
- Background refresh
- Retry handling
- Loading states

---

# Data Flow

```
                 User Interaction
                        │
                        ▼
                React Native Screen
                        │
                        ▼
                 Repository Layer
                        │
                        ▼
                  Service Layer
                        │
          ┌─────────────┴─────────────┐
          │                           │
          ▼                           ▼
     Express Backend            Direct Supabase
          │                           │
          └─────────────┬─────────────┘
                        ▼
                 PostgreSQL Database
                        │
                        ▼
                Repository Result
                        │
                        ▼
                   Screen Update
```

---

# Payment Flow

```
User Checkout

↓

Mobile App

↓

Express Backend

↓

Razorpay

↓

Payment Verification

↓

PostgreSQL Transaction

↓

Order Created

↓

Enrollment / Purchase Complete
```

Payment verification is performed only on the backend.

---

# Progress Synchronization

```
Watch Lesson

↓

Update Local Progress

↓

Every Few Seconds

↓

Sync Progress

↓

Supabase

↓

Continue Learning
```

If the user is offline, progress is cached locally and synchronized once connectivity is restored.

---

# Monorepo Communication

```
React Native App

↓

Shared API Client

↓

Express API

↓

Supabase

↓

Database
```

Shared packages ensure consistency between frontend and backend.

---

# Core Technologies

| Layer | Technology |
|--------|------------|
| Mobile | React Native + Expo |
| Routing | Expo Router |
| Language | TypeScript |
| Backend | Express.js |
| Database | Supabase PostgreSQL |
| ORM | Drizzle ORM |
| Validation | Zod |
| State | React Context + TanStack Query |
| Package Manager | pnpm Workspaces |

---

# Engineering Principles

The project follows several architectural principles.

- Separation of concerns
- Repository pattern
- Service layer abstraction
- Feature-oriented development
- Centralized authentication
- Shared validation models
- Reusable components
- Predictable data flow
- Offline-first learning experience
- Modular monorepo organization

---

# Adding a New Feature

Every feature should follow the same development flow.

```
Create Route

↓

Create Components

↓

Create Repository

↓

Create Service

↓

Integrate Backend

↓

Test

↓

Ship
```

Maintaining this workflow keeps the codebase consistent and easy to extend.

---

# Documentation

| File | Description |
|------|-------------|
| README.md | Project overview |
| PRODUCT.md | Product vision |
| docs/ARCHITECTURE.md | System architecture |
| docs/CONTRIBUTING.md | Development guide |

---

# Summary

MakersFlow is built around a layered architecture where every layer has a clearly defined responsibility.

```
User

↓

UI

↓

Repository

↓

Service

↓

Backend API / Supabase

↓

PostgreSQL
```

This architecture provides a scalable foundation for building new features while keeping the codebase maintainable, predictable, and easy to understand for new contributors.
