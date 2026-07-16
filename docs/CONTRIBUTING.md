# Developer Contribution & Setup Guide

This guide describes instructions on setting up, developing, and validating the MakersFlow (Edodwaja) workspace components locally.

---

## Workspace Setup

This project uses `pnpm` workspaces for package management. Before starting any application, you must install dependencies and build shared libraries.

### 1. Build Pipeline
Run the following commands in the root of the repository:
```bash
# Install dependencies across all packages
pnpm install

# Compile libraries (db, api-spec, api-zod, api-client-react)
pnpm run build
```

### 2. Validation Tasks
Before committing changes, ensure your code compiles and passes static type safety checks:
```bash
# Run typechecking across the entire workspace
pnpm run typecheck
```

---

## Application Workflows

### 1. Mobile Client (`artifacts/mobile`)
The mobile application is an Expo React Native client.

- **Start Metro Bundler**:
  ```bash
  cd artifacts/mobile
  pnpm start
  ```
- **Clear Metro Cache** (Run this if you experience bundler compilation issues or caching bugs):
  ```bash
  pnpm start --clear
  ```
- **Platform Flags**:
  - Web: Press `w` (or run `pnpm web`)
  - Android Emulator: Press `a` (or run `pnpm android`)
  - iOS Simulator: Press `i` (or run `pnpm ios`)

### 2. Express Backend Server (`artifacts/api-server`)
The REST API is written in Express.js.

- **Environment Setup**:
  Create a `.env` file inside `artifacts/api-server` specifying necessary database tokens and credentials.
- **Start Development Server**:
  ```bash
  cd artifacts/api-server
  pnpm run dev
  ```
  This command builds the entrypoint using `esbuild` and starts the app with hot reloading.

### 3. Mockup Sandbox (`artifacts/mockup-sandbox`)
The sandbox serves as an isolated playground using Vite and Tailwind CSS.

- **Start Sandbox Server**:
  ```bash
  cd artifacts/mockup-sandbox
  pnpm run dev
  ```
