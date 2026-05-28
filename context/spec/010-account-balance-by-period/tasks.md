# Tasks: Account Balance by Period on Dashboard

---

## Slice 1: Block future-month navigation (Frontend)

Минимальная видимая ценность — пользователь не может перейти на будущий месяц. Изменения только во фронтенде, сервисы не затронуты.

- [x] В `src/pages/dashboard/DashboardPage.tsx` добавить `disabled={isCurrentMonth}` к кнопке `›` и инлайн-стиль переопределения (`opacity: 0.3`, `cursor: 'not-allowed'`) когда `isCurrentMonth === true`. Базовый `navButtonStyle` не изменять. **[Agent: react-frontend]**
- [x] Добавить атрибут `max` к `<input type="month">` пикеру: значение — текущий месяц в формате `YYYY-MM`, вычисленное из существующей переменной `now`. **[Agent: react-frontend]**
- [x] Открыть `/dashboard` в браузере. Проверить: кнопка `›` выглядит неактивной (приглушённой) и не реагирует на клик. Открыть пикер — убедиться, что месяцы после текущего недоступны для выбора. **[Agent: react-frontend]**

---

## Slice 2: Исторический баланс счетов (Backend + BFF)

Dashboard для прошлых месяцев возвращает корректный исторический баланс.

- [x] В `services/transactions-service/app/repositories/transaction_repo.py` добавить опциональный параметр `after_date: Optional[datetime]` в метод `get_totals`. Когда параметр передан — фильтровать транзакции по `created_at >= after_date` (открытый диапазон без верхней границы). Существующая логика `year`/`month` остаётся без изменений. **[Agent: python-backend]**
- [x] В `services/transactions-service/app/routers/transactions.py` добавить `after_date: Optional[datetime] = Query(None)` к маршруту `GET /internal/transactions/totals` и передать параметр в метод репозитория. Форма ответа (`expense_categories` / `income_sources`) не меняется. **[Agent: python-backend]**
- [x] В `services/web-bff/app/schema.py` обновить резолвер `dashboard(year, month)`: вычислить `end_of_period` (первый момент следующего месяца, с обработкой декабря); если `end_of_period <= now` — выполнить дополнительный вызов `GET /internal/transactions/totals?after_date=<end_of_period>` и применить формулу `historical_total = current_total − income_after + expenses_after`; если текущий месяц — использовать живой баланс как прежде. Обернуть дополнительный вызов в `try/except` с откатом на текущий баланс. **[Agent: python-backend]**
- [x] Пересобрать Docker-образы `transactions-service` и `web-bff` и перезапустить контейнеры. Выполнить GraphQL-запрос `{ dashboard(year: <прошлый год>, month: <прошлый месяц>) { totalAccountBalance } }` и сравнить результат с текущим балансом — значения должны отличаться при наличии транзакций после того месяца. Также проверить: запрос для текущего месяца по-прежнему возвращает текущий баланс. **[Agent: python-backend]**

---

## Slice 3: E2E-тесты

- [x] Обновить `frontend/tests/dashboard.spec.ts`: добавить тест, что кнопка `›` задизейблена на текущем месяце; тест, что атрибут `max` у пикера равен текущему месяцу в формате `YYYY-MM`; тест, что при переключении на прошлый месяц (с известными транзакциями) значение карточки Account Balance отличается от текущего реального баланса. **[Agent: qa-testing]**
- [x] Запустить `cd frontend && npx playwright test tests/dashboard.spec.ts --reporter=list`. Все тесты зелёные. **[Agent: qa-testing]**
