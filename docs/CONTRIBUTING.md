# Contributing to MakersFlow

Thank you for your interest in contributing to MakersFlow.

This guide explains how to set up the development environment, follow the project architecture, and contribute new features while maintaining consistency across the codebase.

---

# Development Philosophy

MakersFlow follows a layered architecture designed to keep the codebase modular and maintainable.

Every new feature should follow this flow:

```text
Screen
    │
    ▼
Repository
    │
    ▼
Service
    │
    ▼
Backend API / Supabase
```

Please avoid bypassing repositories or services by accessing the database directly from UI components.

---

# Prerequisites

Install the following before getting started:

- Node.js 20 or later
- pnpm
- Git
- Expo Go (optional for physical device testing)
- Android Studio or Xcode (optional for emulator testing)

---

# Clone the Repository

```bash
git clone <repository-url>

cd MakersFlow
```

---

# Install Dependencies

Install all workspace dependencies.

```bash
pnpm install
```

---

# Build Shared Packages

Compile shared libraries before running any application.

```bash
pnpm run build
```

---

# Running the Mobile Application

Navigate to the mobile workspace.

```bash
cd artifacts/mobile
```

Start the Expo development server.

```bash
pnpm start
```

If Metro cache becomes corrupted, clear it with:

```bash
pnpm start --clear
```

Useful shortcuts:

| Key | Action |
|-----|--------|
| `a` | Open Android Emulator |
| `i` | Open iOS Simulator |
| `w` | Open Web |
| `r` | Reload Application |
| `m` | Open Expo Menu |

---

# Running the Backend

Navigate to the backend workspace.

```bash
cd artifacts/api-server
```

Create a `.env` file containing the required environment variables.

Then start the development server.

```bash
pnpm run dev
```

---

# Running the UI Sandbox

Navigate to the sandbox.

```bash
cd artifacts/mockup-sandbox
```

Start the development server.

```bash
pnpm run dev
```

---

# Environment Variables

Environment files are intentionally excluded from version control.

Create the required `.env` files before running the project.

Typical variables include:

```text
SUPABASE_URL

SUPABASE_ANON_KEY

API_URL
```

Refer to the project owner if additional variables are required.

---

# Code Quality

Before opening a pull request, verify the project builds successfully.

Run TypeScript checks.

```bash
pnpm run typecheck
```

Build the workspace.

```bash
pnpm run build
```

Resolve any errors before submitting changes.

---

# Project Structure

```text
artifacts/
    mobile/
    api-server/
    mockup-sandbox/

docs/

lib/

supabase/

scripts/
```

Each directory has a dedicated responsibility.

Please avoid introducing unrelated files into existing folders.

---

# Coding Guidelines

When contributing:

- Follow the existing folder structure.
- Reuse components whenever possible.
- Keep components focused on presentation.
- Place business logic inside services.
- Use repositories for data access.
- Avoid duplicating functionality.
- Write clear and descriptive commit messages.

---

# Pull Request Guidelines

Before submitting a pull request:

- Ensure the project builds successfully.
- Ensure TypeScript reports no errors.
- Test the affected functionality.
- Keep pull requests focused on a single feature or bug fix.
- Update documentation when introducing significant architectural changes.

---

# Architecture

New features should follow the existing architecture.

```text
Feature

↓

Screen

↓

Repository

↓

Service

↓

Backend API / Supabase
```

Maintaining this structure keeps the codebase predictable and easier to maintain.

---

# Documentation

Additional documentation is available in the `docs` directory.

- `ARCHITECTURE.md` – Engineering handbook and system architecture.
- `PRODUCT.md` – Product overview and vision.
- `README.md` – Repository overview and setup instructions.

---

# Need Help?

If you're unsure where a feature belongs or how it should be implemented, review the architecture documentation before introducing a new pattern.

Consistency is preferred over clever implementations.
