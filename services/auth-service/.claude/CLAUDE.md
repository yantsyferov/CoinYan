# Auth Service — Claude Code Instructions

## Launch & Test Commands

Start all infrastructure and the service via Docker Compose from the project root:

```bash
docker-compose up -d
```

The auth-service container runs Uvicorn on port 8000. The service reads its configuration
from environment variables; a `.env` file (or compose environment block) must supply:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | yes | — | asyncpg DSN for auth-db (e.g. `postgresql+asyncpg://...`) |
| `REDIS_URL` | yes | — | Redis DSN (e.g. `redis://redis:6379/0`) |
| `JWT_SECRET` | yes | — | HS256 signing key for access tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | `15` | Access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | no | `30` | Refresh token TTL (stored in Redis) |
| `RESEND_API_KEY` | yes | — | Resend transactional email key |
| `EMAIL_FROM` | yes | — | Sender address for password-reset and email-change emails |
| `FRONTEND_BASE_URL` | yes | — | Used to build reset/confirm links (e.g. `http://localhost:5173`) |
| `SENTRY_DSN` | no | `""` | Sentry DSN; leave empty to disable Sentry |

Run tests inside the running container (asyncio_mode = auto, no manual event loop setup needed):

```bash
docker-compose exec auth-service pytest
```

Run a single test file in isolation:

```bash
docker-compose exec auth-service pytest tests/<file>.py -v
```

Apply pending Alembic migrations (runs automatically on container start via entrypoint, but
can also be run manually):

```bash
docker-compose exec auth-service alembic upgrade head
```

## Architecture Overview

Auth-service is the single source of truth for user identity in CoinYan. It owns the
`auth-db` PostgreSQL database and a dedicated Redis keyspace. No other service writes to
`auth-db` or to the `auth:*` Redis keys.

**Responsibilities:**
- User registration — creates the `users` row, issues access + refresh tokens
- Login — verifies bcrypt password, issues access + refresh tokens, enforces account
  lockout after 5 consecutive failures (15-minute Redis-backed lockout)
- Token refresh — validates the refresh JTI from the HttpOnly cookie, rotates it
  (old JTI revoked, new JTI stored), returns a new access token
- Logout — revokes the refresh JTI in Redis and clears the cookie
- Forgot/reset password — generates a `secrets.token_urlsafe(32)` token, stores it in
  Redis with a 1-hour TTL (`auth:pwd_reset:{token}`), sends the reset link via Resend;
  single-use enforcement: token deleted before applying the new hash
- Email change — stores a 24-hour confirmation token in Redis
  (`auth:email_change:{token}`), sets `pending_email` on the user row, sends confirmation
  to the new address and a security alert to the old address; token is deleted on confirm
- Profile update — `PATCH /internal/auth/me/profile` updates `display_name` and/or
  `base_currency`
- Password change — `POST /internal/auth/me/change-password` verifies current password
  before applying the new hash

**Redis key schema:**

| Key pattern | TTL | Holds |
|---|---|---|
| `auth:refresh:{user_id}:{jti}` | `REFRESH_TOKEN_EXPIRE_DAYS` × 86400 s | forward lookup marker |
| `auth:refresh_lookup:{jti}` | same | reverse JTI → user_id lookup |
| `auth:pwd_reset:{token}` | 3600 s | user_id bound to reset token |
| `auth:email_change:{token}` | 86400 s | `user_id:new_email` bound to confirm token |
| `auth:login_attempts:{email}` | 900 s | failed login counter |
| `auth:locked:{email}` | 900 s | account lockout flag |

**Port:** 8000 (internal Docker network: `auth-service:8000`)

**Called by:** web-bff only. All routes are prefixed `/internal/auth` and are not exposed
directly to the public internet.

**External dependencies:**
- `auth-db` — PostgreSQL; sole database for this service
- Redis — token registry, lockout state (shared Redis instance, isolated by key prefix)
- Resend API — transactional email delivery (password reset, email change confirmation/alert)
- Sentry (optional) — error tracking

## Rules and Conventions

**Async SQLAlchemy — always use async patterns:**
- Engine: `create_async_engine` with `pool_pre_ping=True`
- Sessions: `async_sessionmaker` with `expire_on_commit=False`; sessions yielded via
  `get_db()` dependency
- All queries use `await session.execute(select(...))` — never synchronous `.query()`
- `session.flush()` after mutations inside repository methods; `session.commit()` called
  once at the router level after all mutations for a request are complete
- Never call `session.commit()` inside a repository method — commit ownership belongs to
  the router

