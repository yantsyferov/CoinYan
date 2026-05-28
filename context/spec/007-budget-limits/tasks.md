# Task List: Per-Category Budget Limits

- **Spec:** `context/spec/007-budget-limits/`
- **Status:** In Progress

---

## Slice 1: budgets-service — сервис запущен, REST-эндпоинты работают

_После этого слайса: `budgets-service` работает в Docker, `/health` отвечает, PUT/GET/DELETE для лимита работают через curl._

- [x] Создать `services/budgets-service/` по образцу `categories-service`: `Dockerfile`, `pyproject.toml`, `app/main.py`, `app/config.py`, модель `BudgetLimit`, репозиторий с UPSERT, роутер с `PUT /internal/budget-limits/{category_id}`, `DELETE /internal/budget-limits/{category_id}`, `GET /internal/budget-limits`, `GET /health`. **[Agent: python-backend]**
- [x] Alembic: создать начальную миграцию для таблицы `budget_limit` (`id UUID PK`, `user_id UUID NOT NULL`, `expense_category_id UUID NOT NULL`, `amount NUMERIC(19,4) CHECK > 0`, `created_at`, `updated_at`; UNIQUE на `(user_id, expense_category_id)`). **[Agent: python-backend]**
- [x] `docker-compose.yml`: добавить `budgets-db` (postgres:16-alpine) и `budgets-service` (порт 8005); добавить `BUDGETS_SERVICE_URL: http://budgets-service:8005` в env `web-bff`. **[Agent: python-backend]**
- [x] Верификация: `docker compose up budgets-service --build -d` → `curl http://localhost:8005/health` возвращает 200; PUT создаёт/обновляет лимит; GET возвращает список; DELETE удаляет. **[Agent: python-backend]**

---

## Slice 2: BFF — ExpenseCategory получает monthlyLimit, мутация setExpenseCategoryLimit

_После этого слайса: GraphQL-запрос возвращает `monthlyLimit`/`monthlySpent`; мутация сохраняет/снимает лимит._

- [x] BFF: добавить HTTP-клиент `budgets-service`; добавить поля `monthly_limit: float | None` и `budget_percent: float | None` в Strawberry-тип `ExpenseCategory`; обновить резолвер — `asyncio.gather` из трёх сервисов, graceful degradation при недоступности budgets-service. **[Agent: python-backend]**
- [x] BFF: добавить мутацию `setExpenseCategoryLimit(id: ID!, monthlyLimit: Float): ExpenseCategory` — `None` → DELETE, `>0` → PUT; возвращает обновлённую `ExpenseCategory`. **[Agent: python-backend]**
- [x] Фронтенд: добавить `monthlyLimit?: number | null` и `monthlySpent?: number` в `src/entities/category/model/types.ts`; расширить `EXPENSE_CATEGORIES_QUERY`; создать `src/entities/category/api/expense-category-limit.mutation.ts`. **[Agent: react-frontend]**
- [x] Верификация: GraphQL-запрос `expenseCategories { id name monthlyLimit monthlySpent }` возвращает `null` без лимита, корректное значение после мутации `setExpenseCategoryLimit`. **[Agent: python-backend]**

---

## Slice 3: Поле «Месячный лимит» на ExpenseCategoryDetailPage

_После этого слайса: пользователь может задать или убрать месячный лимит прямо с детальной страницы категории расходов._

- [x] Добавить поле ввода «Monthly Limit» в header-карточку категории в `src/pages/categories/ExpenseCategoryDetailPage.tsx`: controlled `<input type="number">`, `onBlur` → мутация (`>0` → сохранить, пусто → убрать лимит), inline-ошибка при вводе 0, отрицательного числа или текста. **[Agent: react-frontend]**
- [x] Верификация: в браузере открыть страницу категории; ввести значение и убрать фокус → лимит сохраняется без кнопки; очистить поле и убрать фокус → лимит снимается; ввести 0 → показывается ошибка, лимит не сохраняется. **[Agent: react-frontend]**

---

## Slice 4: Кольцевой прогресс-индикатор в CircleItem / HomePage

_После этого слайса: иконки категорий с лимитом на главном экране обёрнуты цветным SVG-кольцом._

- [x] Расширить `src/shared/ui/CircleItem.tsx` необязательным пропом `budgetRatio?: number`: SVG 80×80, `<circle r="34" cx="40" cy="40">`, `strokeDasharray="213.63"`, `strokeDashoffset = 213.63 × (1 − clamp(ratio, 0, 1))`; цвет: `<0.6` → `#22c55e`, `<0.85` → `#f97316`, `≥0.85` → `#ef4444`; кольцо скрыто, если `budgetRatio === undefined`. **[Agent: react-frontend]**
- [x] В `src/pages/home/HomePage.tsx` вычислить `budgetRatio = monthlySpent / monthlyLimit` для каждой категории расходов с лимитом и передавать в соответствующий `CircleItem`. **[Agent: react-frontend]**
- [x] Верификация: в браузере — 20% → зелёное частичное кольцо; 70% → оранжевое; 94% → красное; 120% → красное полное; категория без лимита → кольцо отсутствует. **[Agent: react-frontend]**

---

## Slice 5: Предупреждение в TransactionModal при превышении лимита

_После этого слайса: добавление расхода сверх лимита показывает мягкое предупреждение с возможностью подтвердить или отменить._

- [x] В `src/features/transaction/TransactionModal.tsx` добавить состояние `budgetWarning: boolean`; перед вызовом `CreateExpenseTransaction` проверить `monthlySpent + amount > monthlyLimit`; если да — показать предупреждение с кнопками «Confirm anyway» (продолжить с мутацией) и «Cancel» (вернуться к форме). Доходы и переводы — без изменений. **[Agent: react-frontend]**
- [x] Верификация: задать лимит $500 при $480 потраченных; попытаться добавить $40 → предупреждение появляется; нажать «Cancel» → расход не создаётся; нажать «Confirm anyway» → расход записывается, кольцо становится красным. **[Agent: react-frontend]**
