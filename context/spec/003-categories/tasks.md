# Task List: Categories

- **Spec:** `context/spec/003-categories/`
- **Approach:** Each slice is a complete vertical cut — runnable and testable before moving to the next.

---

## Slice 1: Infrastructure — `categories-service` Starts Up

*Goal: `docker-compose up` brings up `categories-service` (port 8003) and `categories-db` without errors; `GET /health` returns `{"status": "ok"}` and the Alembic migration creates both `expense_categories` and `income_sources` tables.*

- [x] Add `categories-db` (PostgreSQL, port 5434) and `categories-service` (port 8003) containers to `docker-compose.yml`; both join `coinyan-net`; add `CATEGORIES_SERVICE_URL=http://categories-service:8003` env var to the `web-bff` service **[Agent: devops-infra]**
- [x] Scaffold `categories-service`: FastAPI app with `GET /health` returning `{"status": "ok"}`, Pydantic `BaseSettings` config (`DATABASE_URL`, `SENTRY_DSN`), Loguru structured JSON logging, multi-stage `Dockerfile` (non-root user) — matching the `accounts-service` pattern **[Agent: python-backend]**
- [x] Create the initial Alembic migration for `categories-db` — two tables: `expense_categories` (`id` UUID PK, `user_id` UUID NOT NULL, `name` TEXT NOT NULL, `icon` VARCHAR 50 NOT NULL, `created_at` TIMESTAMPTZ, `updated_at` TIMESTAMPTZ; `UNIQUE(user_id, name)`; `INDEX(user_id)`) and `income_sources` (identical structure with its own `UNIQUE(user_id, name)` and `INDEX(user_id)`) **[Agent: postgres-database]**
- [x] Add `CATEGORIES_SERVICE_URL: str` to `web-bff/app/config.py` **[Agent: python-backend]**
- [x] Verify: Run `docker-compose up --build`. Confirm `GET http://localhost:8003/health` returns `{"status": "ok"}`. Check `docker logs` to confirm migration ran and both `expense_categories` and `income_sources` tables were created without errors. **[Agent: devops-infra]**

---

## Slice 2: Categories List — See Default Expense Categories

*Goal: A signed-in user navigates to `/categories` and sees 9 default expense categories. The Income Sources section is empty with a prompt.*

- [x] Implement `ExpenseCategory` and `IncomeSource` SQLAlchemy ORM models in `categories-service/app/models/` mirroring the two table schemas **[Agent: postgres-database]**
- [x] Implement `ExpenseCategoryRepository` in `categories-service/app/repositories/expense_category_repo.py` with async methods: `get_by_user(user_id)`, `bulk_create(user_id, items: list[{name, icon}])` **[Agent: python-backend]**
- [x] Implement `IncomeSourceRepository` in `categories-service/app/repositories/income_source_repo.py` with async methods: `get_by_user(user_id)` **[Agent: python-backend]**
- [x] Implement `ExpenseCategoryService.get_or_seed(user_id, session)` in `categories-service/app/services/`: calls `get_by_user`; if empty, bulk-inserts the 9 defaults via `INSERT ... ON CONFLICT DO NOTHING`, then re-fetches; returns the list. Defaults: Groceries, Rent, Transport, Dining Out, Entertainment, Healthcare, Utilities, Shopping, Education — all with icon `"tag"` **[Agent: python-backend]**
- [x] Implement `GET /internal/expense-categories` and `GET /internal/income-sources` in `categories-service/app/routers/`; both read `X-User-Id` header; expense endpoint calls `ExpenseCategoryService.get_or_seed`; income endpoint calls `IncomeSourceRepository.get_by_user` directly **[Agent: python-backend]**
- [x] Add `Category` Strawberry type (`id`, `name`, `icon`, `createdAt`) and two query resolvers to `web-bff/app/schema.py`: `expenseCategories: [Category!]!` (GETs `/internal/expense-categories`) and `incomeSources: [Category!]!` (GETs `/internal/income-sources`); both extract `user_id` from JWT and set `X-User-Id` header **[Agent: python-backend]**
- [x] Create `entities/category` in the frontend: `Category` TypeScript type, `EXPENSE_CATEGORIES_QUERY` and `INCOME_SOURCES_QUERY` gql documents, `useExpenseCategories()` and `useIncomeSources()` Apollo hooks **[Agent: react-frontend]**
- [x] Build `CategoriesPage` (`/categories` route, protected) in `pages/categories/CategoriesPage.tsx`: two sections — "Expense Categories" and "Income Sources"; each section lists items as icon+name rows with a "+" button; shows empty-state prompt when a section has no items; uses the two hooks **[Agent: react-frontend]**
- [x] Add `/categories` to `App.tsx` as a protected route; add a navigation link to `/categories` from the home (`/`) page **[Agent: react-frontend]**
- [x] Verify: Sign in. Navigate to `http://localhost:5173/categories`. Confirm 9 default expense categories are listed. Confirm the Income Sources section shows an empty-state prompt. **[Agent: react-frontend]**

