# Tasks: At-a-Glance Financial Summary

---

## Slice 1: Bottom Navigation Bar

Минимальная видимая ценность — шаренный нав-бар появляется на всех страницах приложения.

- [x] В `src/shared/ui/BottomNav.tsx` создать компонент с двумя табами: **Home** (`/`) и **Dashboard** (`/dashboard`). Активный таб выделяется цветом через `useLocation()`. **[Agent: react-frontend]**
- [x] В `src/shared/lib/router/ProtectedRoute.tsx` встроить `<BottomNav />` в layout и добавить `paddingBottom: 64px` к контент-обёртке. **[Agent: react-frontend]**
- [x] В `src/app/App.tsx` добавить пустой защищённый роут `/dashboard` (временный placeholder-компонент, чтобы таб не вёл в 404). **[Agent: react-frontend]**
- [x] Запустить приложение, открыть Home Page в браузере. Проверить: нав-бар виден снизу, таб «Home» активен, контент не перекрыт. Перейти по табу «Dashboard» — открывается placeholder без ошибок. **[Agent: react-frontend]**

---

## Slice 2: BFF — GraphQL-запрос `dashboard`

Добавить серверную агрегацию данных; фронтенд пока не использует.

- [x] В `services/web-bff/app/schema.py` добавить Strawberry-типы `DashboardCategoryItem` и `DashboardSummary` согласно таблицам из tech spec. **[Agent: python-backend]**
- [x] Добавить GraphQL-запрос `dashboard(year: Int, month: Int) -> DashboardSummary`: параллельный `asyncio.gather` по 4 сервисам (transactions totals, accounts, budget-limits, expense-categories), вычисление полей, сортировка категорий по `amount` убыванию. Если вспомогательный сервис недоступен — возвращать пустые значения вместо исключения. **[Agent: python-backend]**
- [x] Пересобрать Docker-образ `web-bff` и перезапустить контейнер. Выполнить GraphQL-запрос `{ dashboard { totalIncome totalExpenses netBalance totalAccountBalance categories { name amount share } } }` через curl или GraphQL playground. Проверить: возвращаются корректные данные за текущий месяц. **[Agent: python-backend]**

---

## Slice 3: Dashboard Page — сводные показатели

Страница `/dashboard` показывает 4 суммовых карточки за текущий месяц.

- [x] Создать файл `src/entities/dashboard/api/dashboard.query.ts` с GraphQL-запросом `Dashboard($year: Int, $month: Int)`, запрашивающим все поля `DashboardSummary`. **[Agent: react-frontend]**
- [x] Создать `src/pages/dashboard/DashboardPage.tsx`: локальный стейт `{ year, month }` инициализированный текущей датой, `useQuery(DASHBOARD_QUERY, { variables: { year, month }, fetchPolicy: 'cache-and-network' })`, отображение 4 карточек (Total Income, Total Expenses, Net Balance, Total Account Balance) с состоянием загрузки. **[Agent: react-frontend]**
- [x] Заменить placeholder в `App.tsx` на реальный `DashboardPage`. **[Agent: react-frontend]**
- [x] Открыть `/dashboard` в браузере. Проверить: 4 карточки видны, значения соответствуют реальным данным за текущий месяц. Net Balance = Income − Expenses. **[Agent: react-frontend]**

---

## Slice 4: Dashboard Page — переключатель периода

Пользователь может листать месяцы и видеть пересчитанные данные.

- [x] Добавить в `DashboardPage` блок выбора периода: кнопки `‹` / `›` меняют `{ year, month }` в локальном стейте, заголовок отображает название месяца и год (например, «May 2026»). Клик по заголовку открывает нативный `<input type="month">` для прямого выбора периода. **[Agent: react-frontend]**
- [x] Добавить кнопку «Today»: видна только тогда, когда отображаемый период не совпадает с текущим месяцем; нажатие возвращает стейт к текущей дате. **[Agent: react-frontend]**
- [x] Открыть `/dashboard` в браузере. Нажать `‹` — данные пересчитываются для предыдущего месяца, кнопка «Today» появляется. Нажать «Today» — возврат к текущему месяцу, кнопка скрывается. Выбрать месяц через пикер — данные обновляются. **[Agent: react-frontend]**

---

## Slice 5: Dashboard Page — разбивка по категориям и пустое состояние

Финальный слайс добавляет список категорий и обработку пустого периода.

- [x] Добавить в `DashboardPage` секцию «Spending by Category»: список строк с иконкой (через существующий `ACCOUNT_ICONS`), названием, суммой и прогресс-баром. Для категорий без лимита — нейтральный цвет, ширина = `share%`. Для категорий с лимитом — цвет по `budgetPercent` (зелёный < 60%, оранжевый < 85%, красный ≥ 85%). Нажатие на строку — переход на `/categories/expense/:id`. **[Agent: react-frontend]**
- [x] Добавить пустое состояние: если `categories` пусто — показывать текст «No transactions for this period» вместо списка; карточки в этом случае отображают $0. **[Agent: react-frontend]**
- [x] Открыть `/dashboard` в браузере с реальными данными. Проверить: категории видны, отсортированы по убыванию суммы, прогресс-бары корректны. Нажать на категорию — открывается её детальная страница. Переключиться на месяц без транзакций — видно пустое состояние и нули в карточках. **[Agent: react-frontend]**

---

## Slice 6: E2E-тесты

- [x] Создать `frontend/tests/dashboard.spec.ts` с тестами: (1) текущий месяц по умолчанию, (2) переключение `‹`/`›` обновляет заголовок и данные, (3) кнопка «Today» появляется/скрывается, (4) пустой период показывает нули и сообщение, (5) клик по категории открывает детальную страницу, (6) `BottomNav` присутствует на `/` и `/dashboard` с подсветкой активного таба. **[Agent: qa-testing]**
- [x] Запустить `cd frontend && npx playwright test tests/dashboard.spec.ts --reporter=list`. Все тесты зелёные. **[Agent: qa-testing]**
