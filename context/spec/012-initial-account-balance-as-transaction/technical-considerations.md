# Technical Specification: Initial Account Balance Recorded as a Transaction

- **Functional Specification:** `context/spec/012-initial-account-balance-as-transaction/functional-spec.md`
- **Status:** Completed
- **Author(s):** yantsyferov

---

## 1. High-Level Technical Approach

Три слоя, минимальные изменения. Никаких новых сервисов, никаких миграций схемы БД.

1. **`transactions-service`** — сделать `income_source_id` необязательным полем для income-транзакций (сейчас он обязателен). Это позволяет создавать стартовый баланс без привязки к источнику дохода.
2. **`accounts-service`** — инициализировать `current_balance = 0` при создании счёта (вместо `starting_balance`). BFF будет поднимать баланс через стандартный механизм `_adjust_balance`, как и для всех остальных транзакций.
3. **`web-bff`** — после создания счёта, если `starting_balance > 0`, создать income-транзакцию в transactions-service и вызвать `_adjust_balance`. Вся логика оркестрации — в BFF, в соответствии с существующим паттерном.
4. **Frontend** — изменений не требуется. `startingBalance` уже передаётся в мутации, а Apollo refetch подхватит обновлённое состояние.

---

## 2. Proposed Solution & Implementation Plan

### 2.1 `transactions-service` — `income_source_id` становится необязательным

**Файл:** `services/transactions-service/app/schemas/transaction.py`

| Поле | До | После |
|---|---|---|
| `income_source_id` в `CreateTransactionRequest` | `UUID` (обязательное) | `UUID \| None = None` |

Только это поле меняется. Все существующие flow (createIncomeTransaction из BFF) по-прежнему передают `income_source_id` — изменение обратно совместимо.

---

### 2.2 `accounts-service` — `current_balance` инициализируется нулём

**Файл:** `services/accounts-service/app/repositories/account_repo.py` (или `services/account_service.py` — где инициализируется `current_balance`)

| Поле | До | После |
|---|---|---|
| `current_balance` при создании | `= starting_balance` | `= Decimal("0")` |

`starting_balance` по-прежнему сохраняется в своей колонке для справки. Только начальное значение `current_balance` меняется — дальше им управляет BFF через `_adjust_balance`.

> Существующие счета не затрагиваются: их `current_balance` поддерживается дельта-механизмом и не пересчитывается.

---

### 2.3 `web-bff` — оркестрация в `create_account` резолвере

**Файл:** `services/web-bff/app/schema.py`

Логика `create_account` мутации после изменений:

| Шаг | Действие |
|---|---|
| 1 | `POST /internal/accounts` — создать счёт (current_balance теперь = 0) |
| 2 | Если `starting_balance > 0`: `POST /internal/transactions` с полями ниже |
| 3 | Если `starting_balance > 0`: вызвать `_adjust_balance(user_id, account_id, +starting_balance)` |
| 4 | Вернуть обновлённый объект счёта |

Параметры транзакции на шаге 2:

| Поле | Значение |
|---|---|
| `type` | `"income"` |
| `amount` | `starting_balance` |
| `account_amount` | `starting_balance` |
| `account_currency` | валюта нового счёта |
| `exchange_rate` | `1.0` |
| `account_id` | ID нового счёта |
| `income_source_id` | `null` |
| `note` | `"Initial balance"` |

Если `starting_balance` равен 0 или не передан — шаги 2 и 3 пропускаются. Поведение идентично текущему для счетов без стартового баланса.

---

### 2.4 Frontend — без изменений

Мутация `createAccount` уже отправляет `startingBalance`. После успеха Apollo перезапрашивает `ACCOUNTS_QUERY` — список счетов обновляется с правильным `currentBalance`. При переходе на страницу счёта `AccountDetailPage` использует `fetchPolicy: cache-and-network`, поэтому автоматически подтянет созданную транзакцию.

---

## 3. Impact and Risk Analysis

**System dependencies:**
- BFF теперь делает до двух дополнительных HTTP-вызовов при создании счёта (transactions-service + accounts-service balance). Это соответствует паттерну всех существующих income-транзакций — никаких архитектурных изменений.
- `accounts-service` перестаёт быть единственным источником правды для начального баланса счёта. `current_balance` всегда управляется через `_adjust_balance`.

**Potential risks and mitigations:**

| Риск | Митигация |
|---|---|
| Существующие счета с `starting_balance > 0` не имеют транзакции — расхождение остаётся для старых данных | Явно вне скоупа этой спеки. Отдельная задача по миграции данных при необходимости. |
| Если BFF создал транзакцию, но `_adjust_balance` упал — balance = 0, транзакция существует | Использовать тот же error-handling паттерн, что и в существующих income-транзакциях. Пограничный кейс, существующий уже сейчас. |
| `income_source_id = null` в income-транзакции — такие записи не появятся ни в одном income source | Ожидаемое поведение: стартовый баланс не относится ни к одному источнику дохода. |

---

## 4. Testing Strategy

**`transactions-service`:**
- Income-транзакция с `income_source_id = null` принимается (HTTP 201)
- Income-транзакция с заданным `income_source_id` по-прежнему работает

**`web-bff` (integration):**
- `createAccount` с `starting_balance = 500` → транзакция создана, `current_balance = 500`
- `createAccount` с `starting_balance = 0` → транзакция не создана, `current_balance = 0`
- `createAccount` без `starting_balance` → транзакция не создана, `current_balance = 0`

**E2E (Playwright):**
- Создать счёт "Savings" с $500 → в истории счёта появилась одна запись "$500 / Initial balance"
- Открыть дашборд → Account Balance включает $500
- Отменить транзакцию "Initial balance" → баланс счёта = $0, дашборд уменьшился на $500
