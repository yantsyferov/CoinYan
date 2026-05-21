# Technical Specification: User Account Essentials

- **Functional Specification:** `context/spec/001-user-account-essentials/functional-spec.md`
- **Status:** Completed
- **Author(s):** CoinYan Team

---

## 1. High-Level Technical Approach

This feature introduces `auth-service` — a new, standalone FastAPI microservice with its own dedicated PostgreSQL database (`auth-db`). It is responsible for the complete user identity lifecycle: registration, authentication, password reset, and profile management.

The **Web BFF** (FastAPI + Strawberry) exposes all auth operations as GraphQL mutations and one query to the React frontend. Internally, the BFF translates these into REST calls to `auth-service`.

The **React frontend** manages sessions with an in-memory access token (not persisted to disk) and an httpOnly cookie for the long-lived refresh token.

**Systems affected:** `auth-service` (new), `web-bff` (new GraphQL schema additions), `auth-db` (new PostgreSQL database), Redis (shared, for rate limiting and token management), React frontend (new pages and auth state management).

---

## 2. Proposed Solution & Implementation Plan

### 2.1 Data Model — `auth-db`

**Table: `users`**

| Column | Type | Constraints | Purpose |
|---|---|---|---|
| `id` | UUID | PK, auto-generated | Unique user identifier across all services |
| `display_name` | TEXT | NOT NULL | Name shown throughout the app |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Primary login identifier (stored lowercase) |
| `password_hash` | TEXT | NOT NULL | bcrypt hash of the user's password |
| `pending_email` | VARCHAR(255) | NULLABLE | New email awaiting confirmation; null if no change is pending |
| `is_active` | BOOLEAN | DEFAULT TRUE | Account status flag (reserved for future soft-deletion) |
| `created_at` | TIMESTAMPTZ | NOT NULL | Set on insert |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Auto-updated on every modification |

Managed via SQLAlchemy async ORM + Alembic migrations.

---

### 2.2 Redis Key Patterns

| Key Pattern | Value | TTL | Purpose |
|---|---|---|---|
| `auth:login_attempts:{email}` | Integer counter | 15 min (from first failure) | Tracks consecutive sign-in failures |
| `auth:locked:{email}` | `"1"` | 15 min | Account lockout flag; absence = unlocked |
| `auth:refresh:{user_id}:{jti}` | `"1"` | 30 days | Valid refresh token registry; deleted on sign-out |
| `auth:pwd_reset:{token}` | `user_id` | 1 hour | Single-use password reset token |
| `auth:email_change:{token}` | `{user_id}:{new_email}` | 24 hours | Single-use email confirmation token |

---

### 2.3 `auth-service` Internal REST API

All routes are prefixed `/internal/auth` and are not publicly exposed — only the BFF can reach them (enforced at the network/routing level).

**Authentication:**

| Method | Path | Request Body | Response | Notes |
|---|---|---|---|---|
| `POST` | `/register` | `{display_name, email, password}` | `{user, access_token}` + sets refresh cookie | Returns 409 if email exists |
| `POST` | `/login` | `{email, password}` | `{user, access_token}` + sets refresh cookie | Returns 401 on bad credentials; 423 if locked |
| `POST` | `/logout` | — (reads cookie) | `204` | Deletes refresh token JTI from Redis; clears cookie |
| `POST` | `/refresh` | — (reads cookie) | `{access_token}` | Issues new access token; rotates refresh token |

**Password Reset:**

| Method | Path | Request Body | Response | Notes |
|---|---|---|---|---|
| `POST` | `/forgot-password` | `{email}` | `200` always | No leak of email existence |
| `POST` | `/reset-password` | `{token, new_password}` | `{user, access_token}` + sets refresh cookie | 400 if token invalid/expired |

**Profile:**