**Pydantic v2 for all schemas:**
- Every request body and response body is a Pydantic `BaseModel` in `app/schemas/auth.py`
- ORM responses use `model_config = ConfigDict(from_attributes=True)`
- Input validators use `@field_validator` (Pydantic v2 API — never the v1 `@validator`)
- `ValueError` raised in a validator produces a 422 response; keep messages user-readable
- Never annotate a field `Optional[X]` — use `X | None` (Python 3.10+ union syntax)

**Alembic for every schema change — no manual ALTER TABLE:**
- One migration history for `auth-db`; all migration files live in `alembic/versions/`
- Filename convention: `YYYY-MM-DD_<description>.py` (e.g.
  `2026-05-16_create_users_table.py`)
- After changing any SQLAlchemy model, generate a migration:
  `alembic revision --autogenerate -m "<description>"`, then review the generated file
  before committing
- Never run raw `ALTER TABLE` against the database by hand

**Router files map 1-to-1 with domain resources:**
- `app/routers/auth.py` — all authentication and profile endpoints
- `app/routers/health.py` — `/health` liveness/readiness probe only
- Business logic goes in `app/services/` or `app/repositories/`; router functions stay thin
- Every endpoint must declare `response_model`, `status_code`, `summary`, and `description`

**Security — non-negotiable:**
- Never log JWT secrets, raw token strings, or password hashes; use Loguru structured JSON
  logging (`logger.info`, `logger.warning`) but redact sensitive fields
- Passwords are always hashed with bcrypt (`hash_password` / `verify_password` in
  `app/core/security.py`); plain text or weaker algorithms (MD5, SHA-1) are forbidden
- Access tokens are HS256 JWTs signed with `JWT_SECRET`; the algorithm is fixed — do not
  make it configurable via request parameters
- Password reset and email-change tokens are single-use: the Redis key is deleted
  immediately before applying any state change
- All authenticated endpoints extract the user identity via the `get_current_user_id`
  dependency — never trust a user-supplied `user_id` field in request bodies for
  authenticated operations

**Logging and error tracking:**
- Loguru is configured in `app/main.py` with `serialize=True` (structured JSON to stdout)
- Sentry is initialized conditionally on `settings.SENTRY_DSN`; `traces_sample_rate=0.1`
- Do not mix `logging` and `loguru` in the same module — `email_service.py` uses stdlib
  `logging` for warnings; all other modules use Loguru

## Key Files and Structure

```
services/auth-service/
├── app/
│   ├── main.py                   # FastAPI app factory; mounts routers; initialises Loguru + Sentry
│   ├── config.py                 # pydantic-settings Settings class; all env vars declared here
│   ├── core/
│   │   ├── dependencies.py       # get_db, get_redis, get_current_user_id FastAPI dependencies;
│   │   │                         #   SQLAlchemy engine + session factory; Redis connection pool
│   │   └── security.py           # hash_password, verify_password (bcrypt); create_access_token,
│   │                             #   decode_access_token (python-jose HS256)
│   ├── models/
│   │   └── user.py               # SQLAlchemy User ORM model (table: users); DeclarativeBase
│   ├── repositories/
│   │   └── user_repo.py          # UserRepository static methods: create_user, get_by_email,
│   │                             #   get_by_id, update_password, update_display_name,
│   │                             #   update_base_currency, update_email, set_pending_email
│   ├── routers/
│   │   ├── auth.py               # All /internal/auth/* endpoints (register, login, logout,
│   │   │                         #   refresh, me, forgot-password, reset-password, change-password,
│   │   │                         #   change-email, confirm-email)
│   │   └── health.py             # GET /health — returns 200 for container probes
│   ├── schemas/
│   │   └── auth.py               # All Pydantic v2 request/response models (RegisterRequest,
│   │                             #   LoginRequest, AuthResponse, UserResponse, RefreshResponse,
│   │                             #   ForgotPasswordRequest, ResetPasswordRequest,
│   │                             #   UpdateProfileRequest, ChangePasswordRequest, ChangeEmailRequest)
│   └── services/
│       ├── email_service.py      # EmailService: send_password_reset, send_email_change_confirmation,
│       │                         #   send_email_change_alert — calls Resend via asyncio.to_thread
│       └── redis_service.py      # RedisService: refresh token registry, password-reset token
│                                 #   registry, email-change token registry, login-attempt
│                                 #   rate limiting and account lockout
├── alembic/
│   ├── env.py                    # Alembic environment; imports SQLAlchemy Base for autogenerate
│   ├── script.py.mako            # Migration file template
│   └── versions/
│       ├── 2026-05-16_create_users_table.py        # Initial users table migration
│       └── 2026-05-28_add_base_currency_to_users.py # Adds base_currency column
├── alembic.ini                   # Alembic config; script_location = alembic
└── pyproject.toml                # Project metadata, dependencies, pytest config (asyncio_mode=auto),
                                  #   ruff lint config (line-length=100, py312 target)
```
