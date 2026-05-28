# Task List: Initial Account Balance Recorded as a Transaction

- **Spec:** `context/spec/012-initial-account-balance-as-transaction/`
- **Status:** Ready

---

## Slice 1 — `transactions-service`: `income_source_id` становится необязательным

После этого слайса: можно создавать income-транзакцию без привязки к источнику дохода. Все существующие flow не затронуты.

- [x] В `services/transactions-service/app/schemas/transaction.py` изменить тип поля `income_source_id` в `CreateTransactionRequest` с `UUID` (обязательное) на `UUID | None = None`. **[Agent: python-backend]**
- [x] Verify: поднять сервисы (`docker-compose up -d`), отправить POST на `/internal/transactions` с `type: "income"` и `income_source_id: null` — ожидать HTTP 201. Затем отправить с заданным `income_source_id` — убедиться, что старый flow тоже работает. **[Agent: qa-testing]**

---

## Slice 2 — `accounts-service` + `web-bff`: атомарный переход

После этого слайса: создание счёта со стартовым балансом автоматически порождает income-транзакцию и корректно поднимает `current_balance`.

- [x] В `services/accounts-service/app/repositories/account_repo.py` изменить инициализацию `current_balance` с `starting_balance` на `Decimal("0")`. Поле `starting_balance` остаётся для справки. **[Agent: python-backend]**
- [x] В `services/web-bff/app/schema.py` обновить резолвер `create_account`: после создания счёта, если `starting_balance > 0` — вызвать `POST /internal/transactions` с `type: "income"`, `income_source_id: null`, `note: "Initial balance"` и затем `_adjust_balance(+starting_balance)`. Если `starting_balance` равен 0 или не передан — дополнительных вызовов нет. **[Agent: python-backend]**
- [x] Verify: пересобрать оба контейнера, создать тестовый счёт через GraphQL мутацию `createAccount` с `startingBalance: 500` — убедиться, что (a) `currentBalance` = 500, (b) в истории счёта есть запись "$500 / Initial balance", (c) дашборд за текущий месяц включает эти $500. Также создать счёт без стартового баланса — убедиться, что транзакция не создаётся. **[Agent: qa-testing]**

---

## Slice 3 — Playwright E2E тест

После этого слайса: фича покрыта автотестом, регрессии проверены.

- [x] Написать Playwright тест `frontend/tests/account-initial-balance-as-transaction.spec.ts`, покрывающий: (a) создать счёт с $500 → в истории счёта появилась запись "Initial balance" на $500; (b) дашборд за текущий месяц отражает $500 в Account Balance; (c) создать счёт без стартового баланса → история счёта пуста. **[Agent: qa-testing]**
- [x] Запустить полный Playwright suite, убедиться, что все тесты проходят и регрессий нет. **[Agent: qa-testing]**