---

## Slice 3: Create a Category

*Goal: A user taps "+" and creates a new expense category or income source with a name and icon; it appears in the correct section immediately.*

- [x] Add `VALID_ICONS` constant to `categories-service/app/core/constants.py` (same set as `accounts-service`) **[Agent: python-backend]**
- [x] Implement `POST /internal/expense-categories` in `categories-service`: Pydantic v2 validation — `name` required and non-empty (trimmed), `icon` in `VALID_ICONS`; returns 409 if `(user_id, name)` already exists; returns created item with 201. Implement `POST /internal/income-sources` with identical logic against the `income_sources` table **[Agent: python-backend]**
- [x] Add `CreateCategoryInput` input type and two mutations to the BFF Strawberry schema: `createExpenseCategory(input: CreateCategoryInput!): Category!` (POSTs to `/internal/expense-categories`) and `createIncomeSource(input: CreateCategoryInput!): Category!` (POSTs to `/internal/income-sources`) **[Agent: python-backend]**
- [x] Build `features/category/create-category/CreateCategoryModal.tsx` in the frontend: modal with name text input and icon picker grid; accepts `onSave` mutation and `refetchQuery` as props so it works for both entity types; validates name required; shows server error on duplicate name; closes on success **[Agent: react-frontend]**
- [x] Wire the "+" buttons in `CategoriesPage`: expense "+" opens the modal passing `createExpenseCategory` mutation and `EXPENSE_CATEGORIES_QUERY`; income "+" passes `createIncomeSource` and `INCOME_SOURCES_QUERY` **[Agent: react-frontend]**
- [x] Verify: Tap "+" in Expense Categories. Enter "Coffee", select an icon, save. Confirm "Coffee" appears in the expense section. Tap "+" in Income Sources. Enter "Freelance", save. Confirm it appears in the income section. Try saving without a name — confirm error. Try creating "Coffee" again — confirm duplicate-name error. **[Agent: react-frontend]**

---

## Slice 4: Edit a Category

*Goal: A user taps an existing category and can change its name and icon; updates are reflected immediately.*

- [x] Implement `GET /internal/expense-categories/{id}` and `PATCH /internal/expense-categories/{id}` in `categories-service`: GET returns 404 if not owned; PATCH validates name non-empty and icon in `VALID_ICONS`, returns 409 on duplicate name, returns updated item. Implement identical `GET` and `PATCH` for `/internal/income-sources/{id}` **[Agent: python-backend]**
- [x] Add `UpdateCategoryInput` input type and four mutations to the BFF schema: `updateExpenseCategory(id: ID!, input: UpdateCategoryInput!): Category!` and `updateIncomeSource(id: ID!, input: UpdateCategoryInput!): Category!` **[Agent: python-backend]**
- [x] Build `features/category/edit-category/EditCategoryModal.tsx` in the frontend: modal pre-filled with current name and icon; accepts `onSave` mutation and `refetchQuery` as props; validates name non-empty; closes on success **[Agent: react-frontend]**
- [x] Wire tapping a category row in `CategoriesPage` to open `EditCategoryModal` with the appropriate mutation and refetch query **[Agent: react-frontend]**
- [x] Verify: Tap "Groceries". Change name to "Supermarket" and icon. Save. Confirm the row shows "Supermarket" with the new icon. Try clearing the name — confirm error. Tap "Freelance" in Income Sources, rename to "Contract Work", save. Confirm update. **[Agent: react-frontend]**

---

## Slice 5: Delete a Category

*Goal: A user can delete any category with a single confirmation; the item disappears from the list immediately.*

- [x] Implement `DELETE /internal/expense-categories/{id}` and `DELETE /internal/income-sources/{id}` in `categories-service`: both return 204 on success and 404 if not found or not owned **[Agent: python-backend]**
- [x] Add `deleteExpenseCategory(id: ID!): Boolean!` and `deleteIncomeSource(id: ID!): Boolean!` mutations to the BFF schema **[Agent: python-backend]**
- [x] Build `features/category/delete-category/DeleteCategoryConfirm.tsx` in the frontend: single-confirmation dialog; accepts `onConfirm` mutation and `refetchQuery` as props; calls the mutation on confirm and closes; cancelling leaves the list unchanged **[Agent: react-frontend]**
- [x] Wire a delete button (visible on each category row) in `CategoriesPage` to open `DeleteCategoryConfirm` with the appropriate mutation and refetch query **[Agent: react-frontend]**
- [x] Verify: Tap delete on "Transport". Confirm dialog appears. Cancel — "Transport" remains. Tap delete again and confirm — "Transport" is removed. Delete "Contract Work" from Income Sources — confirm it disappears. **[Agent: react-frontend]**
