# Task List: Transactions

- **Spec:** `context/spec/004-transactions/`
- **Approach:** Each slice is a complete vertical cut — runnable and testable before moving to the next.

---

## Slice 1: Infrastructure — `transactions-service` Starts Up

- [x] Add `transactions-db` (PostgreSQL, port 5435) and `transactions-service` (port 8004) containers to `docker-compose.yml`; both join `coinyan-net`; add `TRANSACTIONS_SERVICE_URL=http://transactions-service:8004` env var to `web-bff` **[Agent: devops-infra]**
- [x] Scaffold `transactions-service`: FastAPI app with `GET /health`, Pydantic `BaseSettings` config, Loguru logging, multi-stage Dockerfile — matching `categories-service` pattern **[Agent: python-backend]**
- [x] Create Alembic migration for `transactions-db`: `transactions` table with all columns + CHECK constraint + three indexes **[Agent: postgres-database]**
- [x] Add `TRANSACTIONS_SERVICE_URL: str` to `web-bff/app/config.py` **[Agent: python-backend]**
- [x] Verify: `GET http://localhost:8004/health` returns `{"status": "ok"}` **[Agent: devops-infra]**

---

## Slice 2: Create & List Transactions (backend + BFF)

- [x] Implement `Transaction` SQLAlchemy ORM model in `transactions-service/app/models/` **[Agent: postgres-database]**
- [x] Implement `TransactionRepository` with `create(...)` and `list_by_filter(account_id?, expense_category_id?, income_source_id?)` async methods **[Agent: python-backend]**
- [x] Implement `POST /internal/transactions` and `GET /internal/transactions` endpoints in `transactions-service` **[Agent: python-backend]**
- [x] Add `Transaction` Strawberry type, `CreateExpenseTransactionInput`, `CreateIncomeTransactionInput` to BFF schema **[Agent: python-backend]**
- [x] Add `createExpenseTransaction` and `createIncomeTransaction` mutations to BFF (orchestrate: create transaction + PATCH account balance) **[Agent: python-backend]**
- [x] Add `accountTransactions`, `expenseCategoryTransactions`, `incomeSourceTransactions` query resolvers to BFF **[Agent: python-backend]**

---

## Slice 3: Home Page Redesign + Drag-and-Drop

- [x] Install `@dnd-kit/core` and `@dnd-kit/utilities` in the frontend **[Agent: react-frontend]**
- [x] Create shared `CircleItem` component (`frontend/src/shared/ui/CircleItem.tsx`): circle with icon + name + optional subtitle; accepts draggable/droppable/highlighted props **[Agent: react-frontend]**
- [x] Create `entities/transaction/` entity: `Transaction` type, query/mutation gql documents, Apollo hooks **[Agent: react-frontend]**
- [x] Redesign `HomePage` with three sections (Accounts, Income Sources, Expense Categories) using `CircleItem`; wire existing Apollo hooks for data **[Agent: react-frontend]**
- [x] Implement drag-and-drop on `HomePage`: Account draggable → Category droppable (expense); Income Source draggable → Account droppable (income); highlight valid drop targets during drag **[Agent: react-frontend]**
- [x] Build `TransactionModal` (`features/transaction/TransactionModal.tsx`): amount + note fields, summary line, calls mutation on confirm **[Agent: react-frontend]**
- [x] Verify: Drag Cash → Groceries → enter amount → confirm. Check Cash balance decreased. Drag Freelance → Cash → enter amount → confirm. Check Cash balance increased. **[Agent: react-frontend]**

---

## Slice 4: Details Views

- [x] Build `AccountDetailPage` (`/accounts/:id`): shows account name/icon/balance + transaction list (date, amount, counterpart, note) using `accountTransactions` query **[Agent: react-frontend]**
- [x] Build `ExpenseCategoryDetailPage` (`/categories/expense/:id`): shows category name/icon/total spent + transaction list using `expenseCategoryTransactions` query **[Agent: react-frontend]**
- [x] Build `IncomeSourceDetailPage` (`/categories/income/:id`): shows income source name/icon/total received + transaction list using `incomeSourceTransactions` query **[Agent: react-frontend]**
- [x] Wire tap on `CircleItem` in `HomePage` to navigate to the appropriate detail route **[Agent: react-frontend]**
- [x] Verify: Tap Cash → see balance + transaction list. Tap Groceries → see total + transactions. **[Agent: react-frontend]**