| Method | Path | Request Body | Response | Notes |
|---|---|---|---|---|
| `GET` | `/me` | — | `{id, display_name, email, pending_email, created_at}` | Requires valid access token |
| `PATCH` | `/me/profile` | `{display_name}` | `{user}` | Display name update |
| `POST` | `/me/change-email` | `{new_email}` | `200` | Sends confirmation to new email + alert to old email |
| `GET` | `/confirm-email` | `?token=xxx` | `{user}` | Applies pending email change; invalidates token |
| `POST` | `/me/change-password` | `{current_password, new_password}` | `200` | 401 if current password wrong; other sessions stay active |

Token strategy: access tokens are short-lived JWTs (15-minute expiry), signed with HS256 using a secret from environment config. Refresh tokens are opaque UUIDs stored in Redis. Each refresh token includes a JTI (JWT ID) for per-token revocation.

---

### 2.4 Web BFF — GraphQL Schema Additions

**Mutations:**

```graphql
signUp(input: SignUpInput!): AuthPayload!
signIn(input: SignInInput!): AuthPayload!
signOut: Boolean!
forgotPassword(email: String!): Boolean!
resetPassword(input: ResetPasswordInput!): AuthPayload!
updateProfile(input: UpdateProfileInput!): User!
changeEmail(newEmail: String!): Boolean!
changePassword(input: ChangePasswordInput!): Boolean!
```

**Query:**

```graphql
me: User
```

**Types:**

```graphql
type User {
  id: ID!
  displayName: String!
  email: String!
  pendingEmail: String
  createdAt: String!
}

type AuthPayload {
  accessToken: String!
  user: User!
}

input SignUpInput    { displayName: String!, email: String!, password: String! }
input SignInInput    { email: String!, password: String! }
input ResetPasswordInput  { token: String!, newPassword: String! }
input UpdateProfileInput  { displayName: String! }
input ChangePasswordInput { currentPassword: String!, newPassword: String! }
```

The BFF forwards the httpOnly refresh cookie to `auth-service` on `signOut` and `refresh` operations using server-side cookie forwarding (not exposed to the browser).

---

### 2.5 Frontend Structure (FSD)

**Pages (routes):**

| Route | Page | Auth required |
|---|---|---|
| `/sign-up` | `SignUpPage` | No |
| `/sign-in` | `SignInPage` | No |
| `/forgot-password` | `ForgotPasswordPage` | No |
| `/reset-password?token=…` | `ResetPasswordPage` | No |
| `/profile` | `ProfilePage` | Yes |

**FSD layers:**

- `entities/user` — `User` TypeScript type, `useCurrentUser` hook (Apollo `me` query), user context
- `features/auth/sign-up` — sign-up form, `signUp` mutation, redirect on success
- `features/auth/sign-in` — sign-in form, `signIn` mutation, lockout message handling
- `features/auth/forgot-password` — forgot-password form, `forgotPassword` mutation
- `features/auth/reset-password` — reset form, token extraction from URL, `resetPassword` mutation
- `features/profile/edit-name` — display name edit form + `updateProfile` mutation
- `features/profile/change-email` — change email form + `changeEmail` mutation
- `features/profile/change-password` — change password form + `changePassword` mutation
- `shared/api/apollo-client` — Apollo Client instance with auth link and token refresh logic
- `shared/lib/token-store` — in-memory access token store (module-level variable; cleared on page unload)
- `shared/ui` — reusable `PasswordInput` (with inline strength feedback), `FormField`, etc.

**Token lifecycle:**

1. On sign-in / sign-up: BFF returns `accessToken` in the GraphQL response body; refresh token is set as `HttpOnly; SameSite=Strict` cookie by the BFF
2. Apollo auth link attaches `Authorization: Bearer {accessToken}` to every request from the in-memory store
3. On 401 from BFF: Apollo forward link silently calls the `refresh` operation (cookie sent automatically); stores new access token in memory; retries the original request
4. On page reload: in-memory token is lost → Apollo makes a silent refresh call before the first authenticated request
5. On sign-out: in-memory token is cleared; `signOut` mutation tells BFF to invalidate the refresh token and clear the cookie

