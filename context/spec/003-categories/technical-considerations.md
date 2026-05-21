# Technical Specification: Categories

- **Functional Specification:** `context/spec/003-categories/functional-spec.md`
- **Status:** Completed

---

## 1. High-Level Technical Approach

A new `categories-service` (port **8003**) with its own PostgreSQL database (`categories-db`, port **5434**) follows the exact same pattern as `accounts-service`. The BFF gains new GraphQL types, queries, and mutations for categories. The frontend gets a `CategoriesPage` with two sections — Expense Categories and Income Sources — backed by the same Apollo/FSD patterns already in use.

The 9 default expense categories are seeded lazily on first access (same pattern as the Cash account in `accounts-service`), using `INSERT ... ON CONFLICT DO NOTHING` to guarantee idempotency.

---

## 2. Proposed Solution & Implementation Plan

### 2.1 Architecture Changes

New containers in `docker-compose.yml`:
- `categories-db` — PostgreSQL, external port 5434, joins `coinyan-net`
- `categories-service` — built from `services/categories-service/Dockerfile`, port 8003, joins `coinyan-net`
- `CATEGORIES_SERVICE_URL=http://categories-service:8003` added to `web-bff` env

New service directory: `services/categories-service/` — mirrors `accounts-service` structure exactly.

### 2.2 Data Model

Two separate tables — expense categories and income sources are distinct entities.

**Table: `expense_categories`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` default |
| `user_id` | UUID NOT NULL | owner; no FK (services decoupled) |
| `name` | TEXT NOT NULL | trimmed, non-empty |
| `icon` | VARCHAR(50) NOT NULL | key from `VALID_ICONS` constant |
| `created_at` | TIMESTAMPTZ NOT NULL | `now()` default |
| `updated_at` | TIMESTAMPTZ NOT NULL | `now()` default |

**Constraint:** `UNIQUE (user_id, name)` — no duplicate names per user.
**Index:** `(user_id)` — fast lookup of a user's expense categories.

---

**Table: `income_sources`**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` default |
| `user_id` | UUID NOT NULL | owner; no FK (services decoupled) |
| `name` | TEXT NOT NULL | trimmed, non-empty |
| `icon` | VARCHAR(50) NOT NULL | key from `VALID_ICONS` constant |
| `created_at` | TIMESTAMPTZ NOT NULL | `now()` default |
| `updated_at` | TIMESTAMPTZ NOT NULL | `now()` default |

**Constraint:** `UNIQUE (user_id, name)` — no duplicate names per user.
**Index:** `(user_id)` — fast lookup of a user's income sources.

### 2.3 API Contracts (`categories-service`)

Two separate routers, both reading `X-User-Id` header via `get_user_id` dependency.

**Expense categories** — prefix `/internal/expense-categories`:

| Method | Path | Request body | Response | Notes |
|---|---|---|---|---|
| `GET` | `/internal/expense-categories` | — | `[ExpenseCategory]` | seeds 9 defaults on first call if list is empty |
| `POST` | `/internal/expense-categories` | `{name, icon}` | `ExpenseCategory` 201 | 409 on duplicate name |
| `GET` | `/internal/expense-categories/{id}` | — | `ExpenseCategory` | 404 if not owned |
| `PATCH` | `/internal/expense-categories/{id}` | `{name, icon}` | `ExpenseCategory` | 409 on duplicate name |
| `DELETE` | `/internal/expense-categories/{id}` | — | 204 | 404 if not owned |

Seeding logic in `ExpenseCategoryService.get_or_seed(user_id, session)`: if the user has no expense categories, bulk-insert the 9 defaults via `INSERT ... ON CONFLICT DO NOTHING`, then re-fetch.

**Default expense categories (seeded on first access):** Groceries, Rent, Transport, Dining Out, Entertainment, Healthcare, Utilities, Shopping, Education.

---

**Income sources** — prefix `/internal/income-sources`:

