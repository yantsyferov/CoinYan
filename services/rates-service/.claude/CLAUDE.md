# rates-service — Claude Code Instructions

## Launch & Test Commands

**Run integration tests (requires running docker-compose stack):**
```bash
cd services/rates-service && python3 -m pytest tests/test_cache.py -v
```

**Run service locally (outside Docker):**
```bash
cd services/rates-service && uvicorn app.main:app --host 0.0.0.0 --port 8006 --reload
```

**Run via Docker Compose (from repo root):**
```bash
docker-compose up -d rates-service rates-redis
```

**Health check:**
```bash
curl http://localhost:8006/health
```

**Sample rate request:**
```bash
# Live rate (no date = today's UTC date)
curl "http://localhost:8006/internal/rates/rate?from=USD&to=EUR"

# Historical rate
curl "http://localhost:8006/internal/rates/rate?from=USD&to=EUR&date=2024-01-15"
```

The test suite calls a live running service at `http://localhost:8006`. Tests are synchronous (`httpx.get`) and inspect Docker Compose logs for cache-hit log lines — the full `docker-compose` stack must be up before running them.

## Architecture Overview

rates-service is a **stateless, Redis-only** exchange rate cache layer. It has no PostgreSQL database, no ORM, and no Alembic migrations.

**Request flow for `GET /internal/rates/rate`:**

1. Check Redis for key `rate:{from}:{to}:{date}` — return immediately on hit (`stale: false`).
2. On cache miss, call external API to fetch a live rate.
   - Historical dates (before today UTC): Frankfurter API only (`https://api.frankfurter.dev/v1/{date}`).
   - Today's rate: try Open Exchange Rates first (if `OPEN_EXCHANGE_RATES_APP_ID` is set), then fall back to Frankfurter latest (`https://api.frankfurter.dev/v1/latest`).
3. On successful fetch, write to Redis with TTL (1 hour for today's rate, 30 days for historical), return `stale: false`.
4. On API failure, scan Redis for any cached key matching `rate:{from}:{to}:*` (any date) and return it with `stale: true`. If nothing is cached, return `rate: null, stale: true`.

**OXR cross-rate logic:** OXR always uses USD as the base. For non-USD pairs, the service fetches both `from` and `to` rates vs USD and computes the cross-rate as `rates[to] / rates[from]`.

**Same-currency short-circuit:** `from == to` returns `1.0, stale: false` without any Redis or HTTP calls.

**Redis key schema:** `rate:{FROM_CURRENCY}:{TO_CURRENCY}:{YYYY-MM-DD}` (e.g., `rate:USD:EUR:2024-01-15`). Values are JSON-encoded floats.

**TTL contract:**
- Today's rate: 3600 s (1 hour) — rate may change intraday.
- Historical rate: 2592000 s (30 days) — historical rates are immutable.

## Rules and Conventions

- **No database, no migrations.** Do not add PostgreSQL, SQLAlchemy, or Alembic to this service. All state lives in the `rates-redis` Redis instance.
- **Stateless by design.** Each request creates a fresh `redis.asyncio` client via `aioredis.from_url(settings.REDIS_URL)` and closes it in an `async with` block. There is no connection pool or persistent client object — Redis errors are caught, logged as warnings, and degraded gracefully.
- **Do not import across service boundaries.** This service must never import from other CoinYan microservices. It communicates only over HTTP.
- **Async throughout.** All route handlers and Redis/HTTP helpers use `async def` with `await`. Never call blocking I/O on the event loop.
- **HTTP client per request.** `httpx.AsyncClient` is created inside `async with` for each external call (5 s timeout). Do not create a shared module-level client.
- **Graceful degradation is mandatory.** Redis failures must never raise HTTP 5xx to the caller — log as `logger.warning` and fall through to the stale fallback or return `None`. External API failures follow the same pattern.
- **Structured JSON logging.** Use `loguru` configured with `serialize=True` (see `app/main.py`). Log cache hits at `INFO` with the Redis key. Log Redis/API failures at `WARNING` with the exception message. The integration test asserts that log lines contain `"Cache hit for {FROM}/{TO} on {DATE}"` — preserve this exact format.
- **Frankfurter does not support all currency pairs.** USD/UAH and many exotic pairs are not available. The stale-fallback path (returning `stale: true`) is the correct response for unsupported pairs.
- **`date` query param is optional.** Omitting it defaults to today's UTC date (`datetime.now(tz=timezone.utc).date().isoformat()`). Always resolve the date before cache key construction.
- **Response field aliases.** The `RateResponse` model uses `from` and `to` as JSON field names (Python keyword conflict handled via `Field(alias="from", serialization_alias="from")`). The router sets `response_model_by_alias=True`. Do not change this — the web-bff depends on these exact field names.
- **Ruff linting:** line length 100, target Python 3.12, rules `E`, `F`, `I`, `UP`.

## Key Files and Structure

```
services/rates-service/
├── app/
│   ├── main.py              # FastAPI app init, /health endpoint, Loguru JSON setup, router registration
│   ├── config.py            # Pydantic BaseSettings: OPEN_EXCHANGE_RATES_APP_ID, REDIS_URL, PORT
│   ├── routers/
│   │   └── rates.py         # GET /internal/rates/rate — RateResponse schema, 3-step cache/fetch/stale logic
│   └── services/
│       ├── rate_cache.py    # Redis helpers: get_cached_rate, set_cached_rate, get_stale_rate; TTL logic
│       └── rate_fetcher.py  # External API calls: OXR latest, Frankfurter latest + historical; fetch_rate entry point
├── tests/
│   └── test_cache.py        # Integration tests: health smoke, cache-hit log assertion, stale fallback, schema check
├── Dockerfile               # Multi-stage build; exposes 8006; runs as non-root appuser
└── pyproject.toml           # Dependencies: fastapi, uvicorn, httpx, pydantic-settings, redis[asyncio], loguru
```

**Entry point for adding new functionality:**
- New external rate source: add a `_fetch_*` async function in `app/services/rate_fetcher.py` and call it in `fetch_rate()`.
- Change TTL rules: edit `_ttl()` in `app/services/rate_cache.py`.
- Add a new endpoint (e.g., bulk rates): add a new router file under `app/routers/` and register it in `app/main.py`.
- New env var: add a field to `Settings` in `app/config.py`.