**Inline password validation:**

- Show requirements checklist (length, uppercase, number) immediately when the password field receives focus
- Validate each rule on `onChange` and mark as met / unmet in real time
- Show "Passwords do not match" on `onBlur` of the confirm-password field (not while typing)

**Default avatar:**

Computed purely in the frontend — display the first character of `user.displayName` (uppercase) in a styled placeholder. No image upload in V1.

---

### 2.6 `auth-service` Project Structure

```
auth-service/
├── app/
│   ├── main.py               # FastAPI app, router registration, lifespan
│   ├── config.py             # Pydantic BaseSettings (env vars)
│   ├── routers/
│   │   ├── auth.py           # All /internal/auth/* endpoints
│   │   └── health.py         # GET /health
│   ├── services/
│   │   ├── auth_service.py   # Core logic: register, login, token issuance
│   │   ├── email_service.py  # Resend API integration
│   │   └── redis_service.py  # Rate-limit counters, token storage
│   ├── repositories/
│   │   └── user_repo.py      # Async SQLAlchemy queries for User
│   ├── models/
│   │   └── user.py           # SQLAlchemy User ORM model
│   ├── schemas/
│   │   └── auth.py           # Pydantic v2 request/response models
│   └── core/
│       ├── security.py       # bcrypt hash/verify, JWT sign/decode
│       └── dependencies.py   # get_current_user, get_db, get_redis FastAPI deps
├── alembic/
│   └── versions/             # Migration scripts
├── Dockerfile
└── pyproject.toml
```

**Required environment variables:**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Async PostgreSQL connection string for auth-db |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | HS256 signing secret (min 256-bit random string) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Default: `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Default: `30` |
| `RESEND_API_KEY` | Resend email API key |
| `EMAIL_FROM` | Sender address for system emails |
| `FRONTEND_BASE_URL` | Used to construct password reset and email confirmation links |

---

## 3. Impact and Risk Analysis

**System Dependencies:**

- `auth-db` (PostgreSQL) must be provisioned before `auth-service` starts
- Redis must be available; rate-limit and token operations depend on it
- Resend API must be reachable for password reset and email confirmation flows
- All other services (`accounts-service`, etc.) will receive the user's UUID from the BFF and must trust it without calling `auth-service` directly

**Potential Risks & Mitigations:**

| Risk | Mitigation |
|---|---|
| Redis unavailable during login | Degrade gracefully: skip lockout check, log the error, allow login to proceed. Never block all users due to a cache failure. |
| JWT secret exposure | Store as environment variable only, never in code or version control. Rotation requires a restart with a new secret — existing tokens become invalid and users must re-authenticate. |
| Email confirmation link replayed | Token is deleted from Redis on first use. Subsequent visits show "Link already used or expired." |
| Timing attack on token comparison | Use `hmac.compare_digest` for all token comparisons to prevent timing-based token guessing. |
| Email enumeration via forgot-password | Always return HTTP 200 with the same message regardless of whether the email exists in the system. |
| Pydantic validation bypass | All input schemas use strict mode; emails are normalised to lowercase before storage and lookup. |

---

## 4. Testing Strategy

- **Unit tests (pytest):** `core/security.py` (bcrypt and JWT functions), `services/auth_service.py` (business logic with mocked repo and Redis), Pydantic schema validation edge cases (empty password, invalid email format)
- **Integration tests (pytest + testcontainers):** Full sign-up → sign-in → token refresh → sign-out flow against a real PostgreSQL and Redis instance; lockout counter increments and auto-unlock after TTL; password reset token issuance and single-use enforcement; email change confirmation flow
- **Frontend tests (Vitest + React Testing Library):** Form validation logic (inline password rules, mismatched confirm, empty fields); redirect behaviour after sign-in and sign-up; lockout message rendering on 423 response; token refresh retry logic in Apollo Link
- **End-to-end (Playwright, future):** Full sign-up through profile-edit golden path in a browser