| Method | Path | Request body | Response | Notes |
|---|---|---|---|---|
| `GET` | `/internal/income-sources` | — | `[IncomeSource]` | no seeding — starts empty |
| `POST` | `/internal/income-sources` | `{name, icon}` | `IncomeSource` 201 | 409 on duplicate name |
| `GET` | `/internal/income-sources/{id}` | — | `IncomeSource` | 404 if not owned |
| `PATCH` | `/internal/income-sources/{id}` | `{name, icon}` | `IncomeSource` | 409 on duplicate name |
| `DELETE` | `/internal/income-sources/{id}` | — | 204 | 404 if not owned |

### 2.4 BFF Schema Changes (`web-bff/app/schema.py`)

Shared Strawberry type (fields are identical for both entities):
```
Category { id, name, icon, createdAt }
```

Shared input types:
```
CreateCategoryInput { name, icon }
UpdateCategoryInput { name, icon }
```

New queries:
```
expenseCategories: [Category!]!
incomeSources: [Category!]!
```

New mutations:
```
createExpenseCategory(input: CreateCategoryInput!): Category!
updateExpenseCategory(id: ID!, input: UpdateCategoryInput!): Category!
deleteExpenseCategory(id: ID!): Boolean!

createIncomeSource(input: CreateCategoryInput!): Category!
updateIncomeSource(id: ID!, input: UpdateCategoryInput!): Category!
deleteIncomeSource(id: ID!): Boolean!
```

All resolvers extract `user_id` from the Bearer token (same `_extract_user_id` helper), set `X-User-Id` header, and forward to the appropriate `categories-service` endpoint (`/internal/expense-categories` or `/internal/income-sources`).

### 2.5 Frontend Component Breakdown (FSD)

**New entity:** `frontend/src/entities/category/`
- `model/types.ts` — `Category` interface `{id, name, icon, createdAt}`
- `api/expense-categories.query.ts` — `EXPENSE_CATEGORIES_QUERY` gql document
- `api/income-sources.query.ts` — `INCOME_SOURCES_QUERY` gql document
- `hooks/useExpenseCategories.ts` — Apollo hook
- `hooks/useIncomeSources.ts` — Apollo hook
- `index.ts` — barrel exports

**New features:**
- `features/category/create-category/` — modal with name input + icon picker; receives a `mutation` prop so it works for both entity types; called from each section's "+" button
- `features/category/edit-category/` — modal pre-filled; same dual-use pattern via props
- `features/category/delete-category/` — single-confirmation modal; receives the appropriate delete mutation via props

**New page:** `pages/categories/CategoriesPage.tsx`
- Two sections: Expense Categories, Income Sources
- Each section: list of icon+name rows with edit/delete actions + "+" button
- Protected route at `/categories`

**Routing:** `/categories` added to `App.tsx` inside `ProtectedRoute`; navigation link added on `HomePage`.

**Config:** `CATEGORIES_SERVICE_URL: str` added to `web-bff/app/config.py`.

---

## 3. Impact and Risk Analysis

- **System Dependencies:** `accounts-service` and `categories-service` are independent. The BFF is the only consumer of both. `transactions-service` (spec 004) will depend on categories existing.
- **Seeding race condition:** Two concurrent first-time requests could both see an empty list. `ON CONFLICT DO NOTHING` on `UNIQUE(user_id, name)` in `expense_categories` makes this safe — duplicates are silently skipped.
- **Deleted category + transactions:** `categories-service` stores no transaction references; transactions (spec 004) will store `expense_category_id` / `income_source_id` as plain UUIDs with no FK. Deletion is safe — orphaned IDs render as "uncategorized" at the BFF level.

---

## 4. Testing Strategy

- **Backend:** Pytest with a real `categories-db` test database (same pattern as `accounts-service`). Cover: seeding idempotency, duplicate name rejection (409), ownership enforcement (404 on wrong user), CRUD happy paths.
- **BFF:** Manual `curl` / GraphQL Playground smoke tests for each resolver.
- **Frontend:** Browser verification following the verify task in the task list.
