# Frontend — Claude Code Instructions

## Launch & Test Commands

### Prerequisites

All backend services must be running before starting the dev server or running tests:

```bash
docker-compose up -d
```

### Dev Server

```bash
cd frontend && npm run dev
```

Starts Vite on `http://localhost:5173`. The Vite proxy forwards `/graphql` requests to `http://web-bff:8001`, so the frontend never communicates with backend services directly — only through the web-bff.

### Test Commands

| Purpose | Command |
|---|---|
| Run all tests | `cd frontend && npx playwright test` |
| Run one file | `cd frontend && npx playwright test tests/<file>.spec.ts` |
| Run with grep | `cd frontend && npx playwright test --grep "test name"` |
| Show UI (debug) | `cd frontend && npx playwright test --ui` |
| Headed mode | `cd frontend && npx playwright test --headed` |

Always `cd frontend` before running playwright commands. Never run `npm run dev` and tests in the same shell — use background processes.

### Build

```bash
cd frontend && npm run build
```

Runs TypeScript compilation (`tsc`) followed by Vite production build. Output goes to `dist/`.

---

## Architecture Overview

The frontend is a React 18 + TypeScript SPA built with Vite. It is the only user-facing client in the CoinYan system.

### Role in the System

The frontend communicates exclusively with the `web-bff` service over GraphQL. There are no direct calls to any other microservice. All queries, mutations, and subscriptions go through Apollo Client, which proxies to `http://web-bff:8001/graphql` via the Vite dev server proxy.

### Tech Stack

- **React 18** with hooks — function components only, no class components
- **TypeScript** in strict mode throughout `src/`
- **Vite 5** — dev server, HMR, production bundler
- **Apollo Client 3** — all GraphQL data fetching, caching, and state management
- **React Router 6** — client-side routing with `createBrowserRouter`
- **@dnd-kit** — drag-and-drop for account reordering

### Feature-Sliced Design Layers

The `src/` directory follows Feature-Sliced Design (FSD). Layers are strictly ordered — a layer may only import from layers below it.

```
src/
  app/          # App shell: App.tsx, routing config, Apollo provider setup
  pages/        # Route-level page components (one folder per route)
  widgets/      # Composed multi-feature UI blocks (BottomNav, dashboards)
  features/     # Domain feature modules grouped by capability
  entities/     # Shared domain model types and fragments
  shared/       # Reusable utilities, UI primitives, Apollo client, token store
```

### Feature Modules (`src/features/`)

- `auth/` — sign-in, sign-up, sign-out, forgot-password, reset-password flows
- `account/` — create, edit, delete account features
- `category/` — category management
- `transaction/` — TransactionModal, TransferModal, EditTransactionDialog

---

## Rules and Conventions

### Data Fetching

- Use Apollo Client for all data fetching. No direct REST calls anywhere in the codebase.
- Keep GraphQL operations (queries, mutations) co-located with the component that uses them — do not centralise them in a separate file unless shared across multiple components.
- Use Apollo cache for derived/computed state wherever possible before reaching for `useState`.

### Authentication

- JWT access and refresh tokens must never be stored in `localStorage`. Use the in-memory token store at `src/shared/lib/token-store.ts`.
- Route guards live in `src/app/` and are wired into the React Router configuration.

### Testing

- This project has E2E tests only (Playwright). There are no unit tests or component tests. Do not create Jest or Vitest test files.
- All test files live in `tests/` and follow the naming pattern `<feature-description>.spec.ts`.
- The auth setup file is `tests/auth.setup.ts` — it handles login state for the test suite. Do not duplicate login logic in individual spec files.
- Maximum **2 fix attempts** per failing test before stopping and reporting to the user.

### TypeScript

- Strict mode is enabled in `tsconfig.json`. All new code must satisfy strict checks.
- Do not use `any` — use `unknown` with type narrowing, or define proper types.

### Component Conventions

- Function components with typed props interfaces only.
- Keep components small and single-purpose. Extract sub-components rather than nesting render logic.
- Use `React.lazy` + `Suspense` for heavy page-level components to keep the initial bundle small.

---

### Playwright Test Debugging Protocol

When a test fails, follow this fixed workflow — do NOT deviate or loop:

#### Step 1: Run the failing test in isolation

```bash
cd frontend && npx playwright test <test-file> --reporter=list 2>&1 | tail -50
```

Never run the full suite to debug a single test.

#### Step 2: Read the error output carefully

- Look at the exact assertion that failed
- Check the line number and the actual vs expected values
- Read the page snapshot or screenshot path if included

#### Step 3: Make ONE focused hypothesis and fix

- Identify the single most likely root cause
- Make the minimal change to fix it
- Do not refactor, rename, or touch unrelated code

#### Step 4: Verify with a single re-run

```bash
cd frontend && npx playwright test <test-file> --reporter=list 2>&1 | tail -50
```

#### Step 5: If still failing after 2 attempts — STOP and report

Do not attempt a third fix. Instead:

- Describe exactly what the test expects vs what is happening
- Show the relevant code diff you already tried
- Ask the user how to proceed

---

## Key Files and Structure

| Path | Description |
|---|---|
| `vite.config.ts` | Vite configuration; defines the `/graphql` proxy to `web-bff:8001` |
| `playwright.config.ts` | Playwright configuration; sets `baseURL`, timeouts, single worker, Chromium only |
| `tsconfig.json` | TypeScript compiler options; strict mode enabled |
| `package.json` | NPM scripts (`dev`, `build`, `test`, `test:headed`, `test:debug`) and dependency versions |
| `src/main.tsx` | App entry point; mounts `<App />` into the DOM |
| `src/app/App.tsx` | Root component; wraps the app in Apollo provider and sets up React Router |
| `src/shared/api/apollo-client.ts` | Apollo Client instance configuration (auth link, HTTP link, cache policies) |
| `src/shared/lib/token-store.ts` | In-memory JWT access/refresh token store — the only permitted token storage |
| `src/shared/lib/router/` | React Router route definitions and route guards |
| `src/shared/lib/format-currency.ts` | Currency formatting utility used across the UI |
| `src/shared/lib/format-date.ts` | Date formatting utility |
| `src/shared/lib/group-by-month.ts` | Groups transaction lists by calendar month for history views |
| `src/shared/ui/BottomNav.tsx` | Bottom navigation bar shared across authenticated pages |
| `src/shared/ui/CurrencyPicker.tsx` | Reusable currency selection component |
| `src/shared/lib/currencies/` | Static currency metadata (codes, symbols, display names) |
| `src/features/auth/` | Authentication feature: sign-in, sign-up, sign-out, forgot/reset-password |
| `src/features/account/` | Account feature: create, edit, delete account modals |
| `src/features/transaction/TransactionModal.tsx` | Modal for creating new expense/income transactions |
| `src/features/transaction/TransferModal.tsx` | Modal for creating transfer transactions between accounts |
| `src/features/transaction/EditTransactionDialog.tsx` | Dialog for editing an existing transaction |
| `src/entities/` | Shared domain model types and reusable GraphQL fragments |
| `src/pages/` | One folder per route (dashboard, accounts, categories, sign-in, sign-up, etc.) |
| `src/widgets/` | Composed UI blocks that combine multiple features (dashboard widgets, account lists) |
| `tests/` | All Playwright E2E spec files (37+ files) |
| `tests/auth.setup.ts` | Playwright auth setup — logs in once and saves storage state for the test suite |
| `tests/helpers.ts` | Shared test helper utilities used across spec files |
