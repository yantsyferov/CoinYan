# Technical Specification: At-a-Glance Financial Summary

- **Functional Specification:** `context/spec/009-at-a-glance-financial-summary/functional-spec.md`
- **Status:** Completed
- **Author(s):** yantsyferov

---

## 1. High-Level Technical Approach

Фича затрагивает два слоя: **Web BFF** и **React Frontend**. Бэкенд-микросервисы изменений не требуют — `transactions-service` уже поддерживает фильтрацию по `year`/`month` в эндпоинте `/totals`, а данные по счетам и бюджетам доступны через существующие сервисы.

**Изменения:**
1. **BFF (`web-bff/app/schema.py`)** — добавить новый GraphQL-запрос `dashboard(year, month)`, агрегирующий данные из 4 сервисов параллельно.
2. **Frontend** — новая страница `/dashboard`, новый GraphQL-запрос, компонент выбора периода, карточки показателей, список категорий с прогресс-баром.
3. **Frontend навигация** — новый шаренный `BottomNav` компонент, встроенный в `ProtectedRoute`-обёртку, чтобы появляться на всех защищённых страницах.

Данные периода (year/month) хранятся в локальном React-состоянии страницы (не в URL).

---

## 2. Proposed Solution & Implementation Plan

### 2.1. BFF: новые типы данных

Добавить в `services/web-bff/app/schema.py` два новых Strawberry-типа:

**`DashboardCategoryItem`**

| Поле | Тип | Описание |
|---|---|---|
| `id` | `ID` | Идентификатор категории |
| `name` | `str` | Название |
| `icon` | `str` | Ключ иконки (строка, как в существующих типах) |
| `amount` | `float` | Сумма расходов за период |
| `share` | `float` | Доля от общих расходов, 0–100 |
| `monthly_limit` | `float \| None` | Месячный лимит, если установлен |
| `budget_percent` | `float \| None` | % использования лимита, если установлен |

**`DashboardSummary`**

| Поле | Тип | Описание |
|---|---|---|
| `total_income` | `float` | Сумма доходов за период |
| `total_expenses` | `float` | Сумма расходов за период |
| `net_balance` | `float` | `total_income − total_expenses` |
| `total_account_balance` | `float` | Сумма `current_balance` всех активных счетов |
| `categories` | `list[DashboardCategoryItem]` | Разбивка по категориям, отсортированная по убыванию `amount` |

### 2.2. BFF: новый GraphQL-запрос

```
dashboard(year: Int, month: Int) -> DashboardSummary
```

Параметры `year` и `month` опциональны; если не переданы — используются текущий год и месяц (аналогично тому, как это сделано в `TransactionRepository.get_totals`).

**Логика запроса (параллельно через `asyncio.gather`):**
1. `GET /internal/transactions/totals?year=&month=` — из `transactions-service`
2. `GET /internal/accounts` — из `accounts-service` (для суммирования балансов)
3. `GET /internal/budget-limits` — из `budgets-service`
4. `GET /internal/expense-categories` — из `categories-service` (для иконок и названий)

**Вычисления в BFF:**
- `total_income` = сумма всех `income_sources` из ответа totals
- `total_expenses` = сумма всех `expense_categories` из ответа totals
- `net_balance` = `total_income − total_expenses`
- `total_account_balance` = сумма `current_balance` по всем активным счетам
- Для каждой категории с ненулевыми тратами: `share = (amount / total_expenses * 100)`, `budget_percent = (amount / monthly_limit * 100)` если лимит задан
- Результирующий список отсортирован по `amount` убыванию

### 2.3. Frontend: GraphQL-запрос

Новый файл `frontend/src/entities/dashboard/api/dashboard.query.ts`:

```graphql
query Dashboard($year: Int, $month: Int) {
  dashboard(year: $year, month: $month) {
    totalIncome
    totalExpenses
    netBalance
    totalAccountBalance
    categories {
      id
      name
      icon
      amount
      share
      monthlyLimit
      budgetPercent
    }
  }
}
```

### 2.4. Frontend: новые файлы и компоненты

**Новые файлы:**

| Путь | Ответственность |
|---|---|
| `src/pages/dashboard/DashboardPage.tsx` | Главный компонент страницы |
| `src/entities/dashboard/api/dashboard.query.ts` | GraphQL-запрос |
| `src/shared/ui/BottomNav.tsx` | Шаренный нижний навигационный бар |

**Изменяемые файлы:**

| Путь | Изменение |
|---|---|
| `src/app/App.tsx` | Добавить защищённый роут `/dashboard → DashboardPage` |
| `src/shared/lib/router/ProtectedRoute.tsx` | Встроить `<BottomNav />` в layout, добавить нижний padding к контенту |

**`DashboardPage`** — локальный стейт `{ year: number, month: number }`, инициализированный текущей датой. Использует `useQuery(DASHBOARD_QUERY, { variables: { year, month }, fetchPolicy: 'cache-and-network' })`. Рендерит три sub-секции:
- **PeriodSelector** (inline): кнопки `‹` / `›`, заголовок месяца с кликом на `<input type="month">` для пикера, кнопка «Today» (скрыта когда уже текущий месяц)
- **SummaryCards**: 4 карточки с подписями и значениями
- **CategoryBreakdown**: список строк с иконкой, названием, суммой и прогресс-баром

**Прогресс-бар** использует ту же логику цветового кодирования, что и существующие `CircleItem` бюджетные кольца: зелёный < 60%, оранжевый < 85%, красный ≥ 85% (применяется только для категорий с лимитом; без лимита — нейтральный цвет).

**`BottomNav`**: фиксированный `position: fixed; bottom: 0` бар с двумя табами — **Home** (иконка 🏠, `/`) и **Dashboard** (иконка 📊, `/dashboard`). Активный таб выделяется цветом на основе текущего `location.pathname` через `useLocation()`.

---

## 3. Impact and Risk Analysis

**Зависимости:**
- Дашборд зависит от 4 микросервисов одновременно. Деградация любого из них влияет на дашборд.
- `BottomNav` добавляется ко всем защищённым страницам — нужно протестировать, что существующие страницы не ломаются.

**Риски и митигация:**

| Риск | Митигация |
|---|---|
| Один из сервисов недоступен → дашборд падает полностью | В BFF: `asyncio.gather` с обработкой ошибок; если `budgets-service` или `categories-service` недоступны — вернуть пустые значения вместо исключения |
| BottomNav перекрывает контент страниц снизу | В `ProtectedRoute`: добавить `padding-bottom: 64px` к контент-обёртке |
| Нативный `<input type="month">` рендерится по-разному в Safari vs Chrome | Использовать `<input type="month">` как fallback; если внешний вид критичен — заменить простым `<select>` для года и месяца |
| Большое число категорий → длинный список на дашборде | Показывать категории без ограничений в V1; пагинация — в Phase 4 |

---

## 4. Testing Strategy

**E2E-тесты (Playwright)** — новый файл `frontend/tests/dashboard.spec.ts`:

- По умолчанию открывается текущий месяц и данные соответствуют ожидаемым
- Нажатие `‹` переключает на предыдущий месяц; заголовок и цифры обновляются
- Кнопка «Today» возвращает к текущему месяцу после перехода в прошлое
- Кнопка «Today» не видна / недоступна, когда уже открыт текущий месяц
- Для месяца без транзакций все суммы отображаются как $0 и виден поясняющий текст
- Клик по строке категории открывает её детальную страницу
- `BottomNav` присутствует на `/` и на `/dashboard`; активная вкладка подсвечивается
